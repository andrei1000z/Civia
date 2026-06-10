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

// Seed 2026-06-11 — 5 promisiuni verificate adversarial (research 32 agenți:
// fiecare sursă citită + confirmată; statusurile ajustate pe principiul minimei
// afirmații — „întârziată" în loc de „încălcată" când livrarea e re-promisă).
export const PROMISIUNI: Promisiune[] = [
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
