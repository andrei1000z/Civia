import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { error } = await sa
    .from("actualizari")
    .update({ titlu: "Civia" })
    .eq("versiune", "0.0.0");
  if (error) {
    console.error("❌", error);
    return;
  }
  console.log("✓ Titlu actualizat la 'Civia'");
}
main();
