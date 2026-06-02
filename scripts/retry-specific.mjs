/**
 * Retry specific bounced sesizari (00051, 00053) with corrected addresses.
 * relatiipublice@pmb.ro is suppressed — replaced with sesizari@pmb.ro.
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.local") ? ".env.local" : ".env.vercel.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY_DEV ?? process.env.RESEND_API_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function fixEmails(emails) {
  return emails
    .map(e => e === "registratura@primarias1.ro" ? "registratura@primariasector1.ro" : e)
    .map(e => e === "relatiipublice@pmb.ro" ? "sesizari@pmb.ro" : e)
    .filter((e, i, a) => a.indexOf(e) === i); // dedup
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
  const codes = ["00051", "00053"];
  const { data: sesizari } = await sb
    .from("sesizari")
    .select("id,code,titlu,author_name,author_email,formal_text,imagini,sent_to_emails,delivery_status")
    .in("code", codes);

  for (const ses of sesizari ?? []) {
    if (ses.delivery_status === "delivered") { console.log(`${ses.code}: already delivered, skip`); continue; }

    const fixedEmails = fixEmails(ses.sent_to_emails ?? []);
    const [to1, to2, ...cc] = fixedEmails;
    const toArr = [to1, to2].filter(Boolean);

    console.log(`\n📧 ${ses.code} → TO: ${toArr.join(",")} CC: ${cc.join(",")}`);

    const attachments = (ses.imagini ?? []).slice(0, 5).map((url, i) => ({
      filename: `${ses.code}-poza-${i + 1}.jpg`, path: url,
    }));

    const result = await sendEmail({
      from: `${ses.author_name} <sesizari@civia.ro>`,
      to: toArr,
      ...(cc.length > 0 ? { cc } : {}),
      ...(ses.author_email ? { bcc: [ses.author_email] } : {}),
      reply_to: `sesizari+${ses.code}@civia.ro`,
      subject: `[RETRIMITERE] Sesizare ${ses.code} — ${ses.titlu}`,
      html: buildHtml(ses.formal_text ?? ses.titlu),
      text: ses.formal_text ?? ses.titlu,
      ...(attachments.length > 0 ? { attachments } : {}),
    });

    if (!result.ok) {
      console.error(`   ❌ ${result.status}:`, JSON.stringify(result.data)); continue;
    }

    console.log(`   ✅ Trimis! id=${result.data.id}`);

    await sb.from("sesizari").update({
      delivery_status: "sent",
      resend_message_id: result.data.id,
      sent_at: new Date().toISOString(),
      sent_to_emails: fixedEmails,
      bounced_at: null, bounce_reason: null,
    }).eq("id", ses.id);

    await sb.from("sesizare_timeline").insert({
      sesizare_id: ses.id,
      event_type: "trimis_via_civia",
      description: `Retrimis (relatiipublice@pmb.ro suprimat → sesizari@pmb.ro). message_id: ${result.data.id}`,
    });

    console.log(`   💾 DB updated`);
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log("\n✅ Done");
}

main().catch(e => { console.error(e); process.exit(1); });
