/* Aplică statusurile pending high-confidence din coada de inbox.
 * DRY-RUN by default. Cu `--apply` chiar scrie (status + timeline cu ora emailului
 * + user_confirmed). Doar forward (rank crescător) + confidence >= 90 + nu peste terminal. */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";

const APPLY = process.argv.includes("--apply");
const RANK: Record<string, number> = {
  nou: 0, trimis: 1, inregistrata: 2, redirectionata: 3, "in-lucru": 4,
  "actiune-autoritate": 5, interventie: 6, amanata: 7, respins: 8, ignorat: 8, rezolvat: 9,
};
const TERMINAL = new Set(["rezolvat", "respins", "ignorat"]);

async function main() {
  const admin = createSupabaseAdmin();
  const { data: replies } = await admin
    .from("sesizare_replies")
    .select("id, sesizare_id, from_email, ai_status, ai_confidence, ai_nr_inregistrare, ai_summary, received_at, processed_at")
    .is("user_confirmed", null)
    .not("sesizare_id", "is", null)
    .gte("ai_confidence", 90)
    .order("received_at", { ascending: true });

  console.log(`MOD: ${APPLY ? "APPLY (scrie!)" : "DRY-RUN"} — ${replies?.length ?? 0} replies legate, conf>=90, pending\n`);
  let applied = 0, skipped = 0;
  for (const r of (replies ?? []) as Record<string, any>[]) {
    const { data: ses } = await admin.from("sesizari").select("id, code, status").eq("id", r.sesizare_id).maybeSingle();
    if (!ses) { console.log(`  ?? reply ${r.id} → sesizare ${r.sesizare_id} negăsită`); continue; }
    const cur = (ses as any).status, next = r.ai_status;
    const code = (ses as any).code;
    const when = r.received_at ?? r.processed_at;
    const forward = (RANK[next] ?? -1) > (RANK[cur] ?? 99);
    const blocked = TERMINAL.has(cur) && next !== "rezolvat";
    const doIt = forward && !blocked && next !== cur;
    console.log(`#${code}: ${cur} → ${next} (${r.ai_confidence}%) | de la ${r.from_email} | email: ${when} | ${doIt ? "✅ APLIC" : "⏭️ skip (" + (next === cur ? "deja" : blocked ? "terminal" : "nu avansează") + ")"}`);
    if (!doIt) {
      // status deja corect / mai avansat / terminal → doar curăț din coadă (fără schimbare).
      if (APPLY) await admin.from("sesizare_replies").update({ user_confirmed: true }).eq("id", r.id);
      skipped++; continue;
    }
    if (APPLY) {
      const upd: Record<string, unknown> = { status: next };
      if (r.ai_nr_inregistrare?.trim()) upd.nr_inregistrare = r.ai_nr_inregistrare.trim();
      if (["in-lucru", "rezolvat", "redirectionata"].includes(next) && r.ai_summary?.trim()?.length > 20) {
        upd.official_response = r.ai_summary.trim();
        upd.official_response_at = when;
      }
      await admin.from("sesizari").update(upd).eq("id", (ses as any).id);
      await appendTimelineEvent({ admin, sesizareId: (ses as any).id, eventType: next, description: r.ai_summary?.slice(0, 200) ?? null, createdAt: when, sentryTags: { source: "backfill_inbox_apply" } });
      await admin.from("sesizare_replies").update({ user_confirmed: true, user_corrected_status: next }).eq("id", r.id);
    }
    applied++;
  }
  console.log(`\n${APPLY ? "APLICATE" : "AR APLICA"}: ${applied} | skip: ${skipped}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
