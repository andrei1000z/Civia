// FAZA 4 — Generator de cereri „Vreau bugetare participativă în orașul meu".
// Context (research 2026): programele oficiale de bugetare participativă din
// România s-au împuținat drastic — multe orașe le-au suspendat sau redus.
// Pârghia cetățeanului: cerere formală (OG 27/2002, răspuns obligatoriu în
// 30 de zile) + transparența decizională (Legea 52/2003). Pur + testabil.

export interface CerereBPInput {
  /** Orașul / comuna pentru care se cere programul. */
  oras: string;
  /** Numele primăriei destinatare (ex: „Primăria Municipiului Ploiești"). */
  primarie: string;
  numeSolicitant: string;
  emailSolicitant: string;
  /** Data cererii, formatată (ex: „11 iunie 2026"). */
  data: string;
}

export function buildCerereBP(i: CerereBPInput): string {
  const nume = i.numeSolicitant.trim() || "[numele dumneavoastră]";
  const oras = i.oras.trim() || "[orașul dumneavoastră]";
  const linii = [
    `Către: ${i.primarie.trim() || "[denumirea primăriei]"}`,
    ``,
    `Subiect: Solicitare privind introducerea unui program de bugetare participativă`,
    ``,
    `Stimată doamnă/Stimate domn,`,
    ``,
    `Subsemnatul/a ${nume}, în temeiul OG nr. 27/2002 privind reglementarea activității de soluționare a petițiilor, vă solicit să analizați introducerea (sau reluarea) unui program anual de bugetare participativă în ${oras}, prin care cetățenii să poată propune și vota proiecte de investiții finanțate dintr-o cotă a bugetului local.`,
    ``,
    `Bugetarea participativă funcționează deja în orașe din România (de exemplu Cluj-Napoca, care derulează programul din 2017) și aduce beneficii documentate: prioritizarea investițiilor după nevoile reale ale cetățenilor, creșterea încrederii în administrație și a transparenței cheltuirii banului public.`,
    ``,
    `În acest sens, vă rog să îmi comunicați:`,
    `1. Dacă instituția dumneavoastră a derulat sau intenționează să deruleze un program de bugetare participativă;`,
    `2. În caz negativ, motivele pentru care un astfel de program nu este considerat oportun;`,
    `3. Calendarul și pașii necesari pentru introducerea unui astfel de program, în acord cu principiile transparenței decizionale (Legea nr. 52/2003).`,
    ``,
    `Vă reamintesc că, potrivit art. 8 din OG nr. 27/2002, aveți obligația de a comunica un răspuns în termen de 30 de zile de la înregistrarea petiției.`,
    ``,
    `Vă rog să îmi comunicați răspunsul la adresa de e-mail: ${i.emailSolicitant.trim() || "[adresa dumneavoastră de e-mail]"}.`,
    ``,
    `În temeiul Regulamentului (UE) 2016/679 (GDPR), vă solicit ca datele mele cu caracter personal să fie prelucrate exclusiv în scopul soluționării prezentei cereri.`,
    ``,
    `Cu stimă,`,
    nume,
    i.data,
  ];
  return linii.join("\n");
}

export const SUBIECT_BP = "Solicitare privind introducerea unui program de bugetare participativă";
