/**
 * F10 Civic Quiz — 15 intrebari despre drepturi civice.
 *
 * Subiecte:
 *  - OG 27/2002 (petitii, termene)
 *  - Legea 544/2001 (acces info publice)
 *  - GDPR Reg UE 2016/679
 *  - Legea 52/2003 (dezbatere publica)
 *  - Constitutia Romaniei (art. 51 petitionare)
 *
 * Quiz: 10 intrebari random din 15. Punctaj la final + badge „Cetatean Informat"
 * daca 8+/10.
 */

export interface QuizQuestion {
  id: string;
  question: string;
  answers: { text: string; correct?: boolean }[];
  explanation: string;
  topic: "petitii" | "info-publice" | "gdpr" | "dezbatere" | "constitutie";
}

export const CIVIC_QUIZ: QuizQuestion[] = [
  {
    id: "og27-term",
    question: "Cat timp are primaria sa raspunda la o sesizare/petitie conform OG 27/2002?",
    answers: [
      { text: "10 zile" },
      { text: "30 zile (extensibil cu 15 zile)", correct: true },
      { text: "60 zile" },
      { text: "Nu exista termen legal" },
    ],
    explanation:
      "OG 27/2002 obliga autoritatile sa raspunda in maxim 30 zile, extensibile cu 15 zile in cazuri complexe (cu notificare).",
    topic: "petitii",
  },
  {
    id: "og27-rights",
    question: "Cine poate depune o petitie/sesizare la o autoritate publica?",
    answers: [
      { text: "Doar cetatenii romani" },
      { text: "Orice persoana fizica sau juridica", correct: true },
      { text: "Doar locuitorii din localitate" },
      { text: "Doar cei cu adresa de domiciliu in zona" },
    ],
    explanation:
      "OG 27/2002 art. 2 — orice persoana fizica sau juridica poate adresa petitii autoritatilor publice. Domiciliul nu e relevant.",
    topic: "petitii",
  },
  {
    id: "lege544-term",
    question: "Care e termenul legal pentru raspuns la o cerere de informatii publice (Legea 544/2001)?",
    answers: [
      { text: "5 zile" },
      { text: "10 zile (extensibil 30 zile)", correct: true },
      { text: "30 zile fix" },
      { text: "Nu exista termen" },
    ],
    explanation:
      "Legea 544/2001 art. 7 — raspuns in 10 zile lucratoare, extensibile la 30 zile pentru cazuri complexe (cu notificare in 5 zile).",
    topic: "info-publice",
  },
  {
    id: "lege544-scope",
    question: "Ce tip de informatii pot fi cerute conform Legii 544/2001?",
    answers: [
      { text: "Doar informatii din arhive vechi" },
      { text: "Orice informatie detinuta de o autoritate publica (cu exceptii)", correct: true },
      { text: "Doar bugetul institutiei" },
      { text: "Doar lista angajatilor" },
    ],
    explanation:
      "Legea 544/2001 — accesul liber la orice informatie detinuta de autoritati, cu exceptii limitate (clasificat, date personale terti).",
    topic: "info-publice",
  },
  {
    id: "lege544-cost",
    question: "Cat costa o cerere de acces la informatii publice?",
    answers: [
      { text: "10 RON taxa fixa" },
      { text: "Gratuit, dar pot fi facturate doar costuri reale de copiere", correct: true },
      { text: "50 RON" },
      { text: "Depinde de complexitate" },
    ],
    explanation:
      "Legea 544/2001 — informarea e gratuita. Doar costurile reale (xerox, CD) pot fi facturate, prestabilite prin hotarare.",
    topic: "info-publice",
  },
  {
    id: "gdpr-right",
    question: "Conform GDPR, ce poti cere autoritatii care iti prelucreaza datele?",
    answers: [
      { text: "Doar dreptul la stergere" },
      { text: "Drept de acces, rectificare, stergere, portabilitate, opozitie", correct: true },
      { text: "Doar dreptul la informare" },
      { text: "Nimic — datele oficialilor sunt sub control complet" },
    ],
    explanation:
      "GDPR Reg UE 2016/679 — cetateanul are 6 drepturi: acces, rectificare, stergere, restrictionare, portabilitate, opozitie.",
    topic: "gdpr",
  },
  {
    id: "gdpr-minimization",
    question: "Pot cere ca datele mele de contact sa NU fie divulgate persoanelor vizate de sesizarea mea?",
    answers: [
      { text: "Nu, primaria poate da emailul meu oricui cere" },
      { text: "Da, conform principiului minimizarii datelor (GDPR art. 5)", correct: true },
      { text: "Doar daca platesc o taxa" },
      { text: "Doar cu acord scris in 3 exemplare" },
    ],
    explanation:
      "GDPR art. 5 — principiul minimizarii. Civia include automat aceasta clauza in emailurile generate.",
    topic: "gdpr",
  },
  {
    id: "lege52-scope",
    question: "Legea 52/2003 reglementeaza:",
    answers: [
      { text: "Salarizarea functionarilor publici" },
      { text: "Transparenta decizionala in administratia publica", correct: true },
      { text: "Doar achizitiile publice" },
      { text: "Cetatenia romana" },
    ],
    explanation:
      "Legea 52/2003 — obliga autoritatile sa publice proiecte de acte normative + sa organizeze dezbateri publice.",
    topic: "dezbatere",
  },
  {
    id: "lege52-time",
    question: "Cu cat timp inainte trebuie publicat un proiect de hotarare locala pentru dezbatere publica?",
    answers: [
      { text: "3 zile" },
      { text: "Minim 30 zile", correct: true },
      { text: "1 zi" },
      { text: "Nu e obligatorie publicarea anticipata" },
    ],
    explanation:
      "Legea 52/2003 — proiectele de acte normative trebuie publicate cu minim 30 zile inainte de adoptare pentru consultare publica.",
    topic: "dezbatere",
  },
  {
    id: "constitutie-art51",
    question: "Articolul 51 din Constitutia Romaniei consacra:",
    answers: [
      { text: "Dreptul la munca" },
      { text: "Dreptul de petitionare", correct: true },
      { text: "Dreptul la educatie" },
      { text: "Dreptul de proprietate" },
    ],
    explanation:
      "Constitutia Romaniei art. 51 — cetatenii au dreptul sa se adreseze autoritatilor publice prin petitii formulate in nume propriu sau colectiv.",
    topic: "constitutie",
  },
  {
    id: "constitutie-art31",
    question: "Care articol din Constitutie garanteaza accesul la informatii publice?",
    answers: [
      { text: "Art. 21" },
      { text: "Art. 31", correct: true },
      { text: "Art. 51" },
      { text: "Art. 81" },
    ],
    explanation:
      "Constitutia art. 31 — dreptul persoanei de a avea acces la orice informatie de interes public.",
    topic: "constitutie",
  },
  {
    id: "amenda-contestatie",
    question: "Cat timp ai sa contesti o amenda contraventionala?",
    answers: [
      { text: "5 zile" },
      { text: "15 zile de la comunicare", correct: true },
      { text: "30 zile" },
      { text: "Nu se poate contesta" },
    ],
    explanation:
      "OG 2/2001 — plangerea contra procesului-verbal se face in 15 zile de la comunicare, la judecatoria de domiciliu.",
    topic: "petitii",
  },
  {
    id: "petitii-anonime",
    question: "Sunt valabile petitiile/sesizarile anonime?",
    answers: [
      { text: "Da, oricand" },
      { text: "Nu — trebuie sa contina nume + adresa de contact (OG 27/2002)", correct: true },
      { text: "Doar daca sunt scurte" },
      { text: "Depinde de primarie" },
    ],
    explanation:
      "OG 27/2002 art. 7 — petitiile anonime sau cele care nu identifica solicitantul nu se iau in considerare. Civia automatizeaza completarea numelui.",
    topic: "petitii",
  },
  {
    id: "ngo-initiere",
    question: "Cati cetateni au nevoie cel putin pentru a infiinta o asociatie (ONG)?",
    answers: [
      { text: "1" },
      { text: "3 (asociati fondatori)", correct: true },
      { text: "10" },
      { text: "100" },
    ],
    explanation:
      "OG 26/2000 — pentru infiintarea unei asociatii e nevoie de minim 3 membri fondatori.",
    topic: "constitutie",
  },
  {
    id: "right-record",
    question: "Pot inregistra audio/video o intalnire publica (consiliu local)?",
    answers: [
      { text: "Nu, niciodata" },
      { text: "Da — sedintele publice pot fi inregistrate (Legea 52/2003 art. 8)", correct: true },
      { text: "Doar jurnalistii acreditati" },
      { text: "Doar cu aprobare de la primar" },
    ],
    explanation:
      "Legea 52/2003 si caracter public sedinte CL — cetatenii pot asista si inregistra sedintele publice.",
    topic: "dezbatere",
  },
];

export const QUIZ_QUESTIONS_PER_ROUND = 10;
export const PASSING_SCORE = 8;
