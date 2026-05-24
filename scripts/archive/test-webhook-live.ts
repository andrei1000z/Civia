/**
 * Trimite un POST real la /api/inbox/reply local și verifică imediat
 * dacă rândul apare în sesizare_replies.
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const BASE = process.env.WEBHOOK_BASE_URL ?? "https://www.civia.ro";
const SECRET = process.env.INBOX_WEBHOOK_SECRET!;

async function main() {
  if (!SECRET) {
    console.error("INBOX_WEBHOOK_SECRET lipsește în .env.local");
    return;
  }
  const ts = new Date().toISOString();
  const payload = {
    from: `LIVE_TEST_${Date.now()}@webhook-debug.civia.ro`,
    to: "sesizari@civia.ro",
    subject: `Re: Sesizare 00044 — LIVE TEST ${ts}`,
    body_text: `Buna ziua,\n\nSesizarea a fost inregistrata cu nr 9999/2026.\n\nLIVE TEST ${ts}`,
  };
  console.log("→ POST", `${BASE}/api/inbox/reply`);
  console.log("→ Payload:", payload);

  const res = await fetch(`${BASE}/api/inbox/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(payload),
  });
  const respText = await res.text();
  console.log("← Status:", res.status);
  console.log("← Response:", respText.slice(0, 500));

  // Wait 2 sec for DB write to propagate
  await new Promise((r) => setTimeout(r, 2000));

  // Check sesizare_replies
  const { data, error, count } = await sa
    .from("sesizare_replies")
    .select("id, from_email, subject, received_at, ai_status, ai_confidence, auto_applied", { count: "exact" })
    .eq("from_email", payload.from)
    .order("received_at", { ascending: false });

  console.log("\n--- DB CHECK ---");
  console.log("Rows found:", count);
  if (error) console.log("Error:", error);
  if (data && data.length > 0) {
    console.log("FOUND:", JSON.stringify(data[0], null, 2));
    // Clean up
    await sa.from("sesizare_replies").delete().eq("from_email", payload.from);
    console.log("(cleaned)");
  } else {
    console.log("⚠️ NOTHING FOUND — webhook returned success but DB row missing");
  }
}
main();
