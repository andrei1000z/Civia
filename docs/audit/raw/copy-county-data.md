# Audit COPY — county-data (hărți, întreruperi, compara, buget, impact, clasament, promisometru, bugetare participativă, propuneri legislative, statistici, calendar, evenimente)

Status: ÎN LUCRU. Audit de copy (gramatică / diacritice / typos / ton / CTA / anglicisme / vag) pe suprafețele de date județene + naționale.

Format constatare: [P0/P1/P2/P3] · fișier:linie (sau URL) · PROBLEMĂ (citat exact) · FIX (text exact de înlocuire).

## src/app/[judet]/**

- [P0] · src/app/[judet]/error.tsx:20 · `„${slug}"` — ghilimea de deschidere curly „ urmată de ghilimea ASCII drept " (interpolare). Încalcă regula AGENTS.md „nu folosi ghilimea ASCII după „". Rezultat afișat: „cluj" cu ghilimea greșită de închidere. · FIX: `Pagina pentru „${slug}” e momentan indisponibilă...` (ghilimea de închidere ” U+201D).
- [P2] · src/app/[judet]/page.tsx:287 · CTA card empty-state `Fii primul care raportează →` cu săgeată bară — convenția CTA interzice „Detalii →" pattern; aici e link descriptiv dar tot folosește săgeata bară. · FIX: acceptabil ca encouragement copy, dar pentru consecvență păstrează textul fără săgeata în plus sau folosește componentă cu icon. Recomand: `Fii primul care raportează` (fără „ →").
- [P3] · src/app/[judet]/page.tsx:379 · empty-state `Vezi sursele naționale →` cu săgeată bară. · FIX: `Vezi sursele naționale` (fără „ →") sau cu icon ArrowRight aria-hidden.
- [P2] · src/app/[judet]/page.tsx:733-735 · hero subtitlu folosește „pe scurt" corect, dar enumerarea „sesizări la primărie, calitate aer live, întreruperi programate și știri locale" — „aer live" e anglicism amestecat (live). · FIX: `calitate aer în timp real` în loc de „calitate aer live".
- [P2] · src/app/[judet]/page.tsx:206 · tile „Autorități" hint `primărie, prefectură, ipj` — „ipj" lowercase, acronim neclar pentru cetățean (Inspectoratul de Poliție Județean). · FIX: `primărie, prefectură, poliție`.
- [P2] · src/app/[judet]/page.tsx:875 · `role="Subordine primărie · 24/7"` — „Subordine primărie" e telegrafic/agramat (lipsește prepoziția). · FIX: `În subordinea primăriei · 24/7`.
- [P3] · src/app/[judet]/page.tsx:750 · CTA hero secundar `Vezi întreruperi` folosește icon `AlertCircle` (linia 749) deși e despre întreruperi; minor inconsistență vizuală (nu copy). · FIX: folosește `AlertTriangle` ca în restul paginii.
- [P3] · src/app/[judet]/page.tsx:480 · `Nicio întrerupere activă în {countyName}. 🎉` — emoji 🎉 în text de stare; AGENTS.md cere evitarea emoji în comunicare. · FIX: elimină emoji-ul: `Nicio întrerupere activă în {countyName}.`

### istoric/page.tsx — LIPSĂ MASIVĂ DIACRITICE (P1, batch)
- [P1] · src/app/[judet]/istoric/page.tsx:38 · `title: \`Istoric administratie — ${county.name}\`` — „administratie" fără diacritice (ț). · FIX: `Istoric administrație — ${county.name}`.
- [P1] · src/app/[judet]/istoric/page.tsx:41 · `Toti primarii Bucurestiului din 1989 pana azi: realizari, controverse, proiecte.` — fără diacritice (Toți, Bucureștiului, până, realizări). NB: și „1989" contrazice descrierea din pagină care zice 1990. · FIX: `Toți primarii Bucureștiului din 1990 până azi: realizări, controverse, proiecte.`
- [P1] · src/app/[judet]/istoric/page.tsx:42 · `Informatii despre administratia locala din ${county.name} — primar, consiliu judetean, prefectura.` — fără diacritice. · FIX: `Informații despre administrația locală din ${county.name} — primar, consiliu județean, prefectură.`
- [P1] · src/app/[judet]/istoric/page.tsx:78 · `Compozitia politica a Consiliului General` — fără diacritice. · FIX: `Compoziția politică a Consiliului General`.
- [P1] · src/app/[judet]/istoric/page.tsx:93 · `Consilii Generale — compozitie pe mandate` — „compozitie" fără ț. · FIX: `Consilii Generale — compoziție pe mandate`.
- [P1] · src/app/[judet]/istoric/page.tsx:163 · `Primar in functie` — fără diacritice (în funcție). · FIX: `Primar în funcție`.
- [P1] · src/app/[judet]/istoric/page.tsx:177 · `Populatie` (label) — fără ț. · FIX: `Populație`.
- [P1] · src/app/[judet]/istoric/page.tsx:183 · `Suprafata` (label) — fără ț. · FIX: `Suprafață`.
- [P1] · src/app/[judet]/istoric/page.tsx:186 · `suprafata totala` — fără diacritice. · FIX: `suprafață totală`.
- [P1] · src/app/[judet]/istoric/page.tsx:205 · `Despre administratia locala` — fără diacritice. · FIX: `Despre administrația locală`.
- [P1] · src/app/[judet]/istoric/page.tsx:210 · `Consiliul Judetean` (h3) — fără ț. · FIX: `Consiliul Județean`.
- [P1] · src/app/[judet]/istoric/page.tsx:213-214 · `Consiliul Judetean este autoritatea deliberativa a administratiei publice locale, constituita la nivel judetean. Este ales prin vot direct pentru un mandat de 4 ani.` — fără diacritice peste tot. · FIX: `Consiliul Județean este autoritatea deliberativă a administrației publice locale, constituită la nivel județean. Este ales prin vot direct pentru un mandat de 4 ani.`
- [P1] · src/app/[judet]/istoric/page.tsx:217-218 · `Coordoneaza activitatea consiliilor locale, aproba bugetul judetean si strategia de dezvoltare a judetului.` — fără diacritice + „si". · FIX: `Coordonează activitatea consiliilor locale, aprobă bugetul județean și strategia de dezvoltare a județului.`
- [P1] · src/app/[judet]/istoric/page.tsx:225-226 · `Prefectul este reprezentantul Guvernului la nivel judetean. Verifica legalitatea actelor administrative emise de autoritatile locale.` — fără diacritice. · FIX: `Prefectul este reprezentantul Guvernului la nivel județean. Verifică legalitatea actelor administrative emise de autoritățile locale.`
- [P1] · src/app/[judet]/istoric/page.tsx:229-230 · `Prefectura coordoneaza serviciile publice deconcentrate ale ministerelor si ale celorlalte organe ale administratiei centrale.` — fără diacritice + „si". · FIX: `Prefectura coordonează serviciile publice deconcentrate ale ministerelor și ale celorlalte organe ale administrației centrale.`
- [P1] · src/app/[judet]/istoric/page.tsx:246 · `Contacte autoritati locale` — fără diacritice. · FIX: `Contacte autorități locale`.
- [P1] · src/app/[judet]/istoric/page.tsx:248 · `Emailuri, telefoane si adrese ale institutiilor publice din {countyName}.` — „si" + „institutiilor". · FIX: `Emailuri, telefoane și adrese ale instituțiilor publice din {countyName}.`
- [P1] · src/app/[judet]/istoric/page.tsx:259 · `In curand` — fără diacritice. · FIX: `În curând`.
- [P1] · src/app/[judet]/istoric/page.tsx:261-263 · `Istoricul complet al administratiei pentru {countyName} — primari, consilieri si decizii importante — va fi disponibil in curand.` — fără diacritice + „si". · FIX: `Istoricul complet al administrației pentru {countyName} — primari, consilieri și decizii importante — va fi disponibil în curând.`

### evenimente/page.tsx + sesizari/page.tsx
- [P2] · src/app/[judet]/evenimente/page.tsx:133 · card footer `Detalii <ArrowRight />` — exact pattern-ul interzis „Detalii →" (card link). · FIX: `Vezi detalii <ArrowRight />`.
- [P2] · src/app/[judet]/sesizari/page.tsx:88 · quick-link hint `Galerie before & after` — anglicism „before & after". · FIX: `Galerie înainte și după`.
- [P3] · src/app/[judet]/sesizari/page.tsx:118 · tagline `... răspundă în max 30 de zile calendaristice.` — „max" abreviere informală. · FIX: `... răspundă în maximum 30 de zile calendaristice.`
- [P3] · src/app/[judet]/sesizari/page.tsx:60 · stiri hero `citești esența în 30s` — „30s" abreviere; OK ca microcopy, dar pentru consecvență RO. · FIX: `citești esența în 30 de secunde` (sau lasă 30s ca microcopy intenționat).

## src/components/maps/**

## src/app/intreruperi/**

### „Caldură" → „Căldură" (P1, sursă de adevăr + propagat peste tot)
- [P1] · src/data/intreruperi.ts:645 · `caldura: "Caldură"` — label TYPE_LABELS afișat în TOATE listările/filtrele/hero-uri de întreruperi (stat cards, taburi filtru, popup hartă, RSS, ICS). „Caldură" e ortografie greșită — corect „Căldură" (ă inițial). · FIX: `caldura: "Căldură",`. NB: corectarea aici rezolvă automat majoritatea afișărilor downstream.
- [P1] · src/app/intreruperi/page.tsx:24 · `title: "Întreruperi programate — apă, caldură, gaz, curent, lucrări stradă"` — „caldură" + „lucrări stradă" (lipsește prepoziția „la"). · FIX: `Întreruperi programate — apă, căldură, gaz, curent, lucrări la stradă`.
- [P1] · src/app/intreruperi/page.tsx:26 · `... când se taie apa, caldura, gazul sau curentul ...` — „caldura" fără diacritice. · FIX: `... când se taie apa, căldura, gazul sau curentul ...`.
- [P1] · src/app/intreruperi/page.tsx:48 · twitter description `Apă, caldură, gaz, curent + lucrări de stradă. Subscribe RSS sau iCal.` — „caldură" + anglicism „Subscribe". · FIX: `Apă, căldură, gaz, curent + lucrări de stradă. Abonează-te prin RSS sau iCal.`
- [P1] · src/app/intreruperi/page.tsx:100 · JSON-LD description `... de apă, caldură, gaz, curent ...` — „caldură". · FIX: `... de apă, căldură, gaz, curent ...`.
- [P2] · src/app/intreruperi/page.tsx:52 · keywords `"întreruperi caldură"` (și 104) — „caldură" în keywords (SEO). · FIX: `"întreruperi căldură"`.
- [P0] · src/app/intreruperi/page.tsx:386 · `formularul „Știi o întrerupere?"` — curly „ urmată de ASCII " la închidere. Încalcă regula AGENTS.md. · FIX: `formularul „Știi o întrerupere?”` (închidere cu ” U+201D).
- [P1] · src/app/intreruperi/page.tsx:135 · tagline `${scrapedCount} entry scrapuite în ultimele 7 zile` — „entry" anglicism + „scrapuite" Romglish grosolan (din „scrape"). Vizibil în hero. · FIX: `${scrapedCount} anunțuri colectate în ultimele 7 zile`.
- [P1] · src/app/intreruperi/page.tsx:249 · buton `Subscribe RSS` — anglicism. · FIX: `Abonează-te RSS` (sau `Urmărește RSS`).
- [P2] · src/app/intreruperi/page.tsx:308 · `Scraper-ul Civia rulează automat la 12 ore.` — „Scraper-ul" anglicism. · FIX: `Robotul Civia colectează automat la 12 ore.` (sau `Sistemul Civia colectează ...`).
- [P2] · src/app/intreruperi/page.tsx:370 · SourceGroup `title="Lucrări strazi (1)"` — „strazi" fără diacritice (străzi). · FIX: `title="Lucrări la stradă (1)"` (consecvent cu TYPE_LABELS).
- [P2] · src/app/intreruperi/page.tsx:378 · SourceGroup `title="Fallback floor (presa locală)"` — „Fallback floor" termen tehnic englez afișat utilizatorului. · FIX: `Sursă de rezervă (presa locală)`.
- [P3] · src/app/intreruperi/page.tsx:135 · „entry" e și gramatical singular pentru plural (scrapedCount poate fi >1). Vezi fix-ul de mai sus (anunțuri).
- [P2] · src/app/intreruperi/page.tsx:127-129 · descriere zice „30 de surse oficiale ... la fiecare 12 ore" dar `_county-content.tsx` zice „30 de minute" — INCONSECVENȚĂ factuală a frecvenței de actualizare. · FIX: aliniază ambele la aceeași valoare (cron real = 1x/zi conform comentariu linia 62; alege „o dată pe zi" peste tot).

### intreruperi/_county-content.tsx
- [P1] · src/app/intreruperi/_county-content.tsx:58 · `Apă, caldură, gaz, curent + lucrări de stradă în <strong>{county.name}</strong>.` — „caldură". · FIX: `Apă, căldură, gaz, curent + lucrări de stradă în ...`.
- [P0] · src/app/intreruperi/_county-content.tsx:129 · `formularul „Știi o întrerupere?"` — curly „ + ASCII ". · FIX: `formularul „Știi o întrerupere?”`.
- [P2] · src/app/intreruperi/_county-content.tsx:65-66 · tagline `catalogul se reîmprospătează la fiecare 30 de minute` — contrazice pagina națională (12 ore) și comentariul real (cron 1x/zi). · FIX: aliniază la valoarea reală, ex. `catalogul se actualizează zilnic`.
- [P2] · src/app/intreruperi/_county-content.tsx:109 · `Catalogul se actualizează la 30 min.` — aceeași inconsecvență + abreviere „min". · FIX: `Catalogul se actualizează zilnic.`

### intreruperi/IntreruperiFilters.tsx
- [P1] · src/app/intreruperi/IntreruperiFilters.tsx:62 · tab `{ value: "caldura", label: "Caldură" }` — „Caldură" hardcodat (NU folosește TYPE_LABELS), deci nu se rezolvă cu fix-ul din data. · FIX: `label: "Căldură"`.
- [P2] · src/app/intreruperi/IntreruperiFilters.tsx:634 · link `{item.sourceEntryUrl ? "PDF oficial" : "Vezi la provider"}` — „provider" anglicism. · FIX: `Vezi la operator` (sau `Vezi la furnizor`).
- [P3] · src/app/intreruperi/IntreruperiFilters.tsx:372 · empty-state buton `Resetează filtrele →` cu săgeată bară — OK ca acțiune, dar săgeata bară e descurajată. · FIX: lasă fără săgeată sau folosește icon.

### intreruperi/SubmitForm.tsx
- [P2] · src/app/intreruperi/SubmitForm.tsx:109 · `Submisia ta a ajuns la moderare.` — „Submisia" anglicism (din submission); neromânesc. · FIX: `Raportul tău a ajuns la moderare.`
- [P3] · src/app/intreruperi/SubmitForm.tsx:117 · `Raportează încă o întrerupere →` cu săgeată bară. · FIX: `Raportează încă o întrerupere` (fără săgeată).
- [P3] · src/app/intreruperi/SubmitForm.tsx:29 · `Imaginea e prea mare (max 5MB)` — „max" abreviere. · FIX: `Imaginea e prea mare (maximum 5 MB)` (+ spațiu înainte de unitate).
- [P3] · src/app/intreruperi/SubmitForm.tsx:63 · `Scrie minim 20 de caractere despre întrerupere.` — „minim" e adverb corect, dar consecvent cu restul ai „minimum". OK, lasă; minor.
- [P3] · src/app/intreruperi/SubmitForm.tsx:253 · buton `Trimite raport` — corect, dar pentru consecvență cu convenția poate `Trimite raportul`. · FIX (opțional): `Trimite raportul`.

### maps/
- [P3] · src/components/maps/SesizariMarkersLayer.tsx:49 · popup link `Vezi detalii →` cu săgeată bară — convenția cere „Vezi detalii" descriptiv; săgeata bară e tolerată dar descurajată. · FIX (opțional): elimină săgeata sau folosește icon ArrowRight aria-hidden.

### intreruperi/[id]/page.tsx
- [P1] · src/app/intreruperi/[id]/page.tsx:48 · meta description `Întreruperi de apă, caldură, gaz, curent ...` — „caldură". · FIX: `... de apă, căldură, gaz, curent ...`.
- [P1] · src/app/intreruperi/[id]/page.tsx:484-485 · `Vezi toate din {item.county === "B" ? "București" : item.county}` — pentru județe non-B afișează CODUL județului (ex. „Vezi toate din CJ", „din TM") în loc de numele. BUG vizibil. · FIX: rezolvă numele prin `getCountyBySlug`/lookup pe cod (ex. `ALL_COUNTIES.find(c=>c.id===item.county)?.name ?? item.county`).
- [P1] · src/app/intreruperi/[id]/page.tsx:497 · `Alte întreruperi în {item.county === "B" ? "București" : item.county}` — același bug: cod județ în loc de nume. · FIX: idem (afișează numele județului).
- [P2] · src/app/intreruperi/[id]/page.tsx:427 · label sidebar `<Building2 /> Provider` — anglicism. · FIX: `Operator` (sau `Furnizor`).
- [P2] · src/app/intreruperi/[id]/page.tsx:453 · `Toate anunțurile providerului` — „providerului" anglicism. · FIX: `Toate anunțurile operatorului`.
- [P2] · src/app/intreruperi/[id]/page.tsx:58 · meta `Provider: ${item.provider}.` — „Provider:" anglicism (afișat în SERP/preview). · FIX: `Operator: ${item.provider}.`
- [P3] · src/app/intreruperi/[id]/page.tsx:487 · `Alte întreruperi programate în această zonă →` cu săgeată bară. · FIX: elimină săgeata.

### intreruperi/[id]/not-found.tsx
- [P2] · src/app/intreruperi/[id]/not-found.tsx:12 · `Entry-ul nu mai există în catalog ...` — „Entry-ul" anglicism. · FIX: `Anunțul nu mai există în catalog — poate s-a finalizat sau a fost șters de operator. Vezi lista curentă actualizată.`

## src/app/compara/**

- [P2] · src/app/compara/page.tsx:8 · `title: "Compară județele — side-by-side"` — „side-by-side" anglicism în titlul paginii (apare în SERP + tab browser). · FIX: `Compară județele — alăturat` (sau doar `Compară județele`).
- [P3] · src/app/compara/[a]/[b]/page.tsx:243 · `label="Rating (0-5)"` — „Rating" anglicism. · FIX: `Notă (0-5)`.
- [P3] · src/app/compara/[a]/[b]/page.tsx:215-216 · `label="Operator transport"` — OK, dar valoarea poate fi lungă; nu e problemă de copy. (fără acțiune)
- [P3] · src/app/compara/[a]/[b]/page.tsx:121 · disclaimer `(vezi disclaimer pe paginile individuale)` — „disclaimer" anglicism în text RO. · FIX: `(vezi precizările de pe paginile individuale)`.

## src/app/buget/**

- [P1] · src/app/buget/simulator/page.tsx:23 · `tagline="Commit, apoi reveal — fără să tragi cu ochiul"` — „Commit, apoi reveal" anglicism total în tagline user-facing. · FIX: `Întâi alegi, apoi vezi — fără să tragi cu ochiul`.
- [P0] · src/app/buget/simulator/page.tsx:32 · `procentele „reale"` — curly „ + ASCII " la închidere. · FIX: `procentele „reale”` (închidere ” U+201D).
- [P0] · src/app/buget/simulator/page.tsx:35-36 · link text `„unde se duc taxele tale"` — curly „ + ASCII ". · FIX: `„unde se duc taxele tale”`.
- [P2] · src/app/buget/personal/BugetCalculatorClient.tsx:113 · `⚠️ <strong>Disclaimer</strong>: Aceste cifre ...` — „Disclaimer" anglicism. · FIX: `<strong>Precizare</strong>: Aceste cifre ...`.
- [P3] · src/app/buget/personal/page.tsx:7 (comentariu, nu UI) — „Pe banii MEI" / titlu cu MAJUSCULE „TĂI"/„MEI" (page.tsx:15,25) — stilistic strident (caps lock pe cuvânt). Nu e greșeală, dar tonul „TĂI" în caps poate fi atenuat. · FIX (opțional): `Pe banii tăi — ce face primăria?`.

## src/app/impact/**

- [P1] · src/app/impact/page.tsx:160 · hero `Toate datele publice. Actualizat la fiecare 2 minute.` — FALS: `revalidate = 1800` (30 min) + comentariul linia 25-28 spune explicit „2 min era overkill". Meta description (linia 14) zice „zilnic". 3 valori contradictorii. · FIX: `Toate datele publice. Actualizat la fiecare 30 de minute.` (aliniază cu revalidate real).
- [P2] · src/app/impact/page.tsx:202 · `<h2>Pâlnia conversie</h2>` — agramat (lipsește „de"/„conversiei"). · FIX: `Pâlnia de conversie`.
- [P2] · src/app/impact/page.tsx:188 · KpiCard sublabel `${rezolvareRate}% rate de rezolvare` — „rate" anglicism (corect „rată"). · FIX: ` ${rezolvareRate}% rată de rezolvare`.
- [P3] · src/app/impact/page.tsx:14 · meta description `Transparență brutală: ...` — „brutală" ton agresiv pentru o descriere SEO; subiectiv. · FIX (opțional): `Transparență totală: câte sesizări s-au trimis ...`.
- [P3] · src/app/impact/page.tsx:282-284 · footer „JSON API" / „Open311" / „Toate cifrele sunt din DB Supabase la cerere." — „DB Supabase" jargon tehnic expus utilizatorului. · FIX: `Toate cifrele provin direct din baza de date, la cerere.`

## src/app/clasament/**

## src/app/promisometru/**

- [P0] · src/app/promisometru/page.tsx:169 · `„termenul anunțat a trecut, nu există anunț de finalizare"` — curly „ + ASCII " la închidere. · FIX: `„termenul anunțat a trecut, nu există anunț de finalizare”`.
- [P3] · src/app/promisometru/page.tsx:151 · `Vezi profilul →` cu săgeată bară. · FIX: elimină săgeata sau folosește icon.
- [P3] · src/app/promisometru/page.tsx:33 · `... Ce s-a promis vs. ce s-a livrat ...` — „vs." e abreviere latină OK în context comparativ; lasă. (fără acțiune)

## src/app/propuneri-legislative/**

- [P1] · src/app/propuneri-legislative/page.tsx:196 · `Autoritățile au obligația legală să răspundă în 30 de zile lucrătoare.` — INCONSECVENȚĂ: paginile de sesizări (tot OG 27/2002) spun „30 de zile calendaristice". OG 27/2002 prevede termen calendaristic. · FIX: `... să răspundă în 30 de zile calendaristice.` (aliniază cu restul site-ului).
- [P2] · src/app/propuneri-legislative/page.tsx:74 · pas „AI formalizează" desc `Groq AI scrie textul juridic structurat cu temei legal` — expune vendorul „Groq" + „Groq AI" jargon. · FIX: `Civia scrie textul juridic structurat cu temei legal` (sau `AI-ul Civia scrie ...`).
- [P2] · src/app/propuneri-legislative/PropuneFormClient.tsx:256 · `AI-ul Groq va citi textul tău și va genera automat un document formal ...` — „AI-ul Groq" expune vendorul + formulare stângace. · FIX: `Civia citește textul tău și generează automat un document formal cu temei legal, impact estimat și precedente din UE. Durează ~5 secunde.`
- [P2] · src/app/propuneri-legislative/PropuneFormClient.tsx:293 · `Propunerea ta este acum live.` — „live" anglicism. · FIX: `Propunerea ta este acum publică.`
- [P2] · src/app/propuneri-legislative/PropuneFormClient.tsx:301 · `Text formalizat de AI` — OK, dar consecvent cu restul „de Civia"? Acceptabil. (fără acțiune obligatorie)
- [P3] · src/app/propuneri-legislative/PropuneFormClient.tsx:113 · `Pasul 3/3 — Publicat! Distribuie pentru susțineri` — „pentru susțineri" stângaci. · FIX: `Publicat! Distribuie ca să strângi susținători`.
- [P3] · src/app/propuneri-legislative/PropuneFormClient.tsx:143,158,173 · `(min 10)` / `/5000` / `(min 50 caractere)` — „min" abreviat. · FIX: `(minimum 10)`, etc. (consecvență).

### propuneri-legislative/[id]/page.tsx
- [P1] · src/app/propuneri-legislative/[id]/page.tsx:142 · `Autoritatea are 30 de zile lucrătoare să răspundă.` — inconsecvent cu „calendaristice" din sesizări (OG 27/2002). · FIX: `Autoritatea are 30 de zile calendaristice să răspundă.`
- [P2] · src/app/propuneri-legislative/[id]/page.tsx:150 · `cetățeni susțin · target {VOTE_THRESHOLD_SEND}` — „target" anglicism. · FIX: `cetățeni susțin · prag {VOTE_THRESHOLD_SEND}` (sau `țintă`).
- [P2] · src/app/propuneri-legislative/[id]/page.tsx:195 · `Document formal generat de AI (Groq Llama) — Legea 52/2003` — „Groq Llama" expune vendorul + modelul; jargon pentru cetățean. · FIX: `Document formal generat de Civia — Legea 52/2003`.

## src/app/bugetare-participativa/** + src/components/bugetare/**

- [P2] · src/app/bugetare-participativa/page.tsx:134 · `Spoiler: diferența ta cea mai mare e exact locul unde merită să acționezi.` — „Spoiler" anglicism. · FIX: `Indiciu: diferența ta cea mai mare e exact locul unde merită să acționezi.`
- [P3] · src/app/bugetare-participativa/page.tsx:140 · CTA `Joacă simulatorul →` cu săgeată bară. · FIX: `Joacă simulatorul` (fără săgeată) sau cu icon.
- [P2] · src/components/bugetare/CerereBPGenerator.tsx:86 · buton `Copiat în clipboard` — „clipboard" anglicism. · FIX: `Copiat` (sau `Text copiat`).
- [P3] · src/components/bugetare/PrioritatiOras.tsx:30 · ORASE `{ county: "TM", label: "Timiș" }` — celelalte etichete sunt orașe (Cluj, Iași, Constanța, Brașov) dar TM e numele județului „Timiș", nu orașul „Timișoara". Inconsecvență label. · FIX: `label: "Timișoara"` (consecvent cu „orașul tău").

## src/app/propuneri-legislative/**

## src/app/statistici-sesizari-romania/**

- [P0] · src/app/statistici-sesizari-romania/page.tsx:91 · FAQ answer `„Sursa: Civia.ro, licență CC BY 4.0".` — curly „ + ASCII " la închidere. · FIX: `„Sursa: Civia.ro, licență CC BY 4.0”.`
- [P0] · src/app/statistici-sesizari-romania/page.tsx:106 · `secțiunea „Top județe" + pagini per județ` — curly „ + ASCII ". · FIX: `secțiunea „Top județe” + pagini per județ`.
- [P0] · src/app/statistici-sesizari-romania/page.tsx:315 · `<em>„Sursa: Civia.ro, CC BY 4.0".</em>` — curly „ + ASCII ". · FIX: `<em>„Sursa: Civia.ro, CC BY 4.0”.</em>`
- [P1] · src/app/statistici-sesizari-romania/page.tsx:283 · în „Top 10 județe active" se afișează `{county}` = CODUL județului (B, CJ, TM...) ca link, nu numele. · FIX: rezolvă numele prin `getCountyById(county)?.name ?? county` (cod doar ca fallback).
- [P2] · src/app/statistici-sesizari-romania/page.tsx:152 · tagline `Open Data CC BY 4.0 · ...` — „Open Data" anglicism (deși e termen recunoscut). · FIX: `Date deschise CC BY 4.0 · Actualizat la 6 ore · API public /api/v1/stats`.
- [P3] · src/app/statistici-sesizari-romania/page.tsx:217 · `Datele se încarcă… reîncearcă în câteva momente.` — OK.

## src/app/calendar/**

- [P1] · src/app/calendar/page.tsx:109 · `tagline="Awareness → participare."` — „Awareness" anglicism total în tagline user-facing. · FIX: `tagline="De la informare la participare."`.
- [P1] · src/app/calendar/page.tsx:184-186 · footer `Today: {today}` — „Today:" engleză + dată ISO brută (ex. „Today: 2026-06-13"). Pare debug rămas în producție. · FIX: elimină linia, sau `Azi: {dată formatată ro-RO}` cu `toLocaleDateString("ro-RO", ...)`.
- [P2] · src/app/calendar/page.tsx:171 · card link `Detalii <ExternalLink />` — pattern interzis „Detalii →". · FIX: `Vezi detalii <ExternalLink />`.
- [P3] · src/app/calendar/page.tsx:10 · comentariu cod (nu UI) cu diacritice lipsă („consultatii", „sedinte") — nu e afișat, doar igienă. (fără acțiune obligatorie)

## src/app/evenimente/**

- [P2] · src/app/evenimente/page.tsx:18-31 · Hero hand-rolled: `<section className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-stone-900 to-zinc-950 ...">` — încalcă regula AGENTS.md „Don't add new full-bleed `<section>` heroes" + „Don't write hand-rolled gradient classes per page". · FIX: folosește `<PageHero>` cu un preset din `HERO_GRADIENT` (sau `COUNTY_HERO_GRADIENT.events`).
- [P3] · src/app/evenimente/page.tsx:8 vs 28 · meta description spune `din 1989 până azi` dar hero spune `din {an calculat din date}` (fallback „1940"); posibil mismatch al anului afișat. · FIX: aliniază (folosește același calcul în ambele, sau text fix coerent).
- [P0] · src/components/evenimente/EvenimenteFilter.tsx:160 · `Niciun eveniment în categoria „{...}".` — curly „ + ASCII " la închidere. · FIX: `Niciun eveniment în categoria „{...}”.`
- [P2] · src/components/evenimente/EvenimenteFilter.tsx:148 · card footer `Detalii <ArrowRight />` — pattern interzis „Detalii →". · FIX: `Vezi detalii <ArrowRight />`.
- [P3] · src/app/evenimente/[slug]/page.tsx:110 · JSON-LD `location={\`Județul ${eveniment.county}, România\`}` — pentru județe non-B `county` e CODUL (ex. „Județul GL"). Doar structured data (nu UI vizibil), dar afectează SEO. · FIX: rezolvă numele județului din cod.

### Componente intreruperi adiacente (în scop)
- [P0] · src/components/intreruperi/AlertsSubscribeForm.tsx:63 · `apasă „Confirmă abonarea".` — curly „ + ASCII " la închidere. · FIX: `apasă „Confirmă abonarea”.`
- [P2] · src/components/intreruperi/AlertsSubscribeForm.tsx:63-64 · `Verifică inbox-ul tău ... verifică folderul Spam.` — „inbox-ul" + „folderul Spam" anglicisme. · FIX: `Verifică-ți căsuța de email și apasă „Confirmă abonarea”. Dacă nu vezi emailul în 5 minute, caută în folderul de spam.`

## src/data/** (doar câmpuri afișate)

- [P3] · src/data/intreruperi.ts:643-650 · `TYPE_LABELS` — vezi P1 de mai sus: `caldura: "Caldură"` → `"Căldură"`. Singurul label din acest map cu problemă de diacritice; restul (Apă, Gaz, Electricitate, Lucrări la stradă, Altele) sunt corecte.
- [P3] · src/data/statistici-judete.ts:99-104 · `aqiLabel` returnează „Bun/Moderat/Nesănătos (grupe sensibile)/Nesănătos" — corect cu diacritice. (fără acțiune)
- [INFO] · src/data/statistici-judete.ts:107-118 · `buildSesizariTipuri` + `accidenteTotal/sesizariTotal` sunt ESTIMĂRI proporționale, afișate în /[judet] și /compara ca cifre. /compara are disclaimer (linia 121) dar paginile /[judet] și /[judet]/istoric le afișează fără mențiunea „estimare". Recomand notă „estimare" și pe paginile de județ pentru onestitate (consecvent cu tonul „Transparență" al platformei). NB: nu e strict copy, dar e o problemă de exactitate a textului afișat.
- [INFO] · Labels din `buildSesizariTipuri` („Gropi asfalt", „Parcări ilegale", „Stâlpișori"...) vs `TIP_LABELS` din statistici-sesizari-romania („Gropi & drumuri", „Parcare ilegală", „Stâlpișori & blocuri") vs `COUNTY_TIP_LABEL` din [judet]/page.tsx („Groapă", „Parcare", „Stâlpișori") — TREI seturi de etichete diferite pentru aceleași tipuri de sesizări. Inconsecvență terminologică cross-pagină. · FIX: consolidează într-o singură sursă de adevăr a etichetelor de tip sesizare.

## Rezumat severități

- P0 (ghilimea ASCII după „ + alte blocante): ~13 (error.tsx [judet], intreruperi/page x1, _county-content x1, buget/simulator x2, promisometru x1, statistici x3, EvenimenteFilter x1, AlertsSubscribeForm x1, + variantele din intreruperi)
- P1 (diacritice lipsă în UI, fals factual, cod-județ-în-loc-de-nume): ~30 (batch istoric/page.tsx ~18, „Caldură" propagat, impact „2 minute", calendar „Awareness"/„Today", intreruperi „entry scrapuite", cod județ x3)
- P2 (anglicisme, gramatică, „Detalii →"): ~30
- P3 (microcopy, abrevieri, săgeți bară, consecvență): ~25

## Top 10

1. [P1 batch] src/app/[judet]/istoric/page.tsx (liniile 38-263) — ~18 stringuri UI fără diacritice (administratie, functie, judetean, populatie, suprafata, institutiilor, In curand etc.). Pagină întreagă neromânizată. Vizibil pe toate cele 42 de județe non-București.
2. [P1] src/data/intreruperi.ts:645 — `caldura: "Caldură"` → `"Căldură"`. Sursă de adevăr propagată în toate listările/filtrele/hero-urile de întreruperi (zeci de afișări). + IntreruperiFilters.tsx:62 hardcodat separat.
3. [P0 ×13] Ghilimea ASCII " după „ — încalcă regula explicită AGENTS.md, produce ghilimea de închidere greșită vizibil. Concentrate în: error.tsx [judet]:20, statistici x3, buget/simulator x2, intreruperi x2, promisometru, EvenimenteFilter, AlertsSubscribeForm.
4. [P1] src/app/impact/page.tsx:160 — „Actualizat la fiecare 2 minute" e FALS (revalidate=1800/30min; meta zice „zilnic"). Trei valori contradictorii pe aceeași temă.
5. [P1] Cod județ afișat în loc de nume — intreruperi/[id]/page.tsx:484,497 („din CJ"), statistici-sesizari-romania:283 (link „B"/„CJ"). Cetățeanul vede coduri, nu nume.
6. [P1] src/app/intreruperi/page.tsx:135 — „${n} entry scrapuite" — „entry" + „scrapuite" (Romglish grosolan) în hero-ul paginii naționale de întreruperi.
7. [P1] src/app/calendar/page.tsx:109 + 184 — tagline „Awareness → participare." (anglicism) + footer „Today: 2026-06-13" (engleză + dată brută, pare debug în producție).
8. [P2 cluster] Anglicisme vendor/jargon: „Groq AI"/„Groq Llama" (propuneri-legislative ×3), „provider/Provider" (intreruperi ×4), „Commit, apoi reveal" (buget/simulator), „Disclaimer" (×2), „live"/„target"/„Submisia"/„Spoiler"/„clipboard".
9. [P2 cluster] „Detalii →" / săgeată-bară interzisă de convenție — evenimente/[judet] EventCard:133, EvenimenteFilter:148, calendar:171, + multe link-uri „... →" (page [judet], promisometru, bugetare, intreruperi).
10. [P1] Inconsecvență „30 de zile lucrătoare" (propuneri-legislative ×2) vs „30 de zile calendaristice" (sesizări) — același temei OG 27/2002 descris diferit. + frecvență actualizare întreruperi (12h vs 30min vs zilnic) inconsecventă între pagini.
