import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const code = process.argv[2] ?? "00044";
  const { data: ses } = await sa
    .from("sesizari")
    .select("id, code, status, nr_inregistrare, sent_via_civia")
    .eq("code", code)
    .maybeSingle();
  console.log("=== SESIZARE", code, "===");
  console.log(JSON.stringify(ses, null, 2));

  if (!ses?.id) { return; }

  const { data: replies } = await sa
    .from("sesizare_replies")
    .select("id, from_email, authority_name, subject, ai_status, ai_confidence, ai_summary, ai_nr_inregistrare, auto_applied, trusted_sender, received_at")
    .eq("sesizare_id", ses.id)
    .order("received_at", { ascending: true });

  console.log("\n=== REPLIES ===");
  for (const r of replies ?? []) {
    console.log(JSON.stringify(r, null, 2));
  }
}
main();
