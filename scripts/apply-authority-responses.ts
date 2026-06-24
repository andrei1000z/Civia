/**
 * 2026-06-24 — one-shot: leagă răspunsurile autorităților (PDF-uri primite de
 * owner) de sesizările Civia + aplică statusul REAL (forward-only), ca pipeline-ul
 * /api/inbox/reply (insert/update în `sesizare_replies` + update pe `sesizari`).
 * UPSERT pe nr_inregistrare (idempotent + corectează statusul la re-rulare).
 *
 *   npx tsx scripts/apply-authority-responses.ts          # DRY
 *   npx tsx scripts/apply-authority-responses.ts --apply  # APLICĂ
 *
 * (Migrarea 107 a aliniat `sesizare_replies.ai_status` cu setul complet din
 *  `sesizari.status`, deci putem marca statusul REAL: rezolvat / acțiune-autoritate.)
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: existsSync(".env.vercel.local") ? ".env.vercel.local" : ".env.local" });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase env"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");

const STATUS_RANK: Record<string, number> = {
  nou: 0, trimis: 1, inregistrata: 2, "in-lucru": 3, "actiune-autoritate": 4,
  redirectionata: 4, interventie: 5, amanata: 5, rezolvat: 6,
};

const RESPONSES = [
  // 00034 — Carol Davila × Eroilor: stâlpișori MONTAȚI ⇒ rezolvat (ASB); sancțiuni ⇒ acțiune (Brigada)
  { code: "00034", from_email: "bpr@b.politiaromana.ro", authority_name: "Brigada Rutieră București", nr: "1873848", ai_status: "actiune-autoritate",
    summary: "Aspectele semnalate SE CONFIRMĂ. În 05–18.06.2026 polițiștii rutieri au sancționat oprirea/staționarea neregulamentară în zonă. S-au făcut demersuri la Comisia Tehnică de Circulație a PMB pentru o bandă unică de transport public; reglementarea va fi realizată de Administrația Străzilor." },
  { code: "00034", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "16588", ai_status: "rezolvat",
    summary: "REZOLVAT — Administrația Străzilor a MONTAT stâlpișori de securizare pe Str. Carol Davila și Bd. Eroilor. Sesizarea a fost transmisă și Poliției Locale pentru sancționare continuă; marcajele de parcare de pe trotuar au fost trimise la Consiliul Local Sector 5." },
  // 00036 — bandă STB Panduri: redirecționat
  { code: "00036", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "16704", ai_status: "redirectionata",
    summary: "Redirecționat către Poliția Locală (sancțiuni) și către TPBI (Asociația de Dezvoltare Intercomunitară Transport Public București-Ilfov) pentru proiectarea benzii dedicate de transport public pe Șoseaua Panduri." },
  // 00027 — Națiunile Unite × Poliției: reabilitare (in-lucru) + sancțiuni/somații (acțiune)
  { code: "00027", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "15682", ai_status: "in-lucru",
    summary: "Artera intră în reabilitare (reparație trotuare + carosabil); în cadrul lucrărilor vor fi montați stâlpișori antiparcare și refăcute marcajele. Marcajele de parcare de pe trotuar au fost redirecționate către Consiliul Local Sector 5." },
  { code: "00027", from_email: "politialocala@sector5.ro", authority_name: "Poliția Locală Sector 5", nr: "81855", ai_status: "actiune-autoritate",
    summary: "Polițiștii locali au efectuat verificări și au aplicat înștiințări + sancțiuni. Două autovehicule staționate/abandonate pe Bd. Națiunile Unite au fost luate în evidență și somate (ridicare conform Legii 421/2002 dacă nu se conformează)." },
  // 00017 — Mântuleasa: redirecționat la CMPB
  { code: "00017", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "16338", ai_status: "redirectionata",
    summary: "Securizarea trotuarului cu stâlpișori e avizată prin proiectul de parcaje de utilitate publică cu plată; redirecționat către Compania Municipală Parking București pentru materializare." },
  // 00016 — C. Istrati 6: marcaj în refacere (acțiune) + semaforizare predată la DGI
  { code: "00016", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "14630", ai_status: "actiune-autoritate",
    summary: "Administrația Străzilor a dispus REFACEREA marcajului de trecere pentru pietoni pe Str. Dr. Constantin Istrati nr. 6. Suplimentar, proiectul de semaforizare a intersecției a fost predat către PMB (Direcția Generală Investiții), în proiectul de semaforizare inteligentă BTMS." },
  // 00024 — Barbu Văcărescu: stâlpișori tramvai montați (rămâne rezolvat)
  { code: "00024", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "15319", ai_status: "actiune-autoritate",
    summary: "Pe Barbu Văcărescu au fost montați stâlpișori flexibili pentru securizarea liniei 5 de tramvai. Stâlpișorii antiparcare pe trotuar nu pot fi montați momentan (amplasament nepredat; lucrări de modernizare a liniei în curs)." },
  // 00015 — banner Șoșoacă, Str. Turda 117-119 (S1): redirecționat la PS1
  { code: "00015", from_email: "office@plmb.ro", authority_name: "Poliția Locală București (DGPL)", nr: "58125", ai_status: "redirectionata",
    summary: "Direcția Generală de Poliție Locală a transmis sesizarea către Primăria Sectorului 1 (Poliția Locală Sector 1), competentă pentru autorizarea și controlul afișajului pe imobilul din Str. Turda 117-119." },
];

async function main() {
  console.log(APPLY ? "=== MOD APLICARE ===\n" : "=== MOD DRY (nu scrie) ===\n");
  for (const r of RESPONSES) {
    const { data: ses, error } = await sb.from("sesizari").select("id,code,status,titlu").eq("code", r.code).maybeSingle();
    if (error) { console.log(`✗ ${r.code} nr.${r.nr}: ${error.message}`); continue; }
    if (!ses) { console.log(`✗ ${r.code} nr.${r.nr}: sesizarea nu există`); continue; }
    const curRank = STATUS_RANK[ses.status as string] ?? 0;
    const newRank = STATUS_RANK[r.ai_status] ?? 0;
    const willUpdate = newRank > curRank;
    console.log(`▸ ${ses.code} „${(ses.titlu as string).slice(0, 44)}" | ${ses.status}${willUpdate ? ` → ${r.ai_status}` : ` (rămâne)`} | ${r.authority_name} nr.${r.nr} [${r.ai_status}]`);
    if (!APPLY) continue;

    const { data: dup } = await sb.from("sesizare_replies").select("id").eq("sesizare_id", ses.id as string).eq("ai_nr_inregistrare", r.nr).maybeSingle();
    if (dup) {
      const { error: e } = await sb.from("sesizare_replies").update({ ai_status: r.ai_status, ai_summary: r.summary, body_text: r.summary }).eq("id", (dup as { id: string }).id);
      console.log(e ? `   ✗ update reply: ${e.message}` : `   ~ reply actualizat (${r.ai_status})`);
    } else {
      const { error: e } = await sb.from("sesizare_replies").insert({
        sesizare_id: ses.id, from_email: r.from_email, from_name: r.authority_name, authority_name: r.authority_name,
        subject: `Răspuns oficial nr. ${r.nr}`, body_text: r.summary, match_method: "code", ai_status: r.ai_status,
        ai_confidence: 95, ai_summary: r.summary, ai_nr_inregistrare: r.nr, auto_applied: true,
        user_confirmed: true, trusted_sender: true, processed_at: new Date().toISOString(),
      });
      console.log(e ? `   ✗ insert reply: ${e.message}` : `   + reply inserat (${r.ai_status})`);
    }

    if (willUpdate) {
      const { error: e } = await sb.from("sesizari").update({
        status: r.ai_status, nr_inregistrare: r.nr, official_response: r.summary, official_response_at: new Date().toISOString(),
      }).eq("id", ses.id as string);
      console.log(e ? `   ✗ update status: ${e.message}` : `   ↑ status → ${r.ai_status}`);
    }
  }
  console.log("\nGata.");
}
main();
