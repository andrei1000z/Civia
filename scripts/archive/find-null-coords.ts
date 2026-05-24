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
    .from("sesizari")
    .select("id, code, titlu, lat, lng")
    .or("lat.is.null,lng.is.null")
    .eq("publica", true)
    .eq("moderation_status", "approved");
  if (error) { console.error(error); return; }
  console.log(`Sesizari publice cu lat/lng NULL: ${data?.length ?? 0}`);
  for (const r of data ?? []) {
    console.log(`  ${r.code} | lat=${r.lat} lng=${r.lng} | ${r.titlu?.slice(0, 60)}`);
  }
}
main();
