// Per-tip formal letter templates
// AI fills in {PROBLEMA} and {PROPUNERE} based on user's description

export interface TipTemplate {
  problema_ghid: string; // How to describe the problem formally
  propunere: string; // Specific proposed action
  urgenta?: "normală" | "urgentă" | "critică";
}

export const TEMPLATES: Record<string, TipTemplate> = {
  groapa: {
    problema_ghid: "o groapă/denivelare în carosabil care reprezintă pericol pentru șoferi, bicicliști și pietoni",
    propunere: "plombarea cu mixtură asfaltică la cald și nivelarea suprafeței",
    urgenta: "urgentă",
  },
  trotuar: {
    problema_ghid: "degradarea trotuarului (plăci sparte, borduri lipsă, gropi) care pune în pericol trecătorii",
    propunere: "reabilitarea pavajului și alinierea plăcilor de beton",
  },
  iluminat: {
    problema_ghid: "defectarea iluminatului public care creează zone întunecate și crește riscul de accidente și infracțiuni",
    propunere: "înlocuirea corpurilor de iluminat defecte și verificarea rețelei electrice",
    urgenta: "urgentă",
  },
  copac: {
    problema_ghid: "un copac cu ramuri uscate sau instabile care reprezintă pericol real de cădere peste pietoni sau vehicule",
    propunere: "toaletarea urgentă a copacului sau, după caz, defrișarea lui în condiții de siguranță",
    urgenta: "critică",
  },
  gunoi: {
    problema_ghid: "nerespectarea programului de salubrizare — tomberoane supraîncărcate, gunoi împrăștiat, miros neplăcut",
    propunere: "ridicarea urgentă a deșeurilor și revizuirea programului de colectare în zonă",
  },
  parcare: {
    problema_ghid: "autovehicule parcate ilegal (pe trotuar, pe pistă de bicicletă, blocând accesul) contrar prevederilor HCGMB",
    propunere: "intervenția Poliției Locale pentru sancționarea și, dacă e cazul, ridicarea vehiculelor",
  },
  amenajare_parcare: {
    problema_ghid: "lipsa locurilor de parcare amenajate în zonă, care duce la parcări neregulamentare pe trotuar/spațiu verde și la blocarea circulației",
    propunere: "analiza posibilității de amenajare a unor locuri de parcare reglementate (parcare de reședință sau locuri suplimentare) cu marcaj și semnalizare conforme normelor în vigoare",
  },
  stalpisori: {
    problema_ghid: "lipsa elementelor de protecție (stâlpișori / parapeți) care permit parcarea ilegală pe trotuar și pune în pericol pietonii",
    propunere: "montarea de stâlpișori anti-parcare pentru a delimita carosabilul de trotuar",
  },
  canalizare: {
    problema_ghid: "probleme la rețeaua de canalizare (capace lipsă, guri de scurgere înfundate, inundații recurente)",
    propunere: "verificarea și desfundarea sistemului, înlocuirea capacelor lipsă",
    urgenta: "urgentă",
  },
  semafor: {
    problema_ghid: "defectarea sistemului de semaforizare/semnalizare rutieră care afectează fluiditatea traficului și siguranța pietonilor",
    propunere: "repararea urgentă a semaforului/indicatorului și sincronizarea cu traficul din zonă",
    urgenta: "urgentă",
  },
  pietonal: {
    problema_ghid: "o traversare de pietoni periculoasă (marcaj șters, fără semafor, fără rampă pentru cărucioare) unde riscul de accident e ridicat",
    propunere: "refacerea marcajului rutier și montarea unui semafor cu buton sau rampă accesibilizată",
  },
  graffiti: {
    problema_ghid: "acte de vandalism (graffiti/inscripții) care degradează imaginea publică a clădirii/monumentului",
    propunere: "curățarea suprafețelor afectate și, dacă e posibil, identificarea autorilor",
  },
  mobilier: {
    problema_ghid: "mobilier stradal deteriorat sau vandalizat (bănci, coșuri de gunoi, stații) care trebuie înlocuit",
    propunere: "înlocuirea mobilierului stradal afectat în regim de urgență",
  },
  zgomot: {
    problema_ghid: "zgomote excesive care depășesc limitele legale conform Ordinului 119/2014 (construcții noaptea, muzică foarte tare, petreceri)",
    propunere: "intervenția Poliției Locale pentru verificarea respectării programului de liniște publică",
  },
  animale: {
    problema_ghid: "câini comunitari agresivi/haite care pun în pericol trecătorii și copiii din zonă",
    propunere: "intervenția ASAU pentru prinderea animalelor și evaluarea stării lor",
    urgenta: "urgentă",
  },
  transport: {
    problema_ghid: "o problemă la transportul public (întârzieri, vehicule nefuncționale, stații deteriorate, linii suprasolicitate)",
    propunere: "analiza STB/Metrorex și ajustarea programului, după caz înlocuirea vehiculelor defecte",
  },
  afisaj: {
    problema_ghid: "afișaj/publicitate ilegală pe domeniul public (afișe sălbatice pe stâlpi/copaci/garduri, panouri publicitare fără autorizație, bannere stradale neavizate) care încalcă Legea 185/2013 privind amplasarea mijloacelor de publicitate",
    propunere: "constatarea contravenției de către Poliția Locală, identificarea beneficiarilor reclamei și înlăturarea materialelor în regim de urgență",
  },
  banda_transport: {
    problema_ghid: "lipsa unei benzi dedicate transportului public, care îngreunează deplasarea autobuzelor/troleibuzelor și descurajează folosirea transportului în comun",
    propunere: "analiza necesității și amenajarea unei benzi dedicate transportului public conform standardelor europene, cu marcaj rutier și semnalizare adecvată",
  },
  trecere_pietoni: {
    problema_ghid: "lipsa unei treceri de pietoni amenajate într-o zonă cu trafic pietonal intens, care obligă pietonii să traverseze prin loc nepermis",
    propunere: "amenajarea unei treceri de pietoni cu marcaj rutier, indicatoare și, dacă e cazul, semaforizare sau iluminare suplimentară",
  },
  rampa_acces: {
    problema_ghid: "lipsa rampelor de acces pentru persoane cu mobilitate redusă (cărucioare, scaune cu rotile), contrar Legii 448/2006 privind drepturile persoanelor cu handicap",
    propunere: "amenajarea unei rampe de acces conform standardelor de accesibilitate, la bordură/intrare instituție",
  },
  colectare_selectiva: {
    problema_ghid: "lipsa infrastructurii de colectare selectivă a deșeurilor (containere separate pentru hârtie, plastic, sticlă, biodegradabile), contrar Legii 211/2011 privind regimul deșeurilor",
    propunere: "amplasarea de containere de colectare selectivă în zona indicată și informarea cetățenilor",
  },
  fumat_interzis: {
    problema_ghid: "fumat în spații publice în care fumatul este interzis (Legea 15/2016 — incinta unor locuri publice precum stații de transport, scări de bloc, locuri de joacă, școli, spitale, restaurante interior)",
    propunere: "control al Poliției Locale în zona indicată, amenzi conform Legii 15/2016 (între 100 și 500 lei pentru persoane fizice) și instalarea de plăcuțe „Fumatul interzis” vizibile",
  },
  altele: {
    problema_ghid: "o situație care necesită intervenția autorităților locale",
    propunere: "verificarea situației la fața locului și luarea măsurilor corespunzătoare",
  },
};

export function getTemplate(tip: string): TipTemplate {
  return TEMPLATES[tip] ?? TEMPLATES["altele"]!;
}
