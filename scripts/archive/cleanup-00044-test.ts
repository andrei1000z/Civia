/**
 * Cleanup complet pentru testul end-to-end pe sesizarea 00044:
 *   - Sterge reply-ul de test (de la relatiipublice@sector5.ro)
 *   - Sterge cele 2 timeline events „inregistrata" generate de AI
 *   - Revert status sesizare la „trimis", clear nr_inregistrare
 *
 * Dupa ce rulezi asta, sesizarea 00044 e EXACT cum era inainte de
 * testul AI inbound reply (status=trimis, fara reply, fara nr).
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
  const { data: ses } = await sa
    .from("sesizari")
    .select("id, status, nr_inregistrare")
    .eq("code", "00044")
    .maybeSingle();
  if (!ses) {
    console.error("00044 not found");
    return;
  }

  // 1. Delete reply rows from sector5.ro / today test
  const { data: replies, error: rdErr } = await sa
    .from("sesizare_replies")
    .delete()
    .eq("sesizare_id", ses.id)
    .gte("received_at", "2026-05-21T00:00:00Z")
    .select("id, from_email");
  if (rdErr) console.error("delete replies:", rdErr);
  else console.log(`Deleted ${replies?.length ?? 0} reply rows for 00044`);

  // 2. Delete timeline events for „inregistrata" created today
  const { data: tlDel, error: tlErr } = await sa
    .from("sesizare_timeline")
    .delete()
    .eq("sesizare_id", ses.id)
    .eq("event_type", "inregistrata")
    .gte("created_at", "2026-05-21T10:00:00Z")
    .select("id, event_type, created_at");
  if (tlErr) console.error("delete timeline:", tlErr);
  else console.log(`Deleted ${tlDel?.length ?? 0} timeline events`);

  // 3. Revert sesizare status to „trimis" + clear nr_inregistrare
  const { error: upErr } = await sa
    .from("sesizari")
    .update({ status: "trimis", nr_inregistrare: null })
    .eq("id", ses.id);
  if (upErr) console.error("revert sesizare:", upErr);
  else console.log("Reverted status to 'trimis', cleared nr_inregistrare");

  // 4. Verify final
  const { data: final } = await sa
    .from("sesizari")
    .select("status, nr_inregistrare")
    .eq("code", "00044")
    .maybeSingle();
  console.log("\nFinal state:", final);
}
main();
