import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const sa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await sa
    .from("sesizari")
    .select("*")
    .eq("sent_via_civia", true)
    .limit(1);
  if (error) {
    console.log("ERR:", error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log("no row");
    return;
  }
  console.log("Columns sesizari (filtered by sent_via_civia):");
  for (const c of Object.keys(data[0]).sort()) console.log("  " + c);

  console.log("\n\nFull row dump (first sent sesizare):");
  console.log(JSON.stringify(data[0], null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
