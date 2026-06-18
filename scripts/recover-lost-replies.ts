/**
 * Recuperare răspunsuri autorități pierdute 12–17 iunie (webhook 401 din redirect
 * www→apex). Payload-urile complete sunt în inbox_debug_log.request_body (ruta le
 * logează ÎNAINTE de auth). Re-rulează pipeline-ul fidel: mojibake-repair → cod →
 * (OCR atașament) → match → classify → INSERT reply + apply status forward-only.
 *
 * DRY-RUN by default (fără OCR, doar clasificare text — rapid). `--apply` scrie
 * (cu OCR pe PDF-uri). Dedup pe message_id (sare cele deja în sesizare_replies).
 *
 *   npx tsx scripts/recover-lost-replies.ts            # dry-run
 *   npx tsx scripts/recover-lost-replies.ts --apply    # scrie în DB (+ OCR)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { extractSesizareCode } from "@/lib/inbox/extract-code";
import { matchReply } from "@/lib/inbox/match-reply";
import { classifyReply } from "@/lib/inbox/classify";
import { computeStatusUpdate, STATUS_RANK } from "@/lib/inbox/status-from-reply";
import { appendTimelineEvent } from "@/lib/sesizari/timeline-writer";
import { repairMojibake } from "@/lib/inbox/decode-mime";
import { extractPdf } from "@/lib/inbox/attachment-extractors/pdf";
import { extractImage } from "@/lib/inbox/attachment-extractors/image";

const APPLY = process.argv.includes("--apply");
const admin = createSupabaseAdmin();
const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const BUCKET = "civia-inbox-attachments";

async function fetchR2(key: string): Promise<Uint8Array | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

function extractFromName(from: string): string | null {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}

async function main() {
  console.log(APPLY ? "MOD: APPLY (scrie + OCR)\n" : "MOD: DRY-RUN (fără scriere, fără OCR)\n");

  // 1) payload-urile pierdute (401) din 06-12
  const { data: logs } = await admin
    .from("inbox_debug_log")
    .select("received_at, request_body")
    .eq("endpoint", "reply")
    .eq("http_status", 401)
    .gte("received_at", "2026-06-12T08:20:00Z")
    .order("received_at", { ascending: true });

  // 2) dedup pe message_id (+ skip cele deja în sesizare_replies)
  const { data: existing } = await admin.from("sesizare_replies").select("message_id");
  const existingMsgIds = new Set((existing ?? []).map((r: any) => r.message_id).filter(Boolean));

  const seen = new Set<string>();
  const items: Array<{ at: string; p: any }> = [];
  for (const l of (logs ?? []) as any[]) {
    let p: any; try { p = JSON.parse(l.request_body || "{}"); } catch { continue; }
    const msgId = p.message_id || p.headers?.["message-id"] || `${l.received_at}-${p.from}`;
    if (seen.has(msgId)) continue;
    seen.add(msgId);
    if (msgId && existingMsgIds.has(msgId)) continue; // deja procesat
    items.push({ at: l.received_at, p });
  }
  console.log(`${items.length} răspunsuri unice de recuperat (după dedup + skip existente)\n`);

  // status final per sesizare (pt. sumar)
  const perSesizare = new Map<string, { code: string; from: string; to: string; cur: string; final: string; nr: string | null; count: number }>();
  let stored = 0, applied = 0, orphan = 0, ocrDone = 0;

  for (const { at, p } of items) {
    const subject = repairMojibake(p.subject || "");
    let body = repairMojibake(p.body_text || p.body_html || "");
    const headers = p.headers || {};
    const atts = (p.attachments || []) as any[];

    // OCR pe atașamente dacă body sărac (doar la APPLY — lent)
    const attachmentsOut: any[] = [];
    if ((body.trim().length < 40) && atts.length && APPLY) {
      for (const a of atts) {
        let extracted = "";
        if (a.r2_key) {
          const bytes = await fetchR2(a.r2_key);
          if (bytes) {
            try {
              const ex = String(a.content_type).includes("pdf")
                ? await extractPdf({ bytes, contentType: a.content_type, filename: a.filename } as never)
                : await extractImage({ bytes, contentType: a.content_type, filename: a.filename } as never);
              extracted = ex.extracted_text || "";
              if (extracted) ocrDone++;
            } catch { /* ignore */ }
          }
        }
        attachmentsOut.push({ ...a, extracted_text: extracted });
        if (extracted) body += `\n[${a.filename}] ${extracted}`;
      }
    }

    // match: cod → cascadă
    const code = extractSesizareCode({ to: p.to || "", subject, body, headers } as any);
    const codeStr = code && typeof code === "object" ? (code as any).code : (code as any);
    const m = await matchReply({
      to: p.to || "", extractedCode: codeStr ?? null,
      inReplyTo: headers["in-reply-to"] || null, referencesChain: headers["references"] || null,
      fromEmail: p.from || "", replyText: `${subject} ${body}`, receivedAt: at, admin,
    });

    const cls = await classifyReply({ subject, body, authority_hint: extractFromName(p.from || "") ?? undefined, trusted_sender: m.confidence === "high" });

    const linked = m.sesizareId !== null;
    if (!linked) { orphan++; }

    // gate apply: match high + clasificare clară (mirror shouldAutoApply, simplificat)
    const eligible = linked && m.confidence === "high" && cls.confidence >= 85 &&
      !["necunoscut", "cerere_informatii"].includes(cls.status) && !cls.is_spam;

    if (APPLY && linked) {
      // INSERT reply (fidel rutei, câmpuri esențiale)
      await admin.from("sesizare_replies").insert({
        sesizare_id: m.sesizareId, from_email: p.from || null, from_name: extractFromName(p.from || ""),
        subject: subject || null, body_text: (p.body_text || null), body_html: p.body_html || null,
        raw_headers: headers, attachments: attachmentsOut.length ? attachmentsOut : (atts.length ? atts : null),
        ai_input_text: body || null, message_id: p.message_id || headers["message-id"] || null,
        in_reply_to: headers["in-reply-to"] || null, references_chain: headers["references"] || null,
        match_method: m.method, ai_status: cls.status, ai_confidence: cls.confidence,
        ai_summary: cls.summary, ai_nr_inregistrare: cls.nr_inregistrare, ai_deadline: cls.deadline,
        ai_suggested_action: cls.suggested_action, auto_applied: eligible, trusted_sender: m.confidence === "high",
        user_confirmed: eligible ? true : null, received_at: at, processed_at: new Date(0).toISOString(),
      });
      stored++;
    }

    // apply status forward-only
    let finalStatus = "";
    if (linked) {
      const { data: cur } = await admin.from("sesizari").select("id, status").eq("id", m.sesizareId!).maybeSingle();
      const curStatus = (cur as any)?.status ?? "nou";
      const upd = eligible ? computeStatusUpdate({ currentStatus: curStatus, aiStatus: cls.status, nrInregistrare: cls.nr_inregistrare, summary: cls.summary, at }) : null;
      finalStatus = upd?.status ?? curStatus;
      if (APPLY && upd) {
        await admin.from("sesizari").update(upd).eq("id", (cur as any).id);
        await appendTimelineEvent({ admin, sesizareId: (cur as any).id, eventType: upd.status, description: cls.summary?.slice(0, 200) ?? null, createdAt: at, sentryTags: { source: "recover_lost_replies" } });
        applied++;
      }
      // sumar per sesizare (cel mai avansat)
      const key = m.code || m.sesizareId!;
      const prev = perSesizare.get(key);
      const better = !prev || (STATUS_RANK[finalStatus] ?? 0) >= (STATUS_RANK[prev.final] ?? 0);
      perSesizare.set(key, {
        code: m.code || "?", from: p.from || "?", to: p.to || "",
        cur: prev?.cur ?? curStatus, final: better ? finalStatus : prev!.final,
        nr: cls.nr_inregistrare || prev?.nr || null, count: (prev?.count ?? 0) + 1,
      });
    }
  }

  console.log("=== SUMAR per sesizare ===");
  for (const [, v] of [...perSesizare.entries()].sort()) {
    const arrow = v.cur !== v.final ? `${v.cur} → ${v.final}` : `${v.final} (neschimbat)`;
    console.log(`#${v.code} | ${arrow} | nr=${v.nr ?? "—"} | ${v.count} răspuns(uri) | ${v.from}`);
  }
  console.log(`\nTotal: ${items.length} unice | orfani (fără match): ${orphan}${APPLY ? ` | stocate: ${stored} | statusuri aplicate: ${applied} | OCR: ${ocrDone}` : ""}`);
  if (!APPLY) console.log("\n(DRY-RUN — rulează cu --apply ca să scrie, inclusiv OCR pe PDF-uri)");
}
main().catch((e) => { console.error(e); process.exit(1); });
