/**
 * Admin script: retrimite toate sesizarile cu delivery_status=bounced
 *
 * Usage: node scripts/resend-bounced.mjs
 *
 * - Scoate adresele din suppressionlist Resend (daca e cazul)
 * - Retrimite email cu adrese corecte (dupa fix authorities)
 * - Updateaza DB cu noul resend_message_id + delivery_status='sent'
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.local") ? ".env.local" : ".env.vercel.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY_DEV ?? process.env.RESEND_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://civia.ro";

if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_KEY) {
  console.error("❌ Missing env vars");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Supabase exec_sql helper ──────────────────────────────────────────────────
async function execSql(sql) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
    },
    body: JSON.stringify({ sql }),
  });
  if (!r.ok) throw new Error(`exec_sql failed: ${await r.text()}`);
}

// ── Resend helpers ────────────────────────────────────────────────────────────
async function resendApi(path, method = "GET", body) {
  const r = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await r.json();
  return { ok: r.ok, status: r.status, data: json };
}

async function removeFromSuppression(email) {
  const r = await resendApi(`/suppressions/${encodeURIComponent(email)}`, "DELETE");
  return r.ok;
}

async function sendViaResend(params) {
  const r = await resendApi("/emails", "POST", params);
  return r;
}

// ── Rebuilds email HTML ───────────────────────────────────────────────────────
function buildHtml(formalText) {
  const paragraphs = formalText.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const body = paragraphs.map(p =>
    `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>")}</p>`
  ).join("\n");
  return `<!DOCTYPE html><html lang="ro"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:720px;margin:0 auto;padding:24px">${body}</body></html>`;
}

// ── Correct email addresses per authorities fix ───────────────────────────────
// Sesizarile au adrese gresite — le inlocuim cu cele corecte
function fixEmailAddress(email) {
  const fixes = {
    "registratura@primarias1.ro": "registratura@primariasector1.ro",
  };
  return fixes[email] ?? email;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔍 Cautand sesizari cu delivery_status=bounced...\n");

  const { data: bounced, error } = await sb
    .from("sesizari")
    .select("id, code, titlu, author_name, author_email, formal_text, imagini, sent_to_emails, resend_message_id, tip, sector, county, locatie")
    .eq("delivery_status", "bounced")
    .order("created_at", { ascending: true });

  if (error) { console.error("❌ DB error:", error); process.exit(1); }
  if (!bounced?.length) { console.log("✅ Nicio sesizare bounce-uita gasita!"); return; }

  console.log(`Found ${bounced.length} sesizari bounce-uite: ${bounced.map(s => s.code).join(", ")}\n`);

  // Wait for rate limit window to reset before starting
  await new Promise(r => setTimeout(r, 3000));

  for (const ses of bounced) {
    console.log(`\n📧 Procesez ${ses.code} — ${ses.titlu}`);

    // Fix email addresses
    const originalEmails = ses.sent_to_emails ?? [];
    const fixedEmails = originalEmails.map(fixEmailAddress);
    const changed = originalEmails.filter((e, i) => e !== fixedEmails[i]);
    if (changed.length > 0) {
      console.log(`   ✏️  Adrese corectate: ${changed.join(", ")} → ${changed.map(fixEmailAddress).join(", ")}`);
    }

    // Remove all addresses from Resend suppression list
    for (const email of [...new Set([...originalEmails, ...fixedEmails])]) {
      const removed = await removeFromSuppression(email);
      if (removed) console.log(`   🗑️  Scos din suppressions: ${email}`);
    }

    // Separate TO (first 2) and CC (rest) — same logic as original send
    const [primary1, primary2, ...rest] = fixedEmails;
    const toEmails = [primary1, primary2].filter(Boolean);
    const ccEmails = rest.filter(Boolean);

    const formalText = ses.formal_text ?? `Sesizare ${ses.code} — ${ses.titlu}`;
    const html = buildHtml(formalText);

    const attachments = (ses.imagini ?? []).slice(0, 5).map((url, i) => ({
      filename: `${ses.code}-poza-${i + 1}.jpg`,
      path: url,
    }));

    const emailPayload = {
      from: `${ses.author_name} <sesizari@civia.ro>`,
      to: toEmails,
      ...(ccEmails.length > 0 ? { cc: ccEmails } : {}),
      ...(ses.author_email ? { bcc: [ses.author_email] } : {}),
      reply_to: `sesizari+${ses.code}@civia.ro`,
      subject: `[RETRIMITERE] Sesizare ${ses.code} — ${ses.titlu}`,
      html,
      text: formalText,
      ...(attachments.length > 0 ? { attachments } : {}),
    };

    console.log(`   📬 Trimit la: TO=${toEmails.join(", ")} CC=${ccEmails.join(", ")}`);
    const result = await sendViaResend(emailPayload);

    if (!result.ok) {
      console.error(`   ❌ Resend error ${result.status}:`, JSON.stringify(result.data));
      continue;
    }

    const messageId = result.data?.id;
    console.log(`   ✅ Trimis! message_id=${messageId}`);

    // Update DB
    const { error: updateErr } = await sb
      .from("sesizari")
      .update({
        delivery_status: "sent",
        resend_message_id: messageId,
        sent_at: new Date().toISOString(),
        sent_to_emails: [...toEmails, ...ccEmails],
        bounced_at: null,
        bounce_reason: null,
        retry_count: (ses.retry_count ?? 0) + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq("id", ses.id);

    if (updateErr) console.error(`   ⚠️  DB update error:`, updateErr);
    else console.log(`   💾 DB updated — delivery_status=sent`);

    // Insert timeline event
    await sb.from("sesizare_timeline").insert({
      sesizare_id: ses.id,
      event_type: "trimis_via_civia",
      description: `Email RETRIMIS de admin (adrese corectate: ${changed.join(", ") || "nicio modificare"}). Nou message_id: ${messageId}.`,
    });

    // Delay between sends to avoid Resend rate limit (5 req/s)
    await new Promise(r => setTimeout(r, 4000));
  }

  console.log("\n✅ Done! Toate sesizarile bounce-uite au fost retrimise.");
}

main().catch(e => { console.error(e); process.exit(1); });
