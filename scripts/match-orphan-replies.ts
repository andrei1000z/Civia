/**
 * Leagă replies orfane (sesizare_id NULL) de sesizarea corectă, când emailul
 * autorității n-a conținut codul Civia (ex. „Primaria Sectorului 1: înregistrare
 * cerere", „răspuns sesizare" cu PDF). Cascadă:
 *   1. Domeniu autoritate cu EXACT 1 candidat (sesizare trimisă la acel domeniu).
 *   2. Scor de adresă: token-overlap între textul reply-ului (body + OCR atașat)
 *      și `locatie` candidaților — câștigător clar (margine ≥ 2).
 * Dacă reply-ul e o confirmare/răspuns substanțial, avansează și statusul
 * sesizării (forward-only, computeStatusUpdate).
 *
 * Dry-run implicit; `--apply` scrie.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { computeStatusUpdate } from "../src/lib/inbox/status-from-reply";

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const dom = (e: string) => (e || "").split("@")[1] || "";
const baseDom = (d: string) =>
  d.replace(
    /^(www|registratura|noreply|contact|secretariat|circulatie\.rutiera|portal|noreply\.portal|noreply\.eps2|office|relatii|relatiicupublicul)\./,
    "",
  );
const STOP = new Set([
  "sector", "strada", "str", "calea", "cale", "bulevardul", "bdul", "soseaua", "sos",
  "nr", "numarul", "intre", "din", "fata", "aferent", "municipiul", "bucuresti",
  "trotuar", "trotuarul", "pe", "la", "si", "de", "cu",
]);
const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const toks = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length >= 3 && !STOP.has(t)));

interface Sez {
  id: string; code: string; locatie: string | null; titlu: string | null;
  author_email: string | null; sent_to_emails: string[] | null; status: string;
  sent_at: string | null; sent_via_civia: boolean | null;
}

async function main() {
  console.log(APPLY ? "MOD: APPLY\n" : "MOD: DRY-RUN\n");
  const { data: orf } = await sb.from("sesizare_replies")
    .select("id,from_email,subject,authority_name,ai_status,ai_summary,ai_nr_inregistrare,body_text,ai_input_text,attachments,received_at")
    .is("sesizare_id", null).order("received_at", { ascending: false });
  const { data: sezAll } = await sb.from("sesizari").select("id,code,locatie,titlu,author_email,sent_to_emails,status,sent_at,sent_via_civia");
  const SEZ = (sezAll || []) as Sez[];

  let matched = 0, skipped = 0;
  for (const o of orf || []) {
    const odom = baseDom(dom(o.from_email));
    if (["gmail.com", "civia.ro", "civia.com", "yahoo.com"].includes(odom)) {
      console.log(`  skip (personal/self): ${o.from_email}`); skipped++; continue;
    }

    // text de matchuit: subiect + body + OCR + NUMELE fișierelor (conțin adesea
    // adresa/subiectul, ex. „...CALEA GRIVITEI X HALTA GRIVITA.pdf").
    const attText = (o.attachments || [])
      .map((a: { extracted_text?: string; filename?: string }) => `${a.filename || ""} ${a.extracted_text || ""}`)
      .join(" ");
    const rTok = toks(`${o.subject || ""} ${o.body_text || ""} ${o.ai_input_text || ""} ${attText}`);

    // CONSTRÂNGERE (user): un răspuns poate fi DOAR pentru o sesizare trimisă
    // EFECTIV via Civia (sent_at ne-null) ȘI trimisă ÎNAINTE de sosirea
    // răspunsului. Exclude sesizările vechi/manuale (sent_at=null, ex. 00001)
    // — n-aveau cum să primească răspuns prin pipeline-ul Civia.
    const replyAt = new Date(o.received_at).getTime();
    const eligible = SEZ.filter((s) => s.sent_at && new Date(s.sent_at).getTime() <= replyAt + 3600_000);

    const candByDom = eligible.filter((s) => (s.sent_to_emails || []).some((e) => baseDom(dom(e)) === odom));
    const inDom = new Set(candByDom.map((s) => s.id));

    // Scor DOAR pe `locatie` (adresa = discriminantul) pe sesizările eligibile
    // (trimise via Civia înainte de reply). Titlul ar dilua (e generic).
    const scored = eligible.map((s) => {
      const sTok = toks(s.locatie || "");
      let score = 0; for (const t of sTok) if (rTok.has(t)) score++;
      if (inDom.has(s.id) && score > 0) score += 1;
      return { s, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    const top = scored[0], second = scored[1];

    // ÎNCREDERE: ÎNALTĂ = câștigător clar (scor ≥2 + margine ≥2) SAU domeniu unic
    // eligibil. Doar ÎNALTĂ se auto-aplică (--apply). Restul = sugestii pt. om.
    // Auto-apply DOAR la certitudine reală: adresă cu scor MARE (≥3 = mai multe
    // tokenuri de adresă, inclusiv numărul) + margine ≥2, SAU domeniu unic
    // eligibil. Restul = sugestii pentru confirmare umană (matching-ul pe adresă
    // e fragil: străzi vecine, redirecționări, scoruri mici coincidentale).
    let pick: Sez | null = null, reason = "", conf = "—";
    if (top && top.score >= 3 && (!second || top.score - second.score >= 2)) {
      pick = top.s; reason = `adresă scor ${top.score} vs ${second?.score ?? 0}`; conf = "ÎNALTĂ";
    } else if (candByDom.length === 1 && (!top || top.score < 3)) {
      pick = candByDom[0]; reason = "domeniu unic eligibil"; conf = "ÎNALTĂ";
    } else if (top && top.score >= 2) {
      pick = top.s; reason = `adresă scor ${top.score} vs ${second?.score ?? 0}`; conf = "MEDIE";
    }

    const sug = scored.slice(0, 3).map((x) => `${x.s.code}(${x.score})`).join(", ") || "niciun candidat eligibil";
    if (!pick || conf !== "ÎNALTĂ") {
      console.log(`  ❓ ${conf === "MEDIE" ? "SUGESTIE(medie)" : "NEMATCHUIT"}: ${o.authority_name || o.from_email} „${(o.subject || "").slice(0, 26)}" [ai=${o.ai_status}]`);
      console.log(`       candidați: ${sug}${pick ? ` → probabil ${pick.code}` : ""}`);
      skipped++; continue;
    }

    matched++;
    console.log(`  ✅ ${conf} ${o.authority_name || o.from_email} „${(o.subject || "").slice(0, 24)}" → ${pick.code} (${reason}) [${pick.status}→, ai=${o.ai_status}]`);

    if (APPLY) {
      await sb.from("sesizare_replies").update({ sesizare_id: pick.id }).eq("id", o.id);
      const upd = computeStatusUpdate({
        currentStatus: pick.status, aiStatus: o.ai_status,
        nrInregistrare: o.ai_nr_inregistrare, summary: o.ai_summary, at: new Date().toISOString(),
      });
      if (upd) {
        await sb.from("sesizari").update(upd).eq("id", pick.id);
        await sb.from("sesizare_timeline").insert({
          sesizare_id: pick.id, event_type: upd.status,
          description: "Răspuns oficial atașat retroactiv (matching pe conținut/domeniu).",
        });
        console.log(`       → sesizare ${pick.status} → ${upd.status}`);
      }
    }
  }
  console.log(`\n=== ${matched} matchuite · ${skipped} sărite ===`);
}
main().catch((e) => console.log("FATAL", e instanceof Error ? e.message : e));
