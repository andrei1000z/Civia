# PLAN PERFECȚIUNE — Civia.ro

> Consolidare a 8 rapoarte de audit (`docs/audit/raw/`: copy-core, copy-county-data, copy-info-legal, ui-uniformity, motion, bugs, a11y, ia-nav). Data: 13 iunie 2026.
> Rapoartele `perf` și `live-site` menționate în brief NU există în `raw/` la data consolidării — secțiunile P4 (perf) și verificarea „live-site" sunt marcate ca lacune și se completează când apar rapoartele.
> Fiecare item: `fișier:linie · vechi → nou`. Constatări duplicate între rapoarte sunt deduplate (o singură intrare, cu sursele notate).

---

## 1. Rezumat executiv

**Starea site-ului.** Civia este un codebase matur și neobișnuit de disciplinat la nivel de logică: rapoartele de bugs și a11y confirmă că zonele clasic-fragile (race conditions, double-submit, null-handling Supabase, cleanup de listeneri, stări loading/error/empty) sunt curate și defensive. Problemele reale NU sunt de stabilitate, ci de **finisaj de suprafață**: copy needucat (diacritice lipsă, anglicisme, ghilimele ASCII), inexactități legale citabile, câteva rute moarte în CTA-uri principale, și o lipsă sistemică de uniformitate vizuală (trei implementări de card-hover, pills fără `dark:`, motion absent pe paginile de județ). Niciuna dintre acestea nu blochează un utilizator, dar împreună erodează percepția de „platformă serioasă, de încredere" — exact moneda unei platforme civice.

**Top 5 probleme sistemice (apar în mai multe rapoarte / multiplicate pe multe rute):**

1. **Inexactități legale repetate & citabile** — „art. 12 OG 27/2002" pentru petiții anonime (corect: **art. 7**) în 4-5 pagini; „Servere Frankfurt only" în press kit (contrazice propria politică de confidențialitate, care declară corect vendorii US+SCC); link sursă oficială rupt (`legi.justice.ro`); retenție contradictorie (24h vs 30 zile vs 3 ani); „HG 60/1991" (corect Legea 60/1991); taxe judiciare greșite. Pe o platformă civică, acestea sunt cel mai grav defect. *(copy-info-legal, copy-county-data)*
2. **Copy needucat pe suprafețe vizibile** — propoziții întregi fără diacritice (`istoric/page.tsx` ~18 string-uri × 42 județe; chaining petiții; tooltips), anglicisme dense („Featured", „BEFORE/AFTER", „Live", „Subscribe", „Awareness", „Commit/reveal", „target", „provider", „scrape/scrapuite"), ghilimele ASCII `"` după `„` (~13 locuri), elipsă `...` în loc de `…` (~15 fișiere), „Eroare" gol robotic (~15 componente). *(copy-core, copy-county-data, copy-info-legal)*
3. **Trei surse divergente de adevăr pentru același lucru** — card-hover (`.card-lift` vs `.card-hover` vs `Card hover` prop, valori diferite); CTA (`constants.ts CTA` vs `copy/cta.ts CTA`, se contrazic); CountUp (`ui/CountUp` vs `home/CountUp`); etichete tip-sesizare (3 seturi); cookies/retenție (3 pagini legale necoincidente). *(motion, ia-nav, ui-uniformity, copy-info-legal)*
4. **Motion absent exact unde produsul „sărbătorește"** — heroul de județ (`CountyPageHero`, ×14 pagini × 42 județe) nu animă deloc; dashboard-urile de cifre (`/impact`, `/clasament`) au numere statice (fără CountUp) și bare care apar pline (fără `bar-grow`+`Reveal`); 31 de fișiere cu hover hand-rolled în loc de `.card-lift`. *(motion, ui-uniformity)*
5. **Descoperibilitate slabă (IA/navigare)** — footer fără NICIUN link de produs și fără contact (GDPR Art. 13); ~15 pagini valoroase orfane (compara, verificare-avere, statistici, glosar, hub-uri SEO); `/impact` și `/buget` sunt pagini complete dar redirectate la home; rute moarte în CTA-uri (`/autoritati/inregistrare`, `/transparenta`, `/compass-ue/profil`, `/initiative/nou`). *(ia-nav, bugs, copy-info-legal)*

**Top 3 puncte forte de păstrat (nu le strica la refactor):**

1. **Disciplina defensivă de cod** — guard-uri `json.data?.x`, `AbortController`+cleanup, `disabled` pe submit, stări loading/error/empty distincte, zero `data!`. `Modal.tsx` (focus-trap + scroll-lock + restore) și `SuccessScreen.tsx` (next-step post-sesizare exemplar) sunt referințe de urmat. *(bugs, a11y, ia-nav)*
2. **Sistemul de design tokens** — `globals.css` are o scală completă (culori light/dark, radius, shadow, z-index) și primitive de motion (`hero-enter`, `card-lift`, `bar-grow`, `stagger-children`, `btn-press`) cu guard `prefers-reduced-motion` solid și corect. Problema e adoptarea inconsecventă, nu sistemul. *(motion, ui-uniformity)*
3. **Onestitatea de fond & conformitatea EU** — politica `/legal/confidentialitate` citează CORECT art. 7 și declară corect vendorii US+SCC (e sursa de adevăr de care trebuie aliniate celelalte pagini); fluxul GDPR în `/cont` (export + ștergere + anonimizare) și opt-in newsletter OFF by default respectă baseline-ul. *(copy-info-legal)*

---

## 2. P0 — ACUM (bug-uri reale, copy public greșit, link-uri rupte)

Grupat pe efort. Toate verificate contra `src/app`.

### Efort < 5 min (one-liner copy/edit)

| # | fișier:linie | vechi → nou |
|---|---|---|
| P0-1 | `src/data/intreruperi.ts:645` | `caldura: "Caldură",` → `caldura: "Căldură",` *(propagă în zeci de afișări întreruperi)* |
| P0-2 | `src/app/intreruperi/IntreruperiFilters.tsx:61` | `{ value: "caldura", label: "Caldură" }` → `label: "Căldură"` *(hardcodat separat, nu prinde fix-ul din data)* |
| P0-3 | `src/app/sesizari-rezolvate/page.tsx:80` | „…Scris-am, au răspuns, au reparat.…" → „…Am scris, au răspuns, au reparat.…" *(greșeală gramaticală vizibilă)* |
| P0-4 | `src/app/urmareste/page.tsx:22` | „Introdu codul de 6 caractere primit…" → „Introdu codul de 5 cifre primit…" *(coduri reale = 5 cifre, ex „00007")* |
| P0-5 | `src/components/sesizari/SesizariPublice.tsx:569,578` | badge `BEFORE` / `AFTER` → `ÎNAINTE` / `DUPĂ` *(engleză pe UI RO)* |
| P0-6 | `src/components/stiri/StiriList.tsx:358` | `<Badge …>Featured</Badge>` → `Recomandat` |
| P0-7 | `src/app/sesizare/[oras]/page.tsx:111` | „Răspuns garantat în **30 de zile**." → „Termen legal de răspuns: **30 de zile** (OG 27/2002)." *(claim fals, contrazis de statusul „fără răspuns")* |
| P0-8 | `src/app/sesizari/strada/[slug]/page.tsx:138` | „· Răspuns garantat 30 zile" → „· Termen legal de răspuns 30 de zile (OG 27/2002)" |
| P0-9 | `src/app/calendar/page.tsx:185` | `Today: {today}` → elimină linia (debug în producție) SAU „Azi: {dată formatată ro-RO}" |
| P0-10 | `src/app/calendar/page.tsx:109` | `tagline="Awareness → participare."` → `tagline="De la informare la participare."` |
| P0-11 | `src/app/buget/simulator/page.tsx:23` | `tagline="Commit, apoi reveal — fără să tragi cu ochiul"` → „Întâi alegi, apoi vezi — fără să tragi cu ochiul" |
| P0-12 | `src/app/impact/page.tsx:160` | „Actualizat la fiecare 2 minute." → „Actualizat la fiecare 30 de minute." *(real: revalidate=1800)* |
| P0-13 | `src/app/verificare-avere/page.tsx:88` | „Scrapers ANI încep să ruleze post-deploy mig 090." → „Datele se actualizează în curând. Revino mai târziu." |
| P0-14 | `src/app/decizii-deschise/page.tsx:77` | „Scrapers încep să ruleze post-deploy mig 090." → „Propunerile apar în curând." |
| P0-15 | `src/app/compass-ue/page.tsx:92` | „Scrapers încep să ruleze post-deploy mig 090." → „Programele apar în curând." |
| P0-16 | `src/app/og-27-2002/page.tsx:203-204` | `href="https://legi.justice.ro"` + „pe legi.justice.ro" → `href="https://legislatie.just.ro/Public/DetaliiDocument/33817"` + „pe legislatie.just.ro" *(domeniu inexistent)* |
| P0-17 | `src/app/intreruperi/page.tsx:135` | „…${scrapedCount} entry scrapuite în ultimele 7 zile" → „…${scrapedCount} anunțuri colectate în ultimele 7 zile" *(Romglish în hero)* |
| P0-18 | `src/app/proteste/page.tsx:26` (FAQ) | „…(HG 60/1991)." → „…(Legea 60/1991)." *(act greșit; verifică și destinatarul: PRIMĂRIE, nu Poliție)* |

### Efort < 30 min (multi-loc / verificare)

| # | fișier:linie | acțiune |
|---|---|---|
| P0-19 | „art. 12" → „art. 7" pentru petiții anonime | Corectează în: `cum-functioneaza/page.tsx:36`, `glosar/page.tsx:51`, `og-27-2002/page.tsx:49`, `intrebari-frecvente/page.tsx:51` (și orice altă apariție „anonime…art. 12"). Sursa corectă: `legal/confidentialitate:75` folosește deja art. 7. |
| P0-20 | `src/proxy.ts:64` `"/impact": "/",` | `/impact` e pagină completă DAR 308→home. Decide: (a) șterge linia + linkează pagina (recomandat — e dashboard valoros), SAU (b) șterge `src/app/impact/page.tsx`. |
| P0-21 | `src/proxy.ts:50` `"/buget": "/",` | `/buget`→home dar `/buget/simulator`+`/buget/personal` trăiesc orfane. Restaurează `/buget` ca hub + linkează, SAU mută copiii sub `/bugetare-participativa/*`. |
| P0-22 | Rute moarte în CTA-uri | `/autoritati/inregistrare` (`autoritati/page.tsx:73,99` — CTA principal → 404), `/compass-ue/profil` (`compass-ue/page.tsx:81`), `/transparenta` (`intrebari-frecvente:169`), `/intreruperi/submit` (`intrebari-frecvente:235`), `/initiative/nou` (`initiative/page.tsx:80`). Per rută: creează pagina SAU schimbă href spre rută existentă/`mailto:`. Confirmat absente prin `ls`. |
| P0-23 | Ghilimele ASCII `"` după `„` (P0 tipografic, ~10 locuri) | Înlocuiește închiderea ASCII `"` cu `”` (U+201D). Confirmate: `[judet]/error.tsx:20`, `intreruperi/page.tsx:386`, `intreruperi/_county-content.tsx:129`, `buget/simulator/page.tsx:32,35-36`, `promisometru/page.tsx:169`, `statistici-sesizari-romania/page.tsx:91,106,315`, `components/evenimente/EvenimenteFilter.tsx:160`, `components/intreruperi/AlertsSubscribeForm.tsx:63`. |
| P0-24 | `src/app/press/page.tsx:144` | „Servere: Frankfurt (Vercel + Supabase EU)" → „Infrastructură principală în UE (Vercel + Supabase, Frankfurt); procesatori AI/email/cache în SUA cu clauze contractuale standard (SCC)." *(press kit citabil; aliniază cu /legal/confidentialitate)* |
| P0-25 | Cod-județ afișat în loc de nume | `intreruperi/[id]/page.tsx:484,497` („din CJ/TM"), `statistici-sesizari-romania/page.tsx:283` (link „B"/„CJ"). Rezolvă numele: `ALL_COUNTIES.find(c=>c.id===code)?.name ?? code` / `getCountyById`. |

**Total P0: 25 grupe** (18 one-liner <5min, 7 grupe <30min).

---

## 3. P1 — Copy site-wide (înlocuiri exacte vechi→nou, pe pagină)

### 3a. `src/app/[judet]/istoric/page.tsx` — DIACRITICE LIPSĂ (cea mai mare secțiune; vizibil pe 42 județe)

~18 string-uri UI fără diacritice. Înlocuiri exacte:

| linie | vechi → nou |
|---|---|
| :38 | `Istoric administratie — ${county.name}` → `Istoric administrație — ${county.name}` |
| :41 | `Toti primarii Bucurestiului din 1989 pana azi: realizari, controverse, proiecte.` → `Toți primarii Bucureștiului din 1990 până azi: realizări, controverse, proiecte.` *(și 1989→1990 ca în pagină)* |
| :42 | `Informatii despre administratia locala din ${county.name} — primar, consiliu judetean, prefectura.` → `Informații despre administrația locală din ${county.name} — primar, consiliu județean, prefectură.` |
| :78 | `Compozitia politica a Consiliului General` → `Compoziția politică a Consiliului General` |
| :93 | `Consilii Generale — compozitie pe mandate` → `Consilii Generale — compoziție pe mandate` |
| :163 | `Primar in functie` → `Primar în funcție` |
| :177 | `Populatie` → `Populație` |
| :183 | `Suprafata` → `Suprafață` |
| :186 | `suprafata totala` → `suprafață totală` |
| :205 | `Despre administratia locala` → `Despre administrația locală` |
| :210 | `Consiliul Judetean` → `Consiliul Județean` |
| :213-214 | `Consiliul Judetean este autoritatea deliberativa a administratiei publice locale, constituita la nivel judetean. Este ales prin vot direct pentru un mandat de 4 ani.` → `Consiliul Județean este autoritatea deliberativă a administrației publice locale, constituită la nivel județean. Este ales prin vot direct pentru un mandat de 4 ani.` |
| :217-218 | `Coordoneaza activitatea consiliilor locale, aproba bugetul judetean si strategia de dezvoltare a judetului.` → `Coordonează activitatea consiliilor locale, aprobă bugetul județean și strategia de dezvoltare a județului.` |
| :225-226 | `Prefectul este reprezentantul Guvernului la nivel judetean. Verifica legalitatea actelor administrative emise de autoritatile locale.` → `Prefectul este reprezentantul Guvernului la nivel județean. Verifică legalitatea actelor administrative emise de autoritățile locale.` |
| :229-230 | `Prefectura coordoneaza serviciile publice deconcentrate ale ministerelor si ale celorlalte organe ale administratiei centrale.` → `Prefectura coordonează serviciile publice deconcentrate ale ministerelor și ale celorlalte organe ale administrației centrale.` |
| :246 | `Contacte autoritati locale` → `Contacte autorități locale` |
| :248 | `Emailuri, telefoane si adrese ale institutiilor publice din {countyName}.` → `Emailuri, telefoane și adrese ale instituțiilor publice din {countyName}.` |
| :259 | `In curand` → `În curând` |
| :261-263 | `Istoricul complet al administratiei pentru {countyName} — primari, consilieri si decizii importante — va fi disponibil in curand.` → `Istoricul complet al administrației pentru {countyName} — primari, consilieri și decizii importante — va fi disponibil în curând.` |

### 3b. `src/components/sesizari/SesizareForm.tsx` — diacritice + persoană I

| linie | vechi → nou |
|---|---|
| :1268 | „Serverul intampina o problema temporara. Te rugam reincearca in cateva secunde." → „Serverul întâmpină o problemă temporară. Te rugăm să reîncerci în câteva secunde." |
| :1261 | „Serverul a raspuns ${res.status}" → „Serverul a răspuns cu eroarea ${res.status}" |
| :1269 | „Eroare trimitere" → „Trimiterea a eșuat. Reîncearcă te rog." |
| :1273 | „Raspuns invalid de la server. Te rugam reincearca." → „Răspuns neașteptat de la server. Reîncearcă te rog." |
| :1289 | „Sesizare inregistrata cu succes. Codul tau este…" → „Sesizare înregistrată cu succes. Codul tău este…" |
| :2069 | „adauga sense de urgenta" → „adaugă un ton de urgență, evidențiază riscul pentru cetățeni" |
| :2079 | buton „+ Urgenta" → „+ Urgență" |
| :2045,2062,2077 | titles „Refac textul cu AI" / „Genereaza varianta mai scurta" / „Adauga ton de urgenta" → „Regenerează textul cu AI" / „Generează o variantă mai scurtă" / „Adaugă ton de urgență" |
| :2048 | buton „Refac" → „Refă" (sau „Regenerează") |
| :691 | „Scrie mai întâi o descriere (min 10 caractere)" → „…(minim 10 caractere)" |

### 3c. `src/app/petitii/[slug]/page.tsx` — diacritice + anglicisme

| linie | vechi → nou |
|---|---|
| :429 | „Si la nivel local?" → „Și la nivel local?" |
| :435-436 | „Depune o sesizare concreta catre primaria ta — Civia formalizeaza textul, gaseste autoritatile si trimite. 90 secunde." → „Depune o sesizare concretă către primăria ta — Civia formalizează textul, găsește autoritățile și o trimite. 90 de secunde." |
| :387 | „…Click → semnezi pe site-ul oficial…" → „…Apasă → semnezi pe site-ul oficial…" |
| :326 | „· scrape zilnic de pe {host}" → „· actualizat zilnic de pe {host}" |

### 3d. `src/app/intreruperi/page.tsx` + `_county-content.tsx` — „căldură" + anglicisme + frecvență

| linie | vechi → nou |
|---|---|
| page:24 | title „…apă, caldură, gaz, curent, lucrări stradă" → „…apă, căldură, gaz, curent, lucrări la stradă" |
| page:26,100 | „…apa, caldura, gazul…" / JSON-LD „caldură" → „căldură" |
| page:48 | „…Subscribe RSS sau iCal." → „…Abonează-te prin RSS sau iCal." (+ „caldură") |
| page:52,104 | keywords „întreruperi caldură" → „întreruperi căldură" |
| page:249 | buton „Subscribe RSS" → „Abonează-te RSS" |
| page:308 | „Scraper-ul Civia rulează automat la 12 ore." → „Sistemul Civia colectează automat la 12 ore." |
| page:127-129 vs _county:65-66,109 | INCONSECVENȚĂ frecvență (12h vs 30min vs cron real 1×/zi). Aliniază TOATE la valoarea reală (recomandat „o dată pe zi"). |
| _county:58 | „Apă, caldură, gaz…" → „Apă, căldură, gaz…" |

### 3e. `src/app/propuneri-legislative/*` — vendor leak + „30 zile lucrătoare"

| linie | vechi → nou |
|---|---|
| page:196 | „…să răspundă în 30 de zile lucrătoare." → „…în 30 de zile calendaristice." *(aliniere OG 27/2002 cu sesizările)* |
| `[id]/page.tsx:142` | „…30 de zile lucrătoare să răspundă." → „…30 de zile calendaristice să răspundă." |
| page:74, `PropuneFormClient.tsx:256`, `[id]/page.tsx:195` | „Groq AI" / „AI-ul Groq" / „Groq Llama" → „Civia" / „AI-ul Civia" *(elimină vendorul din UI)* |
| `PropuneFormClient.tsx:293` | „…este acum live." → „…este acum publică." |

### 3f. Pattern-uri transversale (sweep global, P1/P2)

- **ASCII `...` → `…`** (~15 fișiere): toate butoanele „Se trimite...", „Se încarcă...", placeholder-ele „Caută în titlu...", „Răspunde lui {nume}...". Surse: `SesizareForm`, `StiriList:242,257,278`, `CommentsSection:245,315,333`, `InitiatePetitieForm:324,533`, `ProposePetitieForm:150`, `SendViaCiviaButton:185`, `SignSesizareButton:436`, `DocumentUploader:220`, `ParkingProofUploader:356,365`, `ResendButton:110`, `FooterFeedback:70,92`, `SesizariPublice:651`, `SuccessScreen:110`.
- **„Eroare" gol → mesaj uman** (~15 componente): introdu helper `humanError()` („Ceva n-a mers. Reîncearcă te rog.") și înlocuiește în `CommentsSection`, `DeleteSesizareButton`, `MarkResolvedButton`, `EscalateAvpButton`, `PhotoUploader`, `ParkingProofUploader`, `DocumentUploader`, `StatusTicketButton`, `SignPetitieButton:122,130`, `ProposePetitieForm:42,48`, `FooterFeedback:41,47`, `ResendButton:76`, `UrmarireSesizare:50`.
- **Bare arrow în CTA („… →")** (~6 locuri): `SuccessScreen.tsx:145` („Vezi sesizarea ta →"→„Vezi sesizarea"), `SesizariPublice.tsx:453`, `sesizari/strada/[slug]:210`, `sesizari/page.tsx:198`, `[judet]/page.tsx:287,379`. Scoate „ →" sau folosește icon `aria-hidden`.
- **Anglicisme user-facing de scos** (per fișier, listate în rapoarte): „Featured", „BEFORE/AFTER", „Live/live", „refresh", „Click", „target/Target", „cover/header/Preview", „share-uită/paste-uiește/story/DM", „hate speech", „feedback", „clipboard", „AI Powered", „1-click", „QR code", „Login/magic link", „scrape", „provider/Provider", „Submisia", „Spoiler", „side-by-side", „Disclaimer", „Open Data", „NGO-uri".
- **CTA convenție** (per AGENTS.md): buton acțiune `SignPetitieButton.tsx:158` „Semnează petiția" → „Semnează acum"; `MobileFab.tsx:75` „Fă sesizare" → „Fă o sesizare"; `not-found.tsx:7` „Trimit o sesizare" → „Fă o sesizare"; `cum-functioneaza:168` „Trimite o sesizare acum" (entry) → „Fă o sesizare acum".
- **„Detalii →" card-link interzis**: `[judet]/evenimente/page.tsx:133`, `components/evenimente/EvenimenteFilter.tsx:148`, `calendar/page.tsx:171`, `compass-ue:137`, `decizii-deschise:121`, `hackathons:168` → „Vezi detalii".

### 3g. Sursă unică CTA (rezolvă divergența `constants.ts` vs `copy/cta.ts`)

`constants.ts:45` și `copy/cta.ts:12` se autodeclară ambele „single source of truth" și se contrazic (`PETITIE_HERO`: „Semnează petiția" vs „Vezi petițiile civice"). Consolidează într-un singur fișier; aliniază la AGENTS.md (`PETITIE_HERO="Semnează petiția"`). Șterge cod mort `GHID_DROPDOWN` (`constants.ts:133-148`, neimportat) + `NAV_DATE_PUBLICE=[]` (`:131`).

---

## 4. P2 — Uniformitate UI

### Pattern țintă (definit O DATĂ — aplică peste tot)

- **Card clicabil:** clasa `.card-lift` (globals.css:792 — translateY(-3px), shadow-3, 0.25s). NU hand-roll `hover:-translate-y-* hover:shadow-*`. Container listă → `stagger-children`.
- **Buton acțiune:** componenta `<Button>` (`md = h-11 px-5 text-sm`); CTA mare = `<Button size="lg">` (`h-13`). Feedback tactil `btn-press`. Focus: **o singură** convenție — `focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ring-offset-2` (dominanta; aliniază și `Button` la `ring`).
- **Badge/pill:** componenta `<Badge variant>` (`px-2.5 py-1 rounded-[var(--radius-pill)] text-xs`). NU `bg-emerald-100 text-emerald-700` fără `dark:`.
- **Hero:** `<PageHero gradient={HERO_GRADIENT.*}>`. NU `<section>` full-bleed hand-rolled, NU gradient hardcodat.
- **Culori:** `var(--color-*)` (nu hex brand, nu `emerald-500` unde diferă de token în dark). Shadow: `shadow-[var(--shadow-N)]` (au definiții dark dedicate). Radius card: `rounded-[var(--radius-md)]`.
- **Close-button:** `w-9 h-9 sm:w-8 sm:h-8` (44px touch mobil, WCAG 2.5.5).
- **Spacing pagină:** `container-narrow py-8 md:py-12`.

### Abateri de reparat (dedup)

**Dark-mode breaks (P1 — text invizibil în dark):**
- `decizii-deschise/page.tsx:97`, `compass-ue/page.tsx:107`, `propuneri-legislative/[id]/page.tsx:115` — pills `bg-emerald-100/red-100/amber-100 text-*-700` fără `dark:` → `<Badge variant>` sau pereche `dark:`.
- `components/sesizari/ShareMenu.tsx:240-249` — modal QR `bg-white`+`text-slate-900/600`+`bg-slate-900` fără `dark:` → tokens `--color-surface`/`--color-text` sau `<Modal>`.

**Cluster petiții (P1 — același CTA, rețete divergente pe aceeași pagină):** `petitii/[slug]/page.tsx:260,395,480,525` — „Semnează" cu înălțimi `h-12`/`h-11`, padding `px-4/5/6`, 3 gradiente violet + 1 plat. → o singură rețetă (recomandat `<Button size="lg">` sau `h-12 px-6` + `from-[var(--color-petition)]`). Aliniază și iconițele inline (262/381/527/452 — fixează la 14).

**Hex brand / gradient hand-rolled (P2):** `[judet]/page.tsx:958` `from-[#047857] via-[#065f46]` → tokens / `HERO_GRADIENT.authority`; aliniază cu :699. Gradiente emerald/cyan repetate: `page.tsx:126,145`, `autoritati:89`, `sesizare/[oras]:196,206`, `cum-functioneaza:300`, `sesizari/strada/[slug]:156`, `statistici-sesizari-romania:241` → 1-2 utilitare sau tokens. `cont/page.tsx:496` hero custom → `<PageHero>`.

**Radius/shadow Tailwind vs token (P2):** `admin/inbox/[id]:135,147,193,246,257,273` + `admin/inbox:107` + `sesizari:189` `rounded-md`(6px) → `rounded-[var(--radius-md)]`. `intreruperi/[id]/CalendarMenu:39` `shadow-lg`, `intreruperi/IntreruperiMap:461,470,481` `shadow-md/sm` → `shadow-[var(--shadow-N)]`.

**Pills hand-rolled ocolesc `<Badge>` (P2):** padding inconsecvent (`px-2 py-0.5` / `px-2 py-1` / `px-3 py-1`) + radius (`rounded-full` vs `--radius-pill`) în admin/feedback/propuneri/decizii/drepturile/glosar/sesizari etc. → `<Badge>`.

**Butoane mari inconsistente (P2):** `page.tsx:145` `h-12`, `sesizare/[oras]:206` + `cum-functioneaza:300` `h-14` → `<Button size="lg">` (`h-13`). Close-buttons `w-8 h-8` (P2): `DeleteSesizareButton:89`, `MarkResolvedButton:119`, `StatusTicketButton:165`, `SignSesizareButton:270`, `cont:875`, `admin/sesizari:239,357` → `w-9 h-9 sm:w-8 sm:h-8`.

**Spacing outliers (P2):** `impact:141` `py-16`, `compara/[a]/[b]:90` `py-12 md:py-16` → `py-8 md:py-12`.

**Chip AI cross-surface (P3):** `stiri/[id]/page.tsx:342` `from-violet-500` vs `petitii/[slug]/page.tsx:284` `from-purple-500` → o singură rețetă.

---

## 5. P3 — Motion & „liquid glass"

### Sistemic (un fix → multe rute)

1. **`CountyPageHero.tsx` (×14 pagini × 42 județe)** — adaugă motion ca în `PageHero`: `hero-enter-1` pe h1 (:94), `hero-enter-2` pe descriere (:108), `hero-enter-3` pe tagline (:113) + children (:120), `animate-scale-in` pe icon-chip (:83). Cel mai mare ROI vizual.
2. **`Card.tsx:25` prop `hover`** — a 3-a implementare divergentă de card-hover. Delegă la `.card-lift` (sau aliniază valorile). Consolidează `.card-hover` (globals.css:1152) în `.card-lift`. **Migrează cele 31 de fișiere** cu hover hand-rolled.
3. **`CountUp`** — consolidează `ui/CountUp` + `home/CountUp` într-una (suffix/prefix/decimals; easing `ease-out-expo`, ~900ms).
4. **`btn-press` pe toate CTA/pills** (azi pe ~5 fișiere): `StiriList:214,462`, `SesizariPublice:413,451,648`, `PromisometruList:203,224,254`, `petitii/page.tsx:137,145,224`.

### Dashboard-uri statice (P1 — exact unde produsul „sărbătorește")

- **`impact/page.tsx`** — `KpiCard:310-312` `value.toLocaleString` → `<CountUp>`; `FunnelRow:325` + status `:237` + top-județe `:269` → `bar-grow` pe fill + wrap `<Reveal>`; liste `:228,262` → `stagger-children`.
- **`clasament/page.tsx`** — scor național `:300` `{nationalScore}%` (text-6xl) → `<CountUp>`; bare fix-rate `:378-382,472-474` → `bar-grow`+Reveal; 4 liste `:357,455,502,544` → `stagger-children`; podium `:322,365,549` → `.card-lift`.

### Local (P2/P3)

- Carduri homepage cu hover hand-rolled (au stagger, lipsește lift): `TopVotedWidget:103`, `IntreruperiWidget:45`, `StiriWidget:101,151` → `.card-lift`; `StiriWidget` `<ul>:146` → `stagger-children`.
- Quick-link grids: `sesizari/page.tsx:147`, `[judet]/sesizari:136`, `ghiduri/page.tsx:59` → `.card-lift` + `stagger-children`.
- Pagina județ `[judet]/page.tsx:218,551,899,936` → `.card-lift` + `stagger-children`; hero CTA `active:scale-[0.97]` → `.btn-press`.
- `petitii/page.tsx:196` grid închise → `stagger-children`; `PromisometruList:57-60` bară → `bar-grow`.
- Tranziții abrupte `SesizariPublice:404,423` → `animate-fade-in`.
- Skeleton-uri: `stiri/loading.tsx` generic → apropie de layout real; `StiriList:276` spinner → skeleton-grid (ca `SesizariPublice:389`).

*Reduced-motion: acoperirea e CORECTĂ (guard global globals.css:455 + componente verifică matchMedia). La consolidare, PĂSTREAZĂ guard-urile.*

---

## 6. P4 — Performanță

> **LACUNĂ:** raportul `perf.md` nu există în `docs/audit/raw/`. Această secțiune se completează când apare raportul. Quick-wins de urmărit atunci (din indicii colaterale): skeleton-uri care nu seamănă cu layout-ul real (CLS la hidratare — vezi P3 motion), seed-uri expirate filtrate la runtime, `revalidate` divergent declarat vs real (`impact` 1800). Notă din MEMORY: build local OOM la SSG — verificarea se face cu `tsc + vitest`, build complet pe Vercel.

---

## 7. P5 — A11y

**Pattern țintă:** modalele folosesc `ui/Modal.tsx` (focus-trap Tab/Shift+Tab ciclic, Escape, restore `previouslyFocusedRef`, scroll-lock). Modalele hand-rolled reimplementează doar parțial.

**Focus-trap + restore lipsă (P1) — migrează la `Modal.tsx` sau copiază blocul focus-trap:**
`DeleteSesizareButton:71-133`, `SignSesizareButton:253-265,475`, `ParkingHotspotModal:63-104`, `SendViaCiviaButton:209`, `MarkResolvedButton:111`, `StatusTicketButton:157`, `EscalateAvpButton:112`, `petitii/[slug]/SharePetitie:198`, `cont/page.tsx:862`, `admin/.../ApproveTicketDialog:196`.

**Focus-trap parțial (P2):** `ShareMenu:229-255` (QR), `ui/Lightbox:41-54` (lipsă trap+restore), `ImageLightbox:20-38` (lipsă trap).

**Altele:**
- `CookieBanner:163-167` (P2) — apare fără `aria-live`/`role=status`; SR nu anunță → adaugă `aria-live="polite"`.
- `VoteButtonClient:68,86` (P3) — butoane fără `focus-visible:ring`; `handleShare:52-63` eșuează silențios → adaugă ring + fallback toast.
- `cont/page.tsx:425,940` (P3) — `setTimeout` fără cleanup → setState după unmount; guard `mounted`/ref+clearTimeout.

*NOTĂ pozitivă (referințe): `IstoricInteractive:329-362` are focus-trap complet; `Modal.tsx`, `AuthModal`, `PhotoUploader`, `MapLocationPicker` — de verificat individual.*

---

## 8. P6 — Arhitectură & navigare

**Conflicte rută (P0 — vezi §2):** `/impact` și `/buget` pagini-vii-dar-redirectate.

**Footer (P1):** `Footer.tsx` minimizat la Legal + Social, ZERO produs, ZERO contact.
- Adaugă coloană „Produs" (Sesizări, Petiții, Proteste, Întreruperi, Știri, Clasament) + „Resurse" (Cum funcționează, Ghiduri, Glosar, Întrebări frecvente, Drepturile cetățeanului).
- Adaugă „Contact" + email (`contact@civia.ro`) — **GDPR Art. 13** (identitatea operatorului) + UX.
- Fix `Footer.tsx:30` „Cum măsurăm trafic" → „Cum măsurăm traficul".

**Pagini orfane (P1) — adună într-o categorie „Date publice" (NAV_MORE sub-grup SAU footer):** `/compara`, `/verificare-avere`, `/statistici-sesizari-romania`, `/decizii-deschise`, `/initiative`, `/impact` (după de-redirect). Hub-uri SEO orfane (`/cum-functioneaza`, `/og-27-2002`, `/sesizare-vs-petitie`, `/avocatul-poporului-online`, `/drepturile-cetateanului`, `/intrebari-frecvente`, `/glosar`) → footer „Ghiduri & ajutor" + extinde `STATIC_PAGES` în `api/search/route.ts`.

**NAV_MORE „Explorează" (P1):** dropdown plat de 7 itemi eterogeni (acțiuni + date publice + învățare). Sub-grupează cu headere SAU split (acțiuni rămân, datele publice → footer). Adaugă descrieri sub itemi opaci („Promisometru", „Provocarea lunii").

**Dublări de scop (P1):** `/cum-fac/[tip]` (15) vs `/cum-functioneaza` vs `/ghiduri/ghid-sesizari` — declară `/cum-functioneaza` hub canonic, restul link înapoi / redirect. FAQ în 3 locuri (`HOMEPAGE_FAQ` + `/intrebari-frecvente` + per `/cum-fac`) → sursă unică `src/data/faq.ts`.

**Breadcrumbs lipsă (P1):** cele 9 ghiduri `/ghiduri/{ghid-ajutor-social, ghid-biciclist, ghid-contestatie-amenda, ghid-cutremur, ghid-dezbatere-publica, ghid-legea-544, ghid-ong, ghid-transport, ghid-vara}` — surorile au, acestea nu. Adaugă `<Breadcrumbs items={[{label:"Ghiduri",href:"/ghiduri"},{label:"<titlu>"}]} />`. (P2: `/promisometru/[slug]`, `/propuneri-legislative/[id]`, `/intreruperi/[id]`, `/compara/[a]/[b]`, `/sesizare/[oras]`.)

**Consolidări (P2):** `/calendar` vs `/calendar-civic`(→proteste) vs `/evenimente` — consolidează calendar+evenimente. `/compass-ue`, `/hackathons`, `/initiative`, `/scoala` — decide per pagină: nav/footer SAU redirect (arhivare). `evenimente/page.tsx:18-31` hero hand-rolled → `<PageHero>`.

**Inventare legale necoincidente (P1 — vezi și §2):** cookies/retenție divergente între `confidentialitate`, `cookie-policy`, `analiza-trafic`. Sursa de adevăr = `confidentialitate` (3 ani / vendori US+SCC / art. 7). Aliniază produsul (`cum-functioneaza:66` „24h", FAQ:195 „30 zile") + contradicția mailto vs trimitere automată (`confidentialitate:129`).

---

## 9. Ordinea de execuție pe valuri

**Val 1 — S (1-2h, zero-risc, livrabil azi): P0 copy + link-uri.**
Toate cele 18 one-liner P0 (§2 <5min) + ghilimele ASCII (P0-23) + art. 12→art. 7 (P0-19). Pur text, fără logică. *Dependențe: niciuna.* Verificare: `tsc + vitest`.

**Val 2 — S/M (2-4h): rute moarte + conflicte redirect + diacritice batch.**
P0-20/21/22 (impact/buget/rute moarte — necesită decizie creează-vs-redirect per rută), P0-24/25 (press kit + cod-județ). `istoric/page.tsx` batch diacritice (§3a). *Dependențe: P0-20/21 depind de decizia footer/nav din Val 5 (unde se linkează paginile de-redirectate).*

**Val 3 — M (1 zi): copy P1 site-wide + sweep-uri.**
§3b-3f: SesizareForm, petitii/[slug], intreruperi, propuneri-legislative + sweep `...`→`…`, helper `humanError()`, bare-arrow, anglicisme. §3g: consolidare CTA single-source + ștergere cod mort. *Dependențe: helper `humanError()` înainte de înlocuirile de „Eroare".*

**Val 4 — M (1 zi): uniformitate UI dark-mode-first.**
P2 §4: pills fără `dark:` (P1), modal QR (P1), cluster petiții „Semnează" (P1), apoi radius/shadow/spacing/tokens. *Dependențe: definește pattern-ul țintă (§4) și componenta `<Badge>`/`<Button>` ca referință înainte de migrări.*

**Val 5 — M/L (1-2 zile): IA & navigare.**
§8: footer (produs+resurse+contact), categoria „Date publice", sub-grupare NAV_MORE, breadcrumbs ×9 ghiduri, hub canonic cum-functioneaza, `src/data/faq.ts`, aliniere inventare legale. *Dependențe: footer/nav consumă deciziile din Val 2 (ce pagini rămân vii).* Deblochează linkarea orfanilor.

**Val 6 — L (2-3 zile): motion sistemic + a11y modale.**
P3 §5: `CountyPageHero` motion, consolidare `Card.tsx`/`card-lift`/`card-hover` + migrare 31 fișiere, `CountUp` unificat, dashboard-uri impact/clasament (CountUp+bar-grow). P5 §7: migrare modale hand-rolled la `Modal.tsx` (focus-trap). *Dependențe: consolidarea `.card-lift` înainte de migrarea celor 31 fișiere; `CountUp` unificat înainte de aplicare pe dashboard-uri.*

**Val 7 — TBD: P4 performanță** — blocat pe raportul `perf.md` (lacună). Rulează după ce apare.

**Dependențe cheie cross-val:** (1) Deciziile de rută (Val 2) precedă footer/nav (Val 5). (2) Helper-ele/componentele unificate (`humanError`, `<Badge>`, `.card-lift`, `CountUp`, CTA single-source) se definesc ÎNAINTE de sweep-urile care le folosesc. (3) Sursa de adevăr legală (`confidentialitate`) e referința pentru toate alinierile de copy legal.

---

## Numărătoare iteme / prioritate (dedup)

| Prioritate | Nr. grupe | Note |
|---|---|---|
| **P0** | ~25 | 18 one-liner copy + 7 grupe (rute/redirect/ghilimele/legal/cod-județ) |
| **P1** | ~70 | istoric batch (~18), copy site-wide (SesizareForm, petitii, intreruperi, propuneri), legal (art.7, retenție, Frankfurt, link OG), IA (footer, orfani, breadcrumbs, CTA single-source), UI dark-break (pills, QR, cluster petiții), motion dashboard (impact, clasament, CountyPageHero), a11y focus-trap (~10 modale) |
| **P2** | ~75 | uniformitate (gradiente, radius, shadow, spacing, badge, touch-target, focus-split), anglicisme, „Detalii →", consolidări rută |
| **P3** | ~90 | microcopy, abrevieri, săgeți bară, btn-press, stagger, chip AI, token short-form, border-2 raw |

*(Numerele sunt grupe deduplate; o „grupă" poate atinge mai multe linii/fișiere — ex. istoric batch = 1 grupă, ~18 string-uri.)*

---

## Cele mai sigure 20 fix-uri P0/P1 (aplicabile direct — verificate în cod)

Toate verificate prin `grep`/`ls` contra `src/app` la 13 iun 2026. Pur copy/text, zero risc logic.

| # | fișier:linie | vechi → nou |
|---|---|---|
| 1 | `src/data/intreruperi.ts:645` | `caldura: "Caldură",` → `caldura: "Căldură",` |
| 2 | `src/app/intreruperi/IntreruperiFilters.tsx:61` | `label: "Caldură"` → `label: "Căldură"` |
| 3 | `src/app/sesizari-rezolvate/page.tsx:80` | `Scris-am, au răspuns, au reparat.` → `Am scris, au răspuns, au reparat.` |
| 4 | `src/app/urmareste/page.tsx:22` | `Introdu codul de 6 caractere primit la trimitere.` → `Introdu codul de 5 cifre primit la trimitere.` |
| 5 | `src/components/sesizari/SesizariPublice.tsx:569` | `BEFORE` → `ÎNAINTE` |
| 6 | `src/components/sesizari/SesizariPublice.tsx:578` | `AFTER` → `DUPĂ` |
| 7 | `src/components/stiri/StiriList.tsx:358` | `>Featured<` → `>Recomandat<` |
| 8 | `src/app/sesizare/[oras]/page.tsx:111` | `Răspuns garantat în <strong>30 de zile</strong>.` → `Termen legal de răspuns: <strong>30 de zile</strong> (OG 27/2002).` |
| 9 | `src/app/sesizari/strada/[slug]/page.tsx:138` | `· Răspuns garantat 30 zile` → `· Termen legal de răspuns 30 de zile (OG 27/2002)` |
| 10 | `src/app/calendar/page.tsx:109` | `tagline="Awareness → participare."` → `tagline="De la informare la participare."` |
| 11 | `src/app/calendar/page.tsx:185` | `Today: {today}` → (elimină linia de debug) |
| 12 | `src/app/buget/simulator/page.tsx:23` | `tagline="Commit, apoi reveal — fără să tragi cu ochiul"` → `tagline="Întâi alegi, apoi vezi — fără să tragi cu ochiul"` |
| 13 | `src/app/impact/page.tsx:160` | `Actualizat la fiecare 2 minute.` → `Actualizat la fiecare 30 de minute.` |
| 14 | `src/app/verificare-avere/page.tsx:88` | `Scrapers ANI încep să ruleze post-deploy mig 090.` → `Datele se actualizează în curând. Revino mai târziu.` |
| 15 | `src/app/decizii-deschise/page.tsx:77` | `Scrapers încep să ruleze post-deploy mig 090.` → `Propunerile apar în curând.` |
| 16 | `src/app/compass-ue/page.tsx:92` | `Scrapers încep să ruleze post-deploy mig 090.` → `Programele apar în curând.` |
| 17 | `src/app/intreruperi/page.tsx:135` | `${scrapedCount} entry scrapuite în ultimele 7 zile` → `${scrapedCount} anunțuri colectate în ultimele 7 zile` |
| 18 | `src/app/intreruperi/page.tsx:249` | `Subscribe RSS` → `Abonează-te RSS` |
| 19 | `src/app/glosar/page.tsx:51` | `OG 27/2002 art. 12 spune că petițiile anonime` → `OG 27/2002 art. 7 spune că petițiile anonime` |
| 20 | `src/app/page.tsx:29` | `optional adaugi 1-5 poze` → `opțional adaugi 1-5 poze` |

> Notă pentru #8: numărul liniei trimite la fragmentul JSX cu `<strong>30 de zile</strong>`. La aplicare, înlocuiește textul din jur exact ca mai sus.
> Notă pentru #19: aceeași corecție „art. 12"→„art. 7" se aplică identic în `cum-functioneaza/page.tsx:36`, `og-27-2002/page.tsx:49`, `intrebari-frecvente/page.tsx:51` (P0-19).
