/**
 * Civia Inbox Email Worker — v2 SIMPLIFIED
 * =========================================
 *
 * Runs on Cloudflare Email Routing. When an email arrives at
 * `sesizari@civia.ro` (with optional +CODE plus-addressing), this Worker:
 *
 *   1. Pings /api/inbox/heartbeat to prove we received the email (no-auth,
 *      always logs). This way even if main webhook fails, we KNOW the
 *      Worker is firing.
 *   2. Reads the raw email (standard Cloudflare API: new Response(message.raw))
 *   3. Extracts From, To, Subject, body from MIME using a minimal parser
 *   4. POSTs to /api/inbox/reply with Bearer auth + structured payload
 *   5. Forwards the email to FORWARD_TO (Gmail) as a fail-safe so user
 *      ALWAYS sees the email even if Civia processing breaks
 *
 * Deploy:
 *   1. Cloudflare → Workers & Pages → civia-inbox-handler → Edit code
 *   2. Replace EVERYTHING with this file
 *   3. Save and Deploy
 *
 * Required env variables (Settings → Variables and Secrets):
 *   Secret:     INBOX_WEBHOOK_SECRET = <same as Vercel>
 *   Plain text: WEBHOOK_URL = https://www.civia.ro/api/inbox/reply
 *   Plain text: HEARTBEAT_URL = https://www.civia.ro/api/inbox/heartbeat
 *   Plain text: FORWARD_TO = musateduardandrei10@gmail.com
 *
 * ⚠️ IMPORTANT: WEBHOOK_URL and HEARTBEAT_URL MUST use `www.civia.ro`
 * (NOT `civia.ro` without www). civia.ro redirects to www.civia.ro with
 * 307 and the redirect drops the Authorization header.
 */

const WORKER_VERSION = "2.0.0";

export default {
  /**
   * Email handler — entry point for inbound emails from Email Routing.
   */
  async email(message, env, ctx) {
    const startMs = Date.now();

    // ─── 0. Validate env config (loud failure if missing) ────────
    if (!env.WEBHOOK_URL || !env.INBOX_WEBHOOK_SECRET) {
      // Forward to Gmail so user sees the email, but log warning to console.
      console.error("Missing env: WEBHOOK_URL or INBOX_WEBHOOK_SECRET");
      if (env.FORWARD_TO) {
        try { await message.forward(env.FORWARD_TO); } catch {}
      }
      return;
    }

    // ─── 1. Heartbeat ping (no-auth, can never fail meaningfully) ──
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
          // Critical: don't follow redirects manually — let fetch do it.
          // BUT if redirect strips auth, the heartbeat is no-auth anyway
          // so we don't care for this call.
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
      // Forward anyway so user sees it.
      if (env.FORWARD_TO) {
        try { await message.forward(env.FORWARD_TO); } catch {}
      }
      return;
    }

    // ─── 3. Parse minimal MIME ───────────────────────────────────
    const parsed = parseEmail(rawEmail);

    const payload = {
      from: message.from || parsed.from || "",
      to: message.to || parsed.to || "",
      subject: parsed.subject || "",
      body_text: parsed.text || "",
      body_html: parsed.html || "",
      headers: parsed.headers,
      attachments: parsed.attachments,
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
        redirect: "follow", // ⚠️ may drop Authorization if redirected cross-host!
      });
      webhookStatus = res.status;
      try { webhookBody = (await res.text()).slice(0, 500); } catch {}
      console.log(`Webhook ${webhookStatus}: ${webhookBody}`);
    } catch (e) {
      console.error("Webhook POST failed:", e?.message ?? e);
      webhookBody = `FETCH_ERROR: ${e?.message ?? e}`;
    }

    // ─── 5. Log result via heartbeat (so we have visibility) ─────
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

    // ─── 6. ALWAYS forward to Gmail as fail-safe ─────────────────
    if (env.FORWARD_TO) {
      try { await message.forward(env.FORWARD_TO); } catch (e) {
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
        forward_to: env.FORWARD_TO ?? "MISSING",
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
