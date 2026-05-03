/**
 * Structura administrativă a României — snapshot mai 2026.
 *
 * Last update: 2026-05-03.
 *
 * Context politic: pe 23 aprilie 2026, cei 6 miniștri PSD + vicepremier
 * Marian Neacșu și-au depus demisiile, la cererea conducerii partidului.
 * PSD s-a retras oficial din coaliția guvernamentală. Decretele
 * prezidențiale de eliberare + numire interimari publicate în Monitorul
 * Oficial pe 24 aprilie. Interimatele funcționează constituțional
 * 45 de zile — până în 8 iunie 2026 — după care PM Bolojan trebuie să
 * propună miniștri plini pe portofoliile respective.
 *
 * Cabinetul rămas: PNL + USR + UDMR (minoritar parlamentar). Portofoliile
 * vacante au fost acoperite de actualii miniștri care dețin acum două
 * mandate: unul primar + unul interimar (vezi `interimar: true` la
 * intrările din ministeriCheie).
 *
 * Se actualizează manual după alegeri, remanieri guvernamentale sau
 * schimbări în conducerea instituțiilor centrale.
 *
 * Separat de `pmb-structura.ts` (care e București-specific).
 */

// ═══════════════════════════════════════════════════════════════════
// PRESIDENTUL — șef de stat, mandat 5 ani, maxim 2 mandate
// ═══════════════════════════════════════════════════════════════════

export interface PresidentInfo {
  nume: string;
  mandat: string; // "2025 - 2030"
  partid: string;
  website: string;
  atributii: string[];
  instituaAdministratie: string; // "Administrația Prezidențială"
}

export const PRESEDINTE: PresidentInfo = {
  nume: "Nicușor Dan",
  mandat: "2025 - 2030",
  partid: "Independent",
  website: "https://www.presidency.ro",
  instituaAdministratie: "Administrația Prezidențială",
  atributii: [
    "Șef al statului, reprezintă România în relațiile internaționale",
    "Comandant suprem al forțelor armate",
    "Promulgă legile adoptate de Parlament",
    "Numește prim-ministrul (pe baza majorității parlamentare)",
    "Numește 3 din 9 judecători ai Curții Constituționale",
    "Convoacă referendumuri privind probleme de interes național",
    "Poate dizolva Parlamentul în condiții constituționale stricte",
  ],
};

// ═══════════════════════════════════════════════════════════════════
// GUVERNUL — putere executivă
// ═══════════════════════════════════════════════════════════════════

export interface MinisterInfo {
  nume: string;
  portofoliu: string;
  partid?: string;
  website: string;
  /** Setat true pentru miniștrii interimari (acoperă vacante post-retragere
   *  PSD din coaliție). Apare cu badge „Interimar" pe pagina publică. */
  interimar?: boolean;
}

export interface GuvernInfo {
  primMinistru: string;
  primMinistruPartid: string;
  coalitieGuvernamentala: string[];
  numarMinisteri: number;
  website: string;
  rolGeneral: string;
  atributii: string[];
  ministeriCheie: MinisterInfo[];
}

export const GUVERN: GuvernInfo = {
  primMinistru: "Ilie Bolojan",
  primMinistruPartid: "PNL",
  // Coaliție post-mai 2026: PSD s-a retras, USR a fost integrată oficial
  // după ce avea deja miniștri (Transporturi, Externe, Apărare). Guvernul
  // continuă ca minoritar — sub pragul majorității în ambele camere.
  coalitieGuvernamentala: ["PNL", "USR", "UDMR", "Minorități"],
  numarMinisteri: 16,
  website: "https://gov.ro",
  rolGeneral:
    "Implementează politica internă și externă a țării, coordonează administrația publică și elaborează proiecte de lege. După retragerea PSD din coaliție (mai 2026), cabinetul funcționează cu interimari pe portofoliile vacante și negociază voturi caz cu caz în Parlament.",
  atributii: [
    "Asigură executarea legilor și a ordonanțelor",
    "Conduce politica internă și externă a țării",
    "Pregătește bugetul de stat și îl depune Parlamentului",
    "Poate emite Hotărâri de Guvern (HG) și Ordonanțe (OG / OUG)",
    "Coordonează ministerele, agențiile centrale și prefecturile",
    "Răspunde politic în fața Parlamentului (moțiune de cenzură)",
  ],
  // Lista miniștrilor reflectă cabinetul Bolojan după demisia PSD din
  // 23 aprilie 2026. Intrările cu interimar:true au fost asignate temporar
  // de premier până la o remaniere oficială (deadline constituțional:
  // 8 iunie 2026). Miniștrii care dețin DOUĂ portofolii (unul primar +
  // unul interimar) apar de două ori — o dată cu rolul lor original și o
  // dată cu badge „Interimar" pe portofoliul preluat.
  ministeriCheie: [
    // ── PRIMARI (rol stabil pre + post retragere PSD) ────────────────
    {
      nume: "Cătălin Predoiu",
      portofoliu: "Afaceri Interne",
      partid: "PNL",
      website: "https://www.mai.gov.ro",
    },
    {
      nume: "Cseke Attila",
      portofoliu: "Dezvoltare & Administrație",
      partid: "UDMR",
      website: "https://www.mdlpa.ro",
    },
    {
      nume: "Daniel David",
      portofoliu: "Educația",
      partid: "PNL",
      website: "https://www.edu.ro",
    },
    {
      nume: "Alexandru Nazare",
      portofoliu: "Finanțele",
      partid: "PNL",
      website: "https://mfinante.gov.ro",
    },
    {
      nume: "Oana Țoiu",
      portofoliu: "Afacerile Externe",
      partid: "USR",
      website: "https://www.mae.ro",
    },
    {
      nume: "Radu Miruță",
      portofoliu: "Apărarea (vicepremier)",
      partid: "USR",
      website: "https://www.mapn.ro",
    },
    {
      nume: "Tánczos Barna",
      portofoliu: "Vicepremier (Mediu inițial)",
      partid: "UDMR",
      website: "https://gov.ro",
    },
    {
      nume: "Dragoș Pîslaru",
      portofoliu: "Investiții și Proiecte Europene",
      partid: "USR",
      website: "https://mfe.gov.ro",
    },
    // ── INTERIMARI (preiau portofoliile lăsate de PSD) ────────────────
    // Decret prezidențial 24 aprilie 2026 → 45 zile → expiră 8 iunie 2026.
    {
      nume: "Cătălin Predoiu",
      portofoliu: "Justiția (interim)",
      partid: "PNL",
      website: "https://www.just.ro",
      interimar: true,
    },
    {
      nume: "Cseke Attila",
      portofoliu: "Sănătatea (interim)",
      partid: "UDMR",
      website: "https://www.ms.ro",
      interimar: true,
    },
    {
      nume: "Tánczos Barna",
      portofoliu: "Agricultura (interim)",
      partid: "UDMR",
      website: "https://www.madr.ro",
      interimar: true,
    },
    {
      nume: "Dragoș Pîslaru",
      portofoliu: "Munca și Solidaritatea Socială (interim)",
      partid: "USR",
      website: "https://mmuncii.ro",
      interimar: true,
    },
    {
      nume: "Radu Miruță",
      portofoliu: "Transporturi (interim)",
      partid: "USR",
      website: "https://www.mt.ro",
      interimar: true,
    },
    {
      nume: "Ilie Bolojan",
      portofoliu: "Energia (interim)",
      partid: "PNL",
      website: "https://energie.gov.ro",
      interimar: true,
    },
    {
      nume: "Oana Gheorghiu",
      portofoliu: "Vicepremier (interim, locul Marian Neacșu)",
      partid: "PNL",
      website: "https://gov.ro",
      interimar: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// PARLAMENTUL — putere legislativă (bicameral)
// ═══════════════════════════════════════════════════════════════════

export interface CamerLegislativa {
  nume: string; // "Camera Deputaților" sau "Senatul"
  numarMembri: number;
  durataMandat: number; // ani
  presedinte: string;
  presedintePartid: string;
  website: string;
  rolSpecific: string;
}

export interface ComponentaPolitica {
  partid: string;
  procent: number;
  locuri: number;
  culoare: string;
}

export const PARLAMENT: {
  senat: CamerLegislativa;
  cameraDeputatilor: CamerLegislativa;
  atributii: string[];
  componenta2024: ComponentaPolitica[];
} = {
  senat: {
    nume: "Senatul",
    numarMembri: 136,
    durataMandat: 4,
    presedinte: "Mircea Abrudean",
    presedintePartid: "PNL",
    website: "https://www.senat.ro",
    rolSpecific:
      "Camera superioară. Aprobă numiri judiciare majore, tratate internaționale, legi organice.",
  },
  cameraDeputatilor: {
    nume: "Camera Deputaților",
    numarMembri: 331,
    durataMandat: 4,
    presedinte: "Ciprian Șerban",
    presedintePartid: "PSD",
    website: "https://www.cdep.ro",
    rolSpecific:
      "Camera decizională pentru majoritatea legilor ordinare. Dezbate și adoptă bugetul de stat.",
  },
  atributii: [
    "Adoptă legi (ordinare, organice, constituționale)",
    "Aprobă bugetul de stat și execuția bugetară",
    "Exercită control asupra Guvernului (interpelări, anchete, moțiuni)",
    "Ratifică tratate internaționale",
    "Numește sau confirmă conducătorii unor autorități autonome (Curtea de Conturi, Avocatul Poporului)",
    "Aprobă declarațiile de război și stările excepționale",
  ],
  // Compoziție estimativă după alegerile parlamentare 2024 + recalculare 2025
  componenta2024: [
    { partid: "PSD", procent: 22.0, locuri: 102, culoare: "#DC2626" },
    { partid: "AUR", procent: 18.3, locuri: 85, culoare: "#1F2937" },
    { partid: "PNL", procent: 14.3, locuri: 66, culoare: "#EAB308" },
    { partid: "USR", procent: 12.4, locuri: 58, culoare: "#3B82F6" },
    { partid: "S.O.S.", procent: 7.4, locuri: 34, culoare: "#7C3AED" },
    { partid: "POT", procent: 6.5, locuri: 30, culoare: "#F97316" },
    { partid: "UDMR", procent: 6.4, locuri: 30, culoare: "#10B981" },
    { partid: "Minorități", procent: 3.9, locuri: 18, culoare: "#8B5CF6" },
    { partid: "Independenți", procent: 8.8, locuri: 44, culoare: "#64748B" },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// JUSTIȚIA — putere judecătorească
// ═══════════════════════════════════════════════════════════════════

export interface InstitutieJustitie {
  nume: string;
  shortForm: string;
  rol: string;
  conducator: string;
  website: string;
  numireConducator: string;
}

export const JUSTITIE: {
  atributii: string[];
  institutii: InstitutieJustitie[];
  ierarhieInstante: { nivel: string; descriere: string }[];
} = {
  atributii: [
    "Aplică legea în mod independent față de celelalte puteri",
    "Judecă litigiile civile, penale, comerciale, administrative",
    "Apără drepturile și libertățile fundamentale ale cetățenilor",
    "Asigură egalitatea părților în fața legii",
    "Controlează constituționalitatea legilor (prin CCR)",
  ],
  institutii: [
    {
      nume: "Curtea Constituțională a României",
      shortForm: "CCR",
      rol: "Garant al supremației Constituției. Decide asupra constituționalității legilor, ordonanțelor, tratatelor și reglementează conflictele juridice între autorități.",
      conducator: "Președinte: ales de judecători",
      website: "https://www.ccr.ro",
      numireConducator:
        "9 judecători numiți pentru 9 ani: 3 de Camera Deputaților, 3 de Senat, 3 de Președintele României.",
    },
    {
      nume: "Înalta Curte de Casație și Justiție",
      shortForm: "ICCJ",
      rol: "Cea mai înaltă instanță de drept comun din România. Asigură interpretarea și aplicarea unitară a legii de către celelalte instanțe.",
      conducator: "Președinte ICCJ",
      website: "https://www.scj.ro",
      numireConducator: "Președintele este numit de Președintele României la propunerea CSM.",
    },
    {
      nume: "Consiliul Superior al Magistraturii",
      shortForm: "CSM",
      rol: "Garant al independenței justiției. Numește, promovează, sancționează și transferă judecătorii și procurorii.",
      conducator: "Președinte ales între membri",
      website: "https://www.csm1909.ro",
      numireConducator:
        "19 membri: 14 magistrați aleși de colegii lor, 2 reprezentanți ai societății civile, Ministrul Justiției, Procurorul General, Președintele ICCJ.",
    },
    {
      nume: "Ministerul Public",
      shortForm: "MP",
      rol: "Reprezintă interesele generale ale societății. Coordonat de Procurorul General al României.",
      conducator: "Procurorul General",
      website: "https://www.mpublic.ro",
      numireConducator: "Numit de Președinte la propunerea Ministrului Justiției, cu avizul CSM.",
    },
    {
      nume: "Direcția Națională Anticorupție",
      shortForm: "DNA",
      rol: "Structură specializată a Ministerului Public. Investighează infracțiuni de corupție de nivel mediu și înalt.",
      conducator: "Procuror-șef DNA",
      website: "https://www.pna.ro",
      numireConducator: "Procurorul-șef numit de Președinte pe propunerea Ministrului Justiției.",
    },
    {
      nume: "Direcția de Investigare a Infracțiunilor de Criminalitate Organizată și Terorism",
      shortForm: "DIICOT",
      rol: "Structură specializată pentru infracțiuni grave: crimă organizată, terorism, trafic de droguri, criminalitate cibernetică, trafic de persoane.",
      conducator: "Procuror-șef DIICOT",
      website: "https://www.diicot.ro",
      numireConducator: "Aceeași procedură ca DNA.",
    },
  ],
  ierarhieInstante: [
    { nivel: "Judecătorii", descriere: "Cel mai jos nivel. Judecă cauze civile, penale minore, de familie. Fiecare județ are mai multe judecătorii." },
    { nivel: "Tribunale", descriere: "Al doilea nivel. Judecă apelurile de la judecătorii + cauze mai complexe în primă instanță. Un tribunal per județ + București." },
    { nivel: "Curți de Apel", descriere: "Al treilea nivel. 15 curți de apel care judecă apelurile de la tribunale și unele cauze în primă instanță." },
    { nivel: "Înalta Curte de Casație și Justiție", descriere: "Cea mai înaltă instanță. Casare și revizuire, uniformizare jurisprudență." },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// ADMINISTRAȚIA LOCALĂ — 3 niveluri
// ═══════════════════════════════════════════════════════════════════

export const ADMINISTRATIE_LOCALA = [
  {
    nivel: "Prefectura",
    rol: "Reprezentantul Guvernului în județ. Numit de Guvern, nu e ales. Controlează legalitatea actelor administrative locale.",
    atributii: [
      "Verifică legalitatea HCL-urilor și HCJ-urilor",
      "Poate ataca în instanță actele ilegale ale primarilor",
      "Coordonează serviciile publice deconcentrate (DSP, ISJ, IGSU)",
      "Gestionează situații de urgență în județ",
    ],
    numar: 42,
    icon: "🏛️",
  },
  {
    nivel: "Consiliul Județean",
    rol: "Autoritatea deliberativă la nivel județean. Alege președintele Consiliului Județean.",
    atributii: [
      "Aprobă bugetul județean",
      "Gestionează drumurile județene",
      "Coordonează spitalele județene, școli speciale, muzee",
      "Adoptă strategii de dezvoltare județeană",
    ],
    numar: 41,
    icon: "🏢",
  },
  {
    nivel: "Primăria (Consiliul Local)",
    rol: "Autoritatea executivă/deliberativă la nivel de comună/oraș/municipiu. Primarul + Consiliul Local, ambii aleși direct.",
    atributii: [
      "Gestionează străzi, trotuare, iluminat, salubritate locală",
      "Emite autorizații de construire și certificate de urbanism",
      "Colectează impozite și taxe locale",
      "Organizează servicii publice locale (grădinițe, școli, cultură)",
    ],
    numar: 3228,
    icon: "🏘️",
  },
];

// ═══════════════════════════════════════════════════════════════════
// CUM SE FACE O LEGE — procesul legislativ
// ═══════════════════════════════════════════════════════════════════

export const PROCES_LEGISLATIV = [
  {
    pas: 1,
    titlu: "Inițiativă",
    descriere:
      "Poate propune o lege: Guvernul (proiect), parlamentari individual (propunere legislativă), sau 100.000 cetățeni (inițiativă cetățenească).",
  },
  {
    pas: 2,
    titlu: "Aviz Consiliul Legislativ",
    descriere:
      "Consiliul Legislativ emite un aviz tehnic asupra calității juridice a proiectului. Neimplicare — doar consultativ.",
  },
  {
    pas: 3,
    titlu: "Prima cameră sesizată",
    descriere:
      "În funcție de tipul legii, Senatul sau Camera Deputaților dezbate prima. Termen: 45 de zile (60 pentru coduri). Dacă nu votează la timp → se consideră adoptată tacit.",
  },
  {
    pas: 4,
    titlu: "A doua cameră (decizională)",
    descriere:
      "Camera decizională (pentru majoritatea legilor: Camera Deputaților) dezbate și adoptă varianta finală. Dacă apar modificări, se poate reveni la prima cameră.",
  },
  {
    pas: 5,
    titlu: "Promulgare prezidențială",
    descriere:
      "Președintele are 20 de zile să promulge legea. Poate cere o singură reexaminare Parlamentului sau sesiza CCR pentru neconstituționalitate.",
  },
  {
    pas: 6,
    titlu: "Publicare în Monitorul Oficial",
    descriere:
      "Legea intră în vigoare la 3 zile de la publicare (sau la data stabilită în text). Fără publicare în Monitorul Oficial, legea NU produce efecte juridice.",
  },
];
