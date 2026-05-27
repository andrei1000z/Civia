/**
 * Civia Inbox Email Worker — v3 HARDENED
 * =======================================
 *
 * Runs on Cloudflare Email Routing. When an email arrives at
 * `sesizari@civia.ro` (with optional +CODE plus-addressing), this Worker:
 *
 *   1. Pings /api/inbox/heartbeat (no-auth, proof of receipt)
 *   2. Reads raw email + parses minimal MIME
 *   3. Applies pre-ingest filters (auto-reply, self-forward, mailer-daemon)
 *   4. POSTs to /api/inbox/reply with Bearer auth (only if filters pass)
 *   5. FORWARD la Gmail e CONDIȚIONAT — implicit STOP (user a cerut explicit
 *      2026-05-27: „nu mai imi da FW la nimic"). Reactivează prin
 *      `FORWARD_ENABLED=true` env var.
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
 *   FORWARD_TO       = adresa Gmail (sau gol pentru a opri forward complet)
 *   FORWARD_ENABLED  = "true" pentru a activa forward (default = OFF post 2026-05-27)
 *
 * ⚠️ IMPORTANT: WEBHOOK_URL and HEARTBEAT_URL MUST use `www.civia.ro`
 * (NOT `civia.ro` without www). civia.ro redirects to www.civia.ro with
 * 307 and the redirect drops the Authorization header.
 */

const WORKER_VERSION = "3.0.0";

export default {
  /**
   * Email handler — entry point for inbound emails from Email Routing.
   */
  async email(message, env, ctx) {
    const startMs = Date.now();

    // ─── 0. Validate env config (loud failure if missing) ────────
    if (!env.WEBHOOK_URL || !env.INBOX_WEBHOOK_SECRET) {
      console.error("Missing env: WEBHOOK_URL or INBOX_WEBHOOK_SECRET");
      // 2026-05-27 — NU forward la Gmail nici aici (per user request).
      return;
    }

    // ─── 1. Heartbeat ping (no-auth) ──────────────────────────────
    const heartbeatBody = {
      worker_version: WORKER_VERSION,
      from: message.from || "unknown",
      to: message.to || "unknown",
      received_at: new Date().toISOString(),
    };
    if (env.HEARTBEAT_URL) {
      try {
        await fetch(env.HEARTBEAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": `civia-inbox-worker/${WORKER_VERSION}` },
          body: JSON.stringify(heartbeatBody),
          redirect: "follow",
        });
      } catch (e) {
        console.error("Heartbeat failed:", e?.message ?? e);
      }
    }

    // ─── 2. Read raw email content ───────────────────────────────
    let rawEmail = "";
    try {
      rawEmail = await new Response(message.raw).text();
    } catch (e) {
      console.error("Reading raw email failed:", e?.message ?? e);
      return;
    }

    // ─── 3. Parse minimal MIME ───────────────────────────────────
    const parsed = parseEmail(rawEmail);

    // ─── 3.1. PRE-INGEST FILTERS (v3 hardening) ──────────────────
    // Detect emails care nu trebuie să ajungă în /api/inbox/reply:
    //   - Auto-replies (out-of-office, vacation, confirmare automată)
    //   - Self-forwards (FW: către noi ale propriilor noastre emailuri)
    //   - Mailer daemons (bounce-uri trimite în alt pipeline)
    //   - Loop counter > 3 (anti-bombă infinită)
    const filterReason = preIngestFilter(parsed, message.from || "");
    if (filterReason) {
      // Loghez decizia ca să avem audit, dar NU procesez mai departe.
      if (env.HEARTBEAT_URL) {
        try {
          await fetch(env.HEARTBEAT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": `civia-inbox-worker/${WORKER_VERSION}` },
            body: JSON.stringify({
              phase: "filter-drop",
              reason: filterReason,
              from: message.from || "unknown",
              subject: (parsed.subject || "").slice(0, 200),
              worker_version: WORKER_VERSION,
            }),
          });
        } catch { /* ignore */ }
      }
      // Reject explicit ca să-i spunem upstream că nu acceptăm (decât forward
      // silent care lasă mailul să dispară). Cloudflare acceptă reject().
      try {
        message.setReject(`Filtered by Civia (${filterReason})`);
      } catch {
        /* unele runtime-uri Cloudflare nu permit reject; skip */
      }
      return;
    }

    const payload = {
      from: message.from || parsed.from || "",
      to: message.to || parsed.to || "",
      subject: parsed.subject || "",
      body_text: parsed.text || "",
      body_html: parsed.html || "",
      headers: parsed.headers,
      attachments: parsed.attachments,
      // 2026-05-27 — pasăm explicit Message-ID + In-Reply-To + References
      // pentru dedup la nivel Postgres + threading prin chain RFC 5322 §3.6.4
      message_id: parsed.headers["message-id"] || null,
      in_reply_to: parsed.headers["in-reply-to"] || null,
      references: parsed.headers["references"] || null,
      auth_results: parsed.headers["authentication-results"] || null,
    };

    // ─── 4. POST to webhook with Bearer auth ─────────────────────
    let webhookStatus = 0;
    let webhookBody = "";
    try {
      const res = await fetch(env.WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.INBOX_WEBHOOK_SECRET}`,
          "Content-Type": "application/json",
          "User-Agent": `civia-inbox-worker/${WORKER_VERSION}`,
        },
        body: JSON.stringify(payload),
        redirect: "follow",
      });
      webhookStatus = res.status;
      try { webhookBody = (await res.text()).slice(0, 500); } catch {}
      console.log(`Webhook ${webhookStatus}: ${webhookBody}`);
    } catch (e) {
      console.error("Webhook POST failed:", e?.message ?? e);
      webhookBody = `FETCH_ERROR: ${e?.message ?? e}`;
    }

    // ─── 5. Log result via heartbeat (visibility) ─────────────────
    if (env.HEARTBEAT_URL) {
      try {
        await fetch(env.HEARTBEAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": `civia-inbox-worker/${WORKER_VERSION}` },
          body: JSON.stringify({
            phase: "post-webhook",
            worker_version: WORKER_VERSION,
            webhook_url: env.WEBHOOK_URL,
            webhook_status: webhookStatus,
            webhook_response_preview: webhookBody.slice(0, 200),
            duration_ms: Date.now() - startMs,
          }),
        });
      } catch {}
    }

    // ─── 6. Forward to Gmail — DEZACTIVAT IMPLICIT (2026-05-27) ──
    // User a cerut explicit: „nu mai imi da FW la nimic nimic lasa ma in
    // pace uita de emailul meu". Forward-ul rămâne CODEAT dar gated pe
    // env var explicit `FORWARD_ENABLED=true`. Pentru re-activare ulterioară
    // (e.g. admin debugging), seteaza env var în Cloudflare dashboard.
    if (env.FORWARD_ENABLED === "true" && env.FORWARD_TO) {
      try {
        await message.forward(env.FORWARD_TO);
      } catch (e) {
        console.error("Forward failed:", e?.message ?? e);
      }
    }
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

// ─── PRE-INGEST FILTER (v3) ───────────────────────────────────────

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
  const subject = (parsed.subject || "").toLowerCase();
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
