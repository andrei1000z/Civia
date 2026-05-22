import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  // Direct: count
  const r1 = await sa.from("sesizare_replies").select("id", { head: true, count: "exact" });
  console.log("HEAD count:", r1.count, "err:", r1.error?.message);

  // Full select
  const r2 = await sa.from("sesizare_replies").select("*").limit(100);
  console.log("Select limit 100:", r2.data?.length, "err:", r2.error?.message);
  if (r2.data && r2.data.length > 0) {
    console.log("Sample:", JSON.stringify(r2.data[0], null, 2));
  }

  // Without filters at all
  const r3 = await sa.from("sesizare_replies").select("id, from_email, received_at, sesizare_id, ai_status");
  console.log("\nFULL select (no limit):");
  console.log("  rows:", r3.data?.length);
  console.log("  err:", r3.error?.message);
  if (r3.data) {
    for (const row of r3.data.slice(0, 10) as Array<{ from_email: string; received_at: string; ai_status: string }>) {
      console.log(`    ${row.received_at} | ${row.from_email} | ${row.ai_status}`);
    }
  }
}
main();
