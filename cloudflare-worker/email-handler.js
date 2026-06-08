/**
 * Civia Inbox Email Worker — v4.0 (R2 attachment upload)
 * =======================================================
 *
 * Runs on Cloudflare Email Routing. When an email arrives at
 * `sesizari@civia.ro` (with optional +CODE plus-addressing if Subaddressing
 * is ENABLED in Email Routing settings), this Worker:
 *
 *   1. Reads raw email + parses MIME (SYNC, ~50-200ms)
 *   2. Applies pre-ingest filters (auto-reply, self-forward, mailer-daemon)
 *   3. Uploads each attachment to R2 bucket civia-inbox-attachments
 *   4. Fire-and-forget webhook POST cu r2_keys via ctx.waitUntil()
 *   5. Email returnată ca acceptată în <1s
 *
 * NEW v4 (2026-05-27): R2 attachment upload pentru AI extraction
 *   - Atașamentele (PDF, DOCX, JPG, PNG) sunt uploadate în R2 bucket
 *     civia-inbox-attachments cu cheie attachments/{YYYY-MM-DD}/{uuid}-{filename}
 *   - Payload-ul webhook include r2_key per attachment → backend
 *     fetch-uiește bytes pentru extracție text (unpdf, Gemini Vision, mammoth)
 *   - R2 binding: CIVIA_INBOX_R2 (configurat în Settings → Bindings)
 *   - Lifecycle: obiecte > 90 zile auto-delete (configurat în R2 bucket settings)
 *
 * Deploy:
 *   1. Cloudflare → Workers & Pages → civia-inbox-handler → Edit code
 *   2. Replace EVERYTHING with this file
 *   3. Save and Deploy
 *
 * Required bindings (Settings → Bindings):
 *   R2 bucket:  CIVIA_INBOX_R2 → civia-inbox-attachments
 *
 * Required env variables (Settings → Variables and Secrets):
 *   Secret:     INBOX_WEBHOOK_SECRET = <same as Vercel>
 *   Plain text: WEBHOOK_URL          = https://www.civia.ro/api/inbox/reply
 *   Plain text: HEARTBEAT_URL        = https://www.civia.ro/api/inbox/heartbeat
 *
 * ⚠️ IMPORTANT: WEBHOOK_URL and HEARTBEAT_URL MUST use `www.civia.ro`
 * (NOT `civia.ro` without www). civia.ro redirects to www.civia.ro with
 * 307 and the redirect drops the Authorization header.
 */

const WORKER_VERSION = "4.0.0";

// Limite atașamente — protejează R2 cost + Vercel function timeout.
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB total (Cloudflare email limit)
const ACCEPTED_ATTACHMENT_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc (legacy, mammoth can handle some)
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

export default {
  /**
   * Email handler — entry point for inbound emails from Email Routing.
   * Strategy: parse + R2 upload SYNC, webhook network call ASYNC via ctx.waitUntil().
   */
  async email(message, env, ctx) {
    const startMs = Date.now();

    // ─── 0. Validate env config (loud failure if missing) ────────
    if (!env.WEBHOOK_URL || !env.INBOX_WEBHOOK_SECRET) {
      console.error("Missing env: WEBHOOK_URL or INBOX_WEBHOOK_SECRET");
      // audit fix: respinge (bounce) în loc de drop TĂCUT → expeditorul
      // (autoritatea) primește eroare + poate reîncerca, nu pierdem răspunsul.
      try { message.setReject("Civia inbox temporarily unavailable"); } catch {}
      return;
    }

    // ─── 1. Read + parse raw email (SYNC) ────────────────────────
    let rawEmail = "";
    try {
      rawEmail = await new Response(message.raw).text();
    } catch (e) {
      console.error("Reading raw email failed:", e?.message ?? e);
      return;
    }
    const parsed = parseEmail(rawEmail);

    // ─── 2. Pre-ingest filters (SYNC, decision in <1ms) ──────────
    const filterReason = preIngestFilter(parsed, message.from || "");
    if (filterReason) {
      if (env.HEARTBEAT_URL) {
        ctx.waitUntil(
          safeFetch(env.HEARTBEAT_URL, {
            method: "POST",
            headers: jsonHeaders(),
            body: JSON.stringify({
              phase: "filter-drop",
              reason: filterReason,
              from: message.from || "unknown",
              subject: (parsed.subject || "").slice(0, 200),
              worker_version: WORKER_VERSION,
            }),
          }),
        );
      }
      try {
        message.setReject(`Filtered by Civia (${filterReason})`);
      } catch {
        /* runtime may not support reject; skip */
      }
      return;
    }

    // ─── 3. Upload attachments la R2 (SYNC, dar paralel) ─────────
    // 2026-05-27 — Pentru AI extraction backend, avem nevoie de bytes-urile
    // atașamentelor accesibile din Vercel. Upload în R2 bucket privat;
    // backend folosește S3 SDK cu credentials pentru fetch.
    //
    // Key format: attachments/YYYY-MM-DD/uuid-filename
    // (uuid evită collision dacă 2 emailuri au atașamente cu același nume)
    //
    // Filter:
    //   - reject MIME-uri nesuportate (executabile, archives) — log dar nu upload
    //   - reject > 10MB per file (R2 cost guard)
    //   - reject > 25MB total per email (Cloudflare hard limit oricum)
    const attachmentsWithR2 = [];
    let totalSize = 0;

    if (env.CIVIA_INBOX_R2 && parsed.attachments && parsed.attachments.length > 0) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const messageIdShort = (parsed.headers["message-id"] || "")
        .replace(/[<>]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 16) || randomShortId();

      const uploads = parsed.attachments.map(async (att) => {
        const baseMeta = {
          filename: att.filename,
          content_type: att.content_type,
          size: att.size,
        };

        // Filter MIME unsupported (e.g. .exe rebranded ca .pdf cu content-type
        // greșit — backend va detect spoofing via magic bytes; aici filter
        // doar declared MIME ca să evităm upload risipit).
        if (!ACCEPTED_ATTACHMENT_MIMES.some((m) => att.content_type.toLowerCase().includes(m.toLowerCase()))) {
          return { ...baseMeta, r2_key: null, skip_reason: "unsupported-mime" };
        }

        // Size guard (per file).
        if (att.size > MAX_ATTACHMENT_BYTES) {
          return { ...baseMeta, r2_key: null, skip_reason: "too-large" };
        }

        // Total size guard.
        if (totalSize + att.size > MAX_TOTAL_ATTACHMENT_BYTES) {
          return { ...baseMeta, r2_key: null, skip_reason: "total-cap-exceeded" };
        }
        totalSize += att.size;

        // Sanitize filename pentru R2 key (remove path traversal).
        const safeFilename = (att.filename || "unknown")
          .replace(/[\/\\]/g, "_")
          .replace(/[^a-zA-Z0-9._-]/g, "_")
          .slice(0, 100);
        const r2Key = `attachments/${today}/${messageIdShort}-${randomShortId()}-${safeFilename}`;

        try {
          // att.bytes e ArrayBuffer-like (Uint8Array sau string binary).
          // Conversie sigură la Uint8Array pentru R2 put.
          const body = att.bytes instanceof Uint8Array
            ? att.bytes
            : (typeof att.bytes === "string"
                ? Uint8Array.from(att.bytes, (c) => c.charCodeAt(0))
                : new Uint8Array(att.bytes));

          await env.CIVIA_INBOX_R2.put(r2Key, body, {
            httpMetadata: { contentType: att.content_type },
            customMetadata: {
              filename: att.filename || "unknown",
              uploaded_at: new Date().toISOString(),
              worker_version: WORKER_VERSION,
            },
          });
          return { ...baseMeta, r2_key: r2Key };
        } catch (e) {
          console.error(`R2 upload failed for ${att.filename}: ${e?.message ?? e}`);
          return { ...baseMeta, r2_key: null, skip_reason: `r2-error:${(e?.message ?? "unknown").slice(0, 80)}` };
        }
      });

      const results = await Promise.all(uploads);
      attachmentsWithR2.push(...results);
    } else if (parsed.attachments && parsed.attachments.length > 0) {
      // R2 binding lipsește (legacy deploy) — păstrăm metadata only.
      for (const att of parsed.attachments) {
        attachmentsWithR2.push({
          filename: att.filename,
          content_type: att.content_type,
          size: att.size,
          r2_key: null,
          skip_reason: "r2-not-bound",
        });
      }
    }

    // ─── 4. Build payload (SYNC) ────────────────────────────────
    const payload = {
      from: message.from || parsed.from || "",
      to: message.to || parsed.to || "",
      subject: parsed.subject || "",
      body_text: parsed.text || "",
      body_html: parsed.html || "",
      headers: parsed.headers,
      attachments: attachmentsWithR2,
      message_id: parsed.headers["message-id"] || null,
      in_reply_to: parsed.headers["in-reply-to"] || null,
      references: parsed.headers["references"] || null,
      auth_results: parsed.headers["authentication-results"] || null,
    };

    // ─── 5. Background work via ctx.waitUntil() ──────────────────
    const backgroundWork = (async () => {
      if (env.HEARTBEAT_URL) {
        await safeFetch(env.HEARTBEAT_URL, {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({
            worker_version: WORKER_VERSION,
            from: message.from || "unknown",
            to: message.to || "unknown",
            received_at: new Date().toISOString(),
            attachment_count: attachmentsWithR2.length,
            attachments_uploaded: attachmentsWithR2.filter((a) => a.r2_key).length,
          }),
        });
      }

      let webhookStatus = 0;
      let webhookBody = "";
      try {
        const res = await fetch(env.WEBHOOK_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.INBOX_WEBHOOK_SECRET}`,
            "Content-Type": "application/json",
            "User-Agent": `civia-inbox-worker/${WORKER_VERSION}`,
          },
          body: JSON.stringify(payload),
          redirect: "follow",
        });
        webhookStatus = res.status;
        try { webhookBody = (await res.text()).slice(0, 500); } catch {}
      } catch (e) {
        webhookBody = `FETCH_ERROR: ${e?.message ?? e}`;
      }

      if (env.HEARTBEAT_URL) {
        await safeFetch(env.HEARTBEAT_URL, {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({
            phase: "post-webhook",
            worker_version: WORKER_VERSION,
            webhook_url: env.WEBHOOK_URL,
            webhook_status: webhookStatus,
            webhook_response_preview: webhookBody.slice(0, 200),
            duration_ms: Date.now() - startMs,
            attachments: attachmentsWithR2.map((a) => ({
              filename: a.filename,
              r2_key: a.r2_key,
              skip_reason: a.skip_reason ?? null,
            })),
          }),
        });
      }

      // Forward la Gmail dezactivat default.
      if (env.FORWARD_ENABLED === "true" && env.FORWARD_TO) {
        try {
          await message.forward(env.FORWARD_TO);
        } catch (e) {
          console.error("Forward failed:", e?.message ?? e);
        }
      }
    })();

    ctx.waitUntil(backgroundWork);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/__config") {
      return new Response(JSON.stringify({
        version: WORKER_VERSION,
        webhook_url: env.WEBHOOK_URL ?? "MISSING",
        heartbeat_url: env.HEARTBEAT_URL ?? "MISSING",
        forward_to: env.FORWARD_TO ?? "(unset)",
        forward_enabled: env.FORWARD_ENABLED === "true",
        has_secret: !!env.INBOX_WEBHOOK_SECRET,
        has_r2_binding: !!env.CIVIA_INBOX_R2,
      }, null, 2), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return new Response(`Civia Inbox Email Worker v${WORKER_VERSION} — OK`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    "User-Agent": `civia-inbox-worker/${WORKER_VERSION}`,
  };
}

async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    console.error("safeFetch error:", e?.message ?? e);
    return null;
  }
}

function randomShortId() {
  // crypto.randomUUID disponibil în Workers runtime
  return crypto.randomUUID().slice(0, 8);
}

// ─── PRE-INGEST FILTER ────────────────────────────────────────────

function preIngestFilter(parsed, msgFrom) {
  const h = parsed.headers || {};
  const fromAddr = String(msgFrom || h.from || "").toLowerCase();

  if (
    /mailer-daemon|postmaster|^noreply@|^no-reply@|bounce[s]?@/i.test(fromAddr) ||
    /<>/.test(h["return-path"] || "")
  ) {
    return "mailer-daemon";
  }

  const autoSubmitted = (h["auto-submitted"] || "").toLowerCase().trim();
  if (autoSubmitted && autoSubmitted !== "no") {
    return `auto-submitted:${autoSubmitted}`;
  }

  const precedence = (h["precedence"] || "").toLowerCase().trim();
  if (/(bulk|list|junk|auto_reply)/.test(precedence)) {
    return `precedence:${precedence}`;
  }

  const xPrecedence = (h["x-precedence"] || "").toLowerCase().trim();
  if (/(bulk|list|junk|auto_reply)/.test(xPrecedence)) {
    return `x-precedence:${xPrecedence}`;
  }

  const xAutoSuppress = (h["x-auto-response-suppress"] || "").toLowerCase();
  if (xAutoSuppress && /\b(all|autoreply|oof|dr)\b/.test(xAutoSuppress)) {
    return `x-auto-response-suppress:${xAutoSuppress.slice(0, 40)}`;
  }

  if (h["x-autorespond"]) return "x-autorespond";
  if (h["x-autoreply"]) return "x-autoreply";

  const body = (parsed.text || parsed.html || "").toLowerCase();
  const isForward = /^(fw|fwd|re:\s*fw|re:\s*fwd):/i.test(parsed.subject || "");
  const containsCiviaMailto = /mailto:sesizari@civia\.ro|sesizari@civia\.ro/i.test(body);
  if (isForward && containsCiviaMailto) return "self-forward";

  const loopCount = parseInt(h["x-civia-loop-count"] || "0", 10);
  if (loopCount >= 3) return `loop-count:${loopCount}`;

  if (/@civia\.ro\b/i.test(fromAddr) || /civia\.ro/.test(h["sender"] || "")) {
    return "echo-from-civia";
  }

  if (h["list-id"] || h["list-unsubscribe"]) return "list-message";

  return null;
}

// ─── MIME parsing (minimal but robust) ────────────────────────────
//
// 2026-05-27 v4 — Atașamentele acum păstrează BYTES decoded (pentru R2 upload),
// nu doar metadata. parsed.attachments[].bytes = Uint8Array.

function parseEmail(raw) {
  const headers = {};
  const lines = raw.split(/\r?\n/);
  let bodyStart = 0;
  let lastKey = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") { bodyStart = i + 1; break; }
    if (/^[ \t]/.test(line) && lastKey) {
      headers[lastKey] = (headers[lastKey] || "") + " " + line.trim();
      continue;
    }
    const ci = line.indexOf(":");
    if (ci > 0) {
      const key = line.slice(0, ci).toLowerCase().trim();
      headers[key] = line.slice(ci + 1).trim();
      lastKey = key;
    }
  }

  const subject = decodeMime(headers["subject"] || "");
  const from = headers["from"] || "";
  const to = headers["to"] || "";
  const contentType = headers["content-type"] || "";
  const body = lines.slice(bodyStart).join("\n");

  const isMultipart = /multipart\//i.test(contentType);
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);

  let text = "";
  let html = "";
  const attachments = [];

  if (isMultipart && boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = splitMultipart(body, boundary);
    for (const part of parts) {
      const ph = parseHeaders(part.headers);
      const pct = ph["content-type"] || "";
      const disp = ph["content-disposition"] || "";
      const cte = (ph["content-transfer-encoding"] || "").toLowerCase();

      if (/attachment|inline/i.test(disp) && /filename/i.test(disp)) {
        const fn = disp.match(/filename="?([^";]+)"?/i);
        // 2026-05-27 v4 — decodeBinary returnează Uint8Array pentru upload R2
        // (decodeBody veche returna string care strica binary).
        const bytes = decodeBinary(part.body, cte);
        attachments.push({
          filename: fn ? decodeMime(fn[1]) : "unknown",
          content_type: pct.split(";")[0].trim(),
          size: bytes.length,
          bytes, // NEW: bytes decoded pentru upload R2
        });
      } else if (/text\/html/i.test(pct)) {
        html = decodeBody(part.body, cte, charsetOf(pct));
      } else if (/text\/plain/i.test(pct)) {
        text = decodeBody(part.body, cte, charsetOf(pct));
      } else if (/multipart\//i.test(pct)) {
        const nb = pct.match(/boundary="?([^";]+)"?/i);
        if (nb) {
          const nps = splitMultipart(part.body, nb[1]);
          for (const np of nps) {
            const nph = parseHeaders(np.headers);
            const nct = nph["content-type"] || "";
            const ndisp = nph["content-disposition"] || "";
            const ncte = (nph["content-transfer-encoding"] || "").toLowerCase();

            // Nested attachment (rare but happens with .eml forwards)
            if (/attachment|inline/i.test(ndisp) && /filename/i.test(ndisp)) {
              const nfn = ndisp.match(/filename="?([^";]+)"?/i);
              const nbytes = decodeBinary(np.body, ncte);
              attachments.push({
                filename: nfn ? decodeMime(nfn[1]) : "unknown",
                content_type: nct.split(";")[0].trim(),
                size: nbytes.length,
                bytes: nbytes,
              });
            } else if (/text\/html/i.test(nct) && !html) {
              html = decodeBody(np.body, ncte, charsetOf(nct));
            } else if (/text\/plain/i.test(nct) && !text) {
              text = decodeBody(np.body, ncte, charsetOf(nct));
            }
          }
        }
      }
    }
  } else {
    const cte = (headers["content-transfer-encoding"] || "").toLowerCase();
    const decoded = decodeBody(body, cte, charsetOf(contentType));
    if (/text\/html/i.test(contentType)) html = decoded;
    else text = decoded;
  }

  // 2026-05-29 — Fallback: daca text gol dar HTML prezent, derivam text
  // brut din HTML (strip tags). Pentru cazul sector5 unde emailul are
  // multipart/related cu text/html + inline images (logo-uri institutionale)
  // si text/plain lipseste sau e gol. Acum backend-ul primeste body_text
  // garantat ne-gol cand sender a trimis HTML reply (orice primarie).
  if (!text && html) {
    text = stripHtmlBasic(html);
  }

  return { subject, from, to, text, html, headers, attachments };
}

/**
 * Basic HTML→text fallback in Worker (lightweight, no DOM available).
 * Strip tags, decode common entities, normalize whitespace.
 * Used cand text/plain lipseste in multipart/related (cazul sector5).
 */
function stripHtmlBasic(html) {
  if (!html) return "";
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function splitMultipart(body, boundary) {
  const dash = "--" + boundary;
  const parts = body.split(dash);
  const result = [];
  for (let i = 1; i < parts.length; i++) {
    let chunk = parts[i];
    if (chunk.startsWith("--")) break;
    chunk = chunk.replace(/^\r?\n/, "");
    const empty = chunk.search(/\r?\n\r?\n/);
    if (empty === -1) continue;
    const headersBlob = chunk.slice(0, empty);
    let bodyBlob = chunk.slice(empty).replace(/^\r?\n\r?\n/, "");
    bodyBlob = bodyBlob.replace(/\r?\n--?\s*$/, "");
    result.push({ headers: headersBlob, body: bodyBlob });
  }
  return result;
}

function parseHeaders(blob) {
  const out = {};
  const lines = blob.split(/\r?\n/);
  let lastKey = null;
  for (const line of lines) {
    if (/^[ \t]/.test(line) && lastKey) {
      out[lastKey] = (out[lastKey] || "") + " " + line.trim();
      continue;
    }
    const ci = line.indexOf(":");
    if (ci > 0) {
      const key = line.slice(0, ci).toLowerCase().trim();
      out[key] = line.slice(ci + 1).trim();
      lastKey = key;
    }
  }
  return out;
}

/** Extrage charset din Content-Type (default utf-8). */
function charsetOf(contentType) {
  const m = (contentType || "").match(/charset\s*=\s*"?([^"\s;]+)"?/i);
  return m ? m[1].toLowerCase() : "utf-8";
}

/**
 * 2026-06-07 — decodează body TEXT respectând charset-ul.
 * Bug fix mojibake („BunÄ ziua" în loc de „Bună ziua"): înainte base64/QP
 * returnau un string cu bytes Latin-1; byte-urile UTF-8 erau interpretate
 * greșit. Acum reconstruim bytes-ii reali și decodăm cu TextDecoder(charset).
 */
function decodeBody(body, encoding, charset) {
  const cs = charset || "utf-8";
  const toText = (bytes) => {
    try { return new TextDecoder(cs).decode(bytes); }
    catch { try { return new TextDecoder("utf-8").decode(bytes); } catch { return null; } }
  };
  if (encoding === "base64") {
    try {
      const binary = atob(body.replace(/\s/g, ""));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return toText(bytes) ?? binary;
    } catch { return body; }
  }
  if (encoding === "quoted-printable") {
    // Review #3: NU masca cu &0xff — ar distruge literalele Unicode (ș=U+0219,
    // ț=U+021B) rămase ne-encodate de unele webmail-uri. decodeQPToBytes
    // construiește corect octeții: =XX → octet, literal → octeții lui UTF-8.
    return toText(decodeQPToBytes(body)) ?? body;
  }
  // 7bit / 8bit / binary: body e deja string (din .text() UTF-8). Pentru UTF-8
  // (cvasi-totalitatea emailurilor) e corect ca atare. Charset-urile non-UTF-8
  // pe 8bit NU sunt recuperabile aici (octeții bruți s-au pierdut la .text() —
  // vezi review #4; ar necesita citirea raw ca bytes).
  return body;
}

/** QP → octeți reali: „=XX" → octet; caracter literal → octeții lui UTF-8.
 *  Evită coruperea literalelor Unicode (vs vechiul charCodeAt & 0xff). */
function decodeQPToBytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "=") {
      const h = str.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(h)) { out.push(parseInt(h, 16)); i += 2; continue; }
      if (str[i + 1] === "\n") { i += 1; continue; }                        // soft break =\n
      if (str[i + 1] === "\r" && str[i + 2] === "\n") { i += 2; continue; } // soft break =\r\n
      out.push(0x3d); continue;                                              // '=' singular
    }
    const code = ch.charCodeAt(0);
    if (code < 0x80) out.push(code);
    else for (const b of new TextEncoder().encode(ch)) out.push(b);
  }
  return new Uint8Array(out);
}

/**
 * v4 — decodează body BINARY (pentru atașamente) ca Uint8Array.
 * decodeBody veche returna string care strica bytes peste 0x7F (UTF-8 mojibake).
 */
function decodeBinary(body, encoding) {
  if (encoding === "base64") {
    try {
      const binary = atob(body.replace(/\s/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch {
      return new TextEncoder().encode(body);
    }
  }
  if (encoding === "quoted-printable") {
    const decoded = decodeQP(body);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i) & 0xff;
    return bytes;
  }
  // 7bit / 8bit / binary
  return new TextEncoder().encode(body);
}

function decodeQP(str) {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeMime(s) {
  if (!s) return s;
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === "B") {
        const bytes = atob(text);
        return new TextDecoder(charset).decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
      }
      return decodeQP(text.replace(/_/g, " "));
    } catch {
      return text;
    }
  });
}
