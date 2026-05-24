/**
 * Civic Literacy Quiz — 5 lecții cu 5 întrebări fiecare.
 *
 * Acoperă: Drepturile mele, Cum scriu o sesizare, Cum funcționează primăria,
 * Petiții vs sesizări vs proteste, Cazuri practice România.
 *
 * Folosit la /civic-quiz + kit școli /scoala. (P2.530, P3.837)
 */

export interface QuizQuestion {
  q: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizLesson {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  questions: QuizQuestion[];
}

export const QUIZ_LESSONS: QuizLesson[] = [
  {
    slug: "drepturi",
    title: "Drepturile mele de cetățean",
    emoji: "⚖️",
    description: "Constituție, legi de bază, cum le folosești în viața reală.",
    questions: [
      {
        q: "Conform Constituției României, dreptul de a depune petiții la autoritățile publice e prevăzut la:",
        options: ["Art. 30", "Art. 51", "Art. 70", "Art. 100"],
        correctIndex: 1,
        explanation: `Art. 51 din Constituție: „Cetățenii au dreptul să se adreseze autorităților publice prin petiții formulate numai în numele semnatarilor."`
      },
      {
        q: "În cât timp e obligată primăria să răspundă la o sesizare conform OG 27/2002?",
        options: ["7 zile", "15 zile", "30 zile", "60 zile"],
        correctIndex: 2,
        explanation: "OG 27/2002 art. 8: 30 zile calendaristice. Extensie posibilă încă 15 zile cu notificare scrisă."
      },
      {
        q: "Legea 544/2001 reglementează:",
        options: ["Petițiile civice", "Accesul la informații publice", "Răspunsul primarului", "Procedura electorală"],
        correctIndex: 1,
        explanation: "Legea 544/2001 — acces liber la informații de interes public. Termen răspuns: 10 zile (info simple) / 30 zile (info complexe)."
      },
      {
        q: "Dacă primăria nu răspunde la sesizarea ta în 30 zile, te poți adresa:",
        options: ["Doar instanței de judecată", "Avocatului Poporului", "Doar prefecturii", "Niciunde, e legal să tacă"],
        correctIndex: 1,
        explanation: "Avocatul Poporului (Legea 35/1997). Plus opțional: instanța de contencios administrativ sau prefectura."
      },
      {
        q: "Sesizarea către autoritate trebuie să conțină OBLIGATORIU:",
        options: ["Doar descrierea problemei", "Nume real + adresă + descriere", "Nume anonim acceptat", "Doar email"],
        correctIndex: 1,
        explanation: "OG 27/2002 art. 7: sesizările anonime se clasează fără răspuns. Identitatea reală e cerință legală."
      },
    ],
  },
  {
    slug: "sesizare-buna",
    title: "Cum scriu o sesizare bună",
    emoji: "📝",
    description: "Structură, claritate, dovezi. Ce face o sesizare să fie acțională.",
    questions: [
      {
        q: "O sesizare bună conține în principal:",
        options: ["Doar plângere generală", "Locație clară + descriere problemă + soluție propusă", "Doar emoții", "Lista cu toate problemele cartierului"],
        correctIndex: 1,
        explanation: "Specific + actionable. Primăria are nevoie să știe EXACT unde + ce + ce solicitați."
      },
      {
        q: "Pentru parcare ilegală pe trotuar, dovada VIZUALĂ cea mai puternică e:",
        options: ["Plăcuța mașinii + locul", "Doar locul", "Doar plăcuța", "Selfie cu problema"],
        correctIndex: 0,
        explanation: "Plăcuța identifică șoferul, locul demonstrează ilegalitatea (trotuar). Civia cere ambele la tip=parcare."
      },
      {
        q: "Tonul corect într-o sesizare oficială:",
        options: ["Agresiv ca să prindă atenție", "Politicos + ferm + factual", "Sarcastic", "Doar emoțional"],
        correctIndex: 1,
        explanation: "Sesizarea e document oficial. Ton factual + politicos creează presiune fără ostilitate. Civia AI generează automat acest ton."
      },
      {
        q: "În cât timp ar trebui să depui sesizarea după ce observi problema?",
        options: ["Imediat ce poți (zile)", "Maximum 1 lună", "Maximum 6 luni", "Nu contează"],
        correctIndex: 0,
        explanation: "Cu cât mai aproape de momentul observării, cu atât dovada e mai proaspătă + mai credibilă. Plus probabilitatea ca primăria să acționeze rapid e mai mare."
      },
      {
        q: "Co-semnarea unei sesizări:",
        options: ["Nu schimbă nimic", "Crește prioritate la primărie + presiune publică", "E ilegală", "Înlocuiește propria sesizare"],
        correctIndex: 1,
        explanation: "Sesizările cu cosignaturi multiple demonstrează problemă sistemică. Primăria le tratează cu prioritate. Civia activează auto-boost la 10+ cosignaturi."
      },
    ],
  },
  {
    slug: "primaria",
    title: "Cum funcționează primăria",
    emoji: "🏛️",
    description: "Structură, cine pe ce decide, cum colaborezi cu instituția.",
    questions: [
      {
        q: "În București, sectoarele (1-6) sunt conduse de:",
        options: ["Un singur primar general", "Primari de sector + Consiliu Local", "Doar primarul general", "Prefectul Capitalei"],
        correctIndex: 1,
        explanation: "București = 6 sectoare independente cu primar + consiliu local fiecare. Primarul general + Consiliul General coordonează pe lucrările centrale."
      },
      {
        q: "Bugetul local al unei primării e aprobat de:",
        options: ["Primar singur", "Consiliul Local prin vot", "Prefectură", "Guvern"],
        correctIndex: 1,
        explanation: "Legea 215/2001: bugetul local e aprobat de Consiliul Local. Cetățenii pot consulta proiectul bugetar — e document public."
      },
      {
        q: "Pentru o groapă pe DN1 (drum național), autoritatea competentă e:",
        options: ["Primăria locală", "CNAIR", "Poliția Locală", "Consiliul Județean"],
        correctIndex: 1,
        explanation: "Drumurile naționale (DN, A1, A2, etc.) sunt administrate de CNAIR (Compania Națională de Administrare a Infrastructurii Rutiere). Civia AI Vision detectează automat."
      },
      {
        q: "Poliția Locală sancționează:",
        options: ["Doar viteză exces pe DN", "Parcare ilegală pe trotuar + ordine publică locală", "Doar infracțiuni grave", "Furt"],
        correctIndex: 1,
        explanation: "Poliția Locală (NU Poliția Națională): parcări, salubritate, comerț stradal, animale, fapte minore. Pe sesizările Civia parking, Poliția Locală e destinatarul corect."
      },
      {
        q: "Consiliul Local local se întrunește public:",
        options: ["O dată pe an", "Lunar (cel puțin)", "Doar la cerere primar", "Niciodată public"],
        correctIndex: 1,
        explanation: "Legea 215/2001 art. 39: minim o ședință pe lună, publică. Ai dreptul să asiști + să iei cuvântul în secțiunea pentru cetățeni."
      },
    ],
  },
  {
    slug: "petitii-sesizari-proteste",
    title: "Petiții vs Sesizări vs Proteste",
    emoji: "📢",
    description: "Diferențe legale + practice. Când folosești ce.",
    questions: [
      {
        q: "Sesizarea raportează:",
        options: ["O cauză abstractă (lege nouă)", "O problemă concretă locală (groapă, parcare)", "Doar opinii personale", "Petiții parlamentare"],
        correctIndex: 1,
        explanation: "Sesizare = specific, local, actionable de o autoritate concretă. Petiția = cauză colectivă mai amplă."
      },
      {
        q: "Petiția cere de obicei:",
        options: ["Reparație stradă", "Modificare lege / politică publică", "Curățarea unui parc", "Repararea unui semafor"],
        correctIndex: 1,
        explanation: "Petițiile colectează susținere pentru schimbări de politică, legi, decizii guvernamentale. Sesizările rezolvă probleme operaționale concrete."
      },
      {
        q: "Pentru a organiza un protest legal în România:",
        options: ["Nu trebuie să anunți pe nimeni", "Trebuie să anunți primăria cu minim 3 zile avans", "Doar dacă sunt 1000+ oameni", "Trebuie aprobare poliție"],
        correctIndex: 1,
        explanation: "Legea 60/1991 (modificată): anunțul scris la primărie cu minim 3 zile înainte. Adunarea publică e drept constituțional dar reglementat."
      },
      {
        q: "Care e cel mai eficient pentru o groapă în asfalt?",
        options: ["Petiție online", "Protest în fața primăriei", "Sesizare la primăria de sector", "Articol în presă"],
        correctIndex: 2,
        explanation: "Problemă specifică + locală + administrativă = sesizare. Pe Civia: 2 minute, AI generează emailul oficial cu temei legal."
      },
      {
        q: "Care e cel mai eficient pentru oprirea unei legi care îți afectează drepturile?",
        options: ["Sesizare la primărie", "Petiție națională + lobby + protest", "Doar protest", "Doar petiție"],
        correctIndex: 1,
        explanation: "Schimbare politică majoră = multi-vector. Petiția construiește audiență, lobby influențează decident, protest oferă vizibilitate media."
      },
    ],
  },
  {
    slug: "cazuri",
    title: "Cazuri practice România",
    emoji: "📚",
    description: "Studii de caz reale + ce ar fi făcut diferit cu Civia.",
    questions: [
      {
        q: "Petiția SaveRoșia Montană (2013-2014) a strâns:",
        options: ["1.000 semnături", "100.000", "1+ milion", "500"],
        correctIndex: 2,
        explanation: "Peste 1 milion semnături + proteste masive au împiedicat exploatarea minieră. Exemplu istoric de civic engagement românesc reușit."
      },
      {
        q: "Cazul Dafora (Colectiv 2015) a dus la:",
        options: ["Nicio schimbare", "Demiterea premier Ponta + alegeri", "Doar amenzi mici", "Privatizarea cluburilor"],
        correctIndex: 1,
        explanation: "Tragedia a generat proteste #Colectiv care au dus la demisia guvernului Ponta + modificarea legislației safety locuri publice."
      },
      {
        q: "Bucureștenii care raportează parcare ilegală pe Civia pot fi anonimi?",
        options: ["Da, complet anonim", "Nu, dar numele e ascuns public", "Doar primăria vede numele", "Toate informațiile sunt publice"],
        correctIndex: 1,
        explanation: `Numele real e necesar legal (OG 27/2002). PE SITE — anonimizat (apare „[nume], [adresa]"). EMAILUL OFICIAL către primărie — date reale. Privacy by design.`
      },
      {
        q: `Dacă primăria îți răspunde „redirecționăm la altă autoritate", cât timp se resetează?`,
        options: ["Nu se resetează", "30 zile noi de la primirea ei", "60 zile", "Pentru totdeauna"],
        correctIndex: 1,
        explanation: "OG 27/2002 art. 8 alin. (2): termen nou de 30 zile începe de la înregistrarea la noua autoritate. Civia urmărește automat."
      },
      {
        q: "Cea mai eficientă tactică pentru a obține rezolvare e:",
        options: ["O sesizare unică agresivă", "Cosignaturi multiple + spotlight social media + reminder după 30 zile", "Doar protest", "Plângere directă instanța"],
        correctIndex: 1,
        explanation: "Presiune publică + reminder legal + reach social = combinație imbatabilă. Civia automatizează toate astea."
      },
    ],
  },
];

export function findLesson(slug: string): QuizLesson | undefined {
  return QUIZ_LESSONS.find((l) => l.slug === slug);
}

export function totalQuestions(): number {
  return QUIZ_LESSONS.reduce((sum, l) => sum + l.questions.length, 0);
}
