/**
 * Reprocesare replies blocate la „necunoscut" din cauza extracției eșuate
 * (Gemini 429) sau clasificării eșuate (Groq 429).
 *
 * Fetch atașamente din R2 (via API Cloudflare) → re-OCR cu pipeline-ul curent
 * (rotație multi-cheie Gemini + fallback CF) → reclasifică cu cascada → update
 * sesizare_replies (ai_status, summary, nr_inregistrare + attachment text).
 *
 * Rulează DRY-RUN implicit. `--apply` scrie în DB.
 * Necesită: SUPABASE_SERVICE_ROLE_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN,
 * + cel puțin o cheie Gemini cu cotă (GEMINI_API_KEY[_2/_3]) pt. PDF scanate.
 *
 *   npx tsx scripts/reprocess-stuck-replies.ts          # dry-run
 *   npx tsx scripts/reprocess-stuck-replies.ts --apply  # scrie
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { extractPdf } from "../src/lib/inbox/attachment-extractors/pdf";
import { extractImage } from "../src/lib/inbox/attachment-extractors/image";
import { classifyReply } from "../src/lib/inbox/classify";

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
const BUCKET = "civia-inbox-attachments";

async function fetchR2(key: string): Promise<Uint8Array | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct}/r2/buckets/${BUCKET}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
}

async function main() {
  console.log(APPLY ? "MOD: APPLY (scrie în DB)\n" : "MOD: DRY-RUN (nimic scris)\n");
  const { data } = await sb
    .from("sesizare_replies")
    .select("id,authority_name,from_email,subject,body_text,ai_input_text,ai_status,attachments,sesizare_id")
    .eq("ai_status", "necunoscut")
    .order("received_at", { ascending: false });

  let recovered = 0, stillStuck = 0;
  for (const r of data || []) {
    const atts = r.attachments || [];
    let extraText = "";
    const updatedAtts = JSON.parse(JSON.stringify(atts));
    for (let i = 0; i < atts.length; i++) {
      const att = atts[i];
      // re-OCR doar pe cele care n-au text deja
      if (att.extracted_text && att.extracted_text.length > 50) {
        extraText += `\n${att.extracted_text}`;
        continue;
      }
      if (att.content_type !== "application/pdf" && !String(att.content_type).startsWith("image/")) continue;
      const bytes = await fetchR2(att.r2_key);
      if (!bytes) continue;
      const ex =
        att.content_type === "application/pdf"
          ? await extractPdf({ bytes, contentType: att.content_type, filename: att.filename } as never)
          : await extractImage({ bytes, contentType: att.content_type, filename: att.filename } as never);
      if (ex.extracted_text) {
        extraText += `\n[${att.filename}] ${ex.extracted_text}`;
        updatedAtts[i] = { ...att, extracted_text: ex.extracted_text, extraction_method: ex.extraction_method, extraction_error: null };
      }
    }

    const body = `${r.body_text || ""}${extraText}`.trim();
    if (body.length < 40) {
      console.log(`  ⏭️  ${r.authority_name || r.from_email} — OCR indisponibil (quota?) → rămâne pt. o rulare ulterioară`);
      stillStuck++;
      continue;
    }
    const res = await classifyReply({ subject: r.subject, body, sender_name: r.authority_name, authority_hint: r.authority_name });
    if (res.status === "necunoscut") {
      console.log(`  ➖ ${r.authority_name || r.from_email} — tot necunoscut după reprocesare`);
      stillStuck++;
      continue;
    }
    recovered++;
    console.log(`  ✅ ${r.authority_name || r.from_email}: necunoscut → ${res.status} (conf ${res.confidence}) nr=${res.nr_inregistrare || "-"}`);
    if (APPLY) {
      const { error } = await sb.from("sesizare_replies").update({
        ai_status: res.status,
        ai_summary: res.summary,
        ai_nr_inregistrare: res.nr_inregistrare,
        ai_deadline: res.deadline,
        attachments: updatedAtts,
        ai_input_text: body.slice(0, 50_000),
      }).eq("id", r.id);
      console.log(error ? `     ✗ update err: ${JSON.stringify(error).slice(0, 100)}` : "     ✓ actualizat");
    }
  }
  console.log(`\n=== ${recovered} recuperate · ${stillStuck} rămase (re-rulează după ce quota Gemini revine / adaugi GEMINI_API_KEY_2) ===`);
}
main().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
