/**
 * Glosar civic românesc — 50+ termeni cu definiție concisă + temei legal.
 *
 * Plan SEO #5 (5/22/2026). DefinedTerm schema pe fiecare → citation magnet
 * pentru ChatGPT/Perplexity când răspund la „ce înseamnă sesizare?",
 * „diferența petitie reclamatie", etc.
 */

export interface GlosarTerm {
  /** Slug pentru URL: /glosar#sesizare */
  slug: string;
  /** Termen vizibil */
  termen: string;
  /** Categorii pentru filtrare/grouping */
  categorie: "sesizari" | "petitii" | "legi" | "institutii" | "proceduri" | "drepturi";
  /** Definiție concisă 1-2 propoziții */
  definitie: string;
  /** Detalii suplimentare (opțional) */
  detaliu?: string;
  /** Temei legal (citat sau referință) */
  temeiLegal?: string;
  /** Sinonime / termeni înrudiți */
  sinonime?: string[];
}

export const GLOSAR: GlosarTerm[] = [
  {
    slug: "sesizare",
    termen: "Sesizare",
    categorie: "sesizari",
    definitie:
      "Comunicare oficială către o autoritate publică despre o problemă concretă care necesită acțiune (groapă, parcare ilegală, gunoi nescos etc.).",
    detaliu:
      "Sesizările sunt gratuite și trebuie să primească răspuns în 30 de zile, conform OG 27/2002. Pot fi trimise scris, prin email sau prin platforme civice (ex: Civia.ro).",
    temeiLegal: "OG 27/2002 art. 1-2",
    sinonime: ["reclamație", "petitie"],
  },
  {
    slug: "petitie",
    termen: "Petiție",
    categorie: "petitii",
    definitie:
      "Cerere colectivă semnată de mai mulți cetățeni pentru o schimbare publică (modificare lege, oprire proiect, decizie administrativă).",
    detaliu:
      "Petițiile sunt diferite de sesizări individuale: cer schimbări de politică, nu rezolvarea unei probleme concrete.",
    temeiLegal: "Constituția României art. 51",
    sinonime: ["cerere colectivă"],
  },
  {
    slug: "reclamatie",
    termen: "Reclamație",
    categorie: "sesizari",
    definitie:
      `Termen colocvial pentru sesizare. În uz public și juridic, „reclamație" și „sesizare" sunt echivalente.`,
    temeiLegal: `OG 27/2002 art. 2 — „prin petiție se înțelege cererea, reclamația, sesizarea..."`,
    sinonime: ["sesizare", "petitie"],
  },
  {
    slug: "contestatie-administrativa",
    termen: "Contestație administrativă",
    categorie: "proceduri",
    definitie:
      "Procedură de atac al unui act administrativ înaintea emitentului (primărie, prefectură etc.). Obligatorie ca cerere prealabilă înainte de contencios administrativ.",
    detaliu:
      "Termen: 30 zile de la comunicarea actului. Răspuns: 30 zile.",
    temeiLegal: "L 554/2004 art. 7",
  },
  {
    slug: "contencios-administrativ",
    termen: "Contencios administrativ",
    categorie: "proceduri",
    definitie:
      "Litigiu între cetățean și administrația publică, soluționat de instanțe specializate (Tribunal, Curte de Apel).",
    detaliu:
      "Acțiunea în contencios poate fi introdusă DUPĂ cererea prealabilă. Termen: 30 zile de la refuz sau expirarea termenului de răspuns.",
    temeiLegal: "L 554/2004",
  },
  {
    slug: "cerere-prealabila",
    termen: "Cerere prealabilă",
    categorie: "proceduri",
    definitie:
      "Solicitare obligatorie către autoritate (emitentul actului) înainte de a merge în contencios administrativ. Echivalent cu contestația administrativă.",
    temeiLegal: "L 554/2004 art. 7",
  },
  {
    slug: "tacere-administrativa",
    termen: "Tăcere administrativă",
    categorie: "proceduri",
    definitie:
      "Lipsa răspunsului unei autorități în termenul legal — echivalent juridic cu REFUZUL. Permite cetățeanului să acționeze direct în instanță.",
    detaliu:
      "Termen tacere: 30 zile pentru petiții (OG 27/2002) sau 10/30 zile pentru cereri Legea 544.",
    temeiLegal: "L 554/2004 art. 2 alin. (2)",
  },
  {
    slug: "petitionar",
    termen: "Petiționar",
    categorie: "sesizari",
    definitie:
      `Cetățeanul care depune o sesizare sau petiție. Termen tehnic-juridic; sinonim: „petent".`,
    sinonime: ["petent", "reclamant"],
  },
  {
    slug: "autoritate-competenta",
    termen: "Autoritate competentă",
    categorie: "institutii",
    definitie:
      "Instituția responsabilă legal pentru rezolvarea unei probleme sesizate. Identificarea ei e crucială: sesizarea trimisă la autoritate greșită nu produce efecte.",
    detaliu:
      "Ex: groapă pe strada urbană → primăria municipiului/sectorului. Groapă pe DN1 → CNAIR.",
  },
  {
    slug: "og-27-2002",
    termen: "OG 27/2002",
    categorie: "legi",
    definitie:
      "Ordonanța Guvernului 27/2002 privind reglementarea activității de soluționare a petițiilor. Cea mai importantă lege civică din România.",
    detaliu:
      "Obligă orice autoritate publică să răspundă la petiții în 30 de zile.",
    temeiLegal: "OG 27/2002 (publicată în Monitorul Oficial nr. 84/2002)",
  },
  {
    slug: "legea-544-2001",
    termen: "Legea 544/2001",
    categorie: "legi",
    definitie:
      "Legea privind liberul acces la informațiile de interes public. Permite cetățenilor să ceară informații deținute de autorități, gratuit.",
    detaliu:
      "Termen răspuns: 10 zile (extensibil la 30). Refuzul motivat poate fi atacat în contencios.",
    temeiLegal: "L 544/2001",
    sinonime: ["acces info publice"],
  },
  {
    slug: "legea-52-2003",
    termen: "Legea 52/2003",
    categorie: "legi",
    definitie:
      "Legea transparenței decizionale în administrația publică. Cetățenii pot participa la elaborarea actelor normative.",
    detaliu:
      "Autoritățile sunt obligate să anunțe consultări publice cu 30 zile înainte.",
    temeiLegal: "L 52/2003",
  },
  {
    slug: "legea-554-2004",
    termen: "Legea 554/2004",
    categorie: "legi",
    definitie:
      "Legea contenciosului administrativ. Stabilește procedura pentru atacul în instanță al actelor administrative.",
    temeiLegal: "L 554/2004",
  },
  {
    slug: "avocatul-poporului",
    termen: "Avocatul Poporului (AVP)",
    categorie: "institutii",
    definitie:
      "Instituție constituțională independentă care apără drepturile cetățeanului în relația cu administrația publică. Sesizările sunt gratuite.",
    detaliu:
      "Poate emite recomandări obligatorii. Online la avp.ro. Acoperă cazuri în care primăriile nu răspund sau refuză nejustificat.",
    temeiLegal: "Constituția art. 58-60, L 35/1997",
    sinonime: ["AVP", "ombudsman"],
  },
  {
    slug: "primaria",
    termen: "Primăria",
    categorie: "institutii",
    definitie:
      "Autoritatea administrativă locală condusă de primar. Responsabilă pentru servicii publice locale: drumuri, salubritate, iluminat, urbanism, asistență socială.",
    detaliu:
      "Civia acoperă toate 220+ primării orașe + 42 primării de județ + 6 primării de sector (București).",
  },
  {
    slug: "prefectura",
    termen: "Prefectura",
    categorie: "institutii",
    definitie:
      "Reprezentantul Guvernului în județ. Conduce serviciile publice deconcentrate. Verifică legalitatea actelor administrației locale.",
    detaliu:
      "Cetățeanul poate sesiza prefectul când primăria nu respectă legea.",
    temeiLegal: "L 340/2004",
  },
  {
    slug: "consiliul-local",
    termen: "Consiliul Local",
    categorie: "institutii",
    definitie:
      "Autoritate deliberativă la nivel local. Adoptă hotărâri (HCL — Hotărâri Consiliu Local) privind bugetul, urbanismul, taxe locale.",
  },
  {
    slug: "consiliul-judetean",
    termen: "Consiliul Județean",
    categorie: "institutii",
    definitie:
      "Autoritate deliberativă la nivel județean. Coordonează activitatea consiliilor locale, gestionează drumurile județene, spitalele.",
  },
  {
    slug: "politia-locala",
    termen: "Poliția Locală",
    categorie: "institutii",
    definitie:
      "Structură de ordine publică sub autoritatea primarului. Verifică parcările, gunoaiele, comerțul stradal, afișajul.",
    detaliu:
      "Diferită de Poliția Română (MAI) — Poliția Locală nu poate investiga infracțiuni.",
    temeiLegal: "L 155/2010",
  },
  {
    slug: "cnair",
    termen: "CNAIR",
    categorie: "institutii",
    definitie:
      "Compania Națională de Administrare a Infrastructurii Rutiere. Responsabilă pentru drumurile naționale (DN) și autostrăzi (A).",
    detaliu:
      "Pentru gropi pe DN1, DN6, A1 etc. — sesizarea merge la CNAIR, nu primărie.",
  },
  {
    slug: "ipj",
    termen: "IPJ",
    categorie: "institutii",
    definitie:
      "Inspectoratul de Poliție Județean. Structură a Poliției Române (MAI), investighează infracțiuni în județ.",
    detaliu:
      "În București: Brigada Rutieră / Direcția Generală de Poliție.",
  },
  {
    slug: "gdpr",
    termen: "GDPR",
    categorie: "legi",
    definitie:
      "Regulamentul (UE) 2016/679 privind protecția datelor personale. Drepturi cheie: acces, rectificare, ștergere, portabilitate, opoziție.",
    detaliu:
      "Civia stochează datele în UE (Frankfurt) și permite ștergerea contului definitiv din /cont.",
    temeiLegal: "Reg. UE 2016/679",
  },
  {
    slug: "termen-30-zile",
    termen: "Termen de 30 de zile",
    categorie: "proceduri",
    definitie:
      "Termenul legal de răspuns la sesizări/petiții civice, conform OG 27/2002 art. 8. Calculat în zile calendaristice (NU lucrătoare).",
    detaliu:
      "Prelungibil cu 15 zile pentru cazuri complexe, cu notificare prealabilă.",
    temeiLegal: "OG 27/2002 art. 8",
  },
  {
    slug: "numar-inregistrare",
    termen: "Număr de înregistrare",
    categorie: "proceduri",
    definitie:
      `Cod unic atribuit de autoritate la primirea sesizării. Format obișnuit: „nr X/AAAA" (ex: nr 7421/2026).`,
    detaliu:
      "Civia detectează automat acest număr din răspunsul primăriei (AI parser) și îl afișează pe pagina sesizării.",
    temeiLegal: "OG 27/2002 art. 9",
  },
  {
    slug: "act-administrativ",
    termen: "Act administrativ",
    categorie: "proceduri",
    definitie:
      "Decizie scrisă emisă de o autoritate publică (decizie primar, dispoziție, hotărâre consiliu, autorizație). Poate fi atacat în contencios.",
  },
  {
    slug: "consultare-publica",
    termen: "Consultare publică",
    categorie: "proceduri",
    definitie:
      "Proces obligatoriu prin care autoritatea anunță cu 30 zile înainte un proiect de act normativ și primește observații publice.",
    temeiLegal: "L 52/2003",
  },
  {
    slug: "dezbatere-publica",
    termen: "Dezbatere publică",
    categorie: "proceduri",
    definitie:
      "Întâlnire publică obligatorie pentru anumite proiecte (urbanism, mediu). Cetățenii pot participa și își pot exprima opinia.",
  },
  {
    slug: "anaf",
    termen: "ANAF",
    categorie: "institutii",
    definitie:
      "Agenția Națională de Administrare Fiscală. Colectează taxe și impozite. Pentru reclamații fiscale: anaf.ro/contestatie.",
  },
  {
    slug: "garda-mediu",
    termen: "Garda de Mediu",
    categorie: "institutii",
    definitie:
      "Inspector de stat pentru protecția mediului. Investighează poluarea, defrișările ilegale, deșeurile.",
    detaliu:
      "Sesizările pe probleme de mediu pot merge AICI direct (în plus față de primărie).",
  },
  {
    slug: "iuli",
    termen: "Inspectoratul de Stat în Construcții (ISC)",
    categorie: "institutii",
    definitie:
      "Verifică legalitatea construcțiilor și autorizațiilor. Pentru construcții ilegale (case fără autorizație etc.).",
  },
  {
    slug: "contraventie",
    termen: "Contravenție",
    categorie: "proceduri",
    definitie:
      "Faptă prin care se încalcă regulile administrative, sancționabilă cu amendă. Diferită de infracțiune (penală).",
    temeiLegal: "OG 2/2001",
  },
  {
    slug: "amenda",
    termen: "Amendă",
    categorie: "proceduri",
    definitie:
      "Sancțiune pecuniară pentru contravenții. Se poate contesta în 15 zile de la primirea procesului-verbal.",
    detaliu:
      "Contestația la judecătoria de sector poate suspenda executarea amenzii.",
    temeiLegal: "OG 2/2001 art. 31",
  },
  {
    slug: "proces-verbal",
    termen: "Proces-verbal de contravenție",
    categorie: "proceduri",
    definitie:
      "Document oficial care constată o contravenție și aplică amenda. Trebuie să conțină: data, locul, fapta, sancțiunea, identitatea agentului.",
  },
  {
    slug: "drept-petitionare",
    termen: "Dreptul de petiționare",
    categorie: "drepturi",
    definitie:
      "Drept constituțional fundamental al cetățeanului de a se adresa în scris autorităților publice cu cereri colective sau individuale.",
    temeiLegal: "Constituția art. 51",
  },
  {
    slug: "drept-acces-info",
    termen: "Dreptul la informații publice",
    categorie: "drepturi",
    definitie:
      "Cetățeanul poate cere și primi gratuit informații deținute de autorități. Termen răspuns: 10 zile (extensibil 30).",
    temeiLegal: "L 544/2001",
  },
  {
    slug: "drept-mediu-sanatos",
    termen: "Dreptul la un mediu sănătos",
    categorie: "drepturi",
    definitie:
      "Drept constituțional. Inclus în art. 35 din Constituție. Permite cetățenilor să acționeze împotriva poluării.",
    temeiLegal: "Constituția art. 35",
  },
  {
    slug: "drept-protectie-date",
    termen: "Dreptul la protecția datelor",
    categorie: "drepturi",
    definitie:
      "Cetățenii pot cere ștergerea, rectificarea, accesul la datele lor personale deținute de orice instituție.",
    temeiLegal: "Reg. UE 2016/679 (GDPR)",
  },
  {
    slug: "trotuar",
    termen: "Trotuar",
    categorie: "sesizari",
    definitie:
      "Parte a străzii destinată pietonilor. Parcarea pe trotuar este interzisă; reclamațiile merg la Poliția Locală.",
    temeiLegal: "OUG 195/2002 (Codul Rutier) art. 142",
  },
  {
    slug: "carosabil",
    termen: "Carosabil",
    categorie: "sesizari",
    definitie:
      "Partea străzii destinată circulației autovehiculelor. Pentru gropi pe carosabil — sesizare la primărie/Administrația Străzilor.",
  },
  {
    slug: "domeniu-public",
    termen: "Domeniu public",
    categorie: "proceduri",
    definitie:
      "Bunuri aparținând statului sau unităților administrativ-teritoriale (drumuri, parcuri, clădiri publice). Sesizările privind aceste bunuri merg la primărie/CJ.",
    temeiLegal: "L 213/1998",
  },
  {
    slug: "salubritate",
    termen: "Salubritate",
    categorie: "sesizari",
    definitie:
      "Servicii de colectare a gunoiului. Operatori diferiți per oraș: Rosal, Compania Romprest, Urban etc. Sesizările pe gunoi netransportat merg DIRECT la operator + primărie.",
  },
  {
    slug: "stalpisori",
    termen: "Stâlpișori (bollards)",
    categorie: "sesizari",
    definitie:
      "Bariere fizice metalice/beton montate pe trotuar pentru a împiedica parcarea ilegală a mașinilor.",
    detaliu:
      "Sesizările pentru montarea de stâlpișori merg la Brigada Rutieră + Primărie + Administrația Străzilor.",
  },
  {
    slug: "trecere-pietoni",
    termen: "Trecere de pietoni",
    categorie: "sesizari",
    definitie:
      `Marcaj rutier („zebra") care indică pietonilor zona de traversare în siguranță. Solicitările de amenajare → Comisia de Circulație + Brigada Rutieră.`,
  },
  {
    slug: "iluminat-public",
    termen: "Iluminat public",
    categorie: "sesizari",
    definitie:
      "Iluminat stradal asigurat de primărie. Pentru becuri arse → sesizare la primăria sector/municipiu sau Servicii Publice locale.",
  },
  {
    slug: "operator-salubritate",
    termen: "Operator salubritate",
    categorie: "institutii",
    definitie:
      "Compania privată contractată de primărie pentru colectarea deșeurilor. Ex: Rosal (sectoare București), Compania Romprest, Urban (Cluj).",
  },
  {
    slug: "apanova",
    termen: "ApaNova București",
    categorie: "institutii",
    definitie:
      "Operatorul de apă și canalizare pentru București. Sesizările pentru capac canal lipsă, scurgeri, conducte sparte → ApaNova.",
  },
  {
    slug: "stb",
    termen: "STB",
    categorie: "institutii",
    definitie:
      "Societatea de Transport București — autobuze, troleibuze, tramvaie. Sesizări pentru rute, întârzieri, stații deteriorate.",
  },
  {
    slug: "metrorex",
    termen: "Metrorex",
    categorie: "institutii",
    definitie:
      "Operatorul de metrou București. Sesizările pentru defecțiuni stații, accesibilitate persoane cu dizabilități.",
  },
  {
    slug: "termoenergetica",
    termen: "Termoenergetica",
    categorie: "institutii",
    definitie:
      "Operatorul termic București. Sesizări pentru conducte rupte, abur în stradă, lipsă căldură.",
  },
  {
    slug: "trimite-si-tu",
    termen: "Trimite și tu",
    categorie: "petitii",
    definitie:
      "Funcție Civia prin care mai mulți cetățeni trimit aceeași sesizare către autorități, cu identitatea fiecăruia. Crește presiunea publică fără să dilueze textul oficial.",
    detaliu:
      `Pe Civia: butonul „Trimite și tu" deschide un modal cu nume + adresa. La submit, emailul pleacă REAL de la sesizari@civia.ro către autorități, cu identitatea celui care apasă (nu a autorului original). Pozele se atașează automat.`,
  },
  {
    slug: "fix-score",
    termen: "Fix Score",
    categorie: "sesizari",
    definitie:
      `Indicator Civia care măsoară rata de răspuns a fiecărei primării — % din sesizări marcate „rezolvat" din total depuse.`,
    detaliu:
      "Vezi /clasament pentru ranking actualizat.",
  },
];

export const GLOSAR_CATEGORII = {
  sesizari: { label: "Sesizări și reclamații", emoji: "📝" },
  petitii: { label: "Petiții și trimiteri colective", emoji: "✊" },
  legi: { label: "Legi cheie", emoji: "⚖️" },
  institutii: { label: "Instituții publice", emoji: "🏛️" },
  proceduri: { label: "Proceduri legale", emoji: "📋" },
  drepturi: { label: "Drepturi cetățenești", emoji: "🛡️" },
} as const;
