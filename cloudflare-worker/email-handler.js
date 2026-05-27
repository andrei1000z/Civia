/**
 * Civia Inbox Email Worker — v3.1 (fire-and-forget pattern)
 * =========================================================
 *
 * Runs on Cloudflare Email Routing. When an email arrives at
 * `sesizari@civia.ro` (with optional +CODE plus-addressing if Subaddressing
 * is ENABLED in Email Routing settings), this Worker:
 *
 *   1. Reads raw email + parses minimal MIME (SYNC, ~50-200ms)
 *   2. Applies pre-ingest filters (auto-reply, self-forward, mailer-daemon)
 *   3. Fire-and-forget webhook POST via ctx.waitUntil() — no longer blocks
 *      email handler. Reduce wall time de la P99 ~10s la P99 <500ms.
 *   4. Email returnată ca acceptată în <1s; webhook + heartbeat continuă în
 *      background pentru max 30s după return.
 *   5. FORWARD la Gmail DEZACTIVAT (env var FORWARD_TO ștearsă 2026-05-27).
 *
 * Deploy:
 *   1. Cloudflare → Workers & Pages → civia-inbox-handler → Edit code
 *   2. Replace EVERYTHING with this file
 *   3. Save and Deploy
 *
 * Required env variables (Settings → Variables and Secrets):
 *   Secret:     INBOX_WEBHOOK_SECRET = <same as Vercel>
 *   Plain text: WEBHOOK_URL          = https://www.civia.ro/api/inbox/reply
 *   Plain text: HEARTBEAT_URL        = https://www.civia.ro/api/inbox/heartbeat
 *
 * Optional env variables:
 *   FORWARD_TO       = adresa Gmail (default: unset/empty)
 *   FORWARD_ENABLED  = "true" pentru a activa forward (default = OFF)
 *
 * ⚠️ IMPORTANT: WEBHOOK_URL and HEARTBEAT_URL MUST use `www.civia.ro`
 * (NOT `civia.ro` without www). civia.ro redirects to www.civia.ro with
 * 307 and the redirect drops the Authorization header.
 *
 * Manual setup checklist (audit 2026-05-27):
 *   [ ] Email Routing → Settings → Enable Subaddressing ☑ (pentru plus-addr)
 *   [ ] DNS → Add TXT _dmarc record (anti-spoofing)
 *   [ ] Workers → Settings → Variables → DELETE FORWARD_TO (cleanup)
 *   [ ] DNS → Remove send.civia.ro MX + TXT (Amazon SES legacy)
 *   [ ] Workers → Settings → Observability → Enable Traces (debug)
 *   [ ] Email Routing → Catch-All → Send to Worker (audit unknown addresses)
 */

const WORKER_VERSION = "3.1.0";

export default {
  /**
   * Email handler — entry point for inbound emails from Email Routing.
   * Strategy: parse SYNC, network calls ASYNC via ctx.waitUntil().
   */
  async email(message, env, ctx) {
    const startMs = Date.now();

    // ─── 0. Validate env config (loud failure if missing) ────────
    if (!env.WEBHOOK_URL || !env.INBOX_WEBHOOK_SECRET) {
      console.error("Missing env: WEBHOOK_URL or INBOX_WEBHOOK_SECRET");
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
      // Fire-and-forget filter log (audit only, fail doesn't matter)
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

    // ─── 3. Build payload (SYNC) ────────────────────────────────
    const payload = {
      from: message.from || parsed.from || "",
      to: message.to || parsed.to || "",
      subject: parsed.subject || "",
      body_text: parsed.text || "",
      body_html: parsed.html || "",
      headers: parsed.headers,
      attachments: parsed.attachments,
      // RFC 5322 §3.6.4 — Message-ID + threading headers explicit
      message_id: parsed.headers["message-id"] || null,
      in_reply_to: parsed.headers["in-reply-to"] || null,
      references: parsed.headers["references"] || null,
      auth_results: parsed.headers["authentication-results"] || null,
    };

    // ─── 4. Background work via ctx.waitUntil() ──────────────────
    // 2026-05-27 — Cloudflare Workers timeout pe email handlers e ~30s
    // wall time. Async network calls (webhook Vercel cu cold-start 3-7s
    // + heartbeat 1-2s + posibil forward) dădeau P99 ~10s sync.
    //
    // Fix: ctx.waitUntil() keeps worker process alive în background pentru
    // PROMISE-urile pasate, dar email() handler returnează imediat. Email
    // routing treats email as accepted; client (autoritate) primește 250 OK
    // în <500ms în loc de 5-10s.
    //
    // Risk: dacă webhook eșuează, NU putem retry. Acceptat tradeoff — un
    // post-webhook heartbeat ne arată în log dacă webhook s-a făcut sau nu.
    const backgroundWork = (async () => {
      // 4a. Initial heartbeat (prove arrival)
      if (env.HEARTBEAT_URL) {
        await safeFetch(env.HEARTBEAT_URL, {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({
            worker_version: WORKER_VERSION,
            from: message.from || "unknown",
            to: message.to || "unknown",
            received_at: new Date().toISOString(),
          }),
        });
      }

      // 4b. Webhook POST cu Bearer auth
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

      // 4c. Post-webhook heartbeat (visibility)
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
          }),
        });
      }

      // 4d. Optional forward (disabled by default per user request 2026-05-27)
      if (env.FORWARD_ENABLED === "true" && env.FORWARD_TO) {
        try {
          await message.forward(env.FORWARD_TO);
        } catch (e) {
          console.error("Forward failed:", e?.message ?? e);
        }
      }
    })();

    ctx.waitUntil(backgroundWork);
    // Email handler returnează aici cu success — wall time ~50-200ms total
  },

  /**
   * Health check via HTTP — visit Worker's URL to verify deploy.
   */
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

/** Fetch care nu aruncă (best-effort, useful for ctx.waitUntil chains). */
async function safeFetch(url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    console.error("safeFetch error:", e?.message ?? e);
    return null;
  }
}

// ─── PRE-INGEST FILTER ────────────────────────────────────────────

/**
 * Returnează un string cu motivul de filter, sau null dacă mail-ul trece.
 * Filtrele aplicate (în ordine, ieșire la primul match):
 *   1. mailer-daemon / postmaster / noreply senders
 *   2. RFC 3834 Auto-Submitted ≠ no
 *   3. Precedence: bulk|list|junk
 *   4. X-Auto-Response-Suppress (Exchange)
 *   5. Self-forward (body conține mailto:sesizari@civia.ro și subject FW/Fwd)
 *   6. Loop counter X-Civia-Loop-Count >= 3 (anti-bombă)
 *   7. Sender contains civia.ro (echo back)
 */
function preIngestFilter(parsed, msgFrom) {
  const h = parsed.headers || {};
  const fromAddr = String(msgFrom || h.from || "").toLowerCase();

  // 1. Mailer-daemon / bounce
  if (
    /mailer-daemon|postmaster|^noreply@|^no-reply@|bounce[s]?@/i.test(fromAddr) ||
    /<>/.test(h["return-path"] || "")
  ) {
    return "mailer-daemon";
  }

  // 2. RFC 3834 — Auto-Submitted header
  const autoSubmitted = (h["auto-submitted"] || "").toLowerCase().trim();
  if (autoSubmitted && autoSubmitted !== "no") {
    return `auto-submitted:${autoSubmitted}`;
  }

  // 3. Precedence: bulk/list/junk
  const precedence = (h["precedence"] || "").toLowerCase().trim();
  if (/(bulk|list|junk|auto_reply)/.test(precedence)) {
    return `precedence:${precedence}`;
  }

  // 3.1 X-Precedence (variant Exchange/legacy)
  const xPrecedence = (h["x-precedence"] || "").toLowerCase().trim();
  if (/(bulk|list|junk|auto_reply)/.test(xPrecedence)) {
    return `x-precedence:${xPrecedence}`;
  }

  // 4. X-Auto-Response-Suppress (Microsoft Exchange)
  const xAutoSuppress = (h["x-auto-response-suppress"] || "").toLowerCase();
  if (xAutoSuppress && /\b(all|autoreply|oof|dr)\b/.test(xAutoSuppress)) {
    return `x-auto-response-suppress:${xAutoSuppress.slice(0, 40)}`;
  }

  // 4.1 X-Autorespond (used by Exim auto-replies)
  if (h["x-autorespond"]) {
    return "x-autorespond";
  }

  // 4.2 X-Autoreply (cPanel + various)
  if (h["x-autoreply"]) {
    return "x-autoreply";
  }

  // 5. Self-forward (FW/Fwd cu mailto:sesizari@civia.ro în body)
  const body = (parsed.text || parsed.html || "").toLowerCase();
  const isForward = /^(fw|fwd|re:\s*fw|re:\s*fwd):/i.test(parsed.subject || "");
  const containsCiviaMailto = /mailto:sesizari@civia\.ro|sesizari@civia\.ro/i.test(body);
  if (isForward && containsCiviaMailto) {
    return "self-forward";
  }

  // 6. Loop counter
  const loopCount = parseInt(h["x-civia-loop-count"] || "0", 10);
  if (loopCount >= 3) {
    return `loop-count:${loopCount}`;
  }

  // 7. Sender domain == civia.ro (echo back from our own mail)
  if (/@civia\.ro\b/i.test(fromAddr) || /civia\.ro/.test(h["sender"] || "")) {
    return "echo-from-civia";
  }

  // 8. List-Id (newsletter-like — never auto-process)
  if (h["list-id"] || h["list-unsubscribe"]) {
    return "list-message";
  }

  return null; // pass
}

// ─── MIME parsing (minimal but robust) ────────────────────────────

function parseEmail(raw) {
  const headers = {};
  const lines = raw.split(/\r?\n/);
  let bodyStart = 0;
  let lastKey = null;

  // Read headers until blank line
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
      const decoded = decodeBody(part.body, cte);

      if (/attachment|inline/i.test(disp) && /filename/i.test(disp)) {
        const fn = disp.match(/filename="?([^";]+)"?/i);
        attachments.push({
          filename: fn ? fn[1] : "unknown",
          content_type: pct.split(";")[0].trim(),
          size: decoded.length,
        });
      } else if (/text\/html/i.test(pct)) {
        html = decoded;
      } else if (/text\/plain/i.test(pct)) {
        text = decoded;
      } else if (/multipart\//i.test(pct)) {
        const nb = pct.match(/boundary="?([^";]+)"?/i);
        if (nb) {
          const nps = splitMultipart(part.body, nb[1]);
          for (const np of nps) {
            const nph = parseHeaders(np.headers);
            const nct = nph["content-type"] || "";
            const ncte = (nph["content-transfer-encoding"] || "").toLowerCase();
            const nd = decodeBody(np.body, ncte);
            if (/text\/html/i.test(nct) && !html) html = nd;
            else if (/text\/plain/i.test(nct) && !text) text = nd;
          }
        }
      }
    }
  } else {
    const cte = (headers["content-transfer-encoding"] || "").toLowerCase();
    const decoded = decodeBody(body, cte);
    if (/text\/html/i.test(contentType)) html = decoded;
    else text = decoded;
  }

  return { subject, from, to, text, html, headers, attachments };
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

function decodeBody(body, encoding) {
  if (encoding === "base64") {
    try { return atob(body.replace(/\s/g, "")); } catch { return body; }
  }
  if (encoding === "quoted-printable") return decodeQP(body);
  return body;
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
