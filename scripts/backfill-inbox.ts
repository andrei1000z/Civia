/**
 * Backfill inbox: repară răspunsurile autorităților deja primite.
 *   1. Decodează SUBIECTUL corect (RFC 2047 din raw_headers) — „cat egoria" etc.
 *   2. Repară BODY-ul mojibake („BunÄ"→„Bună").
 *   3. Re-extrage codul + POTRIVEȘTE sesizarea pentru răspunsurile „undefined"
 *      (ex. auto-ack-urile ps2/primarie3 citează „Sesizare 00058" în body).
 *   4. Aplică STATUSUL corect pe sesizare (forward-only, „inregistrata" și fără nr).
 *
 * REUTILIZEAZĂ exact pipeline-ul live (decode-mime, extract-code, status-from-reply).
 * SAFE: dry-run by default. `--apply` scrie.
 *
 *   npx tsx scripts/backfill-inbox.ts            # dry-run
 *   npx tsx scripts/backfill-inbox.ts --apply    # scrie în DB
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { decodeEmailSubject, repairMojibake } from "@/lib/inbox/decode-mime";
import { extractSesizareCode } from "@/lib/inbox/extract-code";
import { computeStatusUpdate } from "@/lib/inbox/status-from-reply";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error("❌ Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const admin = createClient(URL_, KEY);

type Reply = {
  id: string;
  sesizare_id: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  ai_summary: string | null;
  ai_status: string | null;
  ai_nr_inregistrare: string | null;
  raw_headers: Record<string, unknown> | null;
  received_at: string;
};

async function main() {
  const { data, error } = await admin
    .from("sesizare_replies")
    .select("id, sesizare_id, subject, body_text, body_html, ai_summary, ai_status, ai_nr_inregistrare, raw_headers, received_at")
    .order("received_at", { ascending: false })
    .limit(2000);
  if (error) { console.error("Query failed:", error.message); process.exit(1); }
  const replies = (data ?? []) as Reply[];

  console.log(`Răspunsuri scanate: ${replies.length}`);
  console.log(APPLY ? "MOD: APPLY\n" : "MOD: DRY-RUN (--apply ca să scrii)\n");

  let fixedEncoding = 0, newMatches = 0, statusUpdates = 0;

  for (const r of replies) {
    const newSubject = decodeEmailSubject(r.subject, r.raw_headers);
    const newBody = repairMojibake(r.body_text ?? "");
    const newHtml = repairMojibake(r.body_html ?? "");
    const newSummary = repairMojibake(r.ai_summary ?? "");

    const subjChanged = newSubject !== (r.subject ?? "");
    const bodyChanged = newBody !== (r.body_text ?? "") || newHtml !== (r.body_html ?? "") || newSummary !== (r.ai_summary ?? "");

    // Re-match dacă nu e legat de o sesizare.
    let matchedId = r.sesizare_id;
    let matchedCode: string | null = null;
    if (!matchedId) {
      const ex = extractSesizareCode({
        subject: newSubject,
        body: newBody,
        headers: (r.raw_headers as Record<string, string>) ?? {},
      });
      if (ex.code) {
        const { data: ses } = await admin.from("sesizari").select("id, code").eq("code", ex.code).maybeSingle();
        if (ses) { matchedId = ses.id as string; matchedCode = ses.code as string; }
      }
    }

    const replyUpdate: Record<string, unknown> = {};
    if (subjChanged) replyUpdate.subject = newSubject;
    if (newBody !== (r.body_text ?? "")) replyUpdate.body_text = newBody;
    if (newHtml !== (r.body_html ?? "")) replyUpdate.body_html = newHtml;
    if (newSummary !== (r.ai_summary ?? "")) replyUpdate.ai_summary = newSummary;
    if (matchedId && matchedId !== r.sesizare_id) replyUpdate.sesizare_id = matchedId;

    if (Object.keys(replyUpdate).length > 0) {
      if (subjChanged || bodyChanged) fixedEncoding++;
      if (replyUpdate.sesizare_id) { newMatches++; console.log(`  🔗 MATCH reply ${r.id.slice(0, 8)} → sesizare ${matchedCode}`); }
      if (subjChanged) console.log(`  ✎ subiect: „${(r.subject ?? "").slice(0, 50)}" → „${newSubject.slice(0, 50)}"`);
      if (APPLY) {
        const { error: upErr } = await admin.from("sesizare_replies").update(replyUpdate).eq("id", r.id);
        if (upErr) console.error(`    ⚠ update reply eșuat: ${upErr.message}`);
      }
    }

    // Aplică status pe sesizare (forward-only).
    if (matchedId && r.ai_status) {
      const { data: ses } = await admin.from("sesizari").select("status").eq("id", matchedId).maybeSingle();
      const upd = computeStatusUpdate({
        currentStatus: (ses?.status as string | undefined) ?? "nou",
        aiStatus: r.ai_status,
        nrInregistrare: r.ai_nr_inregistrare,
        summary: newSummary,
        at: r.received_at,
      });
      if (upd) {
        statusUpdates++;
        console.log(`  📌 STATUS ${matchedCode ?? matchedId.slice(0, 8)}: ${ses?.status} → ${upd.status}${upd.nr_inregistrare ? ` (nr ${upd.nr_inregistrare})` : ""}`);
        if (APPLY) {
          const { error: stErr } = await admin.from("sesizari").update(upd).eq("id", matchedId);
          if (stErr) console.error(`    ⚠ update status eșuat: ${stErr.message}`);
        }
      }
    }
  }

  console.log(`\nGata. encoding reparat: ${fixedEncoding} · potriviri noi: ${newMatches} · status-uri actualizate: ${statusUpdates}`);
  console.log(APPLY ? "(scris în DB)" : "(dry-run — 0 scrise)");
}

main();
