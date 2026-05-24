/**
 * Debug — investigheaza de ce sesizare_replies e gol desi webhook-ul
 * primeste cu succes (debug log show insert 200).
 *
 * Verifica:
 *  1. Tabela exista + coloanele sunt OK
 *  2. Recent log entries cu code-uri valide
 *  3. Daca insert direct manual functioneaza
 */
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const sa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  // 1. Count
  const { count: c1 } = await sa.from("sesizare_replies").select("*", { count: "exact", head: true });
  console.log(`sesizare_replies total: ${c1 ?? 0}`);

  // 2. Sesizari with sent_via_civia true
  const { data: sent, count: c2 } = await sa
    .from("sesizari")
    .select("id, code, titlu, sent_via_civia, sent_at", { count: "exact" })
    .eq("sent_via_civia", true)
    .order("sent_at", { ascending: false })
    .limit(20);
  console.log(`\nSesizari trimise via Civia: ${c2 ?? 0}`);
  for (const s of (sent ?? []) as { code: string; titlu: string; sent_at: string }[]) {
    console.log(`  ${s.code} | ${s.sent_at} | ${s.titlu}`);
  }

  // 3. Get sesizare 00044 (referenced in debug log)
  const { data: s44 } = await sa
    .from("sesizari")
    .select("id, code, titlu, status, sent_via_civia, sent_at, sent_to_emails")
    .eq("code", "00044")
    .maybeSingle();
  console.log("\nSesizare 00044:", s44);

  // 4. Try manual insert with the exact same payload the webhook would
  if (s44 && (s44 as { id: string }).id) {
    const sid = (s44 as { id: string }).id;
    console.log("\n→ Test insert manual cu sesizare_id=", sid);
    const { data: ins, error: insErr } = await sa
      .from("sesizare_replies")
      .insert({
        sesizare_id: sid,
        from_email: "DEBUG_TEST@civia.ro",
        from_name: "Debug Test",
        subject: "DEBUG TEST INSERT",
        body_text: "Test manual din script — verificare insert.",
        ai_status: "inregistrata",
        ai_confidence: 95,
        ai_summary: "Test debug",
        auto_applied: false,
        trusted_sender: false,
      })
      .select("id")
      .single();
    if (insErr) {
      console.log("INSERT ERROR:", insErr);
    } else {
      console.log("INSERT OK, id=", (ins as { id: string } | null)?.id);
      // Clean up
      if ((ins as { id: string } | null)?.id) {
        await sa.from("sesizare_replies").delete().eq("id", (ins as { id: string }).id);
        console.log("→ test row deleted");
      }
    }
  }

  // 5. List recent debug log entries that returned code != NULL
  const { data: logs } = await sa
    .from("inbox_debug_log")
    .select("*")
    .eq("endpoint", "reply")
    .eq("http_status", 200)
    .order("received_at", { ascending: false })
    .limit(5);
  console.log("\n--- Recent REPLY logs (status 200) ---");
  for (const l of (logs ?? []) as Array<{ received_at: string; error_message: string | null; request_body: string | null }>) {
    console.log(`${l.received_at}: ${l.error_message ?? "(no msg)"}`);
    if (l.request_body) {
      const body = l.request_body;
      console.log(`  body[0..160]: ${body.slice(0, 160)}`);
    }
  }
}
main();
