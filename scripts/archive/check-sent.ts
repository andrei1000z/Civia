import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const code = process.argv[2] ?? "00042";
  const { data, error } = await sa
    .from("sesizari")
    .select("id, code, sent_via_civia, sent_at, sent_to_emails, resend_message_id, status, author_email, user_id, created_at")
    .eq("code", code)
    .maybeSingle();

  if (error) { console.error(error); process.exit(1); }
  console.log(`=== SESIZAREA ${code} ===`);
  console.log(JSON.stringify(data, null, 2));

  if (data?.id) {
    const { data: tl } = await sa
      .from("sesizare_timeline")
      .select("event_type, description, created_at")
      .eq("sesizare_id", data.id)
      .order("created_at", { ascending: true });
    console.log("\n=== TIMELINE ===");
    console.log(JSON.stringify(tl, null, 2));
  }
}
main();
