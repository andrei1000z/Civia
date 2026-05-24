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
    .select("from_email, ai_status, ai_confidence, ai_authenticity_score, ai_authenticity_reasoning, auto_applied")
    .order("received_at", { ascending: false })
    .limit(10);
  console.log("Latest replies — authenticity breakdown:\n");
  for (const r of data ?? []) {
    console.log("─".repeat(80));
    console.log(`from: ${r.from_email}`);
    console.log(`  ai_status:     ${r.ai_status}`);
    console.log(`  ai_confidence: ${r.ai_confidence}%`);
    console.log(`  authenticity:  ${r.ai_authenticity_score}%`);
    console.log(`  auto_applied:  ${r.auto_applied ? "✅ YES" : "❌ NO"}`);
    console.log(`  reasoning:     ${r.ai_authenticity_reasoning?.slice(0, 200) ?? "(none)"}`);
  }
  console.log("─".repeat(80));
}
main();
