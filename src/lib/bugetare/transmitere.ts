// Adresa formală „Prioritățile orașului" — compilată determinist din topul
// votat de cetățeni și trimisă primăriei (OG 27/2002 → răspuns obligatoriu
// în 30 de zile). Pur + testabil; trimiterea efectivă e în /api/bp/transmite.

export interface PropunereTop {
  titlu: string;
  descriere: string;
  categorie: string;
  votes_count: number;
}

export interface AdresaBPInput {
  /** Numele primăriei destinatare (ex: „Primăria Municipiului Cluj-Napoca"). */
  primarie: string;
  /** Orașul/județul pentru context. */
  oras: string;
  top: PropunereTop[];
  totalVoturi: number;
  /** Data formatată (ex: „1 iulie 2026"). */
  data: string;
}

const CATEGORIE_LABEL: Record<string, string> = {
  mobilitate: "Mobilitate",
  "spatii-verzi": "Spații verzi",
  siguranta: "Siguranță",
  educatie: "Educație",
  sanatate: "Sănătate",
  altele: "Altele",
};

export function buildAdresaBP(i: AdresaBPInput): string {
  const lista = i.top
    .map(
      (p, idx) =>
        `${idx + 1}. ${p.titlu} (${CATEGORIE_LABEL[p.categorie] ?? p.categorie}, ${p.votes_count} ${p.votes_count === 1 ? "vot" : "voturi"})\n   ${p.descriere}`,
    )
    .join("\n\n");

  return [
    `Către: ${i.primarie}`,
    ``,
    `Subiect: Prioritățile de investiții semnalate de cetățeni prin platforma Civia.ro — ${i.oras}`,
    ``,
    `Stimată doamnă/Stimate domn,`,
    ``,
    `Civia.ro este o platformă civică independentă prin care cetățenii semnalează probleme și priorități către autoritățile locale. În temeiul OG nr. 27/2002 privind reglementarea activității de soluționare a petițiilor, vă transmitem prioritățile de investiții propuse și votate de cetățeni pentru ${i.oras} (${i.totalVoturi} ${i.totalVoturi === 1 ? "vot exprimat" : "voturi exprimate"}, fiecare utilizator autentificat având maximum 3 voturi):`,
    ``,
    lista,
    ``,
    `Vă rugăm să ne comunicați, în termenul legal de 30 de zile prevăzut de art. 8 din OG nr. 27/2002, poziția instituției dumneavoastră față de aceste priorități — în special dacă vreuna dintre ele se regăsește deja în planurile de investiții sau poate fi luată în considerare la fundamentarea bugetului local.`,
    ``,
    `Răspunsul dumneavoastră va fi publicat pe civia.ro, alături de prezenta adresă, pentru informarea cetățenilor care au participat.`,
    ``,
    `Cu stimă,`,
    `Echipa Civia.ro — contact@civia.ro`,
    i.data,
  ].join("\n");
}

export const SUBIECT_ADRESA_BP = (oras: string) =>
  `Prioritățile de investiții semnalate de cetățeni prin Civia.ro — ${oras}`;

/** Pragul minim ca o transmitere să aibă greutate (anti „cameră goală"):
 *  cel puțin 3 propuneri aprobate și cel puțin 10 voturi în total. */
export const MIN_PROPUNERI = 3;
export const MIN_VOTURI_TOTAL = 10;
