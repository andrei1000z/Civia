/**
 * Election compass — catalog candidați la alegerile locale, parlamentare,
 * europene. Sursă: date publice (declarații, programe oficiale, mandate
 * anterioare). Bias-free: include candidați din TOATE partidele majore.
 *
 * 2026-05: deocamdată un schelet manual. În viitor: import din declaratii
 * AEP + scraping programe partid.
 */

export interface CandidateAnswer {
  question: string;
  position: "pro" | "contra" | "neutru";
  note?: string;
}

export interface Candidate {
  slug: string;
  name: string;
  party: string;
  partyColor: string;
  position: string; // ex: „candidat primar București"
  imageUrl?: string;
  bio: string;
  // Mandate anterioare cu rezultate verificabile public.
  pastMandates?: Array<{ role: string; period: string; outcomes?: string[] }>;
  // Răspunsuri la întrebări civice — completeza ei direct sau extrage din programe.
  answers: CandidateAnswer[];
  // Surse publice pentru verificare (declaratii AEP, programe, articole).
  sources: Array<{ label: string; url: string }>;
}

export interface ElectionRace {
  slug: string;
  title: string;
  date: string; // YYYY-MM
  type: "locale" | "parlamentare" | "europene" | "prezidentiale";
  scope: string; // ex: „București — Primar General"
  candidates: Candidate[];
}

// Catalog minim — placeholder pana cand userul completeaza real data.
// Toate intrebarile civice sunt comune cross-candidate ca sa fie comparabile.
const COMMON_QUESTIONS = [
  "Sustii o linie de metrou suplimentara in Bucuresti?",
  "Sustii buget participativ pe sectoare?",
  "Vrei mai multe piste de biciclete?",
  "Esti pro/contra parcari subterane finantate din taxe locale?",
  "Sustii audit public anual al primariei?",
];

export const ELECTION_RACES: ElectionRace[] = [
  {
    slug: "bucuresti-primar-general-2028",
    title: "Alegeri Locale 2028 — Primar General București",
    date: "2028-09",
    type: "locale",
    scope: "Bucuresti",
    candidates: [
      // Placeholder — utilizatorul completeaza candidati reali.
    ],
  },
];

export function getRaceBySlug(slug: string): ElectionRace | undefined {
  return ELECTION_RACES.find((r) => r.slug === slug);
}

export { COMMON_QUESTIONS };
