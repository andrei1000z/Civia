// Programe OFICIALE de bugetare participativă din România — index curatoriat
// (FAZA 4). Doar programe consacrate, cu platformă oficială verificabilă.
// Calendarele se schimbă anual → NU stocăm deadline-uri (s-ar învechi);
// trimitem la platforma oficială. Context (research 2026): numărul programelor
// active a scăzut drastic față de 2023 — de-asta pagina transformă absența
// în acțiune (generator de cerere formală).

export interface ProgramBP {
  /** Slug stabil. */
  id: string;
  oras: string;
  county: string;
  /** Platforma oficială a programului. */
  platformaUrl: string;
  /** Descriere scurtă, factuală. */
  descriere: string;
  /** Stare cunoscută la ultima verificare. */
  stare: "activ-istoric" | "incert";
  verificatLa: string;
}

export const PROGRAME_BP: ProgramBP[] = [
  {
    id: "cluj-napoca",
    oras: "Cluj-Napoca",
    county: "CJ",
    platformaUrl: "https://bugetareparticipativa.ro",
    descriere:
      "Pionierul bugetării participative din România (din 2017): cetățenii propun proiecte pe domenii (mobilitate, spații verzi, smart city), apoi votează online. Proiectele câștigătoare intră în bugetul orașului.",
    stare: "activ-istoric",
    verificatLa: "2026-06-11",
  },
  {
    id: "sibiu",
    oras: "Sibiu",
    county: "SB",
    platformaUrl: "https://sibiubugetareparticipativa.ro",
    descriere:
      "Program anual de propuneri + vot online pentru proiecte de oraș, derulat de Primăria Sibiu pe platformă dedicată.",
    stare: "activ-istoric",
    verificatLa: "2026-06-11",
  },
  {
    id: "oradea",
    oras: "Oradea",
    county: "BH",
    platformaUrl: "https://www.oradea.ro",
    descriere:
      "Oradea a derulat ediții de bugetare participativă prin platforma primăriei; verifică secțiunea dedicată pentru ediția curentă.",
    stare: "incert",
    verificatLa: "2026-06-11",
  },
  {
    id: "timisoara",
    oras: "Timișoara",
    county: "TM",
    platformaUrl: "https://decidem.primariatm.ro",
    descriere:
      "Timișoara folosește platforma participativă „Decidem” (pe Decidim, standardul open-source european) pentru consultări și procese participative.",
    stare: "activ-istoric",
    verificatLa: "2026-06-11",
  },
  {
    id: "brasov",
    oras: "Brașov",
    county: "BV",
    platformaUrl: "https://www.brasovcity.ro",
    descriere:
      "Brașovul a derulat ediții de bugetare participativă; verifică site-ul primăriei pentru starea programului în anul curent.",
    stare: "incert",
    verificatLa: "2026-06-11",
  },
];
