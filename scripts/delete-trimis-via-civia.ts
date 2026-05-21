/**
 * Sterge timeline events de tip „trimis_via_civia" care apar pe UI ca
 * „Eveniment" generic — info redundanta cu „Status: trimis".
 *
 * One-time cleanup, plus dezactivam crearea lor din send-via-civia route.
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
  const { data, error } = await sa
    .from("sesizare_timeline")
    .delete()
    .eq("event_type", "trimis_via_civia")
    .select("id, sesizare_id, created_at");
  if (error) {
    console.error(error);
    return;
  }
  console.log(`Sterse ${data?.length ?? 0} timeline events de tip "trimis_via_civia" din toata baza de date.`);
}
main();
