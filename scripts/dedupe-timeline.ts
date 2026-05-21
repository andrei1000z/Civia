/**
 * Sterge timeline events duplicate (provenite din rollback-uri de test).
 * Pentru 00044: pastreaza doar primele 3 events (depusa, trimis initial,
 * trimis_via_civia). Toate „Status actualizat la: trimis" duplicate sunt
 * sterse.
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
  const code = process.argv[2] ?? "00044";
  const { data: ses } = await sa.from("sesizari").select("id").eq("code", code).maybeSingle();
  if (!ses) return;

  // Sterg orice eveniment „trimis" creat dupa 09:00 UTC (lucrurile reale
  // s-au intamplat inainte; tot ce vine dupa = rollback artifacts).
  const { data: deleted, error } = await sa
    .from("sesizare_timeline")
    .delete()
    .eq("sesizare_id", ses.id)
    .eq("event_type", "trimis")
    .gt("created_at", "2026-05-21T09:00:00Z")
    .select("id, created_at");
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Sters ${deleted?.length ?? 0} timeline event-uri duplicate "trimis".`);
}
main();
