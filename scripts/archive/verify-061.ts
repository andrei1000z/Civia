import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data, error, count } = await sa
    .from("actualizari")
    .select("*", { count: "exact" });
  if (error) {
    console.error("❌ Error:", error);
    return;
  }
  console.log(`✓ Tabela are ${count ?? 0} rânduri`);
  if (data && data.length > 0) {
    for (const a of data) {
      console.log(`  - v${a.versiune}: "${a.titlu}" (published=${a.published}, minimalist=${a.minimalist})`);
    }
  } else {
    console.log("⚠️ Tabela e goală. Seed v0.0.0 nu a rulat.");
  }
}
main();
