/* READ-ONLY: ce raspunsuri pierdute (401) sunt recuperabile din inbox_debug_log. */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { extractSesizareCode } from "@/lib/inbox/extract-code";

async function main() {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("inbox_debug_log")
    .select("id, received_at, request_body, error_message")
    .eq("endpoint", "reply")
    .eq("http_status", 401)
    .gte("received_at", "2026-06-12T08:20:00Z")
    .order("received_at", { ascending: true });

  console.log(`=== ${data?.length ?? 0} raspunsuri respinse cu 401 din 06-12 ===\n`);
  const seenMsgId = new Set<string>();
  let dupes = 0;
  for (const l of (data ?? []) as any[]) {
    let p: any = {};
    try { p = JSON.parse(l.request_body || "{}"); } catch { console.log(`[${l.received_at}] (request_body neparsabil)`); continue; }
    const msgId = p.message_id || p.headers?.["message-id"] || "";
    if (msgId && seenMsgId.has(msgId)) { dupes++; continue; }
    if (msgId) seenMsgId.add(msgId);
    const atts = (p.attachments || []).map((a: any) => a.r2_key).filter(Boolean);
    let code: string | null = null;
    try {
      const ex = extractSesizareCode({ to: p.to || "", subject: p.subject || "", body: `${p.body_text || ""}`, headers: p.headers || {} } as any);
      code = (ex && (ex as any).code) ?? (typeof ex === "string" ? ex : null);
    } catch (e) { code = `(extract err)`; }
    console.log(`[${l.received_at}] from=${p.from || "?"}`);
    console.log(`   subj: ${String(p.subject || "").slice(0, 75)}`);
    console.log(`   cod detectat: ${code ?? "—"} | body=${(p.body_text || "").length}c | atts=${atts.length} ${atts.length ? "[" + atts.join(", ").slice(0, 80) + "]" : ""}`);
    console.log(`   bodyprev: ${String(p.body_text || "").replace(/\s+/g, " ").slice(0, 120)}`);
  }
  console.log(`\nUnice (dupa message-id): ${seenMsgId.size} | duplicate sarite: ${dupes}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
