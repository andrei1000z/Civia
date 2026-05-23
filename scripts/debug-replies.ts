/**
 * Debug: why are sesizare_replies count = 0 despite 7 webhook events?
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  // 1. Direct count of replies
  const { count, error } = await sa
    .from("sesizare_replies")
    .select("*", { count: "exact", head: true });
  console.log(`sesizare_replies count: ${count} (error: ${error?.message ?? "none"})`);

  // 2. List any replies, no filter
  const { data: anyReplies } = await sa
    .from("sesizare_replies")
    .select("*")
    .limit(5);
  console.log(`Any replies returned: ${anyReplies?.length ?? 0}`);
  if (anyReplies && anyReplies.length > 0) {
    console.log("Sample:", JSON.stringify(anyReplies[0], null, 2));
  }

  // 3. Check if migration 059 columns exist (try selecting them)
  const { error: probeErr } = await sa
    .from("sesizare_replies")
    .select(
      "ai_authenticity_score, ai_authenticity_reasoning, ai_authenticity_signals",
    )
    .limit(1);
  console.log(
    `Probe migration 059 columns: ${probeErr ? "MISSING: " + probeErr.message : "OK"}`,
  );

  // 4. Try inserting a test row to see what fails
  console.log("\n--- Test insert ---");
  const { data: ses } = await sa
    .from("sesizari")
    .select("id, code")
    .eq("code", "00044")
    .maybeSingle();
  console.log(`Sesizare 00044: id=${ses?.id ?? "NOT FOUND"}`);

  if (ses) {
    const insertRow = {
      sesizare_id: ses.id,
      from_email: "debug-test@civia.ro",
      from_name: "Debug Test",
      subject: "Debug insert test",
      body_text: "test",
      ai_status: "inregistrata" as const,
      ai_confidence: 95,
      ai_summary: "test summary",
      ai_nr_inregistrare: "TEST-001",
      auto_applied: false,
      trusted_sender: false,
      received_at: new Date().toISOString(),
      processed_at: new Date().toISOString(),
    };
    const { data: ins, error: insErr } = await sa
      .from("sesizare_replies")
      .insert(insertRow)
      .select("id")
      .single();
    if (insErr) {
      console.log("❌ Insert failed:", insErr.message);
      console.log("Details:", JSON.stringify(insErr, null, 2));
    } else {
      console.log(`✓ Insert OK, id=${ins?.id}`);
      // Cleanup
      await sa.from("sesizare_replies").delete().eq("id", ins!.id);
      console.log("✓ Cleanup done");
    }
  }

  // 5. Last inbox_debug_log entry for code=00044
  const { data: log44 } = await sa
    .from("inbox_debug_log")
    .select("received_at, http_status, error_message, request_body")
    .eq("endpoint", "reply")
    .order("received_at", { ascending: false })
    .limit(3);
  console.log("\n--- Last 3 reply webhook logs ---");
  for (const l of log44 ?? []) {
    console.log(`[${l.received_at}] HTTP ${l.http_status} — ${l.error_message?.slice(0, 200)}`);
  }

  // 6. Check inbox_debug_log for any HTTP 500 / errors
  const { count: errCount } = await sa
    .from("inbox_debug_log")
    .select("*", { count: "exact", head: true })
    .neq("http_status", 200);
  console.log(`\nNon-200 webhook events: ${errCount}`);
  if ((errCount ?? 0) > 0) {
    const { data: errs } = await sa
      .from("inbox_debug_log")
      .select("received_at, http_status, error_message")
      .neq("http_status", 200)
      .order("received_at", { ascending: false })
      .limit(10);
    for (const e of errs ?? []) {
      console.log(`  [${e.received_at}] HTTP ${e.http_status}: ${e.error_message}`);
    }
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
