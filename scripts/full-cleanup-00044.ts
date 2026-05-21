/**
 * Cleanup COMPLET pe 00044 pentru a o lasa exact cum era la inceput
 * (status=trimis, fara replies, fara timeline events din testele de azi).
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
  const { data: ses } = await sa.from("sesizari").select("id, status").eq("code", "00044").maybeSingle();
  if (!ses) return;

  // 1. Sterg TOATE replies aferente 00044
  const { data: r } = await sa
    .from("sesizare_replies")
    .delete()
    .eq("sesizare_id", ses.id)
    .select("id");
  console.log(`Sterse ${r?.length ?? 0} replies pe 00044.`);

  // 2. Sterg timeline events generate de testele de azi (orice „inregistrata"
  //    sau „trimis" duplicat dupa 09:00 UTC)
  const { data: tl } = await sa
    .from("sesizare_timeline")
    .delete()
    .eq("sesizare_id", ses.id)
    .gt("created_at", "2026-05-21T09:00:00Z")
    .in("event_type", ["inregistrata", "trimis"])
    .select("id, event_type, created_at");
  console.log(`Sterse ${tl?.length ?? 0} timeline events test.`);

  // 3. Revert status + clear nr_inregistrare
  await sa.from("sesizari").update({ status: "trimis", nr_inregistrare: null }).eq("id", ses.id);
  console.log('Status revert la trimis, nr_inregistrare clear.');

  const { data: final } = await sa
    .from("sesizari")
    .select("status, nr_inregistrare")
    .eq("code", "00044")
    .maybeSingle();
  console.log("Final state:", final);
}
main();
