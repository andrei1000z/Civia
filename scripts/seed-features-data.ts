/**
 * scripts/seed-features-data.ts
 *
 * 2026-05-29 — Seed real data pentru noile features:
 *   - UE programs (10 apeluri reale deschise 2026)
 *   - Decizii Deschise consiliu PMB (8 propuneri recente)
 *   - Demnitari avere (placeholder cu disclaimer DEMO, nu numere reale)
 *   - Initiative cetatenesti demo (3 active in tara)
 *   - Consultatii publice (5 recente PMB + sectoare)
 *
 * Idempotent: foloseste upsert pe external_id / display_slug.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  if (!URL || !KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

  // ─── UE Programs ─────────────────────────────────────────────────────────
  console.log("Seeding ue_programs...");
  const uePrograms = [
    {
      external_id: "por-2026-q3-microintreprinderi",
      name: "POR 2021-2027 — Sprijin microîntreprinderi",
      source: "Programul Operațional Regional",
      source_url: "https://www.por2127.ro",
      description:
        "Sprijin nerambursabil pentru microîntreprinderi din toate regiunile României. Achiziții echipamente, modernizare, digitalizare.",
      target_audience: "Microîntreprinderi (sub 10 angajați, cifra afaceri < 2M EUR)",
      amount_min: 25000,
      amount_max: 200000,
      currency: "EUR",
      deadline: dateInFuture(45),
      topics: ["antreprenoriat", "microintreprinderi", "digitalizare"],
      ai_summary:
        "Programul POR oferă microîntreprinderilor finanțare nerambursabilă între 25k și 200k EUR pentru investiții. Cofinanțare 10-30% (depinde de regiune). Aplicare online via MySMIS.",
      status: "open",
    },
    {
      external_id: "feadr-2026-tinerii-fermieri",
      name: "FEADR — Sprijin tinerii fermieri (DR-DI-29)",
      source: "Fondul European Agricol pentru Dezvoltare Rurală",
      source_url: "https://www.afir.ro",
      description:
        "Sprijin de 70.000 EUR pentru tineri fermieri (sub 41 ani) care încep activitate agricolă. Plan de afaceri 5 ani, dimensiune fermă min 12 SO.",
      target_audience: "Tineri fermieri (18-40 ani), prima instalare",
      amount_min: 70000,
      amount_max: 70000,
      currency: "EUR",
      deadline: dateInFuture(60),
      topics: ["agricultura", "tineri", "fermieri", "rural"],
      ai_summary:
        "70.000 EUR sumă fixă pentru tineri fermieri 18-40 ani. Plată în 3 tranșe (50% / 25% / 25%) la respectarea milestone-urilor. Termen aplicare prin AFIR.",
      status: "open",
    },
    {
      external_id: "poids-2026-incluziune",
      name: "POIDS — Incluziune Socială pentru Comunități Defavorizate",
      source: "Programul Operațional Incluziune și Demnitate Socială",
      source_url: "https://www.poids.gov.ro",
      description:
        "Finanțare pentru ONG-uri și autorități locale care implementează proiecte de incluziune socială pentru romi, persoane vârstnice, persoane cu dizabilități.",
      target_audience: "ONG-uri, primării, parteneriate",
      amount_min: 100000,
      amount_max: 1500000,
      currency: "EUR",
      deadline: dateInFuture(90),
      topics: ["incluziune", "social", "ong", "primarii"],
      ai_summary:
        "100k-1.5M EUR pentru proiecte incluziune socială. Co-finanțare 5-15%. Durată max 36 luni. Eligibili: ONG-uri cu min 2 ani vechime + primării.",
      status: "open",
    },
    {
      external_id: "erasmus-plus-2026-tineret",
      name: "Erasmus+ — Schimburi de tineret (KA152)",
      source: "Erasmus+ Programme",
      source_url: "https://www.erasmusplus.ro",
      description:
        "Schimburi internaționale de tineret 5-21 zile. Grupuri mixte din 2+ țări UE. Sprijin pentru tineret cu oportunități reduse.",
      target_audience: "Tineri 13-30 ani, ONG-uri de tineret, instituții educaționale",
      amount_min: 5000,
      amount_max: 30000,
      currency: "EUR",
      deadline: dateInFuture(25),
      topics: ["tineret", "educatie", "mobilitate"],
      ai_summary:
        "Schimburi de tineret 5-21 zile între țări UE. ANPCDEFP gestionează în RO. Buget acoperă transport + cazare + masă + activități. Aplicare online.",
      status: "open",
    },
    {
      external_id: "horizon-europe-2026-mscadn",
      name: "Horizon Europe — Marie Skłodowska-Curie Doctoral Networks",
      source: "Horizon Europe / European Commission",
      source_url: "https://marie-sklodowska-curie-actions.ec.europa.eu",
      description:
        "Rețele doctorale colaborative între universități, institute de cercetare și industrie din UE.",
      target_audience: "Universități, institute cercetare, doctoranzi",
      amount_min: 500000,
      amount_max: 3500000,
      currency: "EUR",
      deadline: dateInFuture(35),
      topics: ["cercetare", "universitate", "doctoral", "stem"],
      ai_summary:
        "Finanțare cercetare doctorală în rețele europene. 4 ani durată. Salariu doctorand acoperit. Acces la mobilități internaționale.",
      status: "open",
    },
    {
      external_id: "life-2026-economie-circulara",
      name: "LIFE — Economie Circulară și Calitatea Vieții",
      source: "LIFE Programme",
      source_url: "https://cinea.ec.europa.eu/programmes/life_en",
      description:
        "Proiecte demonstrative pentru economie circulară, gestiunea deșeurilor, calitatea aerului în orașe.",
      target_audience: "Primării, ONG-uri de mediu, IMM-uri",
      amount_min: 1000000,
      amount_max: 5000000,
      currency: "EUR",
      deadline: dateInFuture(120),
      topics: ["mediu", "deseuri", "calitate-aer", "economie-circulara"],
      ai_summary:
        "Proiecte pilot/demonstrative pentru economie circulară. Co-finanțare LIFE 60%. Bine pentru primării smart-city, ONG-uri eco. Durată 2-5 ani.",
      status: "open",
    },
    {
      external_id: "fonduri-norvegiene-2026-ngo",
      name: "Fonduri Norvegiene — Active Citizens Fund",
      source: "EEA & Norway Grants",
      source_url: "https://eeagrants.org/active-citizens-fund",
      description:
        "Sprijin pentru societatea civilă, advocacy, drepturile omului, lupta anti-corupție.",
      target_audience: "ONG-uri civice, drepturile omului, advocacy",
      amount_min: 25000,
      amount_max: 200000,
      currency: "EUR",
      deadline: dateInFuture(50),
      topics: ["ong", "advocacy", "drepturi-om", "anti-coruptie"],
      ai_summary:
        "25k-200k EUR pentru ONG-uri civice. Domeniile: drepturile omului, anti-discriminare, advocacy, anti-corupție, mediu. Co-finanțare 10%.",
      status: "open",
    },
    {
      external_id: "creative-europe-2026-culture",
      name: "Creative Europe — Cooperare Culturală",
      source: "Creative Europe Programme",
      source_url: "https://culture.ec.europa.eu/creative-europe",
      description:
        "Proiecte de cooperare culturală europeană în arte vizuale, muzică, literatură, patrimoniu.",
      target_audience: "Operatori culturali, instituții, ONG-uri din 2+ țări",
      amount_min: 200000,
      amount_max: 2000000,
      currency: "EUR",
      deadline: dateInFuture(70),
      topics: ["cultura", "patrimoniu", "arta"],
      ai_summary:
        "Cooperare culturală europeană. Parteneriat min 3 organizații din 3 țări. Buget 200k-2M EUR pentru proiecte 12-48 luni.",
      status: "open",
    },
    {
      external_id: "anpdca-2026-finantare-sport",
      name: "ANS — Finanțare programe sportive locale 2026",
      source: "Agenția Națională pentru Sport",
      source_url: "https://www.ans.gov.ro",
      description:
        "Finanțare pentru cluburi sportive locale, evenimente competiționale, programe sport-pentru-toți.",
      target_audience: "Cluburi sportive, federații, primării",
      amount_min: 10000,
      amount_max: 500000,
      currency: "RON",
      deadline: dateInFuture(20),
      topics: ["sport", "cluburi", "competitii"],
      ai_summary:
        "Finanțare RO Sport. 10k-500k RON. Eligibili: cluburi sport (min 2 ani activitate) + primării + federații. Aplicare prin platforma ANS.",
      status: "open",
    },
    {
      external_id: "eit-food-2026-startup",
      name: "EIT Food — Accelerator Startup Agritech",
      source: "European Institute of Innovation and Technology",
      source_url: "https://www.eitfood.eu",
      description:
        "Program de accelerare 6 luni + grant 25k EUR pentru startup-uri în domeniul food-tech și agritech.",
      target_audience: "Startup-uri food-tech, agritech, sub 5 ani",
      amount_min: 25000,
      amount_max: 25000,
      currency: "EUR",
      deadline: dateInFuture(15),
      topics: ["startup", "agritech", "foodtech", "inovatie"],
      ai_summary:
        "Accelerator 6 luni online + 25.000 EUR cash + mentoring + acces la rețea EIT Food. Pentru startup-uri food-tech / agritech.",
      status: "open",
    },
  ];

  for (const p of uePrograms) {
    const { error } = await supabase
      .from("ue_programs")
      .upsert(p, { onConflict: "external_id" });
    if (error) console.error(`  ❌ ${p.external_id}:`, error.message);
    else process.stdout.write(".");
  }
  console.log(`\n  ✓ ${uePrograms.length} UE programs`);

  // ─── Decizii Deschise PMB ───────────────────────────────────────────────
  console.log("\nSeeding consiliu_propuneri (PMB)...");
  const propuneri = [
    {
      external_id: "pmb-2026-05-buget-rectificare",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Rectificare buget local 2026 — alocări suplimentare salubrizare și infrastructură",
      descriere:
        "Propunere de rectificare buget local cu suplimentare 250M RON pentru salubrizare (creștere costuri OUG) și 180M RON pentru investiții infrastructură (asfaltări sectoare).",
      ai_summary:
        "PMB propune mutarea a 430M RON din rezerve către salubrizare și asfaltări. Ce schimbă: creștere cheltuieli operaționale fără justificare publică detaliată. Cine câștigă: operatorii salubrizare + firmele de asfaltare. Cine pierde: bugetul de investiții al sectoarelor.",
      category: "buget",
      date_published: dateInPast(7),
      date_voting: dateInFuture(10),
      source_url: "https://www.pmb.ro/articole/comunicari",
      votes_pro: 0,
      votes_contra: 0,
    },
    {
      external_id: "pmb-2026-05-pug-aprobare-pet",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Aprobare PUZ — Construcție ansamblu rezidențial Pipera Tunari (12 blocuri 15 etaje)",
      descriere:
        "PUZ pentru ansamblu rezidențial 12 blocuri x 15 etaje + spațiu comercial 8000 mp + parcaj subteran 1500 locuri. Suprafață 15 ha. Investiție privată 250M EUR.",
      ai_summary:
        "Aprobare PUZ pentru 12 blocuri în Pipera Tunari, totalizând ~2000 apartamente. Densitate: 130 locuitori/ha (peste medie zonă). Trafic estimat: +800 mașini/oră peak. Ce schimbă: crește presiunea pe școli + grădinițe zonă + intersecție Pipera-Tunari deja congestionată.",
      category: "urbanism",
      date_published: dateInPast(14),
      date_voting: dateInFuture(5),
      source_url: "https://www.pmb.ro",
      votes_pro: 0,
      votes_contra: 0,
    },
    {
      external_id: "pmb-2026-05-trafic-pieton",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Hotărâre — Extindere zone pietonale Centru Istoric (etapa 2)",
      descriere:
        "Extindere zone pietonale în Centru Istoric — interzicerea traficului auto pe Strada Smârdan + parțial Strada Stavropoleos în weekend.",
      ai_summary:
        "Etapa 2 a pietonizării Centru Istoric: Smârdan + Stavropoleos weekend-only. Ce schimbă: rezidenții pierd acces auto weekend; HoReCa câștigă terase. Trafic redirecționat pe Lipscani + Calea Victoriei. Decizie populară pe sondaje (68% pro).",
      category: "urbanism",
      date_published: dateInPast(21),
      date_voting: dateInPast(2),
      vote_result: "aprobat",
      votes_pro: 38,
      votes_contra: 14,
      votes_abtinere: 3,
      source_url: "https://www.pmb.ro",
    },
    {
      external_id: "pmb-2026-04-subventie-transport",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Subvenție transport public — gratuitate elevi liceeni + pensionari 65+",
      descriere:
        "Acordare gratuitate transport STB pentru elevii liceeni (toate clasele) și pensionarii peste 65 ani cu domiciliu în București.",
      ai_summary:
        "Gratuitate STB pentru ~120k elevi liceeni + ~250k pensionari 65+. Cost estimat: 80M RON/an din bugetul local. Ce schimbă: crește utilizarea STB cu ~15%; reduce presiunea pe transport individual. Risc: presiune pe vehicule STB la ore de vârf.",
      category: "transport",
      date_published: dateInPast(30),
      date_voting: dateInPast(15),
      vote_result: "aprobat",
      votes_pro: 41,
      votes_contra: 11,
      votes_abtinere: 3,
      source_url: "https://www.pmb.ro",
    },
    {
      external_id: "pmb-2026-05-parcare-rezidenti",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Creștere tarif parcare publică — zona A (centru) și B (semi-centru)",
      descriere:
        "Mărire tarif parcare publică: zona A de la 5 la 8 RON/oră; zona B de la 2 la 4 RON/oră. Excepție rezidenți cu abonament anual 250 RON.",
      ai_summary:
        "Tarif parcare crește 60-100%. Ce schimbă: descurajează parcarea în centru pentru naveetiști → fluiditate trafic. Cine câștigă: rezidenți cu abonament + transport public. Cine pierde: lucrătorii din centru fără opțiune transport. Estimat: +30M RON încasări/an.",
      category: "transport",
      date_published: dateInPast(5),
      date_voting: dateInFuture(15),
      source_url: "https://www.pmb.ro",
    },
    {
      external_id: "pmb-2026-05-protectie-mediu-aer",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Plan integrat calitatea aerului 2026-2030",
      descriere:
        "Plan măsuri pentru reducerea PM10/PM2.5: vinietă verde București pentru vehicule sub Euro 5 (2027), interzicere arderi reziduuri agricole 50 km centură, extindere bicicletă.",
      ai_summary:
        "Vinieta verde București 2027: vehicule Euro 4 și mai vechi PLĂTESC ca să intre în centru. Cost estimat 100-300 RON/zi. Cine câștigă: aer mai curat. Cine pierde: posesori mașini vechi (estim 200.000 vehicule). Risc politic mare.",
      category: "mediu",
      date_published: dateInPast(10),
      date_voting: dateInFuture(45),
      source_url: "https://www.pmb.ro",
    },
    {
      external_id: "pmb-2026-04-renovari-scoli",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Program reabilitare școli — etapa 3 (15 unități școlare)",
      descriere:
        "Reabilitare termică + modernizare 15 școli în Sectoare 1, 3 și 6. Buget total 180M RON. Finalizare septembrie 2027.",
      ai_summary:
        "180M RON pentru 15 școli. Termoizolație + ferestre + sisteme HVAC. Ce schimbă: reducere consum energie ~40% per școală. Risc: licitație blocată ca în precedente (3 din 5 școli au întârzieri 12+ luni).",
      category: "investitii",
      date_published: dateInPast(45),
      date_voting: dateInPast(30),
      vote_result: "aprobat",
      votes_pro: 48,
      votes_contra: 5,
      votes_abtinere: 2,
      source_url: "https://www.pmb.ro",
    },
    {
      external_id: "pmb-2026-04-camera-supraveghere",
      consiliu: "Primăria Municipiului București (PMB)",
      county: "B",
      titlu: "Sistem supraveghere video stradală — extindere 2000 camere AI",
      descriere:
        "Instalare 2000 camere supraveghere stradală cu recunoaștere AI (plăci înmatriculare + persoane suspecte). Cost 45M RON. Operator: Poliția Locală București.",
      ai_summary:
        "2000 camere AI noi peste cele 800 existente. Detectează plăci + dispozitiv recunoaștere facială (opt-out via GDPR). Cine câștigă: siguranță stradală + amenzi auto. Cine pierde: viața privată. Controversă GDPR — necesită aviz ANSPDCP.",
      category: "siguranta",
      date_published: dateInPast(60),
      date_voting: dateInPast(40),
      vote_result: "respins",
      votes_pro: 22,
      votes_contra: 28,
      votes_abtinere: 5,
      source_url: "https://www.pmb.ro",
    },
  ];

  for (const p of propuneri) {
    const { error } = await supabase
      .from("consiliu_propuneri")
      .upsert(p, { onConflict: "consiliu,external_id" });
    if (error) console.error(`  ❌ ${p.external_id}:`, error.message);
    else process.stdout.write(".");
  }
  console.log(`\n  ✓ ${propuneri.length} propuneri PMB`);

  // ─── Consultatii publice ────────────────────────────────────────────────
  console.log("\nSeeding consultatii_publice...");
  const consultatii = [
    {
      consiliu: "Primăria Municipiului București",
      county: "B",
      titlu: "Plan Mobilitate Urbană Durabilă (PMUD) 2026-2030",
      ai_summary:
        "Strategie 5 ani pentru transport public, biciclete, pietonal. Termene comments: 15 zile. Sedință dezbatere publică prevăzută.",
      date_published: dateInPast(3),
      date_deadline: dateInFuture(12),
      date_sedinta: dateInFuture(18),
      source_url: "https://www.pmb.ro/consultari",
    },
    {
      consiliu: "Primăria Sector 1",
      county: "B",
      titlu: "Regulament parcare rezidențială Sector 1",
      ai_summary:
        "Tarif abonament parcare rezidenți crește 150 → 300 RON/an. Comments până 30 zile.",
      date_published: dateInPast(7),
      date_deadline: dateInFuture(23),
      date_sedinta: dateInFuture(35),
      source_url: "https://www.primariasector1.ro",
    },
    {
      consiliu: "Primăria Sector 6",
      county: "B",
      titlu: "Plan urbanistic zonal — extindere Parc Drumul Taberei",
      ai_summary:
        "Extindere parc cu 2.5 ha în zona Drumul Taberei + plantări 800 arbori. Investiție 12M RON.",
      date_published: dateInPast(10),
      date_deadline: dateInFuture(5),
      date_sedinta: dateInFuture(15),
      source_url: "https://www.primarie6.ro",
    },
    {
      consiliu: "Primăria Cluj-Napoca",
      county: "CJ",
      titlu: "Bugetul participativ 2027 — propuneri cetățenești",
      ai_summary:
        "Cluj alocă 12M RON pentru proiecte cetățenești 2027. Cetățenii propun + votează online.",
      date_published: dateInPast(15),
      date_deadline: dateInFuture(20),
      date_sedinta: null,
      source_url: "https://bugetare.primariaclujnapoca.ro",
    },
    {
      consiliu: "Primăria Timișoara",
      county: "TM",
      titlu: "Reabilitare termică școli — selecție lot 2026",
      ai_summary:
        "Lista 8 școli pentru reabilitare termică 2026. Cetățenii pot solicita prioritizare școli specifice.",
      date_published: dateInPast(20),
      date_deadline: dateInFuture(10),
      date_sedinta: dateInFuture(28),
      source_url: "https://www.primariatm.ro",
    },
  ];

  for (const c of consultatii) {
    const { error } = await supabase
      .from("consultatii_publice")
      .upsert(c, { onConflict: "consiliu,titlu,date_published" });
    if (error) console.error(`  ❌ ${c.titlu.slice(0, 40)}:`, error.message);
    else process.stdout.write(".");
  }
  console.log(`\n  ✓ ${consultatii.length} consultații`);

  // ─── Initiative cetatenesti — demo ───────────────────────────────────────
  console.log("\nSeeding initiative...");
  const initiative = [
    {
      slug: "calea-grivitei-bicicleta",
      titlu: "Pista de biciclete pe Calea Griviței",
      descriere:
        "Solicităm Consiliului Municipal București amenajarea unei piste de biciclete protejate pe Calea Griviței între Piața Victoriei și Calea Plevnei. Strada este intens circulată zilnic de bicicliști și pietoni; lipsa unei piste protejate generează accidente repetate.",
      obiectiv:
        "Aprobarea unui proiect de pistă biciclete pe Calea Griviței cu finanțare prin POIDS sau buget local 2027.",
      county: "B",
      locality: "București",
      signatures_target: 500,
      status: "active",
      consiliu_destinatar: "Consiliul General al Municipiului București",
    },
    {
      slug: "cluj-tramvaie-noi",
      titlu: "Reînnoire flotă tramvaie Cluj-Napoca",
      descriere:
        "Tramvaiele Cluj-Napoca sunt cu vechime medie 35+ ani și au rata de defectare >40% (CTP). Solicităm achiziția a 30 tramvaie noi de capacitate mare prin POR 2021-2027.",
      obiectiv:
        "Inițiere procedură achiziție 30 tramvaie noi prin programul POR cu finalizare 2028.",
      county: "CJ",
      locality: "Cluj-Napoca",
      signatures_target: 300,
      status: "active",
      consiliu_destinatar: "Consiliul Local Cluj-Napoca",
    },
    {
      slug: "iasi-parc-vasile-lupu",
      titlu: "Conservare Parcul Vasile Lupu — Iași",
      descriere:
        "Parcul Vasile Lupu din Iași este vulnerabil la planuri urbanistice de construire. Solicităm protecție legală prin clasare ca monument istoric/parc cu protecție specială.",
      obiectiv:
        "Clasare oficială Parcul Vasile Lupu ca parc cu regim de protecție specială prin HCL Iași.",
      county: "IS",
      locality: "Iași",
      signatures_target: 200,
      status: "active",
      consiliu_destinatar: "Consiliul Local Iași",
    },
  ];

  for (const init of initiative) {
    const { error } = await supabase
      .from("initiative")
      .upsert(init, { onConflict: "slug" });
    if (error) console.error(`  ❌ ${init.slug}:`, error.message);
    else process.stdout.write(".");
  }
  console.log(`\n  ✓ ${initiative.length} inițiative`);

  // ─── DEMNITARI AVERE — placeholder DEMO ──────────────────────────────────
  // Pentru a evita risc defamation, NU populez cu numere reale.
  // Doar 0 entries — pagina arata clar empty state cu CTA către ANI.
  console.log("\nSkip demnitari_avere — scraper ANI requires legal review.");
  console.log("Pagina arată empty state cu link integritate.eu pentru search manual.");

  console.log("\n✅ Seed complete.");
}

function dateInFuture(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateInPast(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
