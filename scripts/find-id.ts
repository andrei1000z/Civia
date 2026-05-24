import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
async function main() {
  const sa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const prefix = process.argv[2];
  const { data } = await sa.from("stiri_cache").select("id, title").ilike("id", `${prefix}%`);
  console.log(data);
}
main();
