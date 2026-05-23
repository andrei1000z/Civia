import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
async function main() {
  const sa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sa.from("stiri_cache").select("url, image_url, title").eq("id", process.argv[2]).maybeSingle();
  console.log(data);
}
main();
