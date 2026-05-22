/**
 * 15 tipuri de probleme civice — date statice pentru pagina /cum-fac/[tip].
 *
 * Fiecare tip are: titlu, slug, descriere SEO, autoritate principală,
 * exemple, pași concreți, FAQ, temei legal.
 *
 * Plan SEO (5/22/2026). Țintă: long-tail keyword „cum fac sesizare pentru
 * groapa", „cum reclam parcare ilegală pe trotuar" etc.
 */

export interface CumFacTip {
  slug: string;
  titlu: string;
  emoji: string;
  /** Slug-uri keyword pentru SEO meta description */
  keywords: string[];
  /** Descriere scurtă afișată pe homepage / index */
  scurt: string;
  /** Descriere completă SEO (~150-250 caractere) pentru meta */
  metaDescription: string;
  /** Autoritate principală responsabilă */
  autoritate: string;
  /** Autorități secundare (opțional) */
  autoritatiSecundare?: string[];
  /** Temei legal aplicabil */
  temeiLegal: string;
  /** Termen răspuns așteptat */
  termenRaspuns: string;
  /** 3-5 exemple concrete */
  exemple: string[];
  /** Pași concreți pentru această problemă */
  pasi: { titlu: string; text: string }[];
  /** FAQ specific tipului */
  faq: { q: string; a: string }[];
}

export const CUM_FAC_TIPURI: CumFacTip[] = [
  {
    slug: "groapa",
    titlu: "Groapă în asfalt / stradă",
    emoji: "🕳️",
    keywords: ["cum reclam groapa", "sesizare groapa primaria", "reparatie carosabil"],
    scurt: "Groapă, gropi, asfalt deteriorat, semnalizare lipsă.",
    metaDescription:
      "Cum trimiți o sesizare pentru o groapă în asfalt: cui te adresezi (primărie / CNAIR / DRDP), termen legal de răspuns 30 zile, model email, fotografii necesare. Gratuit, 90 secunde cu Civia.",
    autoritate: "Primăria locală (carosabil urban) sau CNAIR (DN / autostradă)",
    autoritatiSecundare: ["DRDP (drum județean)", "Compania Națională Drumuri"],
    temeiLegal: "OG 27/2002 + OG 43/1997 (regimul drumurilor)",
    termenRaspuns: "30 zile (OG 27/2002 art. 8)",
    exemple: [
      "Groapă de 30 cm diametru pe str. Republicii nr. 14",
      "Asfalt crăpat pe Bulevardul Magheru între nr. 5-10",
      "Drum național DN1 km 23 — denivelare pericol",
    ],
    pasi: [
      { titlu: "Fotografiază problema", text: "1-3 unghiuri. Include reper vizibil (semn rutier, nr. casă) pentru localizare clară." },
      { titlu: "Descrie locul", text: "Adresă completă. Pentru drum național — denumire DN + kilometraj aproximativ." },
      { titlu: "AI Civia detectează autoritatea", text: "Drum urban → primărie. DN → CNAIR. DJ → DRDP județ." },
      { titlu: "Trimite cu un click", text: "Email pleacă automat de la sesizari@civia.ro către autoritate." },
      { titlu: "Așteaptă 30 zile", text: "Răspuns oficial obligatoriu. Civia monitorizează termenul." },
    ],
    faq: [
      {
        q: "Cine plătește repararea?",
        a: "Autoritatea responsabilă cu administrarea drumului — primărie pentru străzi urbane, CNAIR pentru DN, DRDP pentru DJ. Bani din buget public.",
      },
      {
        q: "Cât durează până se repară?",
        a: "Răspunsul oficial: 30 zile. Reparația efectivă: depinde de severitate + program asfaltări. În medie 1-3 luni pentru gropi simple.",
      },
      {
        q: "Pot să cer despăgubiri dacă mașina mea s-a stricat?",
        a: "Da, dar trebuie să dovedești că autoritatea a fost notificată anterior și nu a acționat. Sesizarea ta pe Civia e dovadă timestampată.",
      },
    ],
  },
  {
    slug: "parcare-ilegala",
    titlu: "Parcare ilegală pe trotuar / pistă",
    emoji: "🚗",
    keywords: ["sesizare parcare ilegala", "masina pe trotuar", "raportare parcare politia locala"],
    scurt: "Mașini parcate pe trotuar, pistă bicicletă, locuri persoane handicap.",
    metaDescription:
      "Cum reclami o mașină parcată ilegal pe trotuar sau pistă de bicicletă. Poliția Locală e autoritatea responsabilă. Sesizare cu poză + plăcuță înmatriculare → amendă. Civia automatizează totul.",
    autoritate: "Poliția Locală",
    autoritatiSecundare: ["Primăria sector / municipiu"],
    temeiLegal: "OUG 195/2002 (Cod Rutier) art. 142 + Legea 155/2010",
    termenRaspuns: "30 zile (OG 27/2002), dar acțiunea poate fi imediată (ridicare)",
    exemple: [
      "Mașină parcată pe trotuar str. Eminescu (blochează pietoni)",
      "Auto pe pistă bicicletă bd. Magheru",
      "Mașină pe loc handicap fără cardin",
    ],
    pasi: [
      { titlu: "Fotografiază clar plăcuța de înmatriculare", text: "Esențial pentru identificare. AI Civia poate detecta automat plate-ul." },
      { titlu: "Fotografiază contextul", text: "Trotuar, marcaj, pistă. Doves blocarea pietonilor / bicicliștilor." },
      { titlu: "Notează adresa", text: "Stradă + reper apropiat. Folosește geo-locația telefonului dacă posibil." },
      { titlu: "Trimite la Poliția Locală", text: "AI Civia detectează automat secția competentă din locația ta." },
    ],
    faq: [
      {
        q: "Pot să fac eu o amendă?",
        a: "Nu — doar Poliția Locală constată contravenția. Tu sesizezi, ei constată + amendează.",
      },
      {
        q: "Mașina va fi ridicată?",
        a: "Poate, dacă blochează circulația sau e pe loc handicap. Decizie a Poliției Locale.",
      },
      {
        q: "Voi fi identificat?",
        a: "Numele tău nu apare la șofer. Civia păstrează identitatea ta confidențial față de cel reclamat. Doar autoritatea o vede.",
      },
    ],
  },
  {
    slug: "gunoi",
    titlu: "Gunoi neridicat / salubritate",
    emoji: "🗑️",
    keywords: ["gunoi neridicat", "sesizare salubritate", "containere supraincarcate"],
    scurt: "Tomberoane pline, gunoi pe stradă, depozite ilegale.",
    metaDescription:
      "Gunoiul nu se ridică de zile întregi? Sesizează către operatorul de salubritate + primărie. Civia detectează operatorul corect (Romprest, RetiM, etc.) din adresa ta. Răspuns 30 zile.",
    autoritate: "Operatorul de salubritate (Romprest, RetiM, etc.)",
    autoritatiSecundare: ["Primăria locală (autoritate contractantă)"],
    temeiLegal: "Legea 211/2011 (regim deșeuri) + contracte locale",
    termenRaspuns: "Operator: 24-72h (urgent). Primăria: 30 zile.",
    exemple: [
      "Containere pline de 5 zile în Cartier Drumul Taberei",
      "Saci de gunoi pe trotuar fără ridicare",
      "Deșeuri voluminoase abandonate pe spațiu verde",
    ],
    pasi: [
      { titlu: "Fotografiază containerele / gunoiul", text: "Mai multe poze din zile diferite dacă problema persistă." },
      { titlu: "Notează ziua/orele", text: "Operatorul e contractat pentru anumite zile/intervale. Compară cu graficul publicat." },
      { titlu: "Sesizează operatorul + primăria", text: "Civia trimite simultan la ambii: operator (acțiune rapidă) + primărie (control)." },
    ],
    faq: [
      {
        q: "Cine plătește serviciul de salubritate?",
        a: "Tu, prin taxă de salubritate (în factura de apă / impozit). Ai dreptul la serviciu conform contractului.",
      },
      {
        q: "Ce fac dacă operatorul nu răspunde nici după sesizare?",
        a: "Sesizare directă la ANRSC (Autoritatea Națională Reglementare Servicii Comunitare) — anrsc.ro.",
      },
    ],
  },
  {
    slug: "iluminat",
    titlu: "Iluminat stradal stricat",
    emoji: "💡",
    keywords: ["bec stricat strada", "iluminat public", "sesizare electrica"],
    scurt: "Stâlpi de iluminat ne-funcționali, becuri arse, cabluri rupte.",
    metaDescription:
      "Stâlp de iluminat stricat? Becul ars de săptămâni? Sesizează la Electrica (operator distribuție) + primărie. Civia găsește operatorul corect din zona ta. Gratuit, 90 secunde.",
    autoritate: "Operatorul distribuție electrică (Electrica, DEER, etc.)",
    autoritatiSecundare: ["Primăria (contractant iluminat public)"],
    temeiLegal: "Legea 123/2012 (energie electrică) + contracte locale",
    termenRaspuns: "Operator: 5-15 zile. Primăria: 30 zile.",
    exemple: [
      "3 stâlpi iluminat consecutivi stricați pe str. Mihai Viteazu",
      "Bec ars de 2 luni Aleea Privighetorii",
      "Cablu rupt pe stâlp 25 bd. Iuliu Maniu — pericol",
    ],
    pasi: [
      { titlu: "Fotografiază stâlpul pe timp de noapte", text: "Dovadă clară că nu se aprinde. Notează numărul stâlpului dacă vizibil." },
      { titlu: "Localizează exact", text: "Adresa + reper (intersecție, nr. clădire)." },
      { titlu: "Sesizare la operator", text: "Civia detectează: Electrica MN, MS, TN/TS, sau alt operator per zonă." },
    ],
    faq: [
      {
        q: "Pot fi în pericol dacă raportez un cablu rupt?",
        a: "NU atinge cablul. Sună 112 imediat dacă e cădere de cablu activ. Sesizarea Civia e pentru cazuri non-emergency (bec ars, etc.).",
      },
    ],
  },
  {
    slug: "stalpisori",
    titlu: "Stâlpișori / bariere distruse",
    emoji: "🚧",
    keywords: ["stalpisori stricati", "bariere parcare", "blocare trotuar"],
    scurt: "Stâlpișori metalici loviti, bariere de parcare distruse.",
    metaDescription:
      "Stâlpișorii de pe trotuar au fost loviți de o mașină? Bariere de parcare distruse? Sesizează primăria / Administrația Domeniului Public pentru reparare. Civia trimite emailul gratuit.",
    autoritate: "Primăria locală / ADP (Administrația Domeniului Public)",
    temeiLegal: "OG 27/2002 + HCL local (administrare spațiu public)",
    termenRaspuns: "30 zile (OG 27/2002 art. 8)",
    exemple: [
      "Stâlpișor metalic îndoit pe trotuar str. Carol I",
      "Bariere parcare lipsă blocaj nr. 15",
      "Lanț parcare rupt acces parc",
    ],
    pasi: [
      { titlu: "Fotografiază stâlpișorul / bariera", text: "Înainte și după (dacă ai poze vechi)." },
      { titlu: "Identifică operatorul ", text: "Stradă urbană → primărie / ADP. Stație tramvai → STB. Aeroport → administrator." },
      { titlu: "Trimite cu Civia", text: "AI generează textul formal cu temei legal." },
    ],
    faq: [],
  },
  {
    slug: "trotuar-stricat",
    titlu: "Trotuar deteriorat / lipsă",
    emoji: "🚶",
    keywords: ["trotuar stricat", "trotuar fara dale", "accesibilitate pieton"],
    scurt: "Dale rupte, gropi pe trotuar, lipsă rampă persoane handicap.",
    metaDescription:
      "Trotuarul e plin de dale rupte sau gropi? Lipsă rampă pentru cărucioare? Sesizează primăria — obligată să asigure infrastructură accesibilă. Civia formalizează emailul cu OG 27/2002.",
    autoritate: "Primăria locală",
    autoritatiSecundare: ["ADP local", "CNCD (dacă e problema accesibilitate)"],
    temeiLegal: "OG 27/2002 + Legea 448/2006 (protecția persoanelor cu dizabilități)",
    termenRaspuns: "30 zile",
    exemple: [
      "Trotuar fără dale între nr. 20-30 str. Toamnei",
      "Rampe lipsă persoane handicap la intersecția X cu Y",
      "Gropi adânci pe trotuar pericol cădere",
    ],
    pasi: [
      { titlu: "Fotografiază problema", text: "Pune un obiect pentru scale (chei, telefon)." },
      { titlu: "Menționează accesibilitate dacă e cazul", text: "Lipsă rampă = încălcare Legea 448/2006." },
      { titlu: "Sesizează primăria", text: "Cu trimitere la prevederea legală corespunzătoare." },
    ],
    faq: [],
  },
  {
    slug: "apa-canalizare",
    titlu: "Apă / canalizare / capac stricat",
    emoji: "💧",
    keywords: ["capac canal lipsa", "scurgere apa strada", "conducta sparta"],
    scurt: "Capace canal lipsă, conducte sparte, scurgeri pe stradă.",
    metaDescription:
      "Capac de canal lipsă sau spart? Scurgere de apă pe stradă? Sesizează operatorul de apă (Apa Nova, Compania de Apă, etc.) — Civia găsește operatorul corect. Răspuns 30 zile.",
    autoritate: "Operator apă-canal (Apa Nova București, Compania de Apă județ, etc.)",
    autoritatiSecundare: ["Primăria"],
    temeiLegal: "OG 27/2002 + L 241/2006 (serviciu apă-canal)",
    termenRaspuns: "Operator: 24-72h pentru capac lipsă (pericol). Primăria: 30 zile.",
    exemple: [
      "Capac canal lipsă intersecția Magheru-Calea Victoriei",
      "Conductă spartă scurge apă bd. Iuliu Maniu",
      "Miros canalizare permanent zona Pieței Romana",
    ],
    pasi: [
      { titlu: "Marchează zona pe timp de noapte", text: "Capac lipsă = pericol imediat. Anunță 112 dacă e accesibil mașinilor." },
      { titlu: "Fotografiază din 2-3 unghiuri", text: "Cu reper de scală." },
      { titlu: "Sesizează operatorul corect", text: "Civia detectează: Apa Nova București / Apa Cluj / Compania de Apă Brașov etc." },
    ],
    faq: [],
  },
  {
    slug: "trafic-semnalizare",
    titlu: "Semafor / semn rutier stricat",
    emoji: "🚦",
    keywords: ["semafor stricat", "semn rutier lipsa", "marcaj sters"],
    scurt: "Semafoare ne-funcționale, semne rutiere lipsă, marcaje șterse.",
    metaDescription:
      "Semafor stricat de zile întregi? Semn rutier lipsă? Marcaj șters periculos? Sesizează primăria + Poliția Rutieră. Civia trimite emailul cu temei OUG 195/2002.",
    autoritate: "Primăria (semnalizare urbană) sau CNAIR (DN)",
    autoritatiSecundare: ["Poliția Rutieră"],
    temeiLegal: "OUG 195/2002 (Cod Rutier) + OG 43/1997",
    termenRaspuns: "30 zile, dar acțiune urgentă pentru semafoare blocate.",
    exemple: [
      "Semafor stricat intersecția Decebal-Unirii (3 zile)",
      "Semn STOP lipsă acces școală",
      `Marcaj „Cedează" complet șters intersecție X-Y`,
    ],
    pasi: [
      { titlu: "Fotografiază din 2 unghiuri", text: "Semaforul + intersecția (context)." },
      { titlu: "Sună 112 dacă e pericol imediat", text: "Semafor blocat în intersecție mare = traffic accident risk." },
      { titlu: "Sesizare oficială Civia", text: "Pentru reparație + statistici." },
    ],
    faq: [],
  },
  {
    slug: "zgomot",
    titlu: "Zgomot / poluare fonică",
    emoji: "🔊",
    keywords: ["zgomot peste limita", "poluare fonica", "club zgomotos"],
    scurt: "Zgomot peste limita legală (club, șantier, vecini).",
    metaDescription:
      "Zgomot peste limita legală de la club, șantier, sau vecini? Sesizează Poliția Locală + Garda de Mediu. Limite legale: 50 dB zi / 40 dB noapte. Civia explică legea + trimite emailul.",
    autoritate: "Poliția Locală + Garda Națională de Mediu",
    autoritatiSecundare: ["DSP (Direcția Sanitar-Veterinară)"],
    temeiLegal: "Legea 121/2019 (poluare fonică) + STAS 10009-1988",
    termenRaspuns: "30 zile, dar acțiune posibil rapidă pentru club / activitate comercială",
    exemple: [
      "Club generează zgomot 90+ dB noapte zonă rezidențială",
      "Șantier înainte de ora 7 dim",
      "Vecin instalație industrială permanent",
    ],
    pasi: [
      { titlu: "Înregistrare audio / video", text: "Cu timestamp. Telefon poate măsura dB cu aplicații (NoiseTube, Decibel X)." },
      { titlu: "Notează orele exacte", text: "Limite legale diferă zi (50 dB) vs noapte (40 dB)." },
      { titlu: "Sesizare la Poliția Locală", text: "Pot măsura cu decibelmetru oficial." },
    ],
    faq: [],
  },
  {
    slug: "masini-abandonate",
    titlu: "Mașini abandonate",
    emoji: "🚙",
    keywords: ["masina abandonata", "auto rugina parcare", "ridicare masina"],
    scurt: "Mașini parcate de luni/ani fără mișcare.",
    metaDescription:
      "Mașină abandonată în parcare de luni de zile? Civia te ajută să sesizezi Poliția Locală pentru ridicare conform Legii 421/2002. Termen procedural: 60-90 zile.",
    autoritate: "Poliția Locală",
    autoritatiSecundare: ["Primăria"],
    temeiLegal: "Legea 421/2002 (regim vehicule abandonate)",
    termenRaspuns: "30 zile răspuns + 60-90 zile procedură ridicare",
    exemple: [
      "Mașină ruginită Aleea X de 8 luni",
      "Auto fără numere de înmatriculare nr. 12",
      "Vehicul abandonat parcare bloc",
    ],
    pasi: [
      { titlu: "Notează plăcuța (dacă există)", text: "Sau alte semne distinctive (model, culoare, geam spart)." },
      { titlu: "Fotografiază în zile diferite", text: "Dovadă că nu se mișcă." },
      { titlu: "Sesizează Poliția Locală", text: "Vor verifica statusul + porni procedura de ridicare." },
    ],
    faq: [],
  },
  {
    slug: "spatiu-verde",
    titlu: "Spațiu verde distrus / parc",
    emoji: "🌳",
    keywords: ["spatiu verde", "arbore taiat", "parc distrus"],
    scurt: "Arbori tăiați ilegal, vandalisme în parcuri, gazon distrus.",
    metaDescription:
      "Arbori tăiați ilegal? Parc distrus de mașini? Sesizează Garda Forestieră + primărie + ANPM. Civia formalizează emailul cu Legea 46/2008 (codul silvic).",
    autoritate: "Garda Forestieră + Primăria",
    autoritatiSecundare: ["ANPM (Agenția Națională pentru Protecția Mediului)"],
    temeiLegal: "Legea 46/2008 (codul silvic) + OUG 195/2005 (mediu)",
    termenRaspuns: "30 zile",
    exemple: [
      "Arbore matur tăiat fără aviz pe str. Tudor Vladimirescu",
      "Parc distrus de mașini parcate pe gazon",
      "Vandalism plantații parc",
    ],
    pasi: [
      { titlu: "Fotografiază arborii / spațiul", text: "Înainte și după dacă ai poze vechi (Google Street View ajută)." },
      { titlu: "Sesizează 3 autorități", text: "Primărie + Garda Forestieră + ANPM. Civia trimite la toate simultan." },
    ],
    faq: [],
  },
  {
    slug: "trecere-pietoni",
    titlu: "Trecere pietoni periculoasă",
    emoji: "🚸",
    keywords: ["trecere pietoni nesigura", "marcaj sters", "semafor lipsa scoala"],
    scurt: "Trecere de pietoni fără marcaj, semafor, sau cu vizibilitate proastă.",
    metaDescription:
      "Trecere de pietoni periculoasă lângă școală / spital? Marcaj șters? Lipsă semafor? Sesizează primăria + Poliția Rutieră. Termen legal 30 zile.",
    autoritate: "Primăria",
    autoritatiSecundare: ["Poliția Rutieră", "CNAIR (DN)"],
    temeiLegal: "OUG 195/2002 + HCL local",
    termenRaspuns: "30 zile",
    exemple: [
      "Trecere fără marcaj lângă Școala 12",
      "Lipsă reductor viteză zonă spital",
      "Vizibilitate proastă din cauza vegetației",
    ],
    pasi: [
      { titlu: "Identifică riscul concret", text: "Lângă școală? Spital? Bătrâni? Cresc prioritate sesizare." },
      { titlu: "Cere soluție concretă", text: "Marcaj refacut + reductor viteză + iluminat + semn." },
    ],
    faq: [],
  },
  {
    slug: "transport-public",
    titlu: "Transport public — autobuze / tramvaie",
    emoji: "🚌",
    keywords: ["statie tramvai stricata", "autobuz lipsa", "transport public reclamatii"],
    scurt: "Stații deteriorate, rute eliminate, autobuze cu probleme.",
    metaDescription:
      "Stație de autobuz vandalizată? Tramvai care nu vine? Sesizează operatorul (STB, RATB, RATC, etc.) + primărie. Civia găsește operatorul corect.",
    autoritate: "Operator transport public (STB, RATB, RATC, RATBV, etc.)",
    autoritatiSecundare: ["Primăria", "ARR (Autoritatea Rutieră Română)"],
    temeiLegal: "OG 27/2002 + Legea 51/2006 (servicii comunitare)",
    termenRaspuns: "30 zile",
    exemple: [
      "Stație tramvai 21 cu adăpost spart",
      "Autobuz 138 nu vine de 5 zile",
      "Tramvai 41 cu uși blocate",
    ],
    pasi: [
      { titlu: "Notează linia + ora", text: "Important pentru identificare." },
      { titlu: "Fotografiază problema", text: "Stație / vehicul." },
      { titlu: "Sesizează operatorul + primăria", text: "Civia trimite la ambii." },
    ],
    faq: [],
  },
  {
    slug: "scoala-spital",
    titlu: "Probleme la școală / spital",
    emoji: "🏥",
    keywords: ["reclamatie scoala", "spital probleme", "infrastructura publica deteriorata"],
    scurt: "Mucegai, ferestre rupte, mobilier deteriorat, neglijență.",
    metaDescription:
      "Probleme la școala copilului tău? La spitalul public? Sesizează direcțiunea + ISJ (școli) / DSP (spital) + primărie. Civia te ajută să formalizezi corect.",
    autoritate: "Direcțiunea instituției + Inspectoratul Școlar / DSP",
    autoritatiSecundare: ["Primăria (proprietar clădire)"],
    temeiLegal: "OG 27/2002 + Legea 1/2011 (învățământ) / L 95/2006 (sănătate)",
    termenRaspuns: "30 zile",
    exemple: [
      "Mucegai în sală de clasă școala generală 14",
      "Ferestre rupte iarnă pavilion 3 spital județean",
      "Mobilier rupt cabinet medical",
    ],
    pasi: [
      { titlu: "Întâi la direcțiunea instituției", text: "Pot rezolva intern fără birocrație." },
      { titlu: "Dacă nu, sesizează ISJ / DSP", text: "Au putere de control + sancțiune." },
      { titlu: "Paralel sesizează primăria", text: "Ca proprietar al clădirii, e responsabilă de reparații majore." },
    ],
    faq: [],
  },
  {
    slug: "drum-national",
    titlu: "Drum național / autostradă",
    emoji: "🛣️",
    keywords: ["sesizare cnair", "drum national stricat", "autostrada"],
    scurt: "Drum național (DN) sau autostradă cu probleme: gropi, semnalizare, balustrade.",
    metaDescription:
      "Probleme pe drum național sau autostradă: gropi, semn rutier lipsă, balustradă ruptă? CNAIR e autoritatea responsabilă. Civia detectează automat km + DN și trimite emailul.",
    autoritate: "CNAIR (Compania Națională de Administrare a Infrastructurii Rutiere)",
    autoritatiSecundare: ["DRDP regional"],
    temeiLegal: "OG 43/1997 + L 213/1998 (regim proprietate publică)",
    termenRaspuns: "30 zile",
    exemple: [
      "Groapă pericol pe DN1 km 65 Brașov-Predeal",
      "Balustradă ruptă viaduct A1",
      "Semnalizare lipsă bretea autostradă",
    ],
    pasi: [
      { titlu: "Identifică DN-ul + kilometrajul aproximativ", text: "Vezi indicatoare laterale (km cu cifre mari pe stâlpi)." },
      { titlu: "Fotografiază problema", text: "În siguranță — NU oprești în autostradă fără urgență." },
      { titlu: "Sesizează CNAIR", text: "Civia trimite la adresa oficială + DRDP regional ca backup." },
    ],
    faq: [],
  },
];
