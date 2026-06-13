# Audit COPY · Info & Legal — Civia.ro

Scope: src/app/{ghiduri, cum-fac, cum-functioneaza, intrebari-frecvente, glosar, drepturile-cetateanului, og-27-2002, sesizare-vs-petitie, avocatul-poporului-online, informatii-publice, verificare-avere, decizii-deschise, scoala, proteste, initiative, provocari, hackathons, compass-ue, autoritati, press, cont, auth, u, not-found, error, legal}

Format constatare: `[P0/P1/P2/P3] · fișier:linie · PROBLEMĂ · FIX`

Status: DONE — toate fișierele din scope citite (ghiduri index + 2 ghiduri spot-check, cum-fac, cum-functioneaza, intrebari-frecvente, glosar, drepturile-cetateanului, og-27-2002, sesizare-vs-petitie, avocatul-poporului-online, informatii-publice, verificare-avere, decizii-deschise, scoala, proteste, initiative, provocari, hackathons, compass-ue, autoritati, press, cont, auth, u, not-found, error, toate 4 paginile legal). Numerotarea articolelor OG 27/2002 + plângere contravențională 20 lei verificate via web.

Total constatări: ~95 (4×P0/echiv. critic, ~14×P1, ~35×P2, ~42×P3).

---

## Constatări

### not-found.tsx
- **[P2]** · `src/app/not-found.tsx:7` · Quick-link label `"Trimit o sesizare"` (persoana I) e inconsecvent cu convenția CTA „Fă o sesizare". · FIX: `label: "Fă o sesizare"`.
- **[P3]** · `src/app/not-found.tsx:8` · Label `"Petiții"` e bun, dar pentru paritate cu celelalte ar putea fi mai descriptiv. · FIX (opțional): `label: "Semnează o petiție"`.

### error.tsx
- **[P2]** · `src/app/error.tsx:31` · Textul spune „apasă „Reîncarcă"" dar butonul real (linia 45) zice „Reîncarcă pagina". Mismatch minor între referință și etichetă. · FIX: în text scrie „apasă „Reîncarcă pagina"" SAU schimbă butonul în „Reîncarcă".
- **[P3]** · `src/app/error.tsx:31` · Folosește ghilimele ASCII drepte `„Reîncarcă"` — corect e „…" (deschidere jos + închidere sus), aici închiderea e ASCII `"`. Atenție la regula RO din AGENTS (în JSX e text, nu string literal, deci nu rupe build-ul, dar e inconsecvent tipografic). · FIX: folosește `„Reîncarcă pagina”` cu ghilimea de închidere curly `”`.

### cum-functioneaza/page.tsx
- **[P1]** · `src/app/cum-functioneaza/page.tsx:168` · CTA mid-page `"Trimite o sesizare acum"` — mix incorect. Convenția: hero/entry-point = „Fă o sesizare"; „Trimite sesizarea" e DOAR pentru butonul de submit din formular. Aici e un link către /sesizari (entry-point), deci ar trebui „Fă o sesizare". · FIX: `Fă o sesizare acum`.
- **[P2]** · `src/app/cum-functioneaza/page.tsx:66` · Claim privacy: „Servere în Uniunea Europeană (Frankfurt)" + „toate sesizările + datele tale dispar definitiv în 24h". Verifică vs. politica reală — AGENTS avertizează explicit: nu pretinde „Frankfurt only" pentru vendori US (Groq, Resend, Upstash sunt US). Vezi secțiunea legală separată.
- **[P2]** · `src/app/cum-functioneaza/page.tsx:36,46` · Citează „OG 27/2002 art. 12" pentru clasarea anonimelor și „art. 8" pentru 30 zile. NUMEROTAREA ARTICOLELOR trebuie verificată (vezi secțiunea legală) — în textul real al OG 27/2002 clasarea anonimelor e art. 7, iar termenul de 30 zile e art. 8. Art. 12 nu se referă la anonime. POSIBIL GREȘIT.
- **[P2]** · `src/app/cum-functioneaza/page.tsx:214,306` · „220+ orașe acoperite" — claim cantitativ repetat; verifică acuratețea vs. datele reale.
- **[P3]** · `src/app/cum-functioneaza/page.tsx:169,261` · Inconsecvență „contencios administrativ — termen 30 zile de la refuz": OK, dar la art.8 OG pentru contencios e formularea „de la comunicare/expirare"; minor.
- **[P2]** · `src/app/cum-functioneaza/page.tsx:51` · „/petitii pentru petiții colective" — OK conceptual.
- **[P3]** · `src/app/cum-functioneaza/page.tsx:303` · CTA final „Fă o sesizare în 90 secunde" — corect conform convenției (entry-point). Bun.

### intrebari-frecvente/page.tsx
- **[P2]** · `src/app/intrebari-frecvente/page.tsx:51,67,149` · „OG 27/2002 art. 12" pentru anonime (de 3 ori) — vezi mai sus, posibil art. 7. VERIFICĂ.
- **[P2]** · `src/app/intrebari-frecvente/page.tsx:169` · „Lista completă publică în /transparenta." — verifică dacă ruta /transparenta există. Dacă nu, link mort / promisiune neonorată.
- **[P2]** · `src/app/intrebari-frecvente/page.tsx:105` · „Constituția art. 51 cere identificare reală. Email + nume + (uneori) CNP." — Art. 51 e dreptul de petiționare, NU cere CNP. Afirmația „(uneori) CNP" pentru petiții e discutabilă/inexactă. · FIX: elimină mențiunea CNP sau reformulează.
- **[P2]** · `src/app/intrebari-frecvente/page.tsx:145` · „criptare la repaus + în tranzit" — claim tehnic; verifică vs. realitate (Supabase oferă encryption at rest, dar formularea trebuie să fie acoperită de politica reală).
- **[P2]** · `src/app/intrebari-frecvente/page.tsx:165` · „avem API public pentru date civice" — verifică dacă există realmente un API public documentat. Dacă nu, e promisiune falsă.
- **[P2]** · `src/app/intrebari-frecvente/page.tsx:169` · „servicii API premium (jurnaliști)" ca sursă de venit — verifică dacă există. Posibil aspirational prezentat ca fapt.
- **[P3]** · `src/app/intrebari-frecvente/page.tsx:131` · „Taxă judiciară redusă (~20 lei)" — taxa de timbru pt. contencios administrativ e fixă prin lege; verifică suma actuală (OUG 80/2013). „~20 lei" poate fi inexact (anularea unui act adm. = 50 lei).
- **[P3]** · `src/app/intrebari-frecvente/page.tsx:195` · „inclusiv din backup-uri (după ciclul de retenție de 30 zile)" — verifică consecvența cu retenția declarată în /legal (politica spune 24h în cum-functioneaza vs 30 zile aici — POSIBIL CONTRADICȚIE).
- **[P1]** · `src/app/cum-functioneaza/page.tsx:66` VS `intrebari-frecvente/page.tsx:195` · CONTRADICȚIE retenție: cum-functioneaza spune „dispar definitiv în 24h", FAQ spune „24h... după ciclul de retenție de 30 zile". Mesaje incompatibile despre cât durează ștergerea. · FIX: aliniază la o singură formulare (probabil „cererea în 24h, eliminare completă din backup în max 30 zile").
- **[P3]** · `src/app/intrebari-frecvente/page.tsx:378` · CTA „Fă o sesizare acum" — corect.
- **[P3]** · `src/app/intrebari-frecvente/page.tsx:279` · tagline „Actualizat săptămânal" — claim mentenanță; asigură-te că e adevărat.
- **[P3]** · `src/app/intrebari-frecvente/page.tsx:93` · „10.000+ pentru petiții parlamentare cu impact" — pragul legal pentru inițiativă legislativă cetățenească e 100.000 (Constituție art. 74), iar petiția parlamentară nu are prag. Cifra „10.000" e arbitrară; clarifică că e prag mediatic, nu legal.

### og-27-2002/page.tsx
- **[P1]** · `src/app/og-27-2002/page.tsx:160-163` · Art. 12 citat ca „Petițiile anonime... se clasează." În textul real al OG 27/2002, dispoziția despre anonime este la **art. 7**, nu art. 12. CITARE GREȘITĂ a numărului de articol pe o pagină dedicată legii. VERIFICĂ ȘI CORECTEAZĂ.
- **[P2]** · `src/app/og-27-2002/page.tsx:121-123` · „Art. 1" citat — textul atribuit („are ca obiect reglementarea modului de exercitare a dreptului de petiționare, garantat de articolul 51 din Constituție") trebuie verificat verbatim vs. textul oficial.
- **[P2]** · `src/app/og-27-2002/page.tsx:131-133` · „Art. 2 — Prin petiție se înțelege cererea, reclamația, sesizarea sau propunerea formulată în scris sau prin poșta electronică." — verifică verbatim (textul oficial menționează și „adresată autorităților publice").
- **[P2]** · `src/app/og-27-2002/page.tsx:151-153` · „Art. 9 — Petițiile vor fi înregistrate..." verifică numărul articolului (înregistrarea e art. 6 în unele variante).
- **[P1]** · `src/app/og-27-2002/page.tsx:203` · Link sursă oficială: `https://legi.justice.ro` — DOMENIU INEXISTENT/GREȘIT. Portalul oficial e `legislatie.just.ro`. Link mort pe pagina sursă-de-adevăr. · FIX: `https://legislatie.just.ro/Public/DetaliiDocument/34322` (OG 27/2002).
- **[P2]** · `src/app/og-27-2002/page.tsx:260` · CTA „Fă o sesizare" — corect (entry-point).
- **[P3]** · `src/app/og-27-2002/page.tsx:250` · Titlu CTA „Trimite sesizarea ta acum, în baza OG 27/2002" — folosește „Trimite sesizarea" într-un titlu de secțiune care duce spre /sesizari (entry-point), nu spre submit. Minor mix.

### sesizare-vs-petitie/page.tsx
- **[P2]** · `src/app/sesizare-vs-petitie/page.tsx:39,63` · „Termen 30 zile sau 45 pentru cazuri complexe" pentru petiții — OG 27/2002 spune 30+15 = 45 max, dar formularea „45 cazuri complexe" e ok ca rotunjire. Consecvent cu restul.
- **[P3]** · `src/app/sesizare-vs-petitie/page.tsx:137` · CTA card petiție „Semnează / inițiază petiție" — convenția pt. petiții e „Semnează petiția" (entry) / „Vezi detalii" (card). „Semnează / inițiază" e hibrid; acceptabil aici (card dual-scop) dar inconsecvent cu convenția strictă. · FIX (opțional): „Semnează petiția".
- **[P3]** · `src/app/sesizare-vs-petitie/page.tsx:62` · „Semnături: De la 10 până la zeci de mii" — pragul „10" e arbitrar (nu există minim legal). OK ca orientare, dar inconsecvent cu FAQ intrebari-frecvente care zice „nu există minim legal".
- **[P3]** · `src/app/sesizare-vs-petitie/page.tsx:44` · „Constituția art. 51 nu impune formă scrisă pe hârtie." — corect și util.
- POZITIV: CTA-uri corecte („Fă o sesizare" / „Semnează o petiție").

### drepturile-cetateanului/page.tsx
- **[P2]** · `src/app/drepturile-cetateanului/page.tsx:232` · CTA-urile din carduri folosesc pattern `{d.ctaText} →` cu săgeată ASCII finală — ex. „Fă o sesizare →", „Vezi ghid L 544/2001 →", „Vezi /avocatul-poporului-online →". AGENTS interzice „Detalii →" (săgeată bară pe card link). Aici nu e bară simplă, dar săgeata pe „Vezi /avocatul-poporului-online →" e neelegant (afișează ruta brută în text). · FIX: ctaText „Escaladează la Avocatul Poporului" (fără rută în copy), „Vezi ghidul Legea 544".
- **[P3]** · `src/app/drepturile-cetateanului/page.tsx:55-56` · ctaHref pt. „Vezi ghid L 544/2001" duce la `/ghiduri` (index), nu la `/ghiduri/ghid-legea-544`. Link impreciz — utilizatorul ajunge pe lista generală, nu pe ghidul promis. · FIX: `ctaHref: "/ghiduri/ghid-legea-544"`.
- **[P3]** · `src/app/drepturile-cetateanului/page.tsx:89` · ctaText „Vezi /avocatul-poporului-online" — afișează ruta brută ca text. · FIX: „Escaladează la Avocatul Poporului".
- **[P3]** · `src/app/drepturile-cetateanului/page.tsx:72` · „Călătorie fără viză în Schengen (UE + non-UE select)." — „non-UE select" e neclar/anglicism. · FIX: „Călătorie fără viză în spațiul Schengen."
- **[P3]** · `src/app/drepturile-cetateanului/page.tsx:79` · „GDPR/L 190/2018" — corect (L 190/2018 e legea de aplicare GDPR în RO). OK.
- **[P2]** · `src/app/drepturile-cetateanului/page.tsx:163` · „informație publică prin solicitare scrisă anonimă cu adresă de corespondență" — discutabil: L 544/2001 cere de regulă identificarea solicitantului (nume) pentru a primi răspuns. Afirmația că poți cere anonim e inexactă. VERIFICĂ.

### glosar/page.tsx
- **[P1]** · `src/app/glosar/page.tsx:51` · „OG 27/2002 art. 12 spune că petițiile anonime pot fi clasate" — ACELAȘI ERROR de numerotare (anonimele = art. 7, nu art. 12). Repetat și aici. CORECTEAZĂ.
- POZITIV: glosarul folosește date din `@/data/glosar` (centralizat). Tagline „Actualizat săptămânal" — verifică veridicitatea.

### avocatul-poporului-online/page.tsx
- **[P2]** · `src/app/avocatul-poporului-online/page.tsx:195-196` · Template plângere: „a depășit acest termen fără a comunica vreo notificare sau prelungire conform art. 9." — referința la „art. 9" pt. prelungire/notificare e greșită; prelungirea e reglementată tot la art. 8 (alin. cu „cel mult 15 zile"). · FIX: schimbă „conform art. 9" în „conform art. 8".
- **[P2]** · `src/app/avocatul-poporului-online/page.tsx:261` · „Taxă: ~20 lei" pt. contencios administrativ — taxa de timbru pt. anularea unui act administrativ e 50 lei (OUG 80/2013 art. 16). „~20 lei" e inexact. · FIX: „Taxă: 50 lei".
- **[P3]** · `src/app/avocatul-poporului-online/page.tsx:243-244` · „40% din primării răspund la revenire." — statistică fără sursă. Dacă nu e măsurată real, e fabricată. · FIX: elimină cifra sau marchează „estimativ".
- **[P3]** · `src/app/avocatul-poporului-online/page.tsx:201` · „Legea 35/1997 art. 13 (competența Avocatului Poporului)" — corectă ca lege (Legea 35/1997 organizarea AVP); verifică articolul exact.
- **[P2]** · `src/app/avocatul-poporului-online/page.tsx:313` · Link `https://avp.ro/depune-petitie` — verifică că URL-ul exact există (avp.ro folosește structură proprie; posibil 404). VERIFICĂ.
- **[P3]** · `src/app/avocatul-poporului-online/page.tsx:42-43,57-59` · Termene investigație „15 zile confirmare + 30-60 zile investigație" — afirmații fără temei legal explicit (AVP nu are termen legal strict). Marchează ca „de obicei".
- POZITIV: CTA „Fă o sesizare acum" corect.

### informatii-publice/page.tsx
- POZITIV: folosește constante `TERMEN_544_ZILE` etc. din lib (single source of truth) — model bun, fără hardcode legal.
- **[P3]** · `src/app/informatii-publice/page.tsx:44` · Hero title „Cere informații publice" — verb imperativ ok; tagline „Transparența e un drept, nu un favor" — bun.
- **[P3]** · `src/app/informatii-publice/page.tsx:29` · „Accesul e gratuit (se pot percepe doar costuri de copiere)." — corect conform L 544/2001.

### cum-fac/page.tsx
- POZITIV: date din `@/data/cum-fac-tipuri`, CTA „Fă o sesizare în 90 secunde" corect.

### verificare-avere/page.tsx
- **[P1]** · `src/app/verificare-avere/page.tsx:88` · TEXT INTERN DE DEV vizibil utilizatorului: „Scrapers ANI încep să ruleze post-deploy mig 090." — jargon tehnic (migrare DB) afișat în empty-state public. · FIX: „Datele se actualizează în curând. Revino mai târziu."
- **[P3]** · `src/app/verificare-avere/page.tsx:79` · „Demnitarul are dreptul la right of reply." — anglicism „right of reply" în text RO. · FIX: „drept la replică".
- **[P3]** · `src/app/verificare-avere/page.tsx:80` · „Civia nu acuză, expune cifre." — frază eliptică (lipsă conjuncție). · FIX: „Civia nu acuză — doar expune cifre."
- **[P3]** · `src/app/verificare-avere/page.tsx:18-19` · meta description „Toate datele sunt oficiale și publice." — ok, dar verifică domeniul `integritate.eu` (ANI) e corect și linkul `cauta-declaratie?nume=` funcționează.

### decizii-deschise/page.tsx
- **[P2]** · `src/app/decizii-deschise/page.tsx:121` · Card link „Comentează & detalii →" — încalcă convenția (săgeată finală pe card link; AGENTS cere „Vezi detalii"). · FIX: „Comentează" sau „Vezi detalii".
- **[P1]** · `src/app/decizii-deschise/page.tsx:77` · TEXT INTERN DE DEV: „Scrapers încep să ruleze post-deploy mig 090." în empty-state public. · FIX: „Propunerile apar în curând."
- **[P3]** · `src/app/decizii-deschise/page.tsx:54` · „Toate propunerile la dispoziția consiliilor locale" — formulare ambiguă („la dispoziția" = pe ordinea de zi?). · FIX: „Toate propunerile aflate pe ordinea de zi a consiliilor locale".

### scoala/page.tsx
- **[P2]** · `src/app/scoala/page.tsx:6` · `const SITE_URL = "https://civia.ro";` hardcodat local în loc de import din `@/lib/constants` (inconsecvent cu restul paginilor). NU e copy, dar e divergență; semnalat.
- **[P2]** · `src/app/scoala/page.tsx:84,127` · „Acces gratuit la Civia API pentru proiecte de clasă" / „acces dashboard analytics elevi" — promisiuni de produs care POSIBIL nu există (vezi și FAQ „API public"). Dacă nu sunt livrabile, sunt false promises. VERIFICĂ.
- **[P3]** · `src/app/scoala/page.tsx:117-120` · Testimonial marcat „— exemplu fictiv, devine real cu primul partener." — onest că e fictiv, dar un testimonial fals (chiar etichetat) într-o secțiune „Proiecte reușite" e riscant reputational. · FIX: mută într-un placeholder neutru fără ghilimele de citat real.
- **[P3]** · `src/app/scoala/page.tsx:27` · Hero zice „5 lecții despre civic engagement" — anglicism „civic engagement" în hero RO. · FIX: „implicare civică".
- **[P3]** · `src/app/scoala/page.tsx:156` · „Earlier access:" — anglicism. · FIX: „Acces anticipat:".
- **[P3]** · `src/app/scoala/page.tsx:81` · „5 prezentări PowerPoint editabile (în pregătire — lansare 2026 Q4)" — onest cu statusul, ok. Verifică data target.

### proteste/page.tsx
- **[P1]** · `src/app/proteste/page.tsx:26` · FAQ: „Notifică Poliția cu min. 3 zile înainte (HG 60/1991)." — REFERINȚĂ LEGALĂ GREȘITĂ: actul e **Legea nr. 60/1991** (privind organizarea și desfășurarea adunărilor publice), NU „HG 60/1991" (hotărâre de guvern). Inconsecvent și cu intrebari-frecvente:214 care zice corect „Legii 60/1991". · FIX: „(Legea 60/1991)". De asemenea, notificarea se face la PRIMĂRIE (nu Poliție) cu min. 3 zile înainte — verifică destinatarul.
- **[P2]** · `src/app/proteste/page.tsx:26` · „Notifică Poliția" — conform Legii 60/1991 declarația prealabilă se depune la PRIMĂRIA localității, nu la Poliție. Posibil greșit. VERIFICĂ.
- **[P3]** · `src/app/proteste/page.tsx:343,362` · Badge „Featured" — anglicism vizibil în UI RO. · FIX: „Promovat" sau „Recomandat".
- **[P3]** · `src/app/proteste/page.tsx:354,369` · Badge „✓ Documentat" — ok.
- POZITIV: disclaimer „Civia nu organizează protestele" clar; CTA „Propune protest" ok.
- **[P3]** · `src/app/proteste/page.tsx:455` · Comentariu de cod menționează „vezi detalii" cu ghilimele ASCII drepte (`„vezi detalii"`) — doar comentariu, nu UI; ignorabil.

### initiative/page.tsx
- **[P2]** · `src/app/initiative/page.tsx:134` · Card link „Semnez și eu →" — săgeată ASCII pe card link (încalcă convenția). Pentru inițiative/petiții convenția e „Semnează"/„Vezi detalii". · FIX: „Semnează" (fără săgeată) sau „Vezi detalii".
- **[P2]** · `src/app/initiative/page.tsx:68` · „validează cu SMS gratuit" — claim: SMS-ul e gratuit pentru utilizator? Verifică (OTP SMS implică cost provider). Dacă „gratuit" se referă la cetățean, ok; altfel inexact.
- **[P3]** · `src/app/initiative/page.tsx:17` · meta „respectă Legea 189/1999" — corect (Legea 189/1999 privind inițiativa legislativă a cetățenilor). OK. Totuși inițiativa locală (la Consiliu Local) e reglementată mai degrabă de OUG 57/2019 (Codul administrativ) — Legea 189/1999 e pentru inițiativa legislativă NAȚIONALĂ. Posibil temei legal nepotrivit pt. „depune la Consiliul Local". VERIFICĂ.
- **[P3]** · `src/app/initiative/page.tsx:72` · tagline „democrație directă, fără birocrație" — ok.

### provocari/page.tsx
- POZITIV: CTA „Fă o sesizare" / „Mai fă o sesizare" corecte; folosește date centralizate. Pagina e curată.
- **[P3]** · `src/app/provocari/page.tsx:170` · „ca să-ți primești badge-ul" — anglicism „badge" în UI RO (apare și „badge-ul" la 169). Acceptabil dacă e termen de produs consacrat, dar inconsecvent. · FIX (opțional): „insigna".

### hackathons/page.tsx
- **[P2]** · `src/app/hackathons/page.tsx:5` · `const SITE_URL = "https://civia.ro";` hardcodat (la fel ca scoala) în loc de import. Semnalat.
- **[P2]** · `src/app/hackathons/page.tsx` · ENGLEZĂ MASIVĂ în UI RO: „upcoming" (titlu secțiune linia 77 + tagline 69), „Challenge ideas" (133), „challenges" (113), „Voice-to-sesizare", „AR overlay", „Chrome extension highlight problems", „Mai multe →". Inconsecvent cu tonul RO al sitului. · FIX: „Următoare", „Idei de provocări", etc. (secțiunea „Challenge ideas" e oricum dev-facing; ia în calcul ascunderea ei).
- **[P3]** · `src/app/hackathons/page.tsx:141` · „Dashboard primării alternative (mai bun decât /admin/primarie)" — expune ruta internă `/admin/primarie` în copy public. · FIX: elimină referința la rută.
- **[P3]** · `src/app/hackathons/page.tsx:168` · Card link „Mai multe →" — săgeată ASCII. · FIX: „Vezi detalii".
- **[P2]** · `src/app/hackathons/page.tsx:65` · „Civia susține și organizează civic tech hackathons" — claim „organizează"; toate cele 3 evenimente sunt „proposal/în discuție" (niciunul confirmat). Afirmația „organizează" e prematură. · FIX: „Civia susține și vrea să organizeze...".

### compass-ue/page.tsx
- **[P1]** · `src/app/compass-ue/page.tsx:92` · TEXT INTERN DE DEV în empty-state public: „Scrapers încep să ruleze post-deploy mig 090." · FIX: „Programele apar în curând."
- **[P2]** · `src/app/compass-ue/page.tsx:85` · „Setează preferințe →" — săgeată pe link. · FIX: „Setează preferințe" (fără săgeată).
- **[P2]** · `src/app/compass-ue/page.tsx:137` · Card link „Detalii + asistent AI →" — săgeată + începe cu „Detalii" (exact ce interzice AGENTS). · FIX: „Vezi detalii și asistent AI".
- **[P3]** · `src/app/compass-ue/page.tsx:75` · tagline „Banii UE pe care îi pierdem doar pentru că nu știm." — frază bună, dar verifică ton (acuzator). OK.

### autoritati/page.tsx
- **[P2]** · `src/app/autoritati/page.tsx:7` · `const SITE_URL = "https://civia.ro";` hardcodat (pattern repetat: scoala, hackathons, autoritati). Semnalat.
- **[P2]** · `src/app/autoritati/page.tsx:59` · „Domeniu instituțional verificat (primarias3.ro, prefectura.ro, etc.)" — exemple de domenii par inventate: `primarias3.ro` (Primăria Sector 3 e de fapt `ps3.ro`), `prefectura.ro` e generic/inexistent. · FIX: exemple reale (`ps3.ro`, `pmb.ro`) sau „domeniul oficial al instituției".
- **[P1]** · `src/app/autoritati/page.tsx:73,99` · Link „/autoritati/inregistrare" — ruta `/autoritati/inregistrare` NU EXISTĂ (verificat). CTA principal „Solicită cont oficial" duce la 404. · FIX: creează ruta SAU schimbă în `mailto:autoritati@civia.ro`.
- **[P2]** · `src/app/autoritati/page.tsx:80` · Pasul 3 afișează `/admin/primarie` ca `<code>` în UI public — expune ruta de admin. · FIX: „dashboard-ul autorității" fără rută.
- **[P3]** · `src/app/autoritati/page.tsx:84` · „Inline status changes, upload poză rezolvare" — anglicisme. · FIX: „Schimbi statusul direct, încarci poză cu rezolvarea".

### press/page.tsx
- **[P0]** · `src/app/press/page.tsx:144` · COMPLIANCE: „Servere: Frankfurt (Vercel + Supabase EU)" — AGENTS interzice EXPLICIT „Frankfurt only" pt. vendori US. Civia folosește Groq (US), Resend (US), Upstash (US). Într-un PRESS KIT (citabil de jurnaliști) e o declarație publică inexactă privind localizarea datelor. · FIX: „Infrastructură principală în UE (Vercel + Supabase, Frankfurt); procesatori AI/email/cache în SUA cu clauze contractuale standard (SCC)." Aliniază cu /legal/confidentialitate.
- **[P2]** · `src/app/press/page.tsx:185-187` · Citat: „România are 19 milioane de cetățeni cu drepturi civice clar definite în OG 27/2002" — populația RO e ~19 mil. dar nu toți sunt „cetățeni cu drepturi civice" (include minori); imprecis ca fapt citabil. · FIX: „aproape 19 milioane de locuitori".
- **[P2]** · `src/app/press/page.tsx:142` · „Autorități indexate: 1500+" — RO are ~3.180 UAT-uri; „1500+" pare sub-numărat. VERIFICĂ.
- **[P2]** · `src/app/press/page.tsx:141` · „Acoperire orașe: 220+ municipii și orașe" — RO are 320 orașe + 103 municipii. „220+" posibil sub realitate. VERIFICĂ și aliniază cifra repetată în toate paginile.
- **[P3]** · `src/app/press/page.tsx:11,13,41` · „NGO-uri" (anglicism). · FIX: „ONG-uri".
- POZITIV: link `/statistici-sesizari-romania` EXISTĂ; citatele atribuite „Echipa Civia" (nu persoane fictive).

### cont/page.tsx
- **[P2]** · `src/app/cont/page.tsx:1090` · Sub-label „Petiții noi" → „Cetățean, când apare o petiție pe Civia" — „Cetățean," la început pare placeholder/merge-token rămas. · FIX: „Când apare o petiție nouă pe Civia".
- **[P3]** · `src/app/cont/page.tsx:1084` · „deadline-uri" (anglicism) în descriere newsletter. · FIX: „termene".
- **[P3]** · `src/app/cont/page.tsx:781` · Empty-state CTA „Depune prima sesizare →" cu săgeată. · FIX (opțional): „Fă prima sesizare".
- **[P3]** · `src/app/cont/page.tsx:740-742` · StatBox folosește hex hardcodat (`#2563EB`, `#059669`, `#EAB308`) — încalcă regula tokens (logică de culoare). Semnalat.
- POZITIV: flux GDPR (export JSON + ștergere cu confirmare „ȘTERGE" + anonimizare publică) corect; opt-in newsletter OFF by default (l.91-97) respectă consimțământul.

### u/[slug]/page.tsx (profil public)
- **[P2]** · `src/app/u/[slug]/page.tsx:106-107` · Badge-uri în engleză: „Power Contributor 50+", „Contributor activ" — anglicism „Power Contributor"/„Contributor" în UI RO. · FIX: „Contribuitor de top (50+)", „Contribuitor activ".
- **[P3]** · `src/app/u/[slug]/page.tsx:188,191` · Sesizările afișează `s.tip` și `s.status` BRUT (slug-uri DB, ex. „in-lucru" în loc de „În lucru"), nu prin `STATUS_LABELS`/`SESIZARE_TIPURI`. Inconsecvent cu restul (cont/page.tsx folosește labels). · FIX: mapează prin label-urile din constants.
- POZITIV: badge-urile ambasador au mix emoji+RO ok.

### ghiduri/page.tsx (index)
- POZITIV: date din `@/data/ghiduri`, „Citește →" e CTA soft acceptabil; hero corect.

### ghiduri/ghid-legea-544/page.tsx
- **[P3]** · `src/app/ghiduri/ghid-legea-544/page.tsx:62-63` · Stat „Prelungire maximă: 30 zile" e ambiguu/înșelător: 30 zile e TOTALUL (10 standard + 20 prelungire), iar pasul HowTo (l.46) zice corect „prelungi cu 20 de zile". Eticheta „Prelungire maximă 30 zile" sugerează +30. · FIX: „Termen maxim (complex): 30 zile" sau „Prelungire: +20 zile".
- POZITIV: termenele L 544 corecte (10 zile, total 30 complex, gratuit).

### cum-fac/[tip]/page.tsx
- POZITIV: date 100% din `@/data/cum-fac-tipuri` (centralizat); meta/keywords per tip. Verifică separat conținutul din `src/data/cum-fac-tipuri.ts` (autorități + temei legal per tip) — nu e în scope de pagini dar e sursa copy-ului.
- NOTĂ: pagina folosește datele; eventualele inexactități de temei legal sunt în fișierul de date, nu în pagină.

### ghiduri/ghid-contestatie-amenda/page.tsx
- POZITIV: ghid legal solid și CORECT. „Taxa judiciară 20 lei" pentru plângere contravențională e CORECTĂ (OUG 80/2013 art. 19 = 20 lei) — verificat. NU confunda cu cei 50 lei de la contencios administrativ.
- **[P3]** · `src/app/ghiduri/ghid-contestatie-amenda/page.tsx:130,220` · „prescripție 6 luni de la săvârșire" — corect (art. 13 OG 2/2001). Bun.
- **[P3]** · `src/app/ghiduri/ghid-contestatie-amenda/page.tsx:80,90,91` · folosește `&quot;` și `&gt;` HTML-entities în loc de ghilimele RO „…" în câteva locuri. Inconsecvent tipografic (în altă parte folosește „…"). · FIX: standardizează pe „…".
- **[P2]** · `src/app/ghiduri/ghid-contestatie-amenda/page.tsx:181` · Recomandă „COTAR" pentru consultanță rutieră — verifică actualitatea/neutralitatea (e o asociație patronală transportatori, nu de șoferi individuali). Posibil recomandare nepotrivită.

### auth/error/page.tsx & cont/error.tsx & auth/callback
- POZITIV: ambele pagini de eroare clare, RO corect, `robots: noindex` pe auth/error. Fără probleme de copy.

### Rute referențiate care LIPSESC (linkuri moarte / promisiuni neonorate)
- **[P1]** · `intrebari-frecvente/page.tsx:169` · „/transparenta" — ruta `/transparenta` NU EXISTĂ în src/app. Link mort + promisiune („Lista completă publică în /transparenta"). · FIX: creează pagina SAU schimbă referința (ex. „/legal/confidentialitate" sau elimină promisiunea).
- **[P1]** · `intrebari-frecvente/page.tsx:235` · „/intreruperi/submit" — ruta NU EXISTĂ (componenta reală e `intreruperi/SubmitForm.tsx`, fără sub-rută /submit). Verifică unde se face raportarea. Link mort în copy. · FIX: corectează ruta reală (ex. „/intreruperi" cu CTA de submit).
- **[P1]** · `autoritati/page.tsx:73,99` · „/autoritati/inregistrare" — ruta NU EXISTĂ. CTA principal + linkul din pasul 1 duc la 404.
- **[P2]** · `compass-ue/page.tsx:81` · „/compass-ue/profil" — ruta NU EXISTĂ („Setează preferințe" → 404).
- **[P2]** · `initiative/page.tsx:80` · „/initiative/nou" — ruta NU EXISTĂ („Lansează inițiativă" → 404). NOTĂ: pagina cont/alte locuri pot folosi alt slug; verifică ruta reală de creare inițiativă.

### legal/confidentialitate/page.tsx
- POZITIV CRUCIAL: această pagină citează CORECT „art. 7 OG 27/2002" (l.75) pentru identificarea petentului — confirmă că „art. 12" din celelalte pagini e greșit. Și declară CORECT vendorii US (Vercel/Groq/Resend) cu SCC+DPA (l.43,155-162) — confirmă că „Frankfurt only" din press kit e neconform cu propria politică.
- **[P1]** · `confidentialitate:129` VS produs · CONTRADICȚIE PRODUS-LEGAL: „emailul către autoritate îl trimiți tu direct (mailto:), Civia doar îl pre-completează." DAR cum-functioneaza:61/94/188, og-27-2002:188, FAQ:61 și badge-ul `sent_via_civia` din cont spun că Civia TRIMITE AUTOMAT de pe sesizari@civia.ro. Politica de confidențialitate descrie un flux mailto care contrazice produsul real. PRIORITAR — politica trebuie să descrie fluxul real (trimitere automată), altfel e o declarație legală inexactă.
- **[P2]** · `confidentialitate:130` · „AI Groq... (servere UE)... Groq nu stochează prompturile" — secțiunea 7 (l.172) admite „dacă Groq routează prin US". Tensiune internă: o secțiune zice „servere UE", alta „poate routa prin US". Aliniază.
- **[P2]** · `confidentialitate:140` VS `141` · „Cont șters: datele personale se șterg imediat" + „Sesizări: 3 ani". 3 ani e consecvent cu AGENTS. DAR cum-functioneaza:66 spune „24h" și FAQ:195 „30 zile". Aceasta (legal) e sursa de adevăr — corectează paginile de produs.
- **[P3]** · `confidentialitate:143` · Backup „7 zile" vs FAQ:195 „retenție 30 zile backup". Inconsecvent. Aliniază produsul la 7 zile (legal).
- **[P2]** · `confidentialitate:274-279` VS `cookie-policy:57` · Tabel cookies: confidentialitate (comentariu l.276-277) spune county cookie + civia_county localStorage au fost ELIMINATE; cookie-policy:57 ÎNCĂ listează `civic_county` (6 luni) ca activ. Inventarele de cookies NU coincid. Una dintre pagini e neactualizată.
- **[P3]** · `confidentialitate:177` · „criptare în tranzit + în repaus" la transferuri SEE — ok ca formulare.

### legal/cookie-policy/page.tsx
- **[P2]** · `cookie-policy:53` VS `confidentialitate:278` · `civic_cookie_consent`: cookie-policy zice „12 luni", confidentialitate zice „permanent (până la ștergere)". Durată contradictorie pentru ACEEAȘI cheie. · FIX: aliniază (ePrivacy recomandă ≤6-12 luni; alege 12 luni peste tot).
- **[P2]** · `cookie-policy:57` · `civic_county` listat ca activ (6 luni) — dar județul a fost eliminat din UI (per confidentialitate + cont). Cookie probabil nu mai e setat. · FIX: elimină rândul dacă nu mai e folosit.
- **[P2]** · `cookie-policy:64,68` VS `analiza-trafic` · `civia_vid` „30 zile" (cookie-policy) vs „durata sesiunii/sessionStorage" (confidentialitate:279) vs hash 24h (analiza-trafic). Trei descrieri diferite ale aceluiași identificator. · FIX: o singură descriere consecventă.
- **[P2]** · `cookie-policy:67-70` · „Plausible cookies (dacă activate prin Vercel Analytics)" — dar analiza-trafic:79 zice Plausible e doar „model de referință", iar pagina insistă „zero cookie-uri". Neclar dacă Plausible e efectiv folosit. Dacă NU, elimină mențiunea „Plausible cookies".
- **[P3]** · `cookie-policy:11,93` · „Cookie Banner EU 2025 (Austria parity ruling)" / „EU Austria 2025 ruling" — referință juridică vagă (nu există un „Austria 2025 ruling" notoriu citabil; paritatea Accept/Reject vine din ghidurile EDPB/CNIL). · FIX: înlocuiește cu temei real (EDPB Guidelines 03/2022 cookie banners) sau elimină.
- **[P3]** · `cookie-policy:49-51` VS `confidentialitate:274` · durată sesiune Supabase: cookie-policy „1 oră (refresh 30 zile)", confidentialitate „7 zile". Inconsecvent. Aliniază.

### legal/analiza-trafic/page.tsx
- **[P2]** · `analiza-trafic:28` (hero) VS secțiunea 6 · Hero declară „zero localStorage tracking", dar secțiunea 6 (l.162) instruiește `localStorage.setItem("civia_exclude_tracking")` + confidentialitate listează `civic_cookie_consent` + `civia_vid` în storage. „Zero localStorage" e o exagerare; reformulează „zero localStorage pentru tracking persistent al vizitatorilor".
- **[P3]** · `analiza-trafic:6` · `const SITE_URL` hardcodat (pattern repetat). Semnalat.
- **[P3]** · `analiza-trafic:148` · „bot traffic în 2025 = 51%... (Imperva Bad Bot Report)" — statistică externă citată; verifică cifra/anul (rapoartele Imperva variază 47-51%).
- **[P3]** · `analiza-trafic:85,89-98` · Anglicisme dense în tabel („Pathname", „Referrer", „Viewport", „Color scheme", „Connection", „Device") — acceptabil în context tehnic, dar inconsecvent cu tonul RO.
- **[P2]** · `analiza-trafic:189` · „hash-ul devine ireversibil după 24h → datele ies din scopul GDPR (nu mai sunt date cu caracter personal)" — afirmație juridică tare; OK ca poziție (model Plausible), dar nu schimba sensul. Semnalat ca afirmație de verificat cu jurist (nu modific).
- POZITIV: pagina e riguroasă; respectă „nu schimba sensul juridic".

### legal/termeni/page.tsx
- **[P2]** · `termeni:102` · Licența menționează „API public" ca serviciu conex — la fel ca FAQ/scoala. Dacă API-ul public nu există încă, e o promisiune în T&C. Verifică.
- **[P3]** · `termeni:39` · meta description corectă; folosește „comerț electronic" — ok.
- **[P3]** · `termeni:162` · „«as is» și «as available»" — anglicisme în text legal RO; acceptabil (termeni consacrați) dar adaugă traducere „(ca atare / așa cum e disponibil)".
- POZITIV: structură DSA/GDPR completă, RO corect, fără typos majore. Consecvent cu confidentialitate.

---

## Afirmații legale care nu mai corespund produsului / posibil inexacte (verificare separată)

1. **CONFIRMAT — Numerotare articol anonime OG 27/2002 GREȘITĂ peste tot.** Toate paginile citează „art. 12" pentru clasarea petițiilor anonime (cum-functioneaza:36, FAQ:51/67/149, og-27-2002:160, glosar:51). Conform textului oficial OG 27/2002 (verificat pe legislatie.just.ro + tpbi.ro + cdep.ro), dispoziția „Petițiile anonime sau cele în care nu sunt trecute datele de identificare a petiționarului nu se iau în considerare și se clasează" este **ART. 7**, nu art. 12. Eroare sistemică, repetată în 5 locuri. PRIORITAR — corectează „art. 12" → „art. 7" în toate. (Termenul de 30 zile = art. 8 e CORECT.)
2. **CONFIRMAT — Link sursă oficială greșit** `legi.justice.ro` (og-27-2002:203) — domeniul nu există. Portalul oficial e `legislatie.just.ro`; OG 27/2002 e la `https://legislatie.just.ro/public/DetaliiDocument/33817` (NU 34322). Pe o pagină dedicată legii, sursa-de-adevăr e ruptă.
3. **„Servere în UE (Frankfurt)"** repetat (cum-functioneaza:66, FAQ:145, press:144) — AGENTS interzice explicit „Frankfurt only" pt. vendori US. Groq/Resend/Upstash sunt procesatori US. Politica reală trebuie să declare SCC/US. Cel mai grav în press kit (P0).
4. **Retenție contradictorie**: „24h" (cum-functioneaza:66) vs. „24h după ciclu 30 zile" (FAQ:195). Aliniază cu /api/cron/purge-retention real (3 ani anonimizare sesizări, 90d cosigner — per AGENTS).
5. **CNP la petiții** (FAQ:105) — Art. 51 Constituție nu cere CNP; afirmația „(uneori) CNP" e inexactă.
6. **API public** (FAQ:165,169; scoala:84,127) — „avem API public", „Acces gratuit la Civia API" — verifică existența reală înainte de a-l anunța ca fapt în mai multe pagini.
7. **„HG 60/1991"** (proteste:26) — referință greșită; actul e **Legea 60/1991**. Și destinatarul notificării (Poliție vs Primărie) trebuie verificat.
8. **Notificare anonimă L 544/2001** (drepturile-cetateanului:163) — afirmația că poți cere informații publice anonim e discutabilă; legea cere identificarea solicitantului.
9. **Legea 189/1999 pt. inițiativă LOCALĂ** (initiative:17) — Legea 189/1999 reglementează inițiativa legislativă NAȚIONALĂ; pentru „depune la Consiliul Local" temeiul corect e OUG 57/2019 (Codul administrativ). Posibil temei legal nepotrivit.
10. **Taxă contencios „~20 lei"** (avocatul-poporului-online:261, FAQ:131) — corect 50 lei (OUG 80/2013).

---

## Top 10

1. **[P0] „Servere Frankfurt only" în press kit** (`press/page.tsx:144`) — declarație publică citabilă de jurnaliști care contrazice propria politică de confidențialitate (care declară corect Vercel/Groq/Resend US + SCC). AGENTS interzice explicit. FIX: aliniază cu /legal/confidentialitate.

2. **[P1] „art. 12 OG 27/2002" pentru petiții anonime — GREȘIT în 5 locuri** (cum-functioneaza, FAQ ×3, og-27-2002, glosar). CONFIRMAT prin textul oficial: anonimele sunt **art. 7**. Eroare sistemică; propria pagină /legal/confidentialitate folosește corect art. 7. FIX global „art. 12" → „art. 7".

3. **[P1] Contradicție produs vs. politică de confidențialitate privind trimiterea emailului** (`confidentialitate:129` „îl trimiți tu direct mailto" vs. tot restul sitului + badge `sent_via_civia` „Civia trimite automat de pe sesizari@civia.ro"). Politica legală descrie un flux care nu mai e cel real.

4. **[P1] Text intern de dev vizibil publicului** — „Scrapers încep să ruleze post-deploy mig 090." în empty-state pe `verificare-avere:88`, `decizii-deschise:77`, `compass-ue:92`. Jargon de migrare DB afișat cetățeanului.

5. **[P1] Rute moarte în CTA-uri principale** — `/autoritati/inregistrare` (CTA „Solicită cont oficial" → 404), `/transparenta` (FAQ promite „lista publică"), `/intreruperi/submit`, `/compass-ue/profil`, `/initiative/nou`. Linkuri/promisiuni neonorate.

6. **[P1] Link sursă oficială OG 27/2002 rupt** (`og-27-2002:203`) — `legi.justice.ro` nu există; corect `legislatie.just.ro/public/DetaliiDocument/33817`. Pe pagina dedicată legii, sursa-de-adevăr e moartă.

7. **[P1] Inventare de cookies/retenție contradictorii între cele 3 pagini legale** — `civic_cookie_consent` (12 luni vs permanent), `civia_vid` (30 zile vs sessionStorage vs hash 24h), `civic_county` (listat activ în cookie-policy dar eliminat per confidentialitate), sesiune Supabase (1h/30d vs 7 zile). Documentele legale trebuie să reflecte aceeași realitate.

8. **[P1] Convenție CTA încălcată sistemic** — „Trimite o sesizare acum" pe entry-point (cum-functioneaza:168), card-links cu „… →"/„Detalii →" (decizii-deschise, compass-ue, initiative, hackathons, drepturi), „Trimit o sesizare" pers. I (not-found). Standardizează: entry „Fă o sesizare", card „Vezi detalii".

9. **[P2] „HG 60/1991" greșit + destinatar notificare protest** (`proteste:26`) — actul e **Legea 60/1991**; declarația prealabilă se depune la PRIMĂRIE, nu la Poliție. Inconsecvent cu FAQ care zice corect „Legea 60/1991".

10. **[P2] Promisiuni de produs nelivrate prezentate ca fapt** — „API public pentru date civice" / „Acces gratuit la Civia API" (FAQ, scoala, termeni), „servicii API premium (jurnaliști)" ca sursă de venit, „Civia organizează hackathons" (toate sunt doar propuneri). Plus anglicisme dense (hackathons, compass-ue, u/[slug]) și taxe juridice greșite (contencios „~20 lei" → 50 lei).

---
Status: DONE
