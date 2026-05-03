// ---------------------------------------------------------------------------
// Ghiduri detaliate pentru fiecare categorie de sesizare Civia.ro
// ---------------------------------------------------------------------------

export interface SesizareGuide {
  tip: string;
  label: string;
  icon: string;
  quickFields: string[];
  fullFields: string[];
  tips: string[];
  destinatari: string[];
  urgenta: string;
}

// Reguli universale, valabile pentru ORICE sesizare
export const UNIVERSAL_RULES: string[] = [
  "Trimite sesizarea la mai multe instituții simultan — crește șansele de rezolvare.",
  "Cere număr de înregistrare (prin e-mail sau la registratură) — fără el, sesizarea nu există oficial.",
  "Atașează poze de calitate: clare, bine luminate, din mai multe unghiuri, cu context vizibil.",
  "Menționează data și ora constatării problemei — nu doar data trimiterii sesizării.",
  'Formulează o solicitare concretă: "Vă solicit remedierea / înlocuirea / verificarea…" — nu doar "vă informez".',
  "Pericol iminent pentru viață sau siguranță = sună 112 PRIMA DATĂ, apoi faci sesizare scrisă.",
  "Păstrează copie a sesizării + confirmare de trimitere (e-mail, nr. înregistrare, captură ecran).",
];

export const SESIZARI_GUIDES: SesizareGuide[] = [
  // ── groapa ──────────────────────────────────────────────────
  {
    tip: "groapa",
    label: "Groapă în asfalt",
    icon: "🕳️",
    quickFields: [
      "Adresă exactă (stradă, număr, între intersecțiile…)",
      "Poză cu groapa",
      "Carosabil sau trotuar",
    ],
    fullFields: [
      "Dimensiuni aproximative (lățime × lungime × adâncime)",
      "Poză de context (se vede strada, un reper)",
      "Apă stagnantă în groapă (da/nu)",
      "Mai multe gropi pe același tronson — menționează câte",
      "Bandă de circulație afectată (1, 2, linia de tramvai)",
    ],
    tips: [
      `Notează strada, numărul cel mai apropiat și intersecțiile între care se află groapa — "pe str. X, între str. Y și str. Z, la nr. 15" e ideal.`,
      "Fă minim 2 poze: una apropiată (se vede adâncimea) și una de context (se vede strada). Pune un obiect lângă groapă (sticlă, telefon) pentru scară.",
      "Precizează dacă groapa e pe carosabil sau pe trotuar — instituția responsabilă diferă.",
      "Dacă vezi apă stagnantă în groapă, menționează explicit: apa infiltrează substratul și agravează rapid deteriorarea.",
      "Când sunt mai multe gropi pe același tronson, descrie-le pe toate într-o singură sesizare — arată că e nevoie de reabilitare, nu de petice.",
      "Verifică dacă groapa e pe drum județean/național (DN/DJ) — în acest caz destinatarul e CNAIR sau Consiliul Județean, nu primăria.",
    ],
    destinatari: [
      "ADP Sector (în București)",
      "Primăria localității",
      "CNAIR (drumuri naționale/europene)",
      "Consiliul Județean (drumuri județene)",
    ],
    urgenta:
      "Groapă foarte mare pe arteră circulată, care pune în pericol direct siguranța traficului — sună la Poliția Rutieră (021 9544 în București) sau 112 dacă a provocat deja accident.",
  },

  // ── trotuar ─────────────────────────────────────────────────
  {
    tip: "trotuar",
    label: "Trotuar degradat",
    icon: "🧱",
    quickFields: [
      "Adresă exactă (stradă, nr, tronson)",
      "Poză dale sparte / ridicate / lipsă",
      "Lungime aproximativă tronson afectat",
    ],
    fullFields: [
      "Cauza vizibilă (rădăcini copac, lucrări anterioare)",
      "Diferență de nivel între dale (cm)",
      "Tranzitat de persoane cu dizabilități / cărucioare",
      "Forțează pietonii pe carosabil (da/nu)",
      "Stare bordură (coborâtă / lipsă la trecere)",
    ],
    tips: [
      "Fotografiază dalele sparte, ridicate sau lipsă — o poză din lateral arată cel mai bine diferența de nivel.",
      "Dacă rădăcinile copacilor au ridicat dalele, menționează explicit — soluția e alta decât simpla înlocuire.",
      "Măsoară aproximativ diferența de nivel: peste 3-4 cm e deja pericol de împiedicare, mai ales pentru vârstnici.",
      "Menționează dacă trotuarul e tranzitat de persoane cu dizabilități, cărucioare sau lângă școli / spitale — are prioritate.",
      "Dacă trotuarul degradat forțează pietonii să meargă pe carosabil, subliniază acest lucru — e argument puternic pentru urgentare.",
      "Verifică și bordura la trecerile de pietoni: bordură necoborâtă = inaccesibil pentru scaune cu rotile și cărucioare.",
    ],
    destinatari: [
      "ADP Sector (în București)",
      "Primăria localității",
    ],
    urgenta:
      "Trotuar prăbușit peste canalizare sau cu risc de cădere în gol — sună 112 dacă e pericol imediat pentru pietoni.",
  },

  // ── iluminat ────────────────────────────────────────────────
  {
    tip: "iluminat",
    label: "Iluminat public defect",
    icon: "💡",
    quickFields: [
      "Adresă exactă (stradă, nr)",
      "Nr. stâlp (plăcuță metalică la ~2 m înălțime)",
      "Poză nocturnă a zonei",
    ],
    fullFields: [
      "Câți stâlpi consecutivi nu funcționează",
      "Trecere de pietoni / intersecție / parc afectat",
      "Tip defect (nu se aprinde deloc / clipește / ars)",
      "Stâlp înclinat / avariat",
    ],
    tips: [
      "Caută pe stâlp plăcuța metalică cu numărul (de obicei la ~2 m) — e cel mai important detaliu pentru operatorul de iluminat.",
      "Numără câți stâlpi consecutivi nu funcționează — dacă sunt mai mulți, probabil e defect de cablu, nu doar bec ars.",
      "Menționează dacă zona neiluminată include trecere de pietoni, intersecție, parc sau școală — prioritizează intervenția.",
      "Fă poză noaptea: arată cel mai clar zona afectată. Dacă poți, include un reper vizibil (nr. stradal, firmă).",
      "Stâlp înclinat sau cu cabluri expuse = pericol de electrocutare. Sună imediat la operator sau 112.",
      "În București, operatorul de iluminat este Luxten sau CLOP — verifică pe site-ul primăriei de sector cine operează în zona ta.",
    ],
    destinatari: [
      "Primăria de sector / localitate",
      "Luxten / CLOP / operatorul de iluminat",
    ],
    urgenta:
      "Stâlp căzut sau cabluri electrice la sol — sună 112 imediat. Nu te apropia de cabluri!",
  },

  // ── copac ───────────────────────────────────────────────────
  {
    tip: "copac",
    label: "Copac căzut/periculos",
    icon: "🌳",
    quickFields: [
      "Adresă exactă",
      "Copac căzut sau doar periculos (înclinat / crengi uscate)",
      "Poză copac",
    ],
    fullFields: [
      "Copac căzut pe: trotuar / mașină / fire electrice / carosabil",
      "Crengi uscate mari deasupra trotuarului",
      "Trunchi vizibil înclinat / scoarță desprinsă",
      "Specie protejată (dacă știi)",
      "Locație: parc sau stradă",
    ],
    tips: [
      "Copac căzut pe fire electrice sau pe carosabil = sună IMEDIAT la 112. Nu încerca să muți copacul singur.",
      "Dacă copacul e în parc, responsabil e ALPAB (în București); dacă e pe stradă sau trotuar, responsabil e ADP sector.",
      "Fotografiază trunchiul (se vede înclinarea / putreziciunea) și coroana (crengi uscate). Include un reper pentru localizare.",
      "Crengi uscate mari deasupra trotuarului sau locurilor de joacă = pericol real. Menționează frecventarea zonei.",
      "Nu solicita tăierea copacilor fără motiv serios — poți cere toaletare (tăierea crengilor periculoase). Tăierea necesită aviz de mediu.",
      "În afara Bucureștiului, contactează primăria locală și direcția de mediu a consiliului județean.",
    ],
    destinatari: [
      "ADP Sector (copaci pe stradă, în București)",
      "ALPAB (copaci în parcuri, în București)",
      "Primăria localității",
      "ISU (dacă a căzut pe fire electrice — prin 112)",
    ],
    urgenta:
      "Copac căzut pe mașini, persoane, fire electrice sau blocând circulația — sună 112. Copac care pare că urmează să cadă = sună Poliția Locală.",
  },

  // ── gunoi ───────────────────────────────────────────────────
  {
    tip: "gunoi",
    label: "Gunoi necolectat",
    icon: "🗑️",
    quickFields: [
      "Adresă exactă",
      "Tomberoane neridicate SAU depozitare ilegală",
      "Poză",
    ],
    fullFields: [
      "De câte zile nu s-a ridicat gunoiul",
      "Tip deșeu: menajer, construcții, vegetal, electrice",
      "Prezența dăunătorilor (șobolani, insecte)",
      "Miros puternic / scurgeri",
      "Nr. containere insuficient pentru zonă",
    ],
    tips: [
      "Distinge clar: tomberoane neridicate de operator (e vina operatorului de salubritate) vs. depozitare ilegală pe domeniu public (e vina celor care aruncă).",
      "Notează de câte zile nu s-a ridicat gunoiul și dacă e o problemă recurentă — operatorul are obligații contractuale de frecvență.",
      "Depozitare ilegală de deșeuri = sesizare la Garda de Mediu (nu doar primărie). Pozele trebuie să arate volumul.",
      "Deșeuri de construcții pe trotuar/stradă = amendă pentru cel care le-a depozitat. Menționează dacă blochează accesul.",
      "Dacă sunt dăunători (șobolani, gândaci) în zona containerelor, menționează — DSP (Direcția de Sănătate Publică) trebuie sesizată.",
      "Containerele insuficiente pentru zonă = sesizare la primărie cu solicitare de suplimentare, nu la operator.",
    ],
    destinatari: [
      "Operatorul de salubritate (Urban, Romprest, Supercom etc.)",
      "Primăria de sector / localitate",
      "Garda de Mediu (depozitare ilegală)",
      "DSP (prezență dăunători)",
    ],
    urgenta:
      "Deșeuri periculoase (chimice, medicale, azbest) abandonate — sună la Garda de Mediu și 112.",
  },

  // ── parcare ─────────────────────────────────────────────────
  {
    tip: "parcare",
    label: "Parcare ilegală",
    icon: "🚗",
    quickFields: [
      "Adresă exactă",
      "Poză cu nr. de înmatriculare vizibil",
      "Unde e parcată: trotuar / trecere / loc handicap / spațiu verde",
    ],
    fullFields: [
      "Blochează acces pietoni / cărucioare / persoane cu dizabilități",
      "Blochează acces pompieri / ambulanță",
      "Problemă recurentă (aceeași mașină zilnic)",
      "Marcaj parcare inexistent în zonă",
    ],
    tips: [
      "Poza trebuie să includă OBLIGATORIU numărul de înmatriculare clar și contextul (se vede trotuarul, trecerea, semnul de handicap).",
      "Parcare pe trotuar = Poliția Locală. Parcare pe bulevard / arteră principală = Brigada Rutieră.",
      "Dacă mașina blochează accesul pentru persoane cu dizabilități sau cărucioare, subliniază — e contravenție mai gravă.",
      "Mașină parcată pe loc de handicap fără legitimație vizibilă pe bord = fotografiază bordul + locul + plăcuța.",
      "Dacă e problemă recurentă (zilnic aceleași mașini pe trotuar), menționează frecvența — Poliția Locală poate monta stâlpișori.",
      "Mașină care blochează accesul pompierilor / ambulanței = sună la Poliția Locală pentru ridicare imediată.",
    ],
    destinatari: [
      "Poliția Locală (trotuar, spații verzi, loc handicap)",
      "Brigada Rutieră (bulevarde, artere principale)",
    ],
    urgenta:
      "Mașină blochează ieșire de urgență, hidrant sau acces ambulanță/pompieri — sună Poliția Locală (021 9770 în București) sau 112.",
  },

  // ── stalpisori ──────────────────────────────────────────────
  {
    tip: "stalpisori",
    label: "Montare stâlpișori anti-parcare",
    icon: "🪧",
    quickFields: [
      "Adresă exactă (stradă, tronson)",
      "Poze mașini parcate pe trotuar în zonă",
      "Lățime aproximativă trotuar",
    ],
    fullFields: [
      "Frecvența parcării ilegale (zilnic, permanent)",
      "Traseu școlar / spital / grădiniță în zonă",
      "Accesibilitate persoane cu dizabilități afectată",
      "Lățime liberă rămasă pe trotuar cu mașini parcate",
    ],
    tips: [
      "Aceasta e o SOLICITARE, nu o defecțiune — argumentează necesitatea cu poze ale mașinilor parcate pe trotuar.",
      "Fotografiază trotuarul la ore de vârf (dimineața, seara) când parcarea ilegală e maximă — arată amploarea problemei.",
      "Menționează HG 1391/2006: trotuarul trebuie să aibă minim 1 metru lățime liberă pentru pietoni. Cu mașini, rămân 30 cm.",
      "Argumentul cel mai puternic: traseu școlar, grădiniță, spital, cămin de bătrâni în zonă — copiii/bolnavii sunt forțați pe carosabil.",
      "Primăria de sector decide montarea. Cere stâlpișori pe tronsonul X-Y, nu pe o adresă punctuală — protejează tot trotuarul.",
      "Dacă deja există stâlpișori dar sunt rupți/lipsă, sesizarea e pentru ADP sector — menționează câți lipsesc.",
    ],
    destinatari: [
      "Primăria de Sector (în București)",
      "ADP Sector (pentru stâlpișori rupți/lipsă)",
      "Primăria localității",
    ],
    urgenta:
      "Nu e caz de urgență 112. Dacă mașinile parcate blochează accesul ambulanței/pompierilor, sună Poliția Locală.",
  },

  // ── canalizare ──────────────────────────────────────────────
  {
    tip: "canalizare",
    label: "Canalizare/inundație",
    icon: "💧",
    quickFields: [
      "Adresă exactă",
      "Gură de canal înfundată / capac lipsă / inundație",
      "Poză",
    ],
    fullFields: [
      "Suprafață aproximativă inundată",
      "Se inundă la fiecare ploaie sau prima dată",
      "Reflux canalizare (miros, apă murdară urcă)",
      "Capac canal lipsă = pericol cădere",
      "Acces imobile/magazine afectat",
    ],
    tips: [
      "Capac de canal lipsă = PERICOL DE CĂDERE. Marchează zona (pune ceva vizibil) și sesizează imediat — sună și la Poliția Locală.",
      "Distinge între apa pluvială (ploaie) și canalizare menajeră: inundație la ploaie = ADP/primărie; reflux canalizare = operatorul de apă.",
      "Fotografiază nivelul apei (lângă un reper: bordură, roata mașinii) și gurile de canal din zonă — arată dacă sunt înfundate.",
      "Menționează suprafața inundată și dacă blochează accesul la imobile, magazine sau circulația auto/pietoni.",
      "Dacă se inundă la fiecare ploaie, menționează frecvența — arată problemă de infrastructură, nu incident izolat.",
      "Reflux de canalizare în subsolul blocului = operator apă (Apa Nova în București). Sesizează și administratorul de bloc.",
    ],
    destinatari: [
      "Apa Nova / operatorul local de apă-canal",
      "ADP Sector (guri de canal pe stradă, în București)",
      "Primăria localității",
    ],
    urgenta:
      "Capac de canal lipsă pe trotuar circulat sau carosabil — sună Poliția Locală imediat. Inundație care pune în pericol persoane sau proprietăți — 112.",
  },

  // ── semafor ─────────────────────────────────────────────────
  {
    tip: "semafor",
    label: "Semafor/semnalizare defect",
    icon: "🚦",
    quickFields: [
      "Intersecția exactă (str. X cu str. Y)",
      "Semafor pietoni sau auto",
      "Direcția afectată",
    ],
    fullFields: [
      "Tip defect: nu funcționează / clipește galben / faze greșite",
      "Indicator rutier lipsă / vandalizat / întors",
      "Accidente recente în zonă (dacă știi)",
      "Semafor acustic lipsă la trecere (nevăzători)",
    ],
    tips: [
      "Precizează EXACT intersecția (strada X cu strada Y) și direcția afectată — o intersecție mare poate avea 8+ semafoare.",
      "Semafor complet nefuncțional pe arteră principală = sună Brigada Rutieră (021 9544 în București) — trimit agent să dirijeze.",
      "Menționează dacă e semafor pentru pietoni sau auto și pe ce sens — operatorul trebuie să știe exact care modul e defect.",
      "Semafor cu faze greșite (verde simultan pe direcții conflictuale) = PERICOL EXTREM. Sună 112.",
      "Indicator rutier lipsă, vandalizat sau întors = Administrația Străzilor / Poliția Rutieră. Fotografiază stâlpul gol sau indicatorul deteriorat.",
      "Dacă intersecția e lângă școală și semaforul e defect, menționează — se prioritizează.",
    ],
    destinatari: [
      "Brigada Rutieră (semafoare, în București)",
      "Administrația Străzilor / PMB",
      "Poliția Rutieră (indicatoare)",
      "Primăria localității (în afara Bucureștiului)",
    ],
    urgenta:
      "Semafor complet nefuncțional pe arteră cu trafic intens sau cu faze conflictuale — sună Brigada Rutieră sau 112.",
  },

  // ── pietonal ────────────────────────────────────────────────
  {
    tip: "pietonal",
    label: "Traversare pietoni periculoasă",
    icon: "🚸",
    quickFields: [
      "Intersecția / locația exactă",
      "Ce lipsește: marcaj / semafor / iluminat / indicator",
      "Poză",
    ],
    fullFields: [
      "Vizibilitate redusă (mașini parcate lângă trecere, vegetație)",
      "Volum trafic auto estimat",
      "Traseu școlar / spital / piață în zonă",
      `Accidente sau "la un pas" cunoscute`,
      "Referință: OUG 195/2002, HG 1391/2006",
    ],
    tips: [
      "Aceasta e categoria cu cel mai mare impact asupra vieții — trimite la TOATE instituțiile responsabile, nu doar una.",
      "Marcaj de trecere de pietoni șters complet = trecerea nu mai e vizibilă legal. Fotografiază de la distanță (perspectiva șoferului).",
      "Menționează dacă e traseu școlar — OUG 195/2002 prevede semnalizare suplimentară (indicator avertizare copii, limitare viteză).",
      "Lipsă iluminat la trecere de pietoni noaptea = extrem de periculos. Fă poză nocturnă și trimite paralel sesizare la iluminat.",
      "Dacă mașinile parcate lângă trecere reduc vizibilitatea, menționează — soluția e stâlpișori/jardiniere pre-trecere.",
      "Citează OUG 195/2002 și HG 1391/2006 în sesizare — obligă autoritățile să asigure siguranța traversărilor.",
    ],
    destinatari: [
      "Primăria Municipiului / Sectorului",
      "Administrația Străzilor",
      "Brigada Rutieră",
      "Poliția Locală",
    ],
    urgenta:
      "Trecere de pietoni pe arteră cu 4+ benzi, fără semafor, lângă școală — sună Brigada Rutieră. Accident la trecere = 112.",
  },

  // ── graffiti ────────────────────────────────────────────────
  {
    tip: "graffiti",
    label: "Graffiti/vandalism",
    icon: "🎨",
    quickFields: [
      "Adresă exactă",
      "Poză graffiti / vandalism",
      "Clădire publică sau privată",
    ],
    fullFields: [
      "Clădire de patrimoniu (da/nu)",
      "Mesaje de ură / simboluri extremiste",
      "Suprafață afectată",
      "Mobilier stradal vandalizat (stație, bancă, panou)",
    ],
    tips: [
      "Fotografiază graffiti-ul și fațada completă — arată contextul (clădire publică, bloc, monument).",
      "Dacă e pe clădire de patrimoniu, sesizează Direcția de Cultură / Monumentele Istorice — intervenția e diferită.",
      "Mesaje de ură, simboluri rasiste/extremiste = sesizare și la Poliție (nu doar Poliția Locală, ci și Poliția Națională).",
      "Clădire privată vandalizată: proprietarul e responsabil de curățare, dar poți sesiza Poliția Locală pentru investigație.",
      "Stație de autobuz, panou publicitar, bancă vandalizată = sesizare la ADP/operator transport, nu doar la primărie.",
      "Dacă ai văzut făptuitorul sau ai cameră de supraveghere în zonă, menționează în sesizare — ajută investigația.",
    ],
    destinatari: [
      "Primăria de sector / localitate",
      "Poliția Locală",
      "Direcția de Cultură (clădiri de patrimoniu)",
      "Poliția Națională (mesaje de ură)",
    ],
    urgenta:
      "Nu e caz de urgență 112. Dacă vandalismul e în desfășurare (vezi pe cineva distrugând), sună 112.",
  },

  // ── mobilier ────────────────────────────────────────────────
  {
    tip: "mobilier",
    label: "Mobilier stradal stricat",
    icon: "🪑",
    quickFields: [
      "Adresă exactă",
      "Tip: bancă / coș gunoi / panou / gard / stâlp",
      "Poză",
    ],
    fullFields: [
      "Metal ascuțit / elemente periculoase expuse",
      "Locație: parc sau stradă",
      "Funcțional dar degradat vs. complet distrus",
      "Coș de gunoi plin / lipsă în zonă",
    ],
    tips: [
      "Metal ascuțit, șuruburi ieșite, scânduri rupte cu așchii = PERICOL DE RĂNIRE. Menționează explicit în sesizare.",
      "Mobilier în parc = responsabil ALPAB (în București); pe stradă sau trotuar = ADP sector / primărie.",
      "Coș de gunoi revărsat permanent = fie e prea mic, fie frecvența de golire e insuficientă. Menționează ambele posibilități.",
      "Gard metalic de protecție (pe trotuar, la treceri) rupt sau lipsă = pericol că pietonii intră pe carosabil. Sesizează la ADP.",
      "Bancă de parc cu inscripții / vandalizată dar funcțională — menționează, dar prioritatea e mobilierul periculos.",
      "Dacă știi modelul / codul de inventar al mobilierului (uneori scris pe el), include-l — ajută identificarea.",
    ],
    destinatari: [
      "ADP Sector (în București, pe stradă)",
      "ALPAB (în parcuri, în București)",
      "Primăria localității",
    ],
    urgenta:
      "Element metalic ascuțit la nivelul copiilor / la loc de joacă — sună Poliția Locală pentru semnalizare imediată a zonei.",
  },

  // ── zgomot ──────────────────────────────────────────────────
  {
    tip: "zgomot",
    label: "Zgomot excesiv/deranj",
    icon: "🔊",
    quickFields: [
      "Adresa sursei de zgomot",
      "Adresa ta (unde se aude)",
      "Tip zgomot (muzică, construcții, utilaje, animale)",
    ],
    fullFields: [
      "Interval orar (22:00–08:00 = interzis)",
      "Frecvență (zilnic, weekenduri, ocazional)",
      "Nivel decibeli estimat (aplicație pe telefon)",
      "Încercare de rezolvare amiabilă (da/nu)",
      "Șantier — are autorizație afișată?",
    ],
    tips: [
      "Intervalul 22:00–08:00 e protejat legal — zgomotul e contravenție. Între 08:00–22:00, pragurile sunt mai permisive dar nu nelimitate.",
      "Instalează o aplicație de decibeli (Decibel X, Sound Meter) și fă o captură de ecran — nu e probă legală, dar e argument concret.",
      "Menționează dacă ai încercat rezolvarea amiabilă (ai vorbit cu vecinul/administratorul) — Poliția Locală apreciază efortul.",
      "Șantier care lucrează noaptea sau în weekend = verifică dacă are autorizație de lucru (afișată la intrare). Fără autorizație = amendă.",
      "Adună semnături de la vecini și trimite sesizare colectivă — are mai multă greutate decât una individuală.",
      "Local/bar cu muzică tare noaptea = sesizare la Poliția Locală + ANPC (dacă funcționează fără autorizație de noapte).",
    ],
    destinatari: [
      "Poliția Locală",
      "Primăria localității (autorizații șantier)",
      "ANPC (localuri comerciale)",
    ],
    urgenta:
      "Nu e caz de 112. Dacă zgomotul e de la o explozie, prăbușire sau altceva suspect, atunci DA, sună 112.",
  },

  // ── animale ─────────────────────────────────────────────────
  {
    tip: "animale",
    label: "Câini periculoși/animale",
    icon: "🐕",
    quickFields: [
      "Zonă / adresă exactă",
      "Câini fără stăpân SAU cu stăpân (adresă stăpân dacă știi)",
      "Câți câini, comportament agresiv",
    ],
    fullFields: [
      "Descriere câini (talie, culoare, semne distinctive)",
      "Zonă frecventată de copii (parc, școală, grădiniță)",
      "Haită organizată sau câini individuali",
      "Incidente anterioare cunoscute (mușcături, atacuri)",
    ],
    tips: [
      "Mușcătură de câine = DU-TE LA URGENȚE imediat (antirabic!) + sună 112 + depune plângere la Poliție. Nu aștepta.",
      "Câini fără stăpân = sesizare la ASPA (Autoritatea pentru Supravegherea și Protecția Animalelor) în București sau serviciul similar local.",
      "Câine cu stăpân care e agresiv = sesizare la Poliția Locală cu adresa stăpânului. Legea 205/2004 obligă stăpânul să controleze animalul.",
      "Descrie câinii (talie, culoare, semne) și zona exactă — echipele de capturare trebuie să-i identifice.",
      "Menționează dacă zona e frecventată de copii (școală, loc de joacă, parc) — prioritizează intervenția.",
      "Nu hrăni haitele de câini în zone populate — le fixezi în zonă. Dacă cineva face asta, menționează în sesizare.",
    ],
    destinatari: [
      "ASPA București / Serviciul local de gestionare animale",
      "Poliția Locală",
      "Direcția Sanitar-Veterinară (DSVSA)",
    ],
    urgenta:
      "Atac de câini asupra unei persoane — sună 112 IMEDIAT. Haită agresivă lângă școală/grădiniță — sună Poliția Locală.",
  },

  // ── transport ───────────────────────────────────────────────
  {
    tip: "transport",
    label: "Problemă transport public",
    icon: "🚌",
    quickFields: [
      "Linia afectată",
      "Stația și direcția",
      "Ora și data incidentului",
    ],
    fullFields: [
      "Tip problemă: nu oprește / frecvență slabă / supraîncărcat",
      "Stație vandalizată / fără acoperiș / fără info",
      "Accesibilitate (rampă, loc handicap)",
      "Nr. vehicul (afișat pe laterale/spate)",
      "Aer condiționat nefuncțional / curățenie",
    ],
    tips: [
      "Notează nr. vehiculului (afișat pe laterale/spate) și ora exactă — STB/operatorul poate identifica șoferul și verifica GPS-ul.",
      "STB (București): sesizari@stbsa.ro sau aplicația InfoSTB. Metrorex: contact@metrorex.ro. Păstrează nr. de înregistrare.",
      "Autobuz care nu oprește în stație, deși ai făcut semn = sesizare cu nr. vehicul, linia, stația, ora. Se verifică pe camere.",
      "Stație vandalizată, fără acoperiș sau fără afișaj = sesizare la STB/operator + primărie (stația e pe domeniul public).",
      "Lipsă accesibilitate (rampă nefuncțională, loc handicap ocupat de bagaje) = sesizare + menționează Legea 448/2006.",
      "Frecvență slabă pe o linie = strânge date concrete: câte vehicule ai numărat într-o oră, câți oameni așteaptă, interval între curse.",
    ],
    destinatari: [
      "STB (București — sesizari@stbsa.ro)",
      "Metrorex (metrou — contact@metrorex.ro)",
      "Operatorul local de transport",
      "Primăria localității (stații, infrastructură)",
    ],
    urgenta:
      "Accident de transport public, incendiu în vehicul sau persoană rănită — sună 112. Șofer care conduce periculos = sună Poliția.",
  },

  // ── afisaj ──────────────────────────────────────────────────
  {
    tip: "afisaj",
    label: "Afișaj/publicitate ilegală",
    icon: "📢",
    quickFields: [
      "Adresă exactă",
      "Tip: afiș sălbatic / panou / banner / mash pe stâlp",
      "Poză cu obiectul publicitar și locul",
    ],
    fullFields: [
      "Beneficiarul reclamei (nume firmă/produs/eveniment vizibil)",
      "Suport: stâlp / copac / gard / clădire / spațiu public",
      "Existența unui număr de autorizație vizibil (de obicei lipsește)",
      "Mai multe afișe identice în zonă (campanie ilegală)",
    ],
    tips: [
      "Fotografiază DOUĂ cadre: una zoom pe afișul/panoul ilegal (ca să se vadă beneficiarul) și una larg (ca să se vadă locul — domeniu public, stâlp, copac).",
      "Legea 185/2013 interzice afișajul fără autorizație pe domeniul public. Sancțiunile sunt 1.000-10.000 lei pentru beneficiarul reclamei (NU pentru lipitor).",
      "Notează numele firmei/produsului/evenimentului din afiș — Poliția Locală îl identifică prin CUI și aplică amenda direct beneficiarului.",
      "Mash-publicitate pe stâlpi de iluminat / copaci = degradare suplimentară a infrastructurii. Menționează asta în sesizare.",
      "Panourile mari (billboards) fără autorizație = sesizare la Direcția Urbanism a primăriei + Poliția Locală. Au alt regim decât afișele mici.",
      "Afișe electorale după campanie: trebuie ridicate în 30 zile de la alegeri (Legea 334/2006). Dacă persistă, sesizare.",
    ],
    destinatari: [
      "Poliția Locală (constată contravenția conform L185/2013)",
      "Primăria sectorului / localității (autorizare + dispune înlăturarea)",
      "PMB / DGAB (pe domeniul public general)",
    ],
    urgenta:
      "Nu e urgență. Termen legal de răspuns: 30 zile (OG 27/2002). Înlăturarea efectivă durează mai mult — Poliția Locală notifică beneficiarul și impune termen.",
  },

  // ── altele ──────────────────────────────────────────────────
  {
    tip: "altele",
    label: "Altele",
    icon: "📝",
    quickFields: [
      "Adresă / localizare exactă",
      "Descriere detaliată a problemei",
      "Poză (dacă e posibil)",
    ],
    fullFields: [
      "Categorie apropiată (dacă niciuna nu se potrivește exact)",
      "Instituția pe care o consideri responsabilă",
      "Impact (câți oameni afectați, frecvență)",
      "Soluție propusă (dacă ai una)",
    ],
    tips: [
      "Descrierea trebuie să răspundă la: CE problemă, UNDE exact, DE CÂND, PE CINE afectează, CÂT de grav.",
      "Chiar dacă nu știi instituția responsabilă, trimite la primărie — au obligația legală să redirecționeze (OG 27/2002).",
      `Formulează o SOLICITARE concretă, nu doar o informare: "Vă solicit remedierea…" nu "Vă aduc la cunoștință…".`,
      "Atașează poze de calitate + localizare pe hartă — o sesizare fără dovezi foto e ușor de ignorat.",
      "Dacă problema afectează mai mulți oameni, strânge semnături sau trimiteți sesizări individuale — volumul contează.",
      "Ai dreptul legal la răspuns în 30 de zile (OG 27/2002). Dacă nu primești, depune reclamație la instituția ierarhic superioară.",
    ],
    destinatari: [
      "Primăria de sector / localitate",
      "Instituția pe care o consideri responsabilă",
    ],
    urgenta:
      "Orice situație care pune în pericol viața sau sănătatea oamenilor — sună 112 prima dată, apoi faci sesizare scrisă.",
  },
];

// Index rapid: tip → guide
export const GUIDES_BY_TIP: Record<string, SesizareGuide> = Object.fromEntries(
  SESIZARI_GUIDES.map((g) => [g.tip, g]),
);
