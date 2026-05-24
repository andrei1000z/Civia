// One-shot: send a preview email to demo the new transactional look.
// Usage: npx tsx scripts/send-preview-email.ts
//
// Imports the same helpers production uses so what we ship lives up
// to what gets shown.

import { config } from "dotenv";
import { existsSync } from "fs";
// Prefer the production-pulled env (`vercel env pull
// .env.vercel.local`) when present so the script can hit Resend with
// the same key the live site uses, falling back to local config.
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import {
  sendEmail,
  emailTemplate,
  emailGreeting,
  emailNoteCallout,
  emailStatusPill,
  escapeEmailHtml,
} from "../src/lib/email/resend";
import { buildSalutation } from "../src/lib/email/format";
import { SESIZARE_STATUS_META } from "../src/lib/sesizari/status";

// Pass recipient as CLI arg: `npx tsx scripts/send-preview-email.ts you@example.com`
const TO = process.argv[2];
if (!TO) {
  console.error("Usage: npx tsx scripts/send-preview-email.ts <recipient-email>");
  process.exit(1);
}

async function main() {
  // Pretend the recipient is „Ion" so they see the polished greeting
  // path. The salutation helper would otherwise fall through to „Bună!"
  // since the email's local part may contain digits.
  const salutation = buildSalutation({
    fullName: "Ion Popescu",
    email: TO,
    withEmoji: true,
  });

  const status = SESIZARE_STATUS_META["interventie"];
  const sesizareCode = "00004";
  const sesizareTitle = "Mașini parcate pe trotuarul Șoselei Morarilor";

  const body = `
    ${emailGreeting(
      salutation,
      `Acesta e un email de previzualizare al noului design transacțional Civia. Imaginea de mai jos arată cum apare, în Gmail / Outlook / Apple Mail, schimbarea de status pe o sesizare reală.`,
    )}

    <p style="margin:20px 0 6px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.6px;font-weight:600">Status nou aplicat</p>
    <p style="margin:0 0 16px">${emailStatusPill({
      label: status.label,
      emoji: status.emoji,
      color: status.color,
    })}</p>

    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0f172a"><strong>${escapeEmailHtml(sesizareTitle)}</strong></p>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#334155">
      Sesizarea <strong>${escapeEmailHtml(sesizareCode)}</strong> a primit
      o intervenție în teren. Detalii mai jos.
    </p>

    ${emailNoteCallout({
      label: "Notă admin",
      text: "Echipa Brigăzii Rutiere a montat 8 stâlpișori anti-parcare pe trotuar. Acțiunea a fost confirmată cu fotografie de pe teren la 30.04.2026, ora 19:45.",
      tone: "primary",
    })}

    ${emailNoteCallout({
      label: "Update raportat de comunitate",
      text: "Cetățeanul a confirmat intervenția cu o poză din locație. Ticketul #017 a fost aprobat cu încredere ridicată.",
      tone: "muted",
    })}

    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b">
      Apasă butonul de mai jos ca să vezi sesizarea pe Civia. Toate
      acțiunile (vot, comentarii, propuneri de status) sunt acum mai
      bine integrate.
    </p>
  `;

  const html = emailTemplate({
    title: status.label,
    preheader:
      "Preview al noului design pentru email-urile transacționale Civia. Salutare curată, status pill, callout-uri.",
    kicker: "PREVIEW · DESIGN EMAIL",
    icon: status.emoji,
    body,
    ctaText: "Vezi sesizarea",
    ctaUrl: "https://civia.ro/sesizari/00004",
  });

  console.log(`▶ Sending preview to ${TO}...`);
  const ok = await sendEmail({
    to: TO,
    subject: `${status.emoji} Preview design email · Civia`,
    html,
  });

  if (ok) {
    console.log("✓ Trimis. Verifică inbox-ul (poate fi și în Promotions).");
  } else {
    console.error("✗ Resend a returnat un eșec. Verifică RESEND_API_KEY în .env.local.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
