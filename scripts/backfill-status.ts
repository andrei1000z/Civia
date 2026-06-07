/**
 * Backfill: pune pe FIECARE sesizare trimisă via Civia statusul REAL dedus din
 * răspunsurile ei (forward-only). Două etape:
 *   1. Leagă răspunsurile orfane (sesizare_id NULL) via matchReply — DOAR la
 *      încredere ÎNALTĂ (determinist sau fuzzy clar), ca să nu legăm greșit.
 *   2. Pentru fiecare sesizare via Civia, aplică computeStatusUpdate cumulativ
 *      pe răspunsurile ei (ordonate cronologic) → status + nr + răspuns oficial.
 *
 * Dry-run implicit; `--apply` scrie. Going-forward e deja automat (inbox route).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { matchReply } from "../src/lib/inbox/match-reply";
import { classifyReply } from "../src/lib/inbox/classify";
import { computeStatusUpdate } from "../src/lib/inbox/status-from-reply";

const PERSONAL = /@(gmail|yahoo|hotmail|outlook|icloud|civia)\./i;

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  console.log(APPLY ? "MOD: APPLY\n" : "MOD: DRY-RUN\n");

  const { data: sez } = await sb
    .from("sesizari")
    .select("id, code, titlu, status")
    .eq("sent_via_civia", true);
  const byId = new Map((sez || []).map((s) => [s.id, s]));

  const { data: reps } = await sb
    .from("sesizare_replies")
    .select("id, sesizare_id, from_email, subject, body_text, ai_input_text, attachments, in_reply_to, references_chain, raw_headers, received_at, ai_status, ai_nr_inregistrare, ai_summary")
    .order("received_at", { ascending: true });

  // ── Etapa 1: leagă orfanii (verificabil) + re-clasifică cu logica corectată ──
  let linked = 0;
  for (const r of reps || []) {
    if (r.sesizare_id) continue;
    if (PERSONAL.test(r.from_email)) { console.log(`  ⏭ skip personal/self: ${r.from_email}`); continue; }
    const attText = (r.attachments || []).map((a: { extracted_text?: string; filename?: string }) => `${a.filename || ""} ${a.extracted_text || ""}`).join(" ");
    const to = (r.raw_headers as { to?: string } | null)?.to || "sesizari@civia.ro";
    const m = await matchReply({
      to, extractedCode: null, inReplyTo: r.in_reply_to, referencesChain: r.references_chain,
      fromEmail: r.from_email, replyText: `${r.subject || ""} ${r.ai_input_text || r.body_text || ""} ${attText}`,
      receivedAt: r.received_at, admin: sb as never,
    });
    // Acceptăm: orice ÎNALTĂ (determinist/fuzzy clar) SAU medium VERIFICABIL pe
    // conținut/domeniu (NU pur-AI, care e cel mai puțin sigur).
    const safeMedium = m.confidence === "medium" && (m.method === "content_score" || m.method === "domain");
    const accept = m.sesizareId && byId.has(m.sesizareId) && (m.confidence === "high" || safeMedium);
    if (!accept) {
      if (m.sesizareId && byId.has(m.sesizareId)) console.log(`  ⚪ [${m.confidence}/${m.method}] „${(r.subject || "").slice(0, 22)}" → ${byId.get(m.sesizareId!)!.code} — neaplicat (review)`);
      continue;
    }
    // RE-CLASIFICĂ cu logica corectată (rezolvat→in-lucru pt. „Note de Constatare" etc.)
    const fresh = await classifyReply({ subject: r.subject || "", body: r.ai_input_text || r.body_text || "" });
    r.sesizare_id = m.sesizareId;
    r.ai_status = fresh.status; // folosit în Etapa 2
    r.ai_summary = fresh.summary;
    linked++;
    console.log(`  🔗 [${m.confidence}/${m.method}] „${(r.subject || "").slice(0, 22)}" → ${byId.get(m.sesizareId!)!.code} | status: ${r.ai_status}`);
    if (APPLY) await sb.from("sesizare_replies").update({ sesizare_id: m.sesizareId, match_method: m.method, ai_status: fresh.status, ai_summary: fresh.summary }).eq("id", r.id);
  }
  console.log(`\n  → ${linked} orfani legați (verificabil). Restul rămân pt. review manual.\n`);

  // ── Etapa 2: recalculează statusul fiecărei sesizări ──
  const repliesBySez = new Map<string, typeof reps>();
  for (const r of reps || []) {
    if (!r.sesizare_id || !byId.has(r.sesizare_id)) continue;
    if (!repliesBySez.has(r.sesizare_id)) repliesBySez.set(r.sesizare_id, []);
    repliesBySez.get(r.sesizare_id)!.push(r);
  }

  let changed = 0;
  for (const [sid, rs] of repliesBySez) {
    const s = byId.get(sid)!;
    let status = s.status as string;
    let nr: string | null = null, official: string | null = null, officialAt: string | null = null;
    for (const r of rs!) {
      const upd = computeStatusUpdate({ currentStatus: status, aiStatus: r.ai_status, nrInregistrare: r.ai_nr_inregistrare, summary: r.ai_summary, at: r.received_at });
      if (upd) {
        status = upd.status;
        if (upd.nr_inregistrare) nr = upd.nr_inregistrare;
        if (upd.official_response) { official = upd.official_response; officialAt = upd.official_response_at!; }
      }
    }
    if (status !== s.status) {
      changed++;
      console.log(`  📌 ${s.code} „${(s.titlu || "").slice(0, 40)}": ${s.status} → ${status} (${rs!.length} răspunsuri)`);
      if (APPLY) {
        const patch: Record<string, unknown> = { status };
        if (nr) patch.nr_inregistrare = nr;
        if (official) { patch.official_response = official; patch.official_response_at = officialAt; }
        if (status === "rezolvat") patch.resolved_at = officialAt || new Date().toISOString();
        await sb.from("sesizari").update(patch).eq("id", sid);
        // Trigger-ul DB pe sesizari.status creează automat event-ul de timeline
        // („Status actualizat la: X") — nu mai inserăm manual (evită duplicat).
      }
    }
  }

  // distribuție finală (proiectată)
  const dist: Record<string, number> = {};
  for (const s of sez || []) {
    let st = s.status as string;
    for (const r of (repliesBySez.get(s.id) || [])) {
      const u = computeStatusUpdate({ currentStatus: st, aiStatus: r.ai_status, at: r.received_at });
      if (u) st = u.status;
    }
    dist[st] = (dist[st] || 0) + 1;
  }
  console.log(`\n=== ${changed} sesizări își schimbă statusul ===`);
  console.log("distribuție proiectată (via Civia):", JSON.stringify(dist));
}
main().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
