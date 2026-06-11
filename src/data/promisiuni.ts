// Promisometru (Faza 3) — promisiuni publice ale primarilor, urmărite cu sursă
// + termen + verdict FACTUAL. Curatoriat manual (ca PROVOCARI/PETITII): fiecare
// intrare TREBUIE să aibă sursă de presă/oficială reală și verdict neacuzator.
// REGULĂ LEGALĂ: nota descrie FAPTE verificabile („termenul anunțat a trecut;
// nu există anunț de finalizare"), niciodată intenții/acuzații („a mințit").

export type PromisiuneStatus =
  | "respectata" // livrată, cu dovadă (anunț de finalizare)
  | "in-curs" // înainte de termen, lucrări/pași vizibili
  | "intarziata" // termenul a trecut fără anunț de finalizare
  | "incalcata"; // abandonată explicit / anulată (dovadă solidă)

export interface Promisiune {
  /** Slug stabil (kebab-case) — cheie React + ancoră. */
  id: string;
  /** Cine a promis (persoană sau instituție). */
  autoritate: string;
  /** Funcția la momentul promisiunii (ex: „Primar Sector 2"). */
  functie: string;
  /** Cod județ (B = București) — pentru filtrare viitoare. */
  county: string;
  /** Promisiunea, concis și fidel sursei. */
  promisiune: string;
  /** Termenul promis, uman („sfârșitul lui 2026") sau „nedeclarat". */
  termen: string;
  /** Termen mașină (YYYY-MM-DD) pentru sortare/countdown; null = nedeclarat. */
  termenIso: string | null;
  /** Sursa primară (articol de presă / comunicat oficial). */
  sursaUrl: string;
  publicatie: string;
  /** Data sursei (YYYY-MM-DD). */
  dataSursa: string;
  status: PromisiuneStatus;
  /** Verdict FACTUAL, neacuzator, 1-2 fraze. */
  nota: string;
  /** Ultima reevaluare a statusului (YYYY-MM-DD). */
  verificatLa: string;
}

// Intrările BULK (research la scară, verificate adversarial) sunt generate
// PROGRAMATIC în promisiuni-bulk.json de scripts/qa/convert-promisiuni.mjs —
// JSON ca să fie imun la capcanele de ghilimele din string-urile TS. Validate
// de aceleași teste ca intrările curate (sursă https, notă factuală, county…).
import PROMISIUNI_BULK from "./promisiuni-bulk.json";

// Seed 2026-06-11 — 5 promisiuni verificate adversarial (research 32 agenți:
// fiecare sursă citită + confirmată; statusurile ajustate pe principiul minimei
// afirmații — „întârziată" în loc de „încălcată" când livrarea e re-promisă).
const PROMISIUNI_CURATE: Promisiune[] = [
  {
    id: "ciucu-spitale-noi-2027",
    autoritate: "Ciprian Ciucu",
    functie: "Primar General al Bucureștiului",
    county: "B",
    promisiune:
      "Construirea a două spitale noi: clinică de psihiatrie pediatrică în Sectorul 4 și spital clinic cu 307 paturi, 8 săli de operație și 33 de specialități pe Bd. Timișoara 101E (Sectorul 6).",
    termen: "2027",
    termenIso: "2027-12-31",
    sursaUrl:
      "https://www.capital.ro/ciprian-ciucu-anunta-construirea-a-doua-spitale-noi-in-bucuresti-proiectele-se-vor-finaliza-in-2027.html",
    publicatie: "Capital",
    dataSursa: "2025-12-01",
    status: "in-curs",
    nota:
      "Anunțată în decembrie 2025, cu termen 2027. La clinica de psihiatrie pediatrică (S4) fundațiile sunt în curs; la spitalul din S6 licitația e finalizată, dar construcția fizică nu a început (iunie 2026).",
    verificatLa: "2026-06-11",
  },
  {
    id: "tuta-parcare-digitala-s1",
    autoritate: "George Tuță",
    functie: "Primar Sector 1",
    county: "B",
    promisiune:
      "Digitalizarea sistemului de parcare din Sectorul 1, în faze: audit în 2025, testare în 2-3 zone-pilot în 2026, extindere la nivel de sector în 2026-2027.",
    termen: "2026-2027",
    termenIso: "2027-12-31",
    sursaUrl:
      "https://primariasector1.ro/consiliul-local-a-votat-reguli-noi-de-parcare-in-sectorul-1-veniturile-din-abonamente-se-intorc-in-infrastructura-de-mobilitate-urbana/",
    publicatie: "Primăria Sector 1 (comunicat oficial)",
    dataSursa: "2024-10-15",
    status: "in-curs",
    nota:
      "Calendarul oficial prevedea pilotul în T1 2026 și extinderea în 2026-2027. În iunie 2026, proiectul se află în interiorul perioadei anunțate pentru etapa de extindere.",
    verificatLa: "2026-06-11",
  },
  {
    id: "hopinca-parcari-supraetajate-s2",
    autoritate: "Rareș Hopincă",
    functie: "Primar Sector 2",
    county: "B",
    promisiune:
      "Construirea a 11 parcări supraetajate între blocuri și 7.000 de noi locuri de parcare rezidențială în primii doi ani de mandat (până în mai 2026).",
    termen: "mai 2026",
    termenIso: "2026-05-31",
    sursaUrl:
      "https://buletin.de/bucuresti/sector-2-rares-hopinca-a-promis-in-campania-electorala-11-parcari-supraetajate-si-7-000-de-noi-locuri-de-parcare-in-doi-ani-cat-a-realizat/",
    publicatie: "Buletin de București",
    dataSursa: "2024-06-01",
    status: "intarziata",
    nota:
      "Termenul de doi ani (mai 2026) a trecut: nicio parcare supraetajată finalizată — proiectele sunt la stadiul de studii de fezabilitate, cu livrare estimată de primărie pentru 2027-2028. Din cele 7.000 de locuri promise au fost realizate ~2.623 (37%).",
    verificatLa: "2026-06-11",
  },
  {
    id: "negoita-complex-acvatic-pantelimon",
    autoritate: "Robert Negoiță",
    functie: "Primar Sector 3",
    county: "B",
    promisiune:
      "Finalizarea Complexului Acvatic din Parcul Pantelimon (piscine, spații de joacă, amenajări) în 6 luni de la anunțul din decembrie 2025.",
    termen: "~18 iunie 2026",
    termenIso: "2026-06-18",
    sursaUrl:
      "https://buletin.de/bucuresti/robert-negoita-isi-cere-scuze-pentru-intarzierile-de-la-parcul-acvatic-pantelimon-nu-este-inca-gata-ca-s-au-terminat-banii/",
    publicatie: "Buletin de București",
    dataSursa: "2025-12-18",
    status: "in-curs",
    nota:
      "În decembrie 2025, primarul și-a cerut scuze pentru întârzieri (proiectul rămăsese nefinalizat din lipsă de fonduri) și a anunțat finalizarea în 6 luni. Termenul expiră în jurul datei de 18 iunie 2026; până la 11 iunie nu există anunț public de deschidere.",
    verificatLa: "2026-06-11",
  },
  {
    id: "negoita-modernizare-ior",
    autoritate: "Robert Negoiță",
    functie: "Primar Sector 3",
    county: "B",
    promisiune:
      "Modernizarea Parcului IOR: 17 locuri de joacă reabilitate, 24 de zone de lucru, 20 de spații comerciale, 20 de grupuri sanitare, 1.150 de stâlpi LED și plantări pe 47.000 m².",
    termen: "noiembrie 2027",
    termenIso: "2027-11-30",
    sursaUrl:
      "https://buletin.de/bucuresti/primarul-robert-negoita-nu-renunta-la-planurile-de-modernizare-consultare-publica-pentru-ior-si-alte-trei-parcuri-din-sectorul-3/",
    publicatie: "Buletin de București",
    dataSursa: "2025-11-04",
    status: "in-curs",
    nota:
      "Proiect anunțat în noiembrie 2025, cu durată estimată de 2 ani (termen noiembrie 2027). În iunie 2026 se află la circa o treime din perioada asumată, fără anunțuri publice recente despre stadiul execuției.",
    verificatLa: "2026-06-11",
  },
  // ─── Val 3b (resume research v3 — PMB, Metrorex, încălcate documentate) ───
  {
    id: "pmb-semaforizare-inteligenta",
    autoritate: "Primăria Municipiului București",
    functie: "Primărie (mandatul Ciucu)",
    county: "B",
    promisiune:
      "Semaforizare inteligentă cu AI în 580 de intersecții: senzori magnetometrici, 300+ camere video, 1.500 de senzori, prioritate pentru transportul public (investiție ~52 de milioane de euro, nerambursabilă).",
    termen: "etapizat (faza 1: ~14 luni de la start)",
    termenIso: null,
    sursaUrl:
      "https://cursdeguvernare.ro/primaria-capitalei-investeste-52-de-milioane-de-euro-pentru-a-introduce-semafoare-inteligente-in-580-de-intersectii.html",
    publicatie: "Curs de Guvernare",
    dataSursa: "2026-02-14",
    status: "in-curs",
    nota:
      "Proiect anunțat în februarie 2026 (studii de fezabilitate ~95% la acel moment) și aprobat de Consiliul General în mai 2026. Termenele pe faze nu au fost asumate public cu date fixe.",
    verificatLa: "2026-06-11",
  },
  {
    id: "ciucu-park-ride-domnesti",
    autoritate: "Ciprian Ciucu",
    functie: "Primar General al Bucureștiului",
    county: "B",
    promisiune:
      "Nod intermodal Park & Ride la Pasajul Domnești (Prelungirea Ghencea): 470 de locuri acoperite + 20 pentru persoane cu dizabilități + 50 cu stații de încărcare electrică (investiție 62,2 milioane lei).",
    termen: "primăvara 2028",
    termenIso: "2028-05-31",
    sursaUrl:
      "https://b365.ro/prelungirea-ghencea-va-fi-gata-anul-acesta-promite-ciprian-ciucu-cand-au-termen-lucrarile-la-noua-sina-de-tramvai-si-park-ride-ul-de-aici-593456/",
    publicatie: "B365",
    dataSursa: "2026-01-28",
    status: "in-curs",
    nota:
      "Promisiune din ianuarie 2026, cu termen primăvara 2028 și detalii tehnice asumate public. La data verificării nu există încă raportări de execuție pentru nodul intermodal.",
    verificatLa: "2026-06-11",
  },
  {
    id: "metrorex-13-trenuri-noi",
    autoritate: "Metrorex",
    functie: "Compania de metrou (Min. Transporturilor)",
    county: "B",
    promisiune:
      "Achiziția a 13 trenuri de metrou noi în perioada 2026-2029, cu opțiune pentru încă 50, cu finanțare din fonduri europene (plan inclus în bugetul de stat).",
    termen: "2026-2029",
    termenIso: "2029-12-31",
    sursaUrl:
      "https://buletin.de/bucuresti/planul-metrorex-pentru-2026-2029-inclus-in-bugetul-de-stat-extinderi-de-magistrale-si-achizitia-de-zeci-trenuri-noi/",
    publicatie: "Buletin de București",
    dataSursa: "2026-03-10",
    status: "in-curs",
    nota:
      "Planul de achiziție (13 trenuri + opțiune 50) a fost inclus în bugetul de stat și confirmat public în martie 2026; perioada asumată e 2026-2029.",
    verificatLa: "2026-06-11",
  },
  {
    id: "negoita-pasaj-unirii",
    autoritate: "Robert Negoiță",
    functie: "Primar Sector 3",
    county: "B",
    promisiune:
      "Pasaj subteran de 2 km sub Bulevardul Unirii, cu parcare subterană de 3.000 de locuri și transformarea suprafeței în zonă pietonală („street mall”).",
    termen: "~2023 (2 ani de la startul estimat în 2021)",
    termenIso: "2023-12-31",
    sursaUrl:
      "https://hotnews.ro/stiri-administratie_locala-24185099-dezbatere-publica-primarul-sectorului-3-robert-negoita-vrea-construiasca-pasaj-2km-sub-bulevarul-unirii-zona-suprafata-deveni-pietonala-street-mall.htm",
    publicatie: "HotNews",
    dataSursa: "2020-07-21",
    status: "incalcata",
    nota:
      "Anunțat în iulie 2020, cu execuție estimată la 2 ani de la un start în 2021. Proiectul nu a fost aprobat și nu a fost realizat — la șase ani de la anunț nu există progres documentat.",
    verificatLa: "2026-06-11",
  },
  {
    id: "negoita-derdelus-pantelimon",
    autoritate: "Robert Negoiță",
    functie: "Primar Sector 3",
    county: "B",
    promisiune:
      "Derdeluș (pârtie de sanie) în Parcul Pantelimon, ca parte din amenajările recreative — construcție începută în vara lui 2019, promis pentru 2020.",
    termen: "2020",
    termenIso: "2020-12-31",
    sursaUrl:
      "https://buletin.de/bucuresti/bilantul-lui-robert-negoita-ce-n-a-realizat-edilul-de-la-3-derdelusul-si-fantanile-care-vantura-apa/",
    publicatie: "Buletin de București",
    dataSursa: "2019-06-01",
    status: "incalcata",
    nota:
      "Construcția a început în vara lui 2019, cu finalizare promisă în 2020. Proiectul a fost abandonat, iar molozul a fost ridicat în 2023, conform bilanțului documentat de presă.",
    verificatLa: "2026-06-11",
  },
  // ─── Val 2 (research v2, 36 agenți — alte orașe + naționale + respectate) ───
  {
    id: "iasi-tramvaie-bozankaya",
    autoritate: "Primăria Municipiului Iași",
    functie: "Primărie",
    county: "IS",
    promisiune:
      "Furnizarea a 18 tramvaie noi de 22 de metri (Bozankaya), finanțate prin PNRR, cu termen de finalizare 30 iunie 2026.",
    termen: "30 iunie 2026",
    termenIso: "2026-06-30",
    sursaUrl:
      "https://ziare.com/tramvaie-noi/primaria-iasi-semnat-achizitie-18-tramvaie-noi-finantare-pnrr-1854965",
    publicatie: "Ziare.com",
    dataSursa: "2024-02-26",
    status: "in-curs",
    nota:
      "Contract semnat pe 26 februarie 2024 pentru 18 tramvaie de 22 m, cu termen de livrare 30 iunie 2026. Termenul expiră în mai puțin de 3 săptămâni de la data verificării.",
    verificatLa: "2026-06-11",
  },
  {
    id: "iasi-spital-regional",
    autoritate: "Primăria Municipiului Iași",
    functie: "Primărie",
    county: "IS",
    promisiune:
      "Construcția Spitalului Regional de Urgență Iași: 850 de paturi, 20 de săli de operație, ~3.000 de angajați (investiție de ~668 de milioane de euro).",
    termen: "2027",
    termenIso: "2027-12-31",
    sursaUrl: "https://adevarul.ro/stiri-locale/iasi/incep-lucrarile-la-spitalul-regional-de-la-iasi-2315027.html",
    publicatie: "Adevărul",
    dataSursa: "2023-02-01",
    status: "in-curs",
    nota:
      "Lucrările au început în 2023 (autorizație semnată, excavare demarată). Termenul asumat — 2027 — nu a fost depășit la data verificării (iunie 2026).",
    verificatLa: "2026-06-11",
  },
  {
    id: "timisoara-inelul-2-est",
    autoritate: "Primăria Timișoara",
    functie: "Primărie",
    county: "TM",
    promisiune:
      "Finalizarea segmentului estic al Inelului 2 de circulație, cu finanțare europeană de 78 de milioane de lei și durată de execuție de 16 luni.",
    termen: "~iulie 2027 (16 luni din martie 2026)",
    termenIso: "2027-07-01",
    sursaUrl: "https://www.primariatm.ro/2026/03/20/finantare-inelul-2",
    publicatie: "Primăria Timișoara (comunicat oficial)",
    dataSursa: "2026-03-20",
    status: "in-curs",
    nota:
      "Contractul de finanțare a fost anunțat oficial pe 20 martie 2026, cu durată de execuție de 16 luni — termen estimat iulie 2027. Proiectul se află la începutul perioadei asumate.",
    verificatLa: "2026-06-11",
  },
  {
    id: "cnair-a7-focsani-adjud",
    autoritate: "CNAIR",
    functie: "Compania Națională de Administrare a Infrastructurii Rutiere",
    county: "RO",
    promisiune:
      "Deschiderea tronsonului A7 Focșani–Adjud Nord (49 km) până la finalul lui 2025, asigurând circulație continuă pe ~250 km de la București la Adjud.",
    termen: "decembrie 2025",
    termenIso: "2025-12-31",
    sursaUrl: "https://ziare.com/autostrazi-romania/a7-deschidere-focsani-adjud-1983927",
    publicatie: "Ziare.com",
    dataSursa: "2025-12-23",
    status: "respectata",
    nota:
      "Tronsonul de 49 km a fost deschis circulației pe 23 decembrie 2025, în interiorul termenului PNRR asumat — 195 km din A7 finanțați prin PNRR erau circulabili la acea dată.",
    verificatLa: "2026-06-11",
  },
  {
    id: "cnair-drum-expres-tureni",
    autoritate: "CNAIR / DRDP Cluj",
    functie: "Administrator infrastructură rutieră",
    county: "CJ",
    promisiune:
      "Deschiderea Drumului Expres A3–Tureni (5 km, legătura DN1–A3) pentru descongestionarea zonei Cluj-Napoca–Turda, anunțată pentru 6 iulie 2025.",
    termen: "iulie 2025",
    termenIso: "2025-07-06",
    sursaUrl: "https://www.ziarul21.ro/actualitate/drumul-expres-a3-tureni-se-deschide-duminica-6-iulie/",
    publicatie: "Ziarul 21",
    dataSursa: "2025-07-04",
    status: "respectata",
    nota:
      "Drumul expres (562,6 milioane lei, 9 structuri de artă) a fost deschis circulației pe 10 iulie 2025 — cu 4 zile după data anunțată inițial, dar în interiorul lunii asumate.",
    verificatLa: "2026-06-11",
  },
  // ─── Val 3 (research v3, 45 agenți — profiluri per persoană) ───
  {
    id: "baluta-pasaj-aparatorii-patriei",
    autoritate: "Daniel Băluță",
    functie: "Primar Sector 4",
    county: "B",
    promisiune:
      "Deschiderea Pasajului Apărătorii Patriei (860 m, două benzi pe sens + linie de tramvai) cel târziu la sfârșitul lui 2026.",
    termen: "sfârșitul lui 2026",
    termenIso: "2026-12-31",
    sursaUrl:
      "https://www.bucurestifm.ro/2025/09/11/pana-la-finalul-lui-2026-pasajul-aparatorii-patriei-va-fi-deschis-circulatiei/",
    publicatie: "Radio București FM",
    dataSursa: "2025-09-11",
    status: "in-curs",
    nota:
      "Promisiune din septembrie 2025: deschiderea „cel mai târziu la sfârșitul lui 2026”. La data verificării, lucrările erau în faza de structură (turnare beton, tablier metalic comandat), fără anunț de finalizare.",
    verificatLa: "2026-06-11",
  },
  {
    id: "negoita-hala-laminor",
    autoritate: "Robert Negoiță",
    functie: "Primar Sector 3",
    county: "B",
    promisiune:
      "Reabilitarea și transformarea Halei Laminor (monument industrial din 1938) în spațiu expozițional și cultural, cu parcare subterană (~600 de milioane de lei).",
    termen: "inaugurată pe 9 noiembrie 2022",
    termenIso: "2022-11-09",
    sursaUrl:
      "https://www.primarie3.ro/index.php/presa/comunicat/primarul-robert-negoi-a-inaugurat-hala-istorica-laminor-invitatul-special-al-evenimentului-presedintele-camerei-deputatilor-marcel-ciolacu/5076",
    publicatie: "Primăria Sectorului 3 (comunicat oficial)",
    dataSursa: "2022-11-09",
    status: "respectata",
    nota:
      "Hala Laminor a fost reabilitată, consolidată și inaugurată oficial pe 9 noiembrie 2022; funcționează ca spațiu multifuncțional cu parcare subterană.",
    verificatLa: "2026-06-11",
  },
  {
    id: "negoita-bulevard-hatieganu",
    autoritate: "Robert Negoiță",
    functie: "Primar Sector 3",
    county: "B",
    promisiune:
      "Lărgirea Bulevardului Iuliu Hațieganu de la 2 la 4 benzi (legătura Sector 3 – Sector 4), cu finalizare în 60 de zile.",
    termen: "60 de zile (deschis pe 1 septembrie 2023)",
    termenIso: "2023-09-01",
    sursaUrl:
      "https://www.primarie3.ro/index.php/presa/comunicat/lucrare-finalizata-in-60-de-zile-a-fost-deschis-traficul-pe-noul-bulevard-iuliu-hatieganu/5924",
    publicatie: "Primăria Sectorului 3 (comunicat oficial)",
    dataSursa: "2023-09-01",
    status: "respectata",
    nota:
      "Lucrarea a fost finalizată în termenul anunțat de 60 de zile, iar traficul a fost deschis pe 1 septembrie 2023.",
    verificatLa: "2026-06-11",
  },
  {
    id: "s6-prelungirea-ghencea",
    autoritate: "Primăria Sectorului 6",
    functie: "Primărie",
    county: "B",
    promisiune:
      "Finalizarea Prelungirii Ghencea (5 km, 4 benzi, linie dublă de tramvai, piste de biciclete): sistematizarea drumurilor până în 2027, tramvai + park&ride până în primăvara lui 2029.",
    termen: "drumuri 2027 · tramvai primăvara 2029",
    termenIso: "2029-03-01",
    sursaUrl:
      "https://primarie6.ro/primarie_sector6/vesti-despre-prelungirea-ghencea-situatia-lucrarilor-pe-fiecare-tronson",
    publicatie: "Primăria Sectorului 6 (comunicat oficial)",
    dataSursa: "2026-01-28",
    status: "in-curs",
    nota:
      "Conform raportării oficiale din ianuarie 2026, tronsoanele 1-2 sunt recepționate, iar utilitățile pentru tronsoanele 3-4 sunt în curs — proiectul urmează calendarul anunțat (drumuri 2027, tramvai 2029).",
    verificatLa: "2026-06-11",
  },
  {
    id: "s4-centrul-marius-nasta",
    autoritate: "Primăria Sectorului 4",
    functie: "Primărie",
    county: "B",
    promisiune:
      "Finalizarea Centrului de Diagnostic, Tratament și Cercetare a Tuberculozei „Marius Nasta” (Calea Șerban Vodă), finanțat prin PNRR cu ~100 de milioane de euro.",
    termen: "august 2026",
    termenIso: "2026-08-31",
    sursaUrl:
      "https://agerpres.ro/administratie/2026/05/07/sector-4-centrul-de-diagnostic-tratament-si-cercetare-a-tuberculozei-marius-nasta-va-fi-terminat-in---1553954",
    publicatie: "AGERPRES",
    dataSursa: "2026-05-07",
    status: "in-curs",
    nota:
      "La 7 mai 2026, stadiul execuției era de 75%, cu termen de finalizare august 2026 — proiectul se află în ultimele luni ale perioadei asumate.",
    verificatLa: "2026-06-11",
  },
];

/** Toate promisiunile: curate (TS, scrise manual) + bulk (JSON, generate de
 *  convertor din research-ul verificat). Testele validează ÎNTREGUL set. */
export const PROMISIUNI: Promisiune[] = [
  ...PROMISIUNI_CURATE,
  ...(PROMISIUNI_BULK as Promisiune[]),
];

export const PROMISIUNE_STATUS_META: Record<
  PromisiuneStatus,
  { label: string; color: string; icon: string }
> = {
  respectata: { label: "Respectată", color: "#059669", icon: "✅" },
  "in-curs": { label: "În curs", color: "#0891B2", icon: "🔵" },
  intarziata: { label: "Întârziată", color: "#D97706", icon: "⏰" },
  incalcata: { label: "Încălcată", color: "#DC2626", icon: "❌" },
};
