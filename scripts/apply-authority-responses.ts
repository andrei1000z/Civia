/**
 * 2026-06-24 — one-shot: leagă răspunsurile autorităților (PDF-uri primite de
 * owner) de sesizările Civia corespunzătoare + aplică statusul, EXACT ca pipeline-ul
 * /api/inbox/reply (insert în `sesizare_replies` + computeStatusUpdate forward-only
 * pe `sesizari`). Codurile au fost identificate manual prin potrivire de locație
 * (vezi modul --find anterior). Idempotent: re-rularea nu dublează (skip pe nr).
 *
 *   npx tsx scripts/apply-authority-responses.ts          # DRY (raportează, nu scrie)
 *   npx tsx scripts/apply-authority-responses.ts --apply  # APLICĂ
 *
 * NOTE constraint: `sesizare_replies.ai_status` (migrarea 057) acceptă DOAR
 * inregistrata/in-lucru/rezolvat/redirectionata/respins/cerere_informatii/necunoscut.
 * „acțiune autoritate" (sancțiuni/montări) → mapat la `in-lucru`; detaliile concrete
 * rămân în `official_response`.
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

// code = codul Civia exact (identificat în modul --find). ai_status ∈ setul valid 057.
const RESPONSES = [
  { code: "00034", from_email: "bpr@b.politiaromana.ro", authority_name: "Brigada Rutieră București", nr: "1873848", ai_status: "in-lucru",
    summary: "Aspectele semnalate SE CONFIRMĂ. În 05–18.06.2026 polițiștii rutieri au sancționat oprirea/staționarea neregulamentară în zonă. S-au făcut demersuri la Comisia Tehnică de Circulație a PMB pentru amenajarea unei benzi unice de transport public; reglementarea va fi realizată de Administrația Străzilor." },
  { code: "00034", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "16588", ai_status: "in-lucru",
    summary: "Administrația Străzilor a montat stâlpișori de securizare pe Str. Carol Davila și Bd. Eroilor. Sesizarea a fost transmisă Poliției Locale pentru aplicarea continuă a sancțiunilor. Marcajele de parcare trasate pe trotuar au fost trimise spre reglementare către Consiliul Local Sector 5." },
  { code: "00036", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "16704", ai_status: "redirectionata",
    summary: "Sesizarea a fost redirecționată către Poliția Locală (pentru sancțiuni) și către TPBI (Asociația de Dezvoltare Intercomunitară pentru Transport Public București-Ilfov) pentru proiectarea benzii dedicate de transport public pe Șoseaua Panduri." },
  { code: "00027", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "15682", ai_status: "in-lucru",
    summary: "Artera intră în reabilitare (reparație trotuare + carosabil); în cadrul lucrărilor vor fi montați stâlpișori antiparcare și refăcute marcajele rutiere. Marcajele de parcare de pe trotuar au fost redirecționate către Consiliul Local Sector 5 pentru reglementare." },
  { code: "00027", from_email: "politialocala@sector5.ro", authority_name: "Poliția Locală Sector 5", nr: "81855", ai_status: "in-lucru",
    summary: "Polițiștii locali au efectuat verificări și au aplicat înștiințări + sancțiuni pe arterele semnalate. Două autovehicule staționate/abandonate pe Bd. Națiunile Unite au fost luate în evidență și somate (ridicare conform Legii 421/2002 dacă nu se conformează în termen)." },
  { code: "00017", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "16338", ai_status: "redirectionata",
    summary: "Securizarea trotuarului cu stâlpișori pe Str. Mântuleasa este avizată prin proiectul de înființare a parcajelor de utilitate publică cu plată; sesizarea a fost redirecționată către Compania Municipală Parking București pentru materializare." },
  { code: "00016", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "14630", ai_status: "in-lucru",
    summary: "Administrația Străzilor a dispus măsuri de refacere a marcajului de trecere pentru pietoni pe Str. Dr. Constantin Istrati nr. 6. Suplimentar, proiectul de semaforizare a intersecției a fost predat către PMB (Direcția Generală Investiții), în cadrul proiectului de semaforizare inteligentă BTMS." },
  { code: "00024", from_email: "office@aspmb.ro", authority_name: "Administrația Străzilor București", nr: "15319", ai_status: "in-lucru",
    summary: "Pe Barbu Văcărescu au fost montați stâlpișori flexibili pentru securizarea liniei 5 de tramvai. Stâlpișorii antiparcare pe trotuar nu pot fi montați momentan (amplasamentul nu a fost predat administrației; lucrări de modernizare a liniei de tramvai în curs)." },
];

async function main() {
  console.log(APPLY ? "=== MOD APLICARE ===\n" : "=== MOD DRY (nu scrie) ===\n");
  for (const r of RESPONSES) {
    const { data: ses, error } = await sb
      .from("sesizari").select("id,code,status,titlu").eq("code", r.code).maybeSingle();
    if (error) { console.log(`✗ ${r.code} (nr.${r.nr}): query error ${error.message}`); continue; }
    if (!ses) { console.log(`✗ ${r.code} (nr.${r.nr}): sesizarea nu există`); continue; }

    const curRank = STATUS_RANK[ses.status as string] ?? 0;
    const newRank = STATUS_RANK[r.ai_status] ?? 0;
    const willUpdate = newRank > curRank;
    console.log(`▸ ${ses.code} „${(ses.titlu as string).slice(0, 48)}" | ${ses.status}${willUpdate ? ` → ${r.ai_status}` : ` (rămâne — forward-only)`} | ${r.authority_name} nr.${r.nr}`);
    if (!APPLY) continue;

    // Insert reply (idempotent pe nr).
    const { data: dup } = await sb.from("sesizare_replies").select("id").eq("sesizare_id", ses.id as string).eq("ai_nr_inregistrare", r.nr).maybeSingle();
    if (dup) { console.log(`   = reply nr.${r.nr} există deja`); }
    else {
      const { error: insErr } = await sb.from("sesizare_replies").insert({
        sesizare_id: ses.id, from_email: r.from_email, from_name: r.authority_name,
        authority_name: r.authority_name, subject: `Răspuns oficial nr. ${r.nr}`,
        body_text: r.summary, match_method: "code", ai_status: r.ai_status, ai_confidence: 95,
        ai_summary: r.summary, ai_nr_inregistrare: r.nr, auto_applied: true,
        user_confirmed: true, trusted_sender: true, processed_at: new Date().toISOString(),
      });
      if (insErr) { console.log(`   ✗ insert reply EȘUAT: ${insErr.message}`); continue; }
      console.log(`   + reply inserat`);
    }

    if (willUpdate) {
      const { error: updErr } = await sb.from("sesizari").update({
        status: r.ai_status, nr_inregistrare: r.nr,
        official_response: r.summary, official_response_at: new Date().toISOString(),
      }).eq("id", ses.id as string);
      if (updErr) console.log(`   ✗ update status EȘUAT: ${updErr.message}`);
      else console.log(`   ↑ status → ${r.ai_status}`);
    }
  }
  console.log("\nGata.");
}
main();
