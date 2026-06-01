/**
 * Catalog autorități destinatare pentru propuneri legislative.
 * Date verificate iunie 2026 de pe site-urile oficiale.
 */

export interface Authority {
  key: string;
  name: string;
  shortName: string;
  email: string;
  /** Email secundar pentru CC (ex: transparenta decizionala) */
  emailCC?: string;
  address: string;
  website: string;
  icon: string;
  description: string;
  /** Temei legal pentru depunere */
  legalBasis: string;
  /** Categorii relevante pentru această autoritate */
  relevantCategories: string[];
}

export const AUTHORITIES: Record<string, Authority> = {
  MAI: {
    key: "MAI",
    name: "Ministerul Afacerilor Interne",
    shortName: "MAI",
    email: "registratura.ipdb@mai.gov.ro",
    emailCC: "transparenta.decizionala@mai.gov.ro",
    address: "Piața Revoluției nr. 1A, sector 1, București",
    website: "https://www.mai.gov.ro",
    icon: "🏛️",
    description: "Ordine publică, poliție, jandarmi, pompieri, imigrări",
    legalBasis: "Legea 52/2003 art. 6 — transparență decizională + OG 27/2002 petiții",
    relevantCategories: ["siguranta", "trafic_rutier", "administrativ"],
  },
  IGPR: {
    key: "IGPR",
    name: "Inspectoratul General al Poliției Române",
    shortName: "Poliția Română",
    email: "igpr@politiaromana.ro",
    address: "Str. Mihai Vodă nr. 6, sector 5, București",
    website: "https://www.politiaromana.ro",
    icon: "👮",
    description: "Poliția rutieră, ordine publică, Codul Rutier",
    legalBasis: "OG 27/2002 petiționar + Legea 52/2003 consultare publică",
    relevantCategories: ["trafic_rutier", "siguranta"],
  },
  MT: {
    key: "MT",
    name: "Ministerul Transporturilor și Infrastructurii",
    shortName: "Min. Transporturi",
    email: "petitie@mt.ro",
    emailCC: "consultare.publica@mt.ro",
    address: "Bulevardul Dinicu Golescu nr. 38, sector 1, București",
    website: "https://www.mt.ro",
    icon: "🚗",
    description: "Drumuri naționale, autostrăzi, transport feroviar, aerian, naval",
    legalBasis: "Legea 52/2003 + OG 27/2002",
    relevantCategories: ["trafic_rutier", "mobilitate", "urbanism"],
  },
  MDLPA: {
    key: "MDLPA",
    name: "Ministerul Dezvoltării, Lucrărilor Publice și Administrației",
    shortName: "MDLPA",
    email: "cabinet@mdlpa.ro",
    emailCC: "transparenta@mdlpa.ro",
    address: "Str. Apolodor nr. 17, sector 5, București",
    website: "https://www.mdlpa.ro",
    icon: "🏗️",
    description: "Urbanism, construcții, administrație publică locală",
    legalBasis: "Legea 52/2003 + HG urbanistice",
    relevantCategories: ["urbanism", "mobilitate", "administrativ"],
  },
  CAMERA_DEPUTATILOR: {
    key: "CAMERA_DEPUTATILOR",
    name: "Camera Deputaților",
    shortName: "Camera Deputaților",
    email: "srp@cdep.ro",
    address: "Str. Izvor nr. 2-4, sector 5, București",
    website: "https://www.cdep.ro",
    icon: "🏛️",
    description: "Propuneri de modificare a legilor, inițiative legislative",
    legalBasis: "Constituția României art. 74 + Regulamentul Camerei Deputaților",
    relevantCategories: ["trafic_rutier", "siguranta", "mediu", "sanatate", "educatie", "altele"],
  },
  SENAT: {
    key: "SENAT",
    name: "Senatul României",
    shortName: "Senat",
    email: "sesizari@senat.ro",
    address: "Calea 13 Septembrie nr. 1-3, sector 5, București",
    website: "https://www.senat.ro",
    icon: "🏛️",
    description: "Camera de reflecție — inițiative legislative, modificări Constituție",
    legalBasis: "Constituția României art. 74 + Regulamentul Senatului",
    relevantCategories: ["trafic_rutier", "siguranta", "mediu", "sanatate", "educatie", "altele"],
  },
  CNAIR: {
    key: "CNAIR",
    name: "Compania Națională de Administrare a Infrastructurii Rutiere",
    shortName: "CNAIR",
    email: "relatii.clienti@cnair.ro",
    address: "Bulevardul Dinicu Golescu nr. 38, sector 1, București",
    website: "https://www.cnair.ro",
    icon: "🛣️",
    description: "Autostrăzi, drumuri naționale, siguranță rutieră",
    legalBasis: "OG 27/2002 petiții",
    relevantCategories: ["trafic_rutier", "mobilitate"],
  },
  PRIMARIA_GENERALA: {
    key: "PRIMARIA_GENERALA",
    name: "Primăria Municipiului București",
    shortName: "PMB",
    email: "relatiicupublicul@pmb.ro",
    address: "Bulevardul Regina Elisabeta nr. 47, sector 5, București",
    website: "https://www.pmb.ro",
    icon: "🏙️",
    description: "Propuneri pentru capitală: mobilitate, spații verzi, urbanism",
    legalBasis: "Legea 52/2003 + OG 27/2002",
    relevantCategories: ["urbanism", "mobilitate", "mediu", "trafic_rutier"],
  },
  ANAP: {
    key: "ANAP",
    name: "Agenția Națională pentru Achiziții Publice",
    shortName: "ANAP",
    email: "anap@anap.gov.ro",
    address: "Str. Italiană nr. 22, sector 2, București",
    website: "https://www.anap.gov.ro",
    icon: "📋",
    description: "Transparență achiziții publice, contracte guvernamentale",
    legalBasis: "Legea 98/2016 + OG 27/2002",
    relevantCategories: ["administrativ", "altele"],
  },
};

export const AUTHORITY_KEYS = Object.keys(AUTHORITIES) as Array<keyof typeof AUTHORITIES>;

export const CATEGORII_PROPUNERI = [
  { value: "trafic_rutier", label: "Trafic & Cod Rutier", icon: "🚗", description: "Viteze, semafoare, parcare, Codul Rutier" },
  { value: "mobilitate", label: "Mobilitate urbană", icon: "🚲", description: "Piste biciclete, transport public, pietoni" },
  { value: "urbanism", label: "Urbanism & Construcții", icon: "🏗️", description: "Planuri urbanistice, construcții ilegale" },
  { value: "mediu", label: "Mediu & Natură", icon: "🌳", description: "Poluare, spații verzi, deșeuri" },
  { value: "siguranta", label: "Siguranță publică", icon: "🛡️", description: "Ordine publică, iluminat, camere CCTV" },
  { value: "sanatate", label: "Sănătate publică", icon: "🏥", description: "Spitale, urgențe, medicamente" },
  { value: "educatie", label: "Educație", icon: "🎓", description: "Școli, universități, burse" },
  { value: "administrativ", label: "Administrație", icon: "🏛️", description: "Digitalizare, birocrație, transparență" },
  { value: "altele", label: "Altele", icon: "📝", description: "Orice altă propunere sistemică" },
] as const;

export type CategorieKey = (typeof CATEGORII_PROPUNERI)[number]["value"];

/** Returnează autoritățile recomandate pentru o categorie */
export function getRecommendedAuthorities(categorie: string): Authority[] {
  return Object.values(AUTHORITIES).filter((a) =>
    a.relevantCategories.includes(categorie),
  );
}

/** Praguri pentru trimitere automată */
export const VOTE_THRESHOLD_SEND = 100;
export const VOTE_THRESHOLD_PRESS = 500;
