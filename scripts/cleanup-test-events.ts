/**
 * One-shot cleanup pentru event-urile de timeline create de scripts/
 * diagnose-send.ts pe 00044 (rollback test din 07:59:59 din 21 mai 2026).
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
  const { data: sesizare } = await sa
    .from("sesizari")
    .select("id")
    .eq("code", "00044")
    .maybeSingle();
  if (!sesizare) return;

  // Sterge event-urile dintre 07:59:30 si 08:00:30 (testul de diagnose).
  const { data: deleted, error } = await sa
    .from("sesizare_timeline")
    .delete()
    .eq("sesizare_id", sesizare.id)
    .gte("created_at", "2026-05-21T07:59:30Z")
    .lt("created_at", "2026-05-21T08:00:30Z")
    .select("event_type, created_at");

  if (error) {
    console.error("DELETE failed:", error);
    return;
  }
  console.log(`Sters ${deleted?.length ?? 0} event-uri de test:`);
  for (const e of deleted ?? []) {
    console.log(`  - ${e.event_type} @ ${e.created_at}`);
  }
}
main();
