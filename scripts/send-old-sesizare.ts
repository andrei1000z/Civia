/**
 * One-shot: trimite prin Civia sesizări publice rămase NETRIMISE (sent_via_civia
 * = false), pe care fluxul normal nu le poate trimite (>24h + fără sesiune owner).
 * Refolosește EXACT logica din /api/sesizari/[code]/send-via-civia (destinatari,
 * text formal, email, status→trimis, timeline) — rulat server-side ca admin.
 *
 *   npx tsx scripts/send-old-sesizare.ts
 */
import { config } from "dotenv";
import { existsSync } from "fs";
config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });

import { randomUUID } from "crypto";
import { decryptField } from "@/lib/crypto/field";
import { getAuthoritiesFor } from "@/lib/sesizari/authorities";
import { detectCountyFromLocatie } from "@/lib/sesizari/county-from-locatie";
import { buildFormalText } from "@/lib/sesizari/mailto";
import { sendEmail } from "@/lib/email/resend";
import { buildFromHeader } from "@/lib/email/format";
import { replyToAddress, makeReplyToken } from "@/lib/inbox/reply-token";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/sanitize";

// Coduri din argv, ex: `npx tsx scripts/send-old-sesizare.ts 00080 00081`.
const CODES = process.argv.slice(2).filter((c) => /^\d{5}$/.test(c));
if (CODES.length === 0) { console.log("Utilizare: npx tsx scripts/send-old-sesizare.ts <cod> [<cod>...]"); process.exit(0); }

async function main() {
const admin = createSupabaseAdmin();
for (const code of CODES) {
  const { data: sesizare } = await admin.from("sesizari").select("*").eq("code", code).maybeSingle();
  if (!sesizare) { console.log(`${code}: lipsă`); continue; }
  if (sesizare.sent_via_civia) { console.log(`${code}: deja trimisă, sar`); continue; }
  sesizare.author_address = decryptField(sesizare.author_address);
  if (!sesizare.author_name || sesizare.author_name.length < 2) { console.log(`${code}: lipsă nume, sar`); continue; }
  if (!sesizare.author_address || sesizare.author_address.length < 3) { console.log(`${code}: lipsă adresă, sar`); continue; }

  let effectiveCounty = sesizare.county;
  if (!effectiveCounty) effectiveCounty = detectCountyFromLocatie(sesizare.locatie) ?? null;

  const recipients = getAuthoritiesFor(sesizare.tip, sesizare.sector, effectiveCounty, sesizare.locatie, undefined, sesizare.descriere);
  if (!recipients.primary || recipients.primary.length === 0) { console.log(`${code}: fără destinatari, sar`); continue; }

  const formalText = sesizare.formal_text ?? buildFormalText({
    tip: sesizare.tip, titlu: sesizare.titlu, locatie: sesizare.locatie, sector: sesizare.sector,
    descriere: sesizare.descriere ?? "", formal_text: sesizare.formal_text,
    author_name: sesizare.author_name, author_email: sesizare.author_email ?? null,
    author_address: sesizare.author_address ?? null, imagini: sesizare.imagini ?? [], code: sesizare.code,
  });

  const subject = `Sesizare ${sesizare.code} — ${sesizare.titlu}`;
  const paragraphs = formalText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const htmlBody = paragraphs.map((p) => `<p style="margin:0 0 14px 0;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`).join("\n");
  const html = `<!DOCTYPE html><html lang="ro"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;max-width:720px;margin:0 auto;padding:24px;">${htmlBody}</body></html>`;
  const attachments = (sesizare.imagini ?? []).slice(0, 5).map((url: string, i: number) => ({ filename: `${sesizare.code}-poza-${i + 1}.jpg`, path: url }));
  const primaryEmails = recipients.primary.map((a) => a.email).filter(Boolean);
  const ccEmails = (recipients.cc ?? []).map((a) => a.email).filter(Boolean);
  const replyTo = replyToAddress(sesizare.code);
  const outboundMessageId = `<sesizare-${sesizare.code}-${randomUUID().slice(0, 12)}@civia.ro>`;
  const fromHeader = buildFromHeader(sesizare.author_name, "sesizari@civia.ro");
  const userEmail = sesizare.author_email ?? "";

  console.log(`\n${code} „${sesizare.titlu}"`);
  console.log(`  → ${primaryEmails.join(", ")}${ccEmails.length ? "  | CC: " + ccEmails.join(", ") : ""}`);

  const result = await sendEmail({
    to: primaryEmails, cc: ccEmails.length > 0 ? ccEmails : undefined, bcc: userEmail ? [userEmail] : undefined,
    subject, html, text: formalText, replyTo, from: fromHeader,
    headers: { "Message-ID": outboundMessageId }, attachments: attachments.length > 0 ? attachments : undefined,
  });
  if (!result.ok || !result.id) { console.log(`  ❌ EROARE send: ${JSON.stringify(result)}`); continue; }

  const now = new Date().toISOString();
  const { error } = await admin.from("sesizari").update({
    sent_via_civia: true, sent_at: now, sent_to_emails: [...primaryEmails, ...ccEmails],
    resend_message_id: result.id, outbound_message_id: outboundMessageId, reply_token: makeReplyToken(sesizare.code),
    ...(sesizare.status === "nou" ? { status: "trimis" } : {}),
  }).eq("id", sesizare.id);
  if (error) { console.log(`  ⚠️ trimis (id=${result.id}) dar update DB eșuat: ${error.message}`); continue; }

  await appendTimelineEvent({
    admin, sesizareId: sesizare.id, eventType: "trimis_via_civia",
    description: `Email trimis automat de Civia către ${primaryEmails.length} ${primaryEmails.length === 1 ? "autoritate" : "autorități"} oficiale. Așteptăm răspunsul.`,
    createdBy: null,
  });
  console.log(`  ✅ TRIMIS (id=${result.id}) · status→trimis`);
}
console.log("\nGata.");
}
main().catch((e) => { console.error(e); process.exit(1); });
