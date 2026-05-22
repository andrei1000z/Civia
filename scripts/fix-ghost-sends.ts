/**
 * Reparare „ghost sends" — sesizari unde sent_via_civia=true dar
 * resend_message_id e null (emailul probabil n-a ajuns).
 *
 * Pași:
 *  1. Listează sesizările cu această stare
 *  2. Pentru fiecare: clear sent_via_civia=false ca user-ul să poată
 *     reapăsa „Trimite cu Civia" sau să folosească retrimit button
 *  3. Adaugă timeline event explicit
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
  const { data: ghosts, error } = await sa
    .from("sesizari")
    .select("id, code, titlu, sent_at, sent_to_emails")
    .eq("sent_via_civia", true)
    .is("resend_message_id", null);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Ghost sends găsite: ${ghosts?.length ?? 0}\n`);
  if (!ghosts || ghosts.length === 0) {
    console.log("Niciun ghost send — DB consistent.");
    return;
  }

  for (const g of ghosts as Array<{ id: string; code: string; titlu: string; sent_at: string; sent_to_emails: string[] }>) {
    console.log(`  ${g.code} | ${g.sent_at} | ${g.titlu.slice(0, 60)}`);
    console.log(`    → marcată ca trimisă către: ${(g.sent_to_emails ?? []).join(", ")}`);
  }

  // Confirm via flag
  if (process.argv.includes("--apply")) {
    for (const g of ghosts as Array<{ id: string; code: string }>) {
      // Reset send state ca user-ul să retrimită
      await sa
        .from("sesizari")
        .update({
          sent_via_civia: false,
          sent_at: null,
          delivery_status: null,
        })
        .eq("id", g.id);
      await sa.from("sesizare_timeline").insert({
        sesizare_id: g.id,
        event_type: "delivery_problem",
        description: `Emailul anterior nu a primit confirmare de livrare de la Resend (ghost send). Status resetat — apasă „Trimite cu Civia" din nou.`,
      });
      console.log(`  ✓ ${g.code} resetat`);
    }
    console.log("\nGata. User-ii pot retrimite manual din UI.");
  } else {
    console.log("\nDry run. Rulează cu --apply ca să resetezi:");
    console.log("  npx tsx scripts/fix-ghost-sends.ts --apply");
  }
}
main();
