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
  const { data: tl } = await sa
    .from("sesizare_timeline")
    .select("id, event_type, description, created_at")
    .eq("sesizare_id", ses.id)
    .order("created_at", { ascending: true });
  console.log(`Timeline pentru ${code}:`);
  for (const e of tl ?? []) {
    console.log(`  ${e.created_at} | ${e.event_type} | ${e.description}`);
  }
}
main();
