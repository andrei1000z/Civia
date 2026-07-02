/**
 * One-shot: răspuns scurt la feedback-ul „pozele nu se deschid în galerie".
 *   npx tsx scripts/send-feedback-reply.ts <to> [bcc]
 *   ex: npx tsx scripts/send-feedback-reply.ts rhbts3939@gmail.com musateduardandrei10@gmail.com
 */
import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
if (!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY_DEV) {
  process.env.RESEND_API_KEY = process.env.RESEND_API_KEY_DEV;
}

import { sendEmail } from "@/lib/email/resend";

const isEmail = (s?: string) => !!s && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const to = process.argv[2]?.trim();
const bcc = process.argv[3]?.trim();
if (!isEmail(to)) {
  console.log("Utilizare: npx tsx scripts/send-feedback-reply.ts <to> [bcc]");
  process.exit(1);
}

const FROM = "Civia <contact@civia.ro>";
const REPLY_TO = "contact@civia.ro";

const html = `<!DOCTYPE html>
<html lang="ro">
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:#1d1d1f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #e8e8ed;border-radius:18px;padding:30px 32px">
        <tr><td>
          <p style="margin:0 0 13px;font-size:15px;line-height:1.65">Salut,</p>
          <p style="margin:0 0 13px;font-size:15px;line-height:1.65">Mersi pentru semnalare — aveai dreptate, pozele din galerie nu se deschideau cum trebuie la click.</p>
          <p style="margin:0 0 13px;font-size:15px;line-height:1.65"><strong>Am rezolvat.</strong> Ajunge live foarte curând; după update se deschid normal. Poți <a href="https://civia.ro/sesizari/00093" style="color:#059669;text-decoration:none;font-weight:600">reîncerca</a>.</p>
          <p style="margin:0 0 18px;font-size:15px;line-height:1.65">Dacă mai apare ceva, zi-ne.</p>
          <p style="margin:0;font-size:15px;line-height:1.65">Mersi,<br>Echipa Civia</p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:#a1a1a6">civia.ro — platforma civică a României</p>
    </td></tr>
  </table>
</body>
</html>`;

async function main() {
  console.log(`→ Trimit către: ${to}${bcc ? `  (BCC: ${bcc})` : ""}  (from ${FROM})`);
  const res = await sendEmail({
    to,
    ...(isEmail(bcc) ? { bcc } : {}),
    from: FROM,
    replyTo: REPLY_TO,
    subject: "Am rezolvat bug-ul cu pozele de pe Civia",
    html,
  });
  if (res.ok) console.log(`✅ Trimis (id=${res.id})`);
  else { console.log("❌ Eșuat."); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
