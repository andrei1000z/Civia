import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const replyId = process.argv[2];
  if (!replyId) {
    console.error("Usage: npx tsx scripts/inspect-reply.ts <reply-id>");
    return;
  }
  const { data, error } = await sa
    .from("sesizare_replies")
    .select("*")
    .eq("id", replyId)
    .single();
  if (error) console.error(error);
  else console.log(JSON.stringify(data, null, 2));
}
main();
