import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data } = await sa
    .from("sesizare_replies")
    .select("id, sesizare_id, from_email, subject, ai_status, received_at, auto_applied")
    .order("received_at", { ascending: false })
    .limit(20);
  console.log("Latest 20 replies in DB:");
  for (const r of data ?? []) {
    console.log(`  ${r.received_at} | sesizare=${r.sesizare_id?.slice(0,8) ?? "NULL"} | from=${r.from_email} | "${r.subject}" | ai=${r.ai_status} | auto=${r.auto_applied}`);
  }
}
main();
