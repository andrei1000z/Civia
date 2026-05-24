import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
async function main() {
  const sa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sa.from("stiri_cache").select("id, title").eq("source", "Adevărul").order("published_at", { ascending: false }).limit(3);
  console.log(JSON.stringify(data, null, 2));
}
main();
