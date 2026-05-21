/**
 * Manual fix pentru sesizari unde email-ul real a plecat via Resend dar
 * DB tracking a esuat silent (bug pre-migration 056). Updateaza
 * sent_via_civia + status + sent_at + log timeline ca si cum send-via-
 * civia ar fi terminat corect.
 *
 * Run:
 *   npx tsx scripts/mark-sent.ts <code> [recipient,recipient,...]
 *
 * Default recipients pentru București semafor (00044):
 *   relatiipublice@pmb.ro, primarie@sector5.ro, dispecerat@pmb.ro,
 *   prefectura@prefecturabucu.ro
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error("Usage: npx tsx scripts/mark-sent.ts <code> [emails,csv]");
    process.exit(1);
  }
  const emailsArg = process.argv[3];
  const emails = emailsArg
    ? emailsArg.split(",").map((s) => s.trim()).filter(Boolean)
    : [
        "relatiipublice@pmb.ro",
        "primarie@sector5.ro",
        "dispecerat@pmb.ro",
        "prefectura@prefecturabucu.ro",
      ];

  const { data: sesizare, error: getErr } = await sa
    .from("sesizari")
    .select("id, code, status, sent_via_civia")
    .eq("code", code)
    .maybeSingle();
  if (getErr || !sesizare) {
    console.error("Sesizarea nu exista:", code, getErr);
    process.exit(1);
  }
  if (sesizare.sent_via_civia) {
    console.log(`${code} deja marcată sent_via_civia=true. Skip.`);
    return;
  }

  const now = new Date().toISOString();
  const { error: upErr } = await sa
    .from("sesizari")
    .update({
      sent_via_civia: true,
      sent_at: now,
      sent_to_emails: emails,
      resend_message_id: null, // necunoscut retroactive
      status: sesizare.status === "nou" ? "trimis" : sesizare.status,
    })
    .eq("id", sesizare.id);
  if (upErr) {
    console.error("UPDATE failed:", upErr);
    process.exit(1);
  }

  const { error: tlErr } = await sa.from("sesizare_timeline").insert({
    sesizare_id: sesizare.id,
    event_type: "trimis_via_civia",
    description: `Sesizarea a fost trimisa via Civia catre ${emails.length} autoritati (marcare retroactiva).`,
  });
  if (tlErr) {
    console.warn("Timeline insert failed (non-fatal):", tlErr.message);
  }

  console.log(`✓ ${code} marcată ca trimisă către:`);
  for (const e of emails) console.log(`  - ${e}`);
  console.log(`Status: ${sesizare.status === "nou" ? "trimis" : sesizare.status}, sent_at=${now}`);
}
main();
