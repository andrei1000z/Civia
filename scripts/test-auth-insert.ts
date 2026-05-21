import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: ses } = await sa.from("sesizari").select("id").eq("code", "00044").maybeSingle();
  if (!ses) {
    console.error("No 00044");
    return;
  }

  // Try insert with authenticity fields
  const { data, error } = await sa
    .from("sesizare_replies")
    .insert({
      sesizare_id: ses.id,
      from_email: "diag@test.ro",
      subject: "Direct DB insert test",
      ai_status: "inregistrata",
      ai_confidence: 88,
      ai_authenticity_score: 77,
      ai_authenticity_reasoning: "Test direct din script — verific schema cache",
      ai_authenticity_signals: { test: true, signals: ["x", "y"] },
      auto_applied: false,
    })
    .select("id, ai_authenticity_score, ai_authenticity_reasoning, ai_authenticity_signals")
    .single();

  if (error) {
    console.error("INSERT FAILED:", error);
  } else {
    console.log("INSERT OK:", JSON.stringify(data, null, 2));
    // Cleanup the test row
    await sa.from("sesizare_replies").delete().eq("id", data.id);
    console.log("Test row cleaned.");
  }
}
main();
