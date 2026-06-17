/* READ-ONLY: dump coada de inbox (replies pending) + sesizările, ca să leg manual. */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdmin } from "@/lib/supabase/admin";

async function main() {
  const admin = createSupabaseAdmin();

  console.log("=== REPLIES PENDING (user_confirmed IS NULL) ===");
  const { data: replies, error: rErr } = await admin
    .from("sesizare_replies")
    .select("id, sesizare_id, from_email, from_name, subject, body_text, ai_status, ai_confidence, ai_nr_inregistrare, match_method, auto_applied, user_confirmed, processed_at")
    .is("user_confirmed", null)
    .order("processed_at", { ascending: false });
  if (rErr) console.log("ERR replies:", rErr.message);
  for (const r of (replies ?? []) as Record<string, unknown>[]) {
    const linked = r.sesizare_id ? "LEGAT→" + r.sesizare_id : "ORFAN";
    console.log(`\n[${r.id}]`);
    console.log(`  ${linked} | method=${r.match_method ?? "—"} | ai_status=${r.ai_status} (${r.ai_confidence}%) | nr_inreg=${r.ai_nr_inregistrare ?? "—"}`);
    console.log(`  de la: ${r.from_name ?? ""} <${r.from_email}> | primit: ${r.processed_at}`);
    console.log(`  subiect: ${String(r.subject ?? "").slice(0, 90)}`);
    console.log(`  body: ${String(r.body_text ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
  }
  console.log(`\n  TOTAL replies pending: ${replies?.length ?? 0}`);

  console.log("\n\n=== SESIZĂRI (toate, cu câmpuri de matching) ===");
  const { data: ses, error: sErr } = await admin
    .from("sesizari")
    .select("code, titlu, locatie, status, sent_via_civia, sent_at, created_at, author_name")
    .order("created_at", { ascending: true });
  if (sErr) console.log("ERR sesizari:", sErr.message);
  for (const s of (ses ?? []) as Record<string, unknown>[]) {
    console.log(`#${s.code} | status=${s.status} | via_civia=${s.sent_via_civia} | sent_at=${s.sent_at ?? "—"}`);
    console.log(`     titlu: ${String(s.titlu ?? "").slice(0, 70)}`);
    console.log(`     locatie: ${String(s.locatie ?? "").slice(0, 80)}`);
  }
  console.log(`\n  TOTAL sesizări: ${ses?.length ?? 0}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
