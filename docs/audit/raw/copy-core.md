# Audit COPY — CORE (Civia.ro)

Audit al fiecărui cuvânt user-facing din nucleul aplicației: homepage, sesizări (flux + public + rezolvate + urmărește), petiții, știri și componentele lor + layout.

Convenții verificate (AGENTS.md):
- CTA hero „Fă o sesizare" / submit „Trimite sesizarea" / card „Vezi detalii"/„Vezi sesizarea" (nu „Detalii →")
- share „Distribuie"/„Copiază link"; petiții „Semnează petiția"/„Semnează acum"
- ghilimele românești „" (nu ASCII " după „)
- diacritice complete, ton uman, fără anglicisme, fără placeholder-e uitate

Severitate: P0 = blocker/încalcă grav convenția sau e greșit gramatical vizibil · P1 = important · P2 = minor · P3 = cosmetic/nice-to-have

---

## Constatări

### src/app/page.tsx (homepage)

- [P2] · src/app/page.tsx:29 · În răspunsul FAQ (JSON-LD, indexat de Google + citat de LLM-uri): „descrii problema în 1-2 fraze, **optional** adaugi 1-5 poze". Anglicism / typo — lipsește diacritica. · FIX: „**opțional** adaugi 1-5 poze".
- [P3] · src/app/page.tsx:39 · FAQ: „**sau marchează** sesizarea ca fără răspuns pe Civia" — ton imperativ amestecat cu enumerarea infinitivelor („plângere la…", „acțiune la…", „marchează"). Inconsecvent. · FIX: „…sau o marchezi ca fără răspuns pe Civia pentru a intra în statisticile publice."
- [P3] · src/app/page.tsx:155 · CTA hero secundar „Semnează petiții". Convenția petiții (AGENTS.md) cere „Semnează petiția". Pluralul e ok ca entry-point general, dar inconsecvent cu restul. · FIX (opțional): „Vezi petițiile" (mai onest — duce la listă, nu semnezi direct) sau păstrează dacă e intenționat entry-point.
- [P3] · src/app/page.tsx:199 · Link „Vezi toate" cu `ArrowRight`. Convenția cere descriptiv, nu doar săgeată; „Vezi toate" e ok ca text, săgeata e decor — acceptabil. Notabil pt. consecvență cu „Vezi detalii".

### src/app/sesizari/page.tsx

- [P1] · src/app/sesizari/page.tsx:198 · CTA cross-link „⚖️ Propune →" — **bare arrow + emoji** ca CTA, încalcă convenția „nu Detalii →". · FIX: „Propune o modificare" (fără săgeată; emoji-ul ⚖️ poate rămâne ca icon dacă e dorit, dar nu săgeata finală).
- [P2] · src/app/sesizari/page.tsx:189-196 · Cross-link folosește utilitare ne-tokenizate (`bg-surface-2`, `border-border`, `text-text-muted`, `text-primary`) în loc de `var(--color-*)` ca restul paginii. (UI/token, nu copy strict — dar inconsecvent vizual.) · FIX: aliniază la `bg-[var(--color-surface-2)]` etc.
- [P3] · src/app/sesizari/page.tsx:183-184 · Card legal duplică info: titlu „Legal — OG 27/2002 art. 8 alin. (1)" apoi textul „Autoritatea are 30 de zile să răspundă (OG 27/2002 art. 8)." Repetă „OG 27/2002 art. 8". · FIX: scoate referința din corp: „Autoritatea are **30 de zile** calendaristice să răspundă."
- [P3] · src/app/sesizari/page.tsx:58 · Quick-link title „Ce semnalează alții" + desc „Votează + trimite și tu". „+" în loc de „și" e telegrafic. · FIX desc: „Votează-le și trimite-le și tu".

### src/components/sesizari/SesizareForm.tsx

- [P2] · SesizareForm.tsx:1830 · Helper locație: „ex: „Strada **Frății** Golești, Craiova"" — typo: „Frății" în loc de „**Frăției**" (și mixează ghilimele „…" cu ASCII `"` în fragmentul interior din JSX). · FIX: „ex: „Strada Frăției, Craiova"" (verifică numele real al străzii) și folosește „…" consecvent.
- [P3] · SesizareForm.tsx:1611 · „Detectăm tipul…" — folosește `…` (corect). OK.
- [P3] · SesizareForm.tsx:1844 · „(se rafinează...)" — folosește **ASCII `...`** în loc de elipsa tipografică `…`. Inconsecvent cu restul formularului (care folosește `…`). · FIX: „(se rafinează…)".
- [P2] · SesizareForm.tsx:2069 · Hint AI (apare în descriere temporar, dar e user-modificabil): „adauga **sense** de urgenta" — anglicism („sense") + lipsă diacritice. · FIX: „adaugă un ton de urgență, evidențiază riscul pentru cetățeni". (Și butonul „+ Urgenta" L2079 → „+ Urgență".)
- [P2] · SesizareForm.tsx:2079 · Buton „+ Urgenta" — lipsă diacritică. · FIX: „+ Urgență".
- [P2] · SesizareForm.tsx:2048-2064 · Butoane AI „Refac" / „Mai scurt" / „+ Urgenta" — „Refac" (pers. I) e ciudat ca etichetă de buton (acțiunea o face sistemul, nu userul). · FIX: „Refă" (imperativ) sau „Regenerează".
- [P2] · SesizareForm.tsx:2062 · title="Genereaza varianta mai scurta" — lipsă diacritice. · FIX: „Generează o variantă mai scurtă".
- [P2] · SesizareForm.tsx:2077 · title="Adauga ton de urgenta" — lipsă diacritice. · FIX: „Adaugă ton de urgență".
- [P2] · SesizareForm.tsx:2045 · title="Refac textul cu AI" — pers. I inconsecvent. · FIX: „Regenerează textul cu AI".
- [P1] · SesizareForm.tsx:1268 · Mesaj eroare server fără diacritice: „Serverul **intampina** o problema temporara. Te rugam **reincearca** in cateva secunde." · FIX: „Serverul întâmpină o problemă temporară. Te rugăm să reîncerci în câteva secunde."
- [P1] · SesizareForm.tsx:1261 · `Serverul a raspuns ${res.status}` — fără diacritice. · FIX: „Serverul a răspuns cu eroarea ${res.status}".
- [P1] · SesizareForm.tsx:1269 · „Eroare trimitere" — mesaj robotic/telegrafic. · FIX: „Trimiterea a eșuat. Reîncearcă te rog."
- [P1] · SesizareForm.tsx:1273 · „**Raspuns invalid** de la server. Te rugam reincearca." — fără diacritice + jargon tehnic. · FIX: „Răspuns neașteptat de la server. Reîncearcă te rog."
- [P1] · SesizareForm.tsx:1289 · announce() screen-reader: „Sesizare **inregistrata** cu succes. Codul **tau** este…" — fără diacritice (citit de screen reader greșit). · FIX: „Sesizare înregistrată cu succes. Codul tău este…".
- [P1] · SesizareForm.tsx:1302,1305 · „Eroare trimitere" (fallback) + announce „Eroare la trimitere: …" — telegrafic. · FIX fallback: „Trimiterea a eșuat".
- [P3] · SesizareForm.tsx:724 · „Serviciul de generare e temporar indisponibil. Reîncearcă în câteva secunde." — OK, uman + diacritice.
- [P2] · SesizareForm.tsx:691 · „Scrie mai întâi o descriere (min 10 caractere)" — „min" abreviat. · FIX: „Scrie mai întâi o descriere (minim 10 caractere)".
- [P3] · SesizareForm.tsx:1077 · `Completează: ${missing.join(", ")}` — OK, uman.
- [P2] · SesizareForm.tsx:1944 · Parcare datetime hint: „Completat automat cu acum" — „cu acum" sună stângaci. · FIX: „Completat automat cu ora actuală, dar poți corecta dacă ai văzut mașina mai devreme."
- [P3] · SesizareForm.tsx:1602 · `<option>` „Alege tipul... (se completează automat din descriere)" — ASCII `...`. · FIX: „Alege tipul… (se completează automat din descriere)".
- [P3] · SesizareForm.tsx:2124 · Submit button „Trimite sesizarea la autorități" — extinde convenția „Trimite sesizarea" cu context; acceptabil dar verifică consecvența cu alte submit-uri. OK.
- [P3] · SesizareForm.tsx:2030,2139 · „AI rescrie textul în limbaj oficial…" — bun, dar „AI" repetat des în UI; ton ok.
- [P3] · SesizareForm.tsx:1958 · „Atașează pozele manual în email — apar pe Civia, dar e mai bine să le pui și ca atașamente." — clar, OK.

### src/components/sesizari/SuccessScreen.tsx

- [P2] · SuccessScreen.tsx:110 · „Trimitem la primărie..." — **ASCII `...`** în loc de elipsa `…`. · FIX: „Trimitem la primărie…".
- [P1] · SuccessScreen.tsx:145 · Buton „Vezi sesizarea ta →" — **bare arrow** + redundant „ta". Convenția cere „Vezi sesizarea" fără săgeată. · FIX: „Vezi sesizarea" (scoate săgeata și „ta").
- [P3] · SuccessScreen.tsx:151 · Buton „Altă sesizare" — un pic telegrafic. · FIX (opțional): „Trimite altă sesizare".
- [P2] · SuccessScreen.tsx:113 · Titlu fallback „Sesizare înregistrată" vs „Trimisă cu succes!" — inconsecvent: unul cu „!", altul fără. Ambele ok separat, dar starea de eroare ascunsă („needs-identity"/„error") arată „Sesizare înregistrată" deși NU s-a trimis → poate induce în eroare. · FIX: la error/needs-identity arată „Sesizare salvată — mai e un pas" ca să nu pară finalizată.
- [P3] · SuccessScreen.tsx:136 · PushPermissionButton context „🔔 Te anunțăm când primăria răspunde" — bun, uman. OK.
- [P3] · SuccessScreen.tsx:206 · „Spune-le și prietenilor — 5 secunde" — bun. OK.
- [P3] · SuccessScreen.tsx:277 · Share copy buton „Copiat!" / „Copiază" — conform convenției („Copiază link"). „Copiază" scurt ok pe buton mic. OK.
- [P3] · SuccessScreen.tsx:165 · „Răspunsul vine în max. 30 de zile calendaristice" — „max." abreviat. · FIX: „în cel mult 30 de zile calendaristice".

### src/app/sesizari/[code]/page.tsx

- [P2] · sesizari/[code]/page.tsx:625 · `className="text-[11px] text-text-muted …"` — clasă ne-tokenizată `text-text-muted` (restul paginii folosește `text-[var(--color-text-muted)]`). (UI/token.) · FIX: `text-[var(--color-text-muted)]`.
- [P3] · sesizari/[code]/page.tsx:553 · Empty state timeline: „Nu există evenimente încă." — corect dar sărac. · FIX (opțional): „Încă nu sunt evenimente — apar aici când autoritatea răspunde."
- [P3] · sesizari/[code]/page.tsx:169 · Link înapoi „Toate sesizările publice" — bun, descriptiv. OK.
- [P3] · sesizari/[code]/page.tsx:471 · „Adresa de domiciliu a fost ascunsă automat pentru protecția datelor personale." — clar, OK.
- [P3] · sesizari/[code]/page.tsx:429 · Heading „Răspunsul autorității" — bun. OK.

### src/app/urmareste/page.tsx + UrmarireSesizare.tsx

- [P1] · urmareste/page.tsx:22 · Hero: „Introdu **codul de 6 caractere** primit la trimitere." — **GREȘIT**: codurile sunt de 5 cifre („00007", vezi UrmarireSesizare placeholder „ex: 00007" + announce L1289 split pe 5). Inconsecvent → derutează userul. · FIX: „Introdu codul de 5 cifre primit la trimitere." (sau „codul numeric").
- [P2] · UrmarireSesizare.tsx:50 · Mesaj eroare fallback „Eroare căutare" — telegrafic/robotic. · FIX: „Nu am putut căuta acum. Reîncearcă te rog."
- [P2] · UrmarireSesizare.tsx:46 · „Nu am găsit sesizarea" vs L44/47 „Sesizarea nu a fost găsită. Verifică codul." — două formulări diferite pentru aceeași eroare. Unifică. · FIX (peste tot): „Sesizarea nu a fost găsită. Verifică codul (5 cifre, ex: 00007)."
- [P3] · UrmarireSesizare.tsx:206 · Link „Vezi pagina completă a sesizării" + ArrowRight — descriptiv, conform spirit convenție. OK.
- [P3] · UrmarireSesizare.tsx:236-239 · Empty state istoric: „Sesizarea există dar nu are încă evenimente în istoric. Status-ul se actualizează când autoritatea dă feedback sau un moderator marchează tranziția." — „feedback" anglicism + „marchează tranziția" jargon. · FIX: „Sesizarea există, dar încă nu are evenimente. Statusul se actualizează când autoritatea răspunde sau când e marcată o schimbare."
- [P3] · UrmarireSesizare.tsx:183 · Badge „+{cosignCount} trimitere/trimiteri" — ok. OK.

### src/app/sesizari-publice/page.tsx + SesizariPublice.tsx

- [P1] · SesizariPublice.tsx:569,578 · Badge-uri poză „BEFORE" / „AFTER" în **ENGLEZĂ** pe interfață românească. · FIX: „ÎNAINTE" / „DUPĂ".
- [P1] · SesizariPublice.tsx:453 · Empty-state CTA „Fă o sesizare acum →" — **bare arrow** după CTA. Convenția hero permite „Fă o sesizare acum" dar fără săgeată finală agățată. · FIX: scoate „ →" → „Fă o sesizare acum".
- [P2] · SesizariPublice.tsx:651 · „Se încarcă..." — **ASCII `...`**. · FIX: „Se încarcă…".
- [P2] · SesizariPublice.tsx:483-617 · Cardurile din feed NU au CTA vizibil („Vezi detalii"/„Vezi sesizarea") — tot cardul e link cu aria-label. Convenția cere link descriptiv pe card. · FIX (opțional, dacă se vrea CTA vizibil): adaugă în bottom row un „Vezi sesizarea →" discret, sau lasă cardul-link (acceptabil dacă consecvent peste tot).
- [P3] · SesizariPublice.tsx:371 · Pill realtime „↻ {n} nouă/noi" — text foarte scurt; „↻" simbol. · FIX (opțional): „↻ {n} sesizări noi — reîmprospătează".
- [P3] · SesizariPublice.tsx:433 · Empty-state (fără filtru): „Platforma e gratuită și nu cere cont. 2 minute — noi scriem textul formal…" — bun, uman. OK.
- [P3] · SesizariPublice.tsx:313 · Filtru status „Orice status" vs L307 „Toate tipurile" / L329 „Toate județele" — inconsecvent („Orice" vs „Toate"). · FIX: „Toate stadiile" sau „Toate statusurile" pentru consecvență.
- [P2] · sesizari-publice/page.tsx:25 · PageHero backLabel „Trimit și eu o sesizare" — pers. I ciudat pe un buton de navigare „înapoi". · FIX: „Fă o sesizare" (consecvent cu CTA hero).

### src/app/sesizari-rezolvate/page.tsx

- [P0] · sesizari-rezolvate/page.tsx:15 · Metadata description: `Galerie "înainte / după" cu sesizări…` — **ghilimele ASCII drepte** `"..."` în text RO (în loc de „…"). · FIX: „Galerie „înainte / după" cu sesizări rezolvate efectiv de primării…" (folosește template literal cu „ și ").
- [P1] · sesizari-rezolvate/page.tsx:80 · Hero description: „**Scris-am**, au răspuns, au reparat." — **greșeală gramaticală**: „Scris-am" nu e română corectă. · FIX: „Am scris, au răspuns, au reparat."
- [P2] · sesizari-rezolvate/page.tsx:83-84 · Tagline: „{n} povești **reparate** cu poză „după"" — „poveștile" nu se repară; nepotrivire semantică. · FIX: „{n} {poveste/povești} cu poză „după" · {total} sesizări rezolvate în total".
- [P3] · sesizari-rezolvate/page.tsx:84 · „{resolved.length} sesizări rezolvate **total**" — „total" la coadă e telegrafic. · FIX: „… rezolvate în total".
- [P2] · sesizari-rezolvate/page.tsx:76 · backLabel „Trimit și eu o sesizare" — la fel ca mai sus, pers. I pe buton înapoi. · FIX: „Fă o sesizare".
- [P3] · sesizari-rezolvate/page.tsx:139,153 · alt-text „Înainte" / „După" — corect RO. (Badge-urile vizuale L146/159 tot „Înainte"/„După" — corect, spre deosebire de feed-ul public care folosea EN.) OK / dovedește inconsecvența cu SesizariPublice.tsx.
- [P3] · sesizari-rezolvate/page.tsx:98 · Empty-state titlu „Galeria se completează în timp" — bun, uman. OK.

### src/app/sesizari/[code]/error.tsx + not-found.tsx

- [P3] · sesizari/[code]/error.tsx:16 · „Codul poate fi invalid sau serviciul e temporar indisponibil." — bun. OK.
- [P3] · sesizari/[code]/error.tsx:32 · Link „Toate sesizările" + ArrowLeft — ok (navigație, nu CTA). OK.
- [P3] · sesizari/[code]/not-found.tsx · Tot textul corect, diacritice ok. OK.

### src/app/sesizari-publice/error.tsx

- [P2] · sesizari-publice/error.tsx:67 · „Reîncerc automat..." — **ASCII `...`** (cod mort momentan, AUTO_RETRY dezactivat, dar tot e în bundle). · FIX: „Reîncerc automat…".
- [P3] · sesizari-publice/error.tsx:82 · „Apasă „Reîncearcă” …" — folosește corect „…”. OK.
- [P3] · sesizari-publice/error.tsx:97 · Link „Trimite o sesizare" cu ArrowLeft — OK.

### src/components/sesizari/ShareMenu.tsx

- [P3] · ShareMenu.tsx:223 · Item meniu „QR code" — anglicism inconsecvent cu modalul (L244 „Cod QR pentru…", L242 „Scanează codul"). · FIX: „Cod QR".
- [P3] · ShareMenu.tsx:214 · „Copiază link + titlu" — conform convenției („Copiază link"). OK.
- [P3] · ShareMenu.tsx:141 · Buton „Distribuie" — conform convenției. OK.

### src/components/sesizari/SignSesizareButton.tsx

- [P2] · SignSesizareButton.tsx:436 · „Trimit emailul către autorități..." — **ASCII `...`**. · FIX: „Trimit emailul către autorități…".
- [P2] · SignSesizareButton.tsx:185 · Mesaj eroare „Eroare previzualizare" — telegrafic. · FIX: „Nu am putut genera previzualizarea. Reîncearcă te rog."
- [P2] · SignSesizareButton.tsx:223 · „Eroare rețea" — telegrafic. · FIX: „Conexiune întreruptă. Verifică internetul și reîncearcă."
- [P2] · SignSesizareButton.tsx:214 · „**Email-ul** nu a putut fi trimis." — „Email-ul" cu cratimă, inconsecvent cu „emailul" folosit în restul codului. · FIX: „Emailul nu a putut fi trimis. Reîncearcă te rog."
- [P3] · SignSesizareButton.tsx:250 · Buton „Trimite și tu" — bun, conform UX (CTA co-semnare). OK.
- [P3] · SignSesizareButton.tsx:440,607 · „Trimite acum" (cu ArrowRight) — verb de acțiune ok pe submit. OK.
- [P3] · SignSesizareButton.tsx:596 · „Editez datele" — pers. I pe buton, ușor neobișnuit dar acceptabil (back-to-form). · FIX (opțional): „Înapoi la date".
- [P3] · SignSesizareButton.tsx:297 · „Mulțumim pentru implicare! 🙌" — bun, uman. OK.
- [P3] · SignSesizareButton.tsx:501 · „Așa pleacă emailul către autorități" — bun, clar. OK.

### src/app/petitii/page.tsx

- [P2] · petitii/page.tsx:288 · Card categorie afișează `cat.value` (slug-ul brut, ex „mediu"/„educatie") în loc de `cat.label`. · FIX: `{cat.label}` (verifică shape PETITIE_CATEGORII — dacă `.label` există e clar un bug de afișare).
- [P3] · petitii/page.tsx:226 · EmptyState CTA „Fă o sesizare" + ArrowRight — conform convenție. OK.
- [P3] · petitii/page.tsx:331 · Card link „Vezi detalii" + ArrowRight — conform convenție. OK.
- [P3] · petitii/page.tsx:43 · Metadata: „Click → vezi argumentele…" — „Click" anglicism. · FIX: „Apasă → vezi argumentele, semnezi pe site-ul oficial." (și L89 la fel).
- [P3] · petitii/page.tsx:89 · CollectionPageJsonLd desc: „Click → semnează pe site-ul oficial." — „Click" anglicism (indexat). · FIX: „Apasă → semnează pe site-ul oficial."
- [P3] · petitii/page.tsx:341 · „Încheiată " / „Mai sunt X zile · până " / „Până " + dată — concatenare ok, dar „Încheiată " cu spațiu la coadă e fragil. OK funcțional.
- [P3] · petitii/page.tsx:131 · „verificare în 1-2 ore, apoi e publică" — bun. OK.

### src/app/petitii/[slug]/SignPetitieButton.tsx

- [P1] · SignPetitieButton.tsx:158 · Buton acțiune „Semnează petiția". Convenția (AGENTS.md) cere pe butonul de ACȚIUNE „Semnează acum" („Semnează petiția" e pt. hero/entry). · FIX: „Semnează acum".
- [P2] · SignPetitieButton.tsx:144 · Placeholder „**Scrie-mi** de ce semnezi (opțional, max 200 caractere)..." — „Scrie-mi" (dativ pers. I) e greșit ca microcopy + **ASCII `...`**. · FIX: „Spune pe scurt de ce semnezi (opțional, max 200 de caractere)".
- [P2] · SignPetitieButton.tsx:122 · „Eroare la semnare" — telegrafic. · FIX: „Nu am putut înregistra semnătura. Reîncearcă te rog."
- [P2] · SignPetitieButton.tsx:130 · toast fallback „Eroare" — un singur cuvânt robotic. · FIX: „Ceva n-a mers. Reîncearcă te rog."
- [P3] · SignPetitieButton.tsx:100 · „Conectează-te ca să semnezi" — bun, clar. OK.
- [P3] · SignPetitieButton.tsx:166 · „+ Adaugă un comentariu (opțional)" — bun. OK.
- [P3] · SignPetitieButton.tsx:127 · toast „Mulțumim! Semnătura ta a fost înregistrată." — bun, uman. OK.

### src/app/petitii/[slug]/SharePetitie.tsx

- [P3] · SharePetitie.tsx:185,205 · „Distribuie" / „Distribuie petiția" — conform convenție. OK.
- [P3] · SharePetitie.tsx:276 · „Copiat" / „Copiază" — conform. OK.
- [P3] · SharePetitie.tsx:226 · „Deschide opțiuni native (Instagram, TikTok, etc.)" — clar; „etc." ok. OK.
- [P3] · SharePetitie.tsx:281 · „…copiază linkul și **paste-uiește** în story / DM." — anglicism hibrid „paste-uiește" + „story"/„DM". · FIX: „…copiază linkul și lipește-l în story sau în mesaj privat."

### src/app/petitii/[slug]/page.tsx

- [P1] · petitii/[slug]/page.tsx:435-436 · Card „și la nivel local": „Depune o sesizare **concreta catre** primaria ta — Civia **formalizeaza** textul, **gaseste autoritatile si** trimite. 90 **secunde**." — **lipsesc diacriticele complet** pe toată propoziția. · FIX: „Depune o sesizare concretă către primăria ta — Civia formalizează textul, găsește autoritățile și o trimite. 90 de secunde."
- [P1] · petitii/[slug]/page.tsx:429 · „Si la nivel local?" — lipsă diacritică „Și". · FIX: „Și la nivel local?".
- [P2] · petitii/[slug]/page.tsx:178 · Badge categorie afișează `cat.value` (slug brut) în loc de `cat.label`. Același bug ca în listing (L288). · FIX: `{cat.label}`.
- [P2] · petitii/[slug]/page.tsx:387 · „Civia agregă petițiile civice. **Click** → semnezi pe site-ul oficial…" — anglicism „Click". · FIX: „…Apasă → semnezi pe site-ul oficial unde petiția a fost lansată. O secundă, niciun spam, nu stocăm date despre semnătura ta."
- [P3] · petitii/[slug]/page.tsx:263,384,528 · „Semnează acum" (când nu există externalHost) — conform convenției buton acțiune. OK.
- [P3] · petitii/[slug]/page.tsx:397 · Buton „Semnează" (când fără host) / „Mergi pe {host}" — ușor inconsecvent cu „Semnează acum" de mai sus. · FIX (opțional): unifică la „Semnează acum".
- [P3] · petitii/[slug]/page.tsx:442 · „Fă o sesizare locală" — conform convenție (variantă CTA). OK.
- [P3] · petitii/[slug]/page.tsx:294 · „Rezumat al cererii și impactului" — bun. OK.
- [P3] · petitii/[slug]/page.tsx:326 · „· scrape zilnic de pe {host}" — anglicism „scrape" vizibil user-ului. · FIX: „· actualizat zilnic de pe {host}".
- [P3] · petitii/[slug]/page.tsx:410 · „Nu mai primește semnături. O lăsăm publică pentru transparență." — bun. OK.

### src/app/petitii/initiaza/InitiatePetitieForm.tsx

- [P1] · InitiatePetitieForm.tsx:186 · hint Titlu: `(„Vrem ca...", „Cerem...", „Stop...")` — **ghilimele MIXTE**: `„` (deschidere RO) urmat de `"` ASCII (închidere) + **ASCII `...`**. · FIX: „Începe cu o cerere („Vrem ca…", „Cerem…", „Stop…")." (folosește „ și " pereche + elipsă).
- [P2] · InitiatePetitieForm.tsx:33 · TARGET desc: „amplu — regional / **national**" — lipsă diacritică. · FIX: „amplu — regional / național".
- [P2] · InitiatePetitieForm.tsx:31 · TARGET desc: „începător — local, **focused**" — anglicism „focused". · FIX: „începător — local, punctual".
- [P2] · InitiatePetitieForm.tsx:411,34 · „**Target** de semnături" / „Target semnături" (aria-label) — anglicism. · FIX: „Țintă de semnături".
- [P2] · InitiatePetitieForm.tsx:324 · „Se încarcă..." — **ASCII `...`**. · FIX: „Se încarcă…".
- [P2] · InitiatePetitieForm.tsx:533 · „Se trimite spre verificare..." — **ASCII `...`**. · FIX: „Se trimite spre verificare…".
- [P2] · InitiatePetitieForm.tsx:123,128 · „Eroare upload" — anglicism + telegrafic. · FIX: „Imaginea nu s-a putut încărca. Reîncearcă te rog."
- [P3] · InitiatePetitieForm.tsx:125 · „Nu am primit URL" — jargon tehnic user-facing. · FIX: „Încărcarea nu a reușit. Reîncearcă te rog."
- [P3] · InitiatePetitieForm.tsx:275,283 · „Imagine **cover**" / alt „Preview cover" — anglicism „cover"/„Preview". · FIX: „Imagine de copertă (opțional)" + alt „Previzualizare copertă".
- [P3] · InitiatePetitieForm.tsx:328 · „Apare ca **header** pe pagina petiției + în **share-uri** sociale" — anglicisme. · FIX: „Apare ca imagine principală pe pagina petiției și în distribuirile pe rețele (Facebook, X, WhatsApp)."
- [P3] · InitiatePetitieForm.tsx:378 · „Markdown light suportat: ## Subtitlu…" — jargon „Markdown light" pentru un cetățean. · FIX (opțional): „Formatare simplă: ## pentru subtitlu, **text** pentru îngroșat, - pentru listă."
- [P3] · InitiatePetitieForm.tsx:506 · „**Slug-ul URL** se generează automat din titlu" — jargon „Slug". · FIX: „Adresa (link-ul) paginii se generează automat din titlu."
- [P3] · InitiatePetitieForm.tsx:163-165 · „Conectat ca {email}" — bun. OK.
- [P3] · InitiatePetitieForm.tsx:359 · hint Sumar: „Răspunde la „despre ce e?" în 2 propoziții." — folosește „…" corect. OK.
- [P3] · InitiatePetitieForm.tsx:538 · Submit „Trimite spre verificare" — verb de acțiune ok. OK.

### src/app/petitii/propune/ProposePetitieForm.tsx

- [P2] · ProposePetitieForm.tsx:42,48 · Mesaj eroare „Eroare" (un cuvânt, de două ori) — robotic. · FIX: „Nu am putut trimite propunerea. Reîncearcă te rog."
- [P2] · ProposePetitieForm.tsx:127 · Label „Email tău (opțional)" — lipsește articolul. · FIX: „Emailul tău (opțional)".
- [P2] · ProposePetitieForm.tsx:150 · „Se trimite..." — **ASCII `...`**. · FIX: „Se trimite…".
- [P3] · ProposePetitieForm.tsx:79 · Buton „Mai propun una" — pers. I ușor ciudat. · FIX (opțional): „Propune încă una".
- [P3] · ProposePetitieForm.tsx:104 · „…orice platformă publică." — bun. OK.
- [P3] · ProposePetitieForm.tsx:25 · „Link-ul trebuie să înceapă cu http:// sau https://" — clar. OK.

### src/app/petitii/initiaza/multumim/page.tsx

- [P2] · multumim/page.tsx:62 · „…apare în listing și poate fi semnată + **share-uită**." — anglicism „share-uită" + „listing". · FIX: „…apare în listă și poate fi semnată și distribuită."
- [P3] · multumim/page.tsx:61 · TimelineStep titlu „**Live** la civia.ro/petitii" — anglicism „Live". · FIX: „Publică pe civia.ro/petitii".
- [P3] · multumim/page.tsx:50 · „Vezi „Reguli de moderare" pe pagina de inițiere." — folosește „…" corect. OK.
- [P3] · multumim/page.tsx:84 · „Vezi alte petiții" — bun. OK.

### src/app/petitii/initiaza/LoginRequiredCard.tsx

- [P3] · LoginRequiredCard.tsx:26 · „…petițiile sunt reale (nu **botii**)…" — colocvial „botii". · FIX (opțional): „…sunt reale (nu generate automat de roboți)…".
- [P3] · LoginRequiredCard.tsx:27 · „Login-ul e prin magic link pe email" — anglicisme „Login"/„magic link" (dar „magic link" e termen consacrat). · FIX (opțional): „Te conectezi printr-un link trimis pe email — fără parole de ținut minte."
- [P3] · LoginRequiredCard.tsx:23,36 · „Conectează-te" — bun, consecvent. OK.

### src/app/petitii/[slug]/not-found.tsx + initiaza/page.tsx

- [P3] · petitii/[slug]/not-found.tsx · Text corect, diacritice ok, „Vezi petițiile" + „Inițiază o petiție". OK.

### src/app/petitii/initiaza/page.tsx

- [P2] · initiaza/page.tsx:36 · Hero desc: „Completezi titlul + descrierea + **target-ul** de semnături" — anglicism „target". · FIX: „…titlul, descrierea și ținta de semnături".
- [P2] · initiaza/page.tsx:55 · TrustBadge „**Live** în câteva ore" — anglicism. · FIX: „Publicată în câteva ore".
- [P3] · initiaza/page.tsx:88 · Regulă: „niciun **hate speech**" — anglicism. · FIX: „niciun discurs instigator la ură".
- [P3] · initiaza/page.tsx:81 · „(ex: „Vrem ca primăria X să...")" — **ASCII `...`** în interiorul ghilimelelor RO. · FIX: „(ex: „Vrem ca primăria X să…")".
- [P3] · initiaza/page.tsx:84 · „dacă cifra/**factul-cheie** e fals" — „factul" nu e cuvânt RO standard. · FIX: „dacă cifra sau faptul-cheie e fals".
- [P3] · initiaza/page.tsx:62 · „AI-ul generează automat „Pe scurt", „Ce cere", „De ce contează"." — folosește „…" corect. OK.

### src/app/petitii/propune/page.tsx

- [P3] · propune/page.tsx:31 · Tagline bun, diacritice ok. OK.
- [P3] · propune/page.tsx:27 · „Trimite-ne link-ul + două vorbe…" — „+" telegrafic dar tolerabil în hero. · FIX (opțional): „Trimite-ne linkul și două vorbe despre ce e".

### src/components/stiri/StiriList.tsx

- [P1] · StiriList.tsx:358 · Badge „**Featured**" — englezesc pe UI RO. · FIX: „Recomandat" sau „În prim-plan".
- [P2] · StiriList.tsx:270 · „**Live** · **refresh** la 30s" — două anglicisme. · FIX: „Actualizare automată la 30s".
- [P2] · StiriList.tsx:242 · Placeholder „Caută în titlu..." — **ASCII `...`**. · FIX: „Caută în titlu…".
- [P2] · StiriList.tsx:257,278 · „Se încarcă..." (×2) — **ASCII `...`**. · FIX: „Se încarcă…".
- [P2] · StiriList.tsx:288 · „**Eroare: {fetchError}**. Verifică conexiunea…" — expune mesajul tehnic brut („HTTP 500") userului. · FIX: scoate `{fetchError}` din UI: „A apărut o problemă de conexiune. Verifică internetul și încearcă din nou."
- [P3] · StiriList.tsx:143 · setFetchError fallback „Eroare" — telegrafic (dar e ascuns în spatele mesajului de mai sus). OK funcțional.
- [P3] · StiriList.tsx:374 · „Citește" + ExternalLink — bun (deschide sursa externă). OK.
- [P3] · StiriList.tsx:450 · author fallback „Redacție" — bun. OK.
- [P3] · StiriList.tsx:300 · empty „Știrile se actualizează." + „Revino în câteva minute…" — bun, uman. OK.
- [P3] · StiriList.tsx:465 · „Încarcă mai multe" + ArrowRight — bun. OK.

### src/app/stiri/[id]/page.tsx + ExpiredArticleBanner + not-found + error

- [P2] · ExpiredArticleBanner.tsx:36 · „…**RSS feed-ul** îl arhivează după o perioadă." — anglicism + jargon tehnic. · FIX: „Articolul căutat nu mai este disponibil — îl arhivăm automat după o perioadă. Vezi mai jos cele mai recente știri."
- [P2] · CONSECVENȚĂ retenție știri: not-found.tsx:54 spune „păstrează știrile pentru 3 zile"; metadata not-found L8 „pentru 3 zile"; dar ExpiredArticleBanner spune vag „după o perioadă"; iar comentariul din [id]/page.tsx:189 menționează generare la cerere. Aliniază mesajul retenției (3 zile) peste tot user-facing. · FIX: în banner adaugă „(după 3 zile)".
- [P3] · stiri/page.tsx:15 · Metadata: „…din **15 surse** naționale verificate (…)" — dar JsonLd L32 listează ~13 surse naționale + „21 de ziare locale"; numărul „15" e hard-codat și poate diverge de `NATIONAL_SOURCES.length` (folosit dinamic în hero L42). · FIX: scoate „15" din descrierea statică sau sincronizează cu lista reală.
- [P3] · stiri/[id]/page.tsx:412 · „Articolul complet" (link sursă) + ExternalLink — bun. OK.
- [P3] · stiri/[id]/page.tsx:349 · „Rezumat al articolului original" — bun. OK.
- [P3] · stiri/[id]/not-found.tsx · Text foarte bun, uman, diacritice complete. OK.
- [P3] · stiri/[id]/error.tsx · „Articolul nu se poate încărca" + „Sursa poate fi temporar indisponibilă…" — bun. OK.

### src/components/stiri/StireFacts.tsx

- [P3] · StireFacts.tsx:59,63 · „Cifre cheie" + „extras automat din articol" — bun, clar. OK.
- [P3] · StireFacts.tsx:189,209,236 · „Eveniment trecut" / „În desfășurare" / „Începe în" — bune, RO corect. OK.

### src/app/stiri/[id]/AiSummary.tsx

- [P2] · AiSummary.tsx:514 · Buton citire vocală: când e activ afișează „**Stop**" (englezesc). · FIX: „Oprește" (consecvent cu tooltip-ul „Oprește citirea" de la L503).
- [P3] · AiSummary.tsx:142 · „**Sinteza AI** se generează — revino în câteva minute…" — „AI" repetat (ok), uman. OK.
- [P3] · AiSummary.tsx:154,162 · „Sinteză AI indisponibilă" / „AI-ul nu a putut sumariza acest articol momentan." — bun, uman. OK.
- [P3] · AiSummary.tsx:128 · „Se generează sinteza…" — folosește `…` corect. OK.
- [P3] · AiSummary.tsx:492 · „{n} minute de citit" — bun. OK.

### src/components/layout/* (Navbar, MobileFab, PageHero, Footer, FooterFeedback)

- [P2] · MobileFab.tsx:75 · Speed-dial label „Fă sesizare" — lipsește „o" față de convenție („Fă o sesizare"). · FIX: „Fă o sesizare".
- [P2] · FooterFeedback.tsx:70 · Placeholder „Scrie mesajul tău — bug, idee, întrebare, orice fel de **feedback**..." — anglicism „feedback" + „bug" + **ASCII `...`**. · FIX: „Scrie-ne — o problemă, o idee, o întrebare, orice…".
- [P2] · FooterFeedback.tsx:92 · „Se trimite..." — **ASCII `...`**. · FIX: „Se trimite…".
- [P2] · FooterFeedback.tsx:41,47 · „Eroare" (×2) — telegrafic. · FIX: „Mesajul nu s-a trimis. Reîncearcă te rog."
- [P3] · FooterFeedback.tsx:63 · „Ce nu-ți place la Civia? Ce lipsește?" — bun, uman. OK.
- [P3] · FooterFeedback.tsx:98 · „Mesajul a ajuns. Mersi că te-ai implicat." — bun. OK.
- [P3] · Footer.tsx:30 · Link „Cum măsurăm trafic" — lipsește articolul. · FIX: „Cum măsurăm traficul".
- [P3] · Navbar.tsx:195,318 · „Explorează" (dropdown „mai mult") — bun, RO corect. OK.
- [P3] · Navbar.tsx:239-240 · „Caută (Ctrl+K)" — bun. OK.
- [P3] · PageHero.tsx:71 · backLabel fallback „Înapoi" — bun. OK.

### src/components/sesizari/* — mesaje de eroare telegrafice „Eroare" (PATTERN sistemic)

Multe componente afișează literalmente „Eroare" / „Eroare {status}" ca fallback user-facing — robotic, ne-uman. Pattern care apare în zeci de locuri. Recomand un helper comun (ex: „Ceva n-a mers. Reîncearcă te rog.") și înlocuire peste tot.

- [P1] · SendViaCiviaButton.tsx:131 · „Eroare de **retea**. Mai **incearca**." — **fără diacritice**. · FIX: „Conexiune întreruptă. Mai încearcă o dată."
- [P2] · SendViaCiviaButton.tsx:185 · „Se trimite..." — **ASCII `...`**. · FIX: „Se trimite…".
- [P3] · SendViaCiviaButton.tsx:190 · „Trimite acum cu Civia (**1-click**)" — anglicism „1-click". · FIX: „Trimite acum cu Civia (un clic)".
- [P2] · CommentsSection.tsx:72,92,113 · Fallback „Eroare" (×3) — telegrafic. · FIX: „Comentariul nu s-a putut publica. Reîncearcă te rog."
- [P2] · CommentsSection.tsx:245 · Placeholder „Răspunde lui {nume}..." — **ASCII `...`**. · FIX: „Răspunde lui {nume}…".
- [P2] · CommentsSection.tsx:315 · Placeholder „Scrie un comentariu..." — **ASCII `...`**. · FIX: „Scrie un comentariu…".
- [P2] · CommentsSection.tsx:333 · „Se trimite..." — **ASCII `...`**. · FIX: „Se trimite…".
- [P2] · DeleteSesizareButton.tsx:49,53 · „Eroare" / „Eroare la ștergere" — telegrafic. · FIX: „Sesizarea nu a putut fi ștearsă. Reîncearcă te rog."
- [P2] · EscalateAvpButton.tsx:56,63 · „Eroare {status}" / „Eroare de rețea. Mai încearcă." — telegrafic. · FIX: „Nu am putut trimite escaladarea. Mai încearcă o dată."
- [P2] · MarkResolvedButton.tsx:74,82 · „Eroare" (×2) — telegrafic. · FIX: „Nu am putut marca rezolvarea. Reîncearcă te rog."
- [P2] · DocumentUploader.tsx:87,157 · „Eroare de rețea" / „Eroare upload" — anglicism + telegrafic. · FIX: „Documentul nu s-a putut încărca. Reîncearcă te rog."
- [P2] · DocumentUploader.tsx:220 · „Trimit... {progress}%" — **ASCII `...`**. · FIX: „Se încarcă… {progress}%".
- [P2] · ParkingHotspotModal.tsx:51,56 · „Eroare" (×2) — telegrafic. · FIX: „Nu am putut încărca datele. Reîncearcă te rog."
- [P2] · ParkingHotspotModal.tsx:156 · „... și încă {n} sesizări." — **ASCII `...`** la început de frază. · FIX: „…și încă {n} sesizări.".
- [P2] · ParkingProofUploader.tsx:203,252 · „Eroare rețea" / „Eroare la upload." — anglicism + telegrafic. · FIX: „Poza nu s-a putut încărca. Reîncearcă te rog."
- [P2] · ParkingProofUploader.tsx:356,365 · „Citim numărul..." / „Se procesează..." — **ASCII `...`** (×2). · FIX: „Citim numărul…" / „Se procesează…".
- [P2] · PhotoUploader.tsx:71,203 · „Eroare rețea" / „Eroare la upload" — anglicism + telegrafic. · FIX: „Poza nu s-a putut încărca. Reîncearcă te rog."
- [P2] · ResendButton.tsx:76 · „Eroare necunoscută" — telegrafic. · FIX: „Ceva n-a mers. Reîncearcă te rog."
- [P2] · ResendButton.tsx:110 · „Retrimit..." — **ASCII `...`**. · FIX: „Se retrimite…".
- [P2] · SectorHeatChart.tsx:44 · fallback „Eroare" — telegrafic (dar grafic admin-ish). · FIX: „Nu am putut încărca graficul."
- [P3] · CosignersBadge.tsx:93 · „...și încă {n}" — **ASCII `...`** la început. · FIX: „…și încă {n}".
- [P3] · ParkingProofUploader.tsx:296 · placeholder „ex: B 123 ABC" — bun (exemplu placă). OK.
- [P3] · SendViaCiviaButton.tsx:246,264 · placeholders „ex: Andrei Popescu" / „ex: Str. Florilor 12…" — bune. OK.

### src/app/sesizare/[oras]/page.tsx + sesizari/strada/[slug]/page.tsx (pagini SEO)

- [P1] · sesizare/[oras]/page.tsx:111 · Hero: „**Răspuns garantat** în 30 de zile." — **claim fals/riscant**: răspunsul NU e garantat de Civia; legea impune doar termenul de 30 zile (și autoritățile îl încalcă frecvent — vezi statusul „fără răspuns" din platformă). Promisiune înșelătoare. · FIX: „Termen legal de răspuns: 30 de zile (OG 27/2002)." sau „Autoritatea are 30 de zile să răspundă (OG 27/2002)."
- [P1] · sesizari/strada/[slug]/page.tsx:138 · Tagline: „…· **Răspuns garantat 30 zile**" — același claim fals. · FIX: „· Termen legal de răspuns 30 de zile (OG 27/2002)".
- [P2] · sesizari/strada/[slug]/page.tsx:185 · Status sesizare afișat RAW (`{s.status}`, ex „in-lucru"/„actiune-autoritate") în loc de eticheta localizată din STATUS_LABELS. · FIX: `{STATUS_LABELS[s.status] ?? s.status}`.
- [P1] · sesizari/strada/[slug]/page.tsx:210 · CTA „Trimite o sesizare acum →" — **bare arrow**. · FIX: „Trimite o sesizare acum" (fără săgeată).
- [P3] · sesizari/strada/[slug]/page.tsx:163 · „Trimite sesizare în 90 sec" + ArrowRight — „sec" prescurtat. · FIX: „Trimite o sesizare în 90 de secunde".
- [P2] · sesizare/[oras]/page.tsx:237 · „Toate cele {n} tipuri →" — bare arrow. · FIX: „Vezi toate cele {n} tipuri".
- [P3] · sesizare/[oras]/page.tsx:209 · „Fă o sesizare în {oras}" — conform convenție (variantă CTA). OK.
- [P3] · sesizare/page.tsx:98 · „Fă o sesizare acum" — conform. OK.
- [P3] · sesizare/[oras]/page.tsx:67 · FAQ: „Vezi /statistici-sesizari-romania pentru date **live**." — anglicism „live". · FIX: „…pentru date actualizate."

---

## Top 10

(la final)
