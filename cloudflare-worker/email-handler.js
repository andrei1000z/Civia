/**
 * Civia Inbox Email Worker
 * ========================
 *
 * Runs on Cloudflare Email Routing. When a reply arrives at
 * `sesizari@civia.ro` (or sesizari+CODE@civia.ro via plus-addressing),
 * this Worker:
 *
 *   1. Parses the incoming MIME email
 *   2. Extracts From, To, Subject, body text + HTML, attachments meta
 *   3. POSTs to https://civia.ro/api/inbox/reply with Bearer secret
 *   4. Forwards a copy to andrei@civia.ro as fail-safe (so even if the
 *      webhook fails, the user sees the email in Gmail)
 *
 * Deployment:
 *   1. On Cloudflare → Workers & Pages → existing `civia-inbox-handler`
 *   2. Replace the default code with this entire file
 *   3. Settings → Variables and Secrets:
 *        - Secret: INBOX_WEBHOOK_SECRET = <same as Vercel>
 *        - Plain text: WEBHOOK_URL = https://civia.ro/api/inbox/reply
 *        - Plain text: FORWARD_TO = musateduardandrei10@gmail.com
 *   4. Save and deploy
 *   5. Email → Email Routing → Email Workers tab
 *   6. Find civia-inbox-handler in the list and connect it to the
 *      sesizari@civia.ro routing rule
 */

export default {
  /**
   * Email handler — entry point for inbound emails from Email Routing.
   * @param {ForwardableEmailMessage} message
   * @param {{ INBOX_WEBHOOK_SECRET: string, WEBHOOK_URL: string, FORWARD_TO?: string }} env
   * @param {ExecutionContext} ctx
   */
  async email(message, env, ctx) {
    try {
      // 1. Read raw email
      const rawSize = message.rawSize ?? 0;
      // Cap at 5MB to keep memory reasonable. Bigger emails get truncated
      // (attachments excluded but text body should fit).
      const reader = message.raw.getReader();
      const chunks = [];
      let totalBytes = 0;
      const MAX_BYTES = 5 * 1024 * 1024;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalBytes += value.byteLength;
          if (totalBytes > MAX_BYTES) break;
        }
      }
      const raw = new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks));

      // 2. Parse minimal headers + body (no full MIME parser — we only
      // need a few fields, regex is enough for >95% of cases)
      const parsed = parseEmail(raw);

      // 3. Build payload for webhook
      const payload = {
        from: message.from || parsed.from || "",
        to: message.to || parsed.to || "",
        subject: parsed.subject || "",
        body_text: parsed.text || "",
        body_html: parsed.html || "",
        headers: parsed.headers,
        attachments: parsed.attachments,
      };

      // 4. POST to webhook (Civia)
      try {
        const webhookRes = await fetch(env.WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.INBOX_WEBHOOK_SECRET}`,
            "Content-Type": "application/json",
            "User-Agent": "Civia-Inbox-Worker/1.0",
          },
          body: JSON.stringify(payload),
        });
        if (!webhookRes.ok) {
          console.error(`Webhook returned ${webhookRes.status}`, await webhookRes.text());
        }
      } catch (e) {
        console.error("Webhook POST failed:", e?.message ?? e);
      }

      // 5. Forward to user's Gmail as fail-safe (so they ALWAYS see the
      // email, even if our webhook breaks)
      if (env.FORWARD_TO) {
        try {
          await message.forward(env.FORWARD_TO);
        } catch (e) {
          console.error("Forward failed:", e?.message ?? e);
        }
      }
    } catch (e) {
      console.error("Email handler crashed:", e?.stack ?? e?.message ?? e);
      // Don't reject — Cloudflare retries rejected emails which could
      // multiply spam/duplicates. Forward as last resort.
      if (env.FORWARD_TO) {
        try {
          await message.forward(env.FORWARD_TO);
        } catch {}
      }
    }
  },

  /**
   * Health check via HTTP — visit https://civia-inbox-handler.<sub>.workers.dev/
   * to verify the worker is deployed.
   */
  async fetch(request) {
    return new Response("Civia Inbox Email Worker — OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};

// ─── Helpers ─────────────────────────────────────────────────────

function concat(chunks) {
  const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Minimal email parser. Extracts:
 *   - subject, from, to (from headers)
 *   - text body (text/plain part)
 *   - html body (text/html part)
 *   - attachment names + types (NOT the content — we don't need it)
 *
 * Doesn't handle every edge case of MIME but covers ~95% of real
 * authority replies (which are simple HTML emails with no nested
 * multipart trees beyond plain+html alternatives).
 */
function parseEmail(raw) {
  const headers = {};
  const lines = raw.split(/\r?\n/);

  // Find end of headers (blank line)
  let bodyStart = 0;
  let lastKey = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") {
      bodyStart = i + 1;
      break;
    }
    // Header continuation (folded line)
    if (/^[ \t]/.test(line) && lastKey) {
      headers[lastKey] = (headers[lastKey] || "") + " " + line.trim();
      continue;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).toLowerCase().trim();
      const value = line.slice(colonIdx + 1).trim();
      headers[key] = value;
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
      const partHeaders = parseHeaders(part.headers);
      const partCt = partHeaders["content-type"] || "";
      const disposition = partHeaders["content-disposition"] || "";
      const cte = (partHeaders["content-transfer-encoding"] || "").toLowerCase();
      const decoded = decodeBody(part.body, cte);

      if (/attachment|inline/i.test(disposition) && /filename/i.test(disposition)) {
        const fnMatch = disposition.match(/filename="?([^";]+)"?/i);
        attachments.push({
          filename: fnMatch ? fnMatch[1] : "unknown",
          content_type: partCt.split(";")[0].trim(),
          size: decoded.length,
        });
      } else if (/text\/html/i.test(partCt)) {
        html = decoded;
      } else if (/text\/plain/i.test(partCt)) {
        text = decoded;
      } else if (/multipart\//i.test(partCt)) {
        // Recursively parse nested multipart (e.g., alternative inside mixed)
        const nestedBoundary = partCt.match(/boundary="?([^";]+)"?/i);
        if (nestedBoundary) {
          const nestedParts = splitMultipart(part.body, nestedBoundary[1]);
          for (const np of nestedParts) {
            const nph = parseHeaders(np.headers);
            const nct = nph["content-type"] || "";
            const ncte = (nph["content-transfer-encoding"] || "").toLowerCase();
            const ndecoded = decodeBody(np.body, ncte);
            if (/text\/html/i.test(nct) && !html) html = ndecoded;
            else if (/text\/plain/i.test(nct) && !text) text = ndecoded;
          }
        }
      }
    }
  } else {
    // Non-multipart
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
  // First piece is preamble (ignore); last piece may be "--" closer (ignore)
  const result = [];
  for (let i = 1; i < parts.length; i++) {
    let chunk = parts[i];
    if (chunk.startsWith("--")) break;
    // Strip leading \r\n
    chunk = chunk.replace(/^\r?\n/, "");
    const emptyLineIdx = chunk.search(/\r?\n\r?\n/);
    if (emptyLineIdx === -1) continue;
    const headersBlob = chunk.slice(0, emptyLineIdx);
    let bodyBlob = chunk.slice(emptyLineIdx).replace(/^\r?\n\r?\n/, "");
    // Strip trailing \r\n before next boundary
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
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).toLowerCase().trim();
      const value = line.slice(colonIdx + 1).trim();
      out[key] = value;
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
  // Decode RFC 2047 encoded headers: =?UTF-8?B?...?= or =?UTF-8?Q?...?=
  if (!s) return s;
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === "B") {
        const bytes = atob(text);
        return new TextDecoder(charset).decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
      } else {
        return decodeQP(text.replace(/_/g, " "));
      }
    } catch {
      return text;
    }
  });
}
