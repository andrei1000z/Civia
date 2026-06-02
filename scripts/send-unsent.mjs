/**
 * Admin script: trimite sesizarile nesent (status=nou, sent_via_civia=false)
 * + retrimitere 00057 (bounceat cu adrese vechi).
 *
 * Folosit dupa fixarea county/sector in DB.
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.local") ? ".env.local" : ".env.vercel.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY_DEV ?? process.env.RESEND_API_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// Authorities hardcoded după fix (getAuthoritiesFor nu e importabil direct)
const AUTH_BY_SECTOR = {
  S1: {
    stalpisori: { to: ["sesizari@pmb.ro", "registratura@primariasector1.ro"], cc: ["office@plmb.ro", "office@aspmb.ro"] },
    parcare:    { to: ["bpr@b.politiaromana.ro", "sesizari@pmb.ro"], cc: ["office@plmb.ro", "registratura@primariasector1.ro"] },
    default:    { to: ["sesizari@pmb.ro", "registratura@primariasector1.ro"], cc: ["office@plmb.ro"] },
  },
  S2: {
    stalpisori: { to: ["sesizari@pmb.ro", "infopublice@ps2.ro"], cc: ["office@plmb.ro", "office@aspmb.ro"] },
    parcare:    { to: ["bpr@b.politiaromana.ro", "sesizari@pmb.ro"], cc: ["infopublice@ps2.ro", "office@plmb.ro"] },
    default:    { to: ["sesizari@pmb.ro", "infopublice@ps2.ro"], cc: ["office@plmb.ro"] },
  },
};

function getRecipients(sector, tip) {
  const s = AUTH_BY_SECTOR[sector];
  if (!s) return { to: ["sesizari@pmb.ro"], cc: [] };
  return s[tip] ?? s.default;
}

function buildHtml(text) {
  const paragraphs = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const body = paragraphs.map(p =>
    `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>")}</p>`
  ).join("\n");
  return `<!DOCTYPE html><html lang="ro"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:720px;margin:0 auto;padding:24px">${body}</body></html>`;
}

async function sendEmail(params) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return { ok: r.ok, status: r.status, data: await r.json() };
}

async function main() {
  // Sesizari de trimis: nou+nesent sau bounced
  const { data: sesizari } = await sb
    .from("sesizari")
    .select("id,code,titlu,author_name,author_email,formal_text,imagini,tip,sector,county,status,delivery_status,sent_via_civia")
    .in("code", ["00055","00056","00057"])
    .order("code");

  for (const ses of sesizari ?? []) {
    const isAlreadyDelivered = ses.delivery_status === "delivered";
    if (isAlreadyDelivered) { console.log(`${ses.code}: already delivered, skip`); continue; }

    const recipients = getRecipients(ses.sector, ses.tip);
    const isResend = ses.delivery_status === "bounced" || ses.delivery_status === "delayed";
    const subjectPrefix = isResend ? "[RETRIMITERE] " : "";

    console.log(`\n📧 ${ses.code} (${ses.tip} ${ses.sector}) ${isResend ? "[RETRY]" : "[FIRST SEND]"}`);
    console.log(`   TO: ${recipients.to.join(", ")}`);
    console.log(`   CC: ${recipients.cc.join(", ")}`);

    const formalText = ses.formal_text ?? ses.titlu;
    const attachments = (ses.imagini ?? []).slice(0, 5).map((url, i) => ({
      filename: `${ses.code}-poza-${i + 1}.jpg`, path: url,
    }));

    const result = await sendEmail({
      from: `${ses.author_name} <sesizari@civia.ro>`,
      to: recipients.to,
      ...(recipients.cc.length > 0 ? { cc: recipients.cc } : {}),
      ...(ses.author_email ? { bcc: [ses.author_email] } : {}),
      reply_to: `sesizari+${ses.code}@civia.ro`,
      subject: `${subjectPrefix}Sesizare ${ses.code} — ${ses.titlu}`,
      html: buildHtml(formalText),
      text: formalText,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    if (!result.ok) {
      console.error(`   ❌ ${result.status}:`, JSON.stringify(result.data));
      continue;
    }
    console.log(`   ✅ Trimis! id=${result.data.id}`);

    const now = new Date().toISOString();
    await sb.from("sesizari").update({
      sent_via_civia: true,
      delivery_status: "sent",
      resend_message_id: result.data.id,
      sent_at: now,
      sent_to_emails: [...recipients.to, ...recipients.cc],
      status: "trimis",
      bounced_at: null,
      bounce_reason: null,
    }).eq("id", ses.id);

    await sb.from("sesizare_timeline").insert({
      sesizare_id: ses.id,
      event_type: "trimis_via_civia",
      description: `Email trimis${isResend ? " (retrimitere după bounce/fix adrese)" : ""} la ${recipients.to.join(", ")}. message_id: ${result.data.id}`,
    });
    console.log(`   💾 status=trimis, delivery_status=sent`);
    await new Promise(r => setTimeout(r, 4000));
  }
  console.log("\n✅ Done");
}

main().catch(e => { console.error(e); process.exit(1); });
