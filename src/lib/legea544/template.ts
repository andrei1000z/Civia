// Generator de cereri în temeiul Legii nr. 544/2001 privind liberul acces la
// informațiile de interes public. Pur + testabil — fără I/O, fără Date.now
// (data se pasează din componentă, ca textul să fie determinist la test).

export const TERMEN_544_ZILE = 10;
export const TERMEN_544_COMPLEX_ZILE = 30;
export const TERMEN_544_REFUZ_ZILE = 5;

export interface Cerere544Input {
  /** Numele autorității/instituției publice destinatare. */
  autoritate: string;
  /** Informația de interes public solicitată (text liber). */
  informatie: string;
  /** Numele solicitantului. */
  numeSolicitant: string;
  /** E-mailul la care vrea răspunsul (dacă format=electronic). */
  emailSolicitant: string;
  /** Data cererii, deja formatată (ex: „10 iunie 2026"). */
  data: string;
  /** Format de răspuns preferat. Implicit electronic (mai rapid + ecologic). */
  format?: "electronic" | "hartie";
}

/** Categorii frecvente de informații publice, cu exemple concrete de formulare. */
export const CATEGORII_544: ReadonlyArray<{ label: string; icon: string; exemplu: string }> = [
  { label: "Buget și cheltuieli", icon: "💶", exemplu: "execuția bugetară pe anul în curs, defalcată pe capitole de cheltuieli" },
  { label: "Contracte și achiziții", icon: "📄", exemplu: "lista contractelor de achiziție publică încheiate în ultimul an, cu obiectul, valoarea și denumirea furnizorului" },
  { label: "Hotărâri și decizii", icon: "⚖️", exemplu: "hotărârile adoptate de consiliul local în ședința din data de [completați data]" },
  { label: "Investiții și lucrări", icon: "🏗️", exemplu: "stadiul, valoarea și termenul de finalizare a lucrărilor de [descrieți] din zona [completați]" },
  { label: "Personal și salarizare", icon: "👥", exemplu: "organigrama instituției și grila de salarizare pe funcții, conform legii salarizării" },
  { label: "Urbanism și mediu", icon: "🌳", exemplu: "autorizațiile de construire emise pentru imobilul/zona [completați] în ultimele 12 luni" },
];

/**
 * Construiește textul cererii. Câmpurile goale rămân ca substituenți „[...]"
 * ca utilizatorul să vadă clar ce mai are de completat înainte de trimitere.
 */
export function buildCerere544(i: Cerere544Input): string {
  const electronic = (i.format ?? "electronic") === "electronic";
  const nume = i.numeSolicitant.trim() || "[numele dumneavoastră]";
  const linii = [
    `Către: ${i.autoritate.trim() || "[denumirea autorității publice]"}`,
    ``,
    `Subiect: Solicitare de informații de interes public (Legea nr. 544/2001)`,
    ``,
    `Stimată doamnă/Stimate domn,`,
    ``,
    `Subsemnatul/a ${nume}, în temeiul art. 6 din Legea nr. 544/2001 privind liberul acces la informațiile de interes public, vă solicit comunicarea următoarelor informații de interes public:`,
    ``,
    i.informatie.trim() || "[descrieți clar și precis informația solicitată]",
    ``,
    electronic
      ? `Vă rog să îmi comunicați răspunsul în format electronic, la adresa de e-mail: ${i.emailSolicitant.trim() || "[adresa dumneavoastră de e-mail]"}.`
      : `Vă rog să îmi comunicați răspunsul pe suport de hârtie.`,
    ``,
    `Vă reamintesc că, potrivit art. 7 din Legea nr. 544/2001, aveți obligația de a comunica răspunsul în scris în termen de ${TERMEN_544_ZILE} zile sau, pentru informațiile care necesită o documentare mai amplă, în termen de ${TERMEN_544_COMPLEX_ZILE} de zile, cu înștiințarea solicitantului în termen de ${TERMEN_544_ZILE} zile. Un eventual refuz se motivează și se comunică în scris în termen de ${TERMEN_544_REFUZ_ZILE} zile.`,
    ``,
    `În temeiul Regulamentului (UE) 2016/679 (GDPR), vă solicit ca datele mele cu caracter personal să fie prelucrate exclusiv în scopul soluționării prezentei cereri.`,
    ``,
    `Vă mulțumesc pentru disponibilitate.`,
    ``,
    `Cu stimă,`,
    nume,
    i.data,
  ];
  return linii.join("\n");
}

/** Subiectul pentru mailto. */
export const SUBIECT_544 = "Solicitare de informații de interes public (Legea nr. 544/2001)";
