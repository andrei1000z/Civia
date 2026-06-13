# Audit MOTION — Civia.ro

Status: COMPLET. Inventariere unde EXISTĂ motion și unde LIPSEȘTE dar surori îl au.

## Primitive existente (sursă)

`src/app/globals.css`:
- `.hero-enter-1/2/3` (L742-744) — fadeInUp stagger title/desc/tagline, folosit de PageHero.
- `.animate-scale-in` (L751) — icon chips, badge-uri.
- `.stagger-children > *` (L755-767) — stagger pe copii direcți, cap la 12.
- `.reveal` / `.reveal.is-visible` (L773-779) — scroll-reveal (componenta `Reveal.tsx`).
- `.reveal .bar-grow` (L784-788) — bare care „cresc" la intrare în viewport.
- `.card-lift` (L792-796) — lift hover + press; CANONIC. „Înlocuiește amestecul de hover:-translate-y-0.5/-1".
- `.card-hover` (L1152-1175) — A DOUA utilitară de hover card (translateY(-2px), shadow-lg). DUPLICAT cu card-lift.
- `.btn-press` (L799-800) — press feedback pe butoane.
- `.animate-fade-in-up` / `.animate-toast-in` / `.animate-fade-in` (L714-730).
- `main#main-content > *` pageEnter (L1118-1120) — fade pe fiecare navigație.
- `.skeleton-shimmer` (L1186-1200) — alternativă la animate-pulse pt blocuri mari.
- `prefers-reduced-motion` guards: L455-462 (global), L1023-1035, L1122-1126, L1169-1175, L1196-1201. Componente JS (`Reveal`, `CountUp` ui + home) verifică matchMedia.

Componente: `src/components/ui/Reveal.tsx`, `src/components/ui/CountUp.tsx`, `src/components/home/CountUp.tsx`.

## Constatări

### Duplicare primitive / componente
- [P2] · `src/components/ui/CountUp.tsx` + `src/components/home/CountUp.tsx` · PROBLEMĂ: DOUĂ componente CountUp distincte. `ui/CountUp` (props `value`, ease-out-quart, 900ms) vs `home/CountUp` (props `to/suffix/prefix/decimals/separator`, ease-out-cubic, 1500ms). API divergent, easing divergent, durată divergentă. · FIX: consolidează la una singură (ui/CountUp extins cu suffix/prefix/decimals) sau documentează clar de ce există două; aliniază easing+durata (900ms ease-out-expo).
- [P2] · `src/app/globals.css:792` + `:1152` · PROBLEMĂ: DOUĂ utilitare hover card — `.card-lift` (translateY(-3px), shadow-3, 0.25s) și `.card-hover` (translateY(-2px), shadow-lg, border-primary, 0.18s). Comentariul card-lift spune că „înlocuiește amestecul". · FIX: alege card-lift ca unic; migrează utilizatorii card-hover; sau documentează distincția (card-hover = border-primary la hover).

### Carduri cu hover hand-rolled în loc de card-lift (surori folosesc card-lift)
- [P2] · `src/components/home/TopVotedWidget.tsx:103` · PROBLEMĂ: `hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-3)] transition-all` hand-rolled; lista ARE `stagger-children` (L96) dar cardurile NU folosesc `.card-lift`. · FIX: adaugă `card-lift` la className-ul Link-ului (păstrează border-hover dacă vrei accent).
- [P2] · `src/components/home/IntreruperiWidget.tsx:45` · PROBLEMĂ: `hover:shadow-[var(--shadow-3)] hover:border-[var(--color-primary)]/30 transition-all` hand-rolled; lista ARE `stagger-children` (L39) dar cardurile NU folosesc `.card-lift`. · FIX: adaugă `card-lift`.

### Butoane fără btn-press (surori îl folosesc)
- [P3] · `src/components/stiri/StiriList.tsx:462` · PROBLEMĂ: butonul „Încarcă mai multe" — `transition-colors` fără `btn-press`. · FIX: adaugă `btn-press`.
- [P3] · `src/components/stiri/StiriList.tsx:214` · PROBLEMĂ: chips filtru categorie — `transition-all` fără `btn-press` (feedback tactil la tap). · FIX: adaugă `btn-press`.
- [P3] · `src/components/sesizari/SesizariPublice.tsx:648` · PROBLEMĂ: „Încarcă mai multe sesizări" fără `btn-press`. · FIX: adaugă `btn-press`.
- [P3] · `src/components/sesizari/SesizariPublice.tsx:413` · PROBLEMĂ: „Reîncearcă" (error state) fără `btn-press`. · FIX: adaugă `btn-press`.
- [P3] · `src/components/sesizari/SesizariPublice.tsx:451` · PROBLEMĂ: CTA „Fă o sesizare acum" (empty state) fără `btn-press`. · FIX: adaugă `btn-press`.

### Tranziții abrupte (apariții fără fade)
- [P3] · `src/components/sesizari/SesizariPublice.tsx:404/423` · PROBLEMĂ: error-state și empty-state apar abrupt (fără `animate-fade-in`) după loading. Filter panel-ul ARE `animate-fade-in` (L298). · FIX: wrap în `animate-fade-in`.

### Statistici fără CountUp (numere flagship statice)
- [P1] · `src/app/impact/page.tsx:310-312` (KpiCard) · PROBLEMĂ: cele 4 KPI mari (Sesizări depuse / Trimise oficial / Rezolvate / Ignorate) randează `value.toLocaleString("ro-RO")` static. Homepage + promisometru folosesc `CountUp` pe numere similare. /impact ESTE dashboard-ul de cifre — exact locul pt CountUp. · FIX: `<CountUp value={value} />` în loc de `{value.toLocaleString(...)}`.
- [P1] · `src/app/clasament/page.tsx:300` · PROBLEMĂ: scorul național flagship `{nationalScore}%` (text-6xl) e static. · FIX: `<CountUp value={nationalScore} />%`.
- [P2] · `src/app/clasament/page.tsx:303-304` · PROBLEMĂ: `nationalResolved`/`nationalTotal` în subtitlu — statice. · FIX: CountUp opțional (P2, sub flagship).
- [P2] · `src/app/clasament/page.tsx:332/390` · PROBLEMĂ: `{c.fixScore}%` pe podium + listă — statice (numere de impact). · FIX: CountUp (opțional pe listă, P3; pe podium P2).
- [P3] · `src/app/petitii/page.tsx:315` · PROBLEMĂ: `external_signature_count.toLocaleString` static (semnături — număr motivant). · FIX: CountUp opțional.

### Bare fără bar-grow (singura folosire e promisometru)
`.reveal .bar-grow` e folosit DOAR în `src/app/promisometru/page.tsx:83`. Toate celelalte bare cresc instant (abrupt) sau doar `transition-all` (animă la schimbare de prop, nu la intrare în viewport).
- [P1] · `src/app/impact/page.tsx:325` (FunnelRow) · PROBLEMĂ: barele pâlniei au `transition-all` dar lățimea e setată la paint → apar pline, fără „creștere". Pâlnia e elementul vizual central al paginii. · FIX: wrap secțiunea în `<Reveal>` și pune `bar-grow` pe fill (`<div className="h-full ... bar-grow">`).
- [P1] · `src/app/impact/page.tsx:237` (status distribution) · PROBLEMĂ: bare status fără bar-grow/Reveal. · FIX: idem.
- [P2] · `src/app/impact/page.tsx:269` (top județe) · PROBLEMĂ: bare top-județe fără bar-grow/Reveal. · FIX: idem.
- [P2] · `src/app/clasament/page.tsx:378-382` · PROBLEMĂ: barele de fix-rate per județ (lista „Restul județelor") — `transition-all`, nu cresc la viewport. · FIX: `bar-grow` pe fill + wrap în Reveal/secțiune reveal.
- [P2] · `src/app/clasament/page.tsx:472-474` · PROBLEMĂ: barele de fix-rate „Top zone" — fără tranziție deloc + fără bar-grow. · FIX: idem.
- [P2] · `src/components/promisiuni/PromisometruList.tsx:57-60` (ProgressBar) · PROBLEMĂ: bara „% perioadă trecută" pe carduri are `transition-all` dar nu `bar-grow` (deși pagina părinte folosește bar-grow pe gauge-ul mare). · FIX: bar-grow opțional (cardurile sunt deja în `.reveal`? NU — sunt în stagger; ar trebui Reveal pentru bar-grow).

### Carduri hover hand-rolled în loc de card-lift (anti-patternul din AGENTS)
AGENTS: card-lift „Înlocuiește amestecul de hover:-translate-y-0.5/-1 + durate diferite".
- [P2] · `src/app/[judet]/sesizari/page.tsx:136` · PROBLEMĂ: quick-links — `hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-3)] hover:-translate-y-0.5 transition-all` (EXACT amestecul interzis). Grid-ul nu are nici `stagger-children`. · FIX: înlocuiește cu `card-lift`; adaugă `stagger-children` pe grid (L123).
- [P2] · `src/app/clasament/page.tsx:322` (podium top 3) · PROBLEMĂ: `hover:-translate-y-1 hover:shadow-[var(--shadow-3)] transition-all` hand-rolled (grid ARE stagger-children L315). · FIX: `card-lift`.
- [P2] · `src/app/clasament/page.tsx:365` („Restul județelor") · PROBLEMĂ: `hover:shadow-[var(--shadow-2)] hover:border... transition-all` hand-rolled. · FIX: `card-lift`.
- [P2] · `src/app/clasament/page.tsx:549` (Ambasadori) · PROBLEMĂ: `hover:shadow-[var(--shadow-2)] hover:border... transition-all` hand-rolled. · FIX: `card-lift`.

### Liste fără stagger-children (surori îl au)
- [P2] · `src/app/clasament/page.tsx:357` („Restul județelor"), `:455` („Top zone"), `:502` („Cetățeni cu impact"), `:544` („Ambasadori") · PROBLEMĂ: 4 liste de carduri/rânduri fără `stagger-children`, deși secțiunea „Top 3 județe" (L315) din aceeași pagină îl are. Apariție abruptă a întregului bloc. · FIX: adaugă `stagger-children` pe fiecare grid/listă.
- [P2] · `src/app/petitii/page.tsx:196` (petiții ÎNCHEIATE) · PROBLEMĂ: grid-ul closed are doar `opacity-80`, fără `stagger-children` — grid-ul active (L174) îl are. · FIX: adaugă `stagger-children` (păstrează opacity-80).
- [P3] · `src/app/[judet]/sesizari/page.tsx:123` (quick-links) · PROBLEMĂ: grid quick-links fără stagger. · FIX: `stagger-children`.
- [P2] · `src/app/impact/page.tsx:228` (status) + `:262` (top județe `<ol>`) · PROBLEMĂ: liste `space-y-2` fără stagger; doar secțiunea KPI (L169) are stagger. · FIX: `stagger-children` pe containerul listei.

### Butoane/pills fără btn-press (suplimentar)
- [P3] · `src/components/promisiuni/PromisometruList.tsx:203/224/254` · PROBLEMĂ: pills sortare/status/autoritate folosesc `transition`/`transition` fără `btn-press`. · FIX: adaugă `btn-press`.
- [P3] · `src/app/petitii/page.tsx:137/145` · PROBLEMĂ: CTA „Inițiază o petiție" / „Propune o petiție existentă" — `transition-colors` fără `btn-press`. · FIX: `btn-press`.
- [P3] · `src/app/petitii/page.tsx:224` · PROBLEMĂ: CTA empty-state „Fă o sesizare" fără `btn-press`. · FIX: `btn-press`.

### Hero județean fără motion (afectează ~14 pagini × 42 județe)
- [P1] · `src/components/county/CountyPageHero.tsx:94/87/108/116` · PROBLEMĂ: heroul de județ NU folosește `hero-enter-1/2/3` pe h1/descriere/tagline, nici `animate-scale-in` pe icon-chip — spre deosebire de `PageHero` (național) care le are pe toate. Inconsistență vizibilă: paginile naționale animă heroul la intrare, cele de județ apar abrupt. Multiplicat pe TOATE rutele `/[judet]/*`. · FIX: aplică `hero-enter-1` pe `<h1>` (L94), `hero-enter-2` pe `<p>` descriere (L108), `hero-enter-3` pe tagline (L113) + children (L120), `animate-scale-in` pe icon-chip (L83).

### Pagina de județ (`/[judet]`) — grilă fără motion (anti-pattern recurent, ×42 rute)
Pagina home a fiecărui județ — surplus de carduri cu hover hand-rolled, fără stagger, fără card-lift.
- [P2] · `src/app/[judet]/page.tsx:218` (tiles statistici), `:551`, `:899`, `:936` · PROBLEMĂ: 4 grupe de carduri folosesc `hover:shadow-[var(--shadow-X)] hover:-translate-y-0.5 transition-all` hand-rolled (amestecul interzis de AGENTS). NICIUNUL nu are `stagger-children`. · FIX: `card-lift` pe carduri + `stagger-children` pe containerele grid (L211 etc.).
- [P2] · `src/app/[judet]/page.tsx` (hero custom) · PROBLEMĂ: heroul paginii de județ e custom (nu CountyPageHero) și nu are hero-enter; CTA-urile albe (L740/747/980) folosesc `active:scale-[0.97]` inline în loc de `.btn-press`. · FIX: `hero-enter-*` pe titlu/descriere/CTA-row; înlocuiește `active:scale-[0.97]` cu `btn-press`.

### Quick-link grids sesizari (anti-pattern recurent)
- [P2] · `src/app/sesizari/page.tsx:147` · PROBLEMĂ: quick-links — `hover:shadow-[var(--shadow-3)] hover:-translate-y-0.5 hover:border... transition-all` hand-rolled; grid (L134) fără `stagger-children`. · FIX: `card-lift` + `stagger-children`.
- [P2] · `src/app/ghiduri/page.tsx:59` · PROBLEMĂ: cardurile de ghid — `hover:-translate-y-1 hover:shadow-[var(--shadow-4)] transition-all` hand-rolled; grid (L54) fără `stagger-children`. · FIX: `card-lift` + `stagger-children`.

### Triplicare utilitară hover card (sursa anti-patternului)
- [P1] · `src/components/ui/Card.tsx:25` · PROBLEMĂ: prop `hover` randează `hover:-translate-y-0.5 hover:shadow-[var(--shadow-3)] hover:border-[var(--color-primary)]/40 active:translate-y-0` — A TREIA implementare divergentă de card-hover (pe lângă `.card-lift` -3px/250ms și `.card-hover` -2px/180ms). Valori diferite (translateY -0.5 vs -3px), durate diferite. Componentă folosită larg → propagă inconsistența. · FIX: fie `Card hover` delegă la clasa `.card-lift`, fie aliniază valorile la card-lift (translateY -3px, durata 0.25s). O singură sursă de adevăr.

### Modale / overlay-uri (OK — referință corectă)
- OK · `src/components/ui/Modal.tsx:124/144` · backdrop `animate-fade-in` + dialog `animate-modal-pop` (modalPop 0.22s ease-out-expo, L813). Focus-trap + body scroll-lock. Reduced-motion via guard global. Model corect pentru orice modal nou.

### Homepage StiriWidget — hover hand-rolled + listă fără stagger
- [P2] · `src/components/home/StiriWidget.tsx:101` (featured) + `:151` (items compacte) · PROBLEMĂ: `hover:shadow-[var(--shadow-X)] hover:border... transition-all` hand-rolled, nu `card-lift`. · FIX: `card-lift`.
- [P2] · `src/components/home/StiriWidget.tsx:146` (`<ul>`) · PROBLEMĂ: lista compactă de 5 articole fără `stagger-children` (sora `TopVotedWidget`/`IntreruperiWidget` îl au). · FIX: `stagger-children`.

### Skeleton-uri loading.tsx generice (layout shift la prima vopsire)
- [P2] · `src/app/stiri/loading.tsx` · PROBLEMĂ: skeleton generic (titlu + 1 rând + 1 bloc 64px) care NU seamănă cu layout-ul real /stiri (PageHero gradient + bară filtre chips + card featured + grid 3-col). La hidratare se vede un salt vizual (skeleton → layout cu totul altă formă). · FIX: skeleton mai apropiat de structura reală (bloc hero + rând de chips + grid de carduri cu `skeleton-shimmer`).
- [P2] · `src/components/stiri/StiriList.tsx:276` · PROBLEMĂ: la încărcarea DATELOR (după ce route shell-ul e deja pictat) afișează un `Loader2` spinner centrat, NU un skeleton de carduri — spre deosebire de `SesizariPublice` (care randează 4 skeleton-carduri). Spinner unde ar trebui skeleton + salt de la spinner la grid. · FIX: skeleton-grid de carduri (ca în SesizariPublice L389-401), opțional cu `skeleton-shimmer`.
- [P3] · `src/app/sesizari/loading.tsx` + alte `loading.tsx` · PROBLEMĂ: același skeleton generic 3-bloc, indiferent de pagina reală. · FIX: aproximează structura paginii (hero + carduri).

### Alte carduri hover hand-rolled (eșantion — pattern e larg, 31 fișiere)
- [P2] · `src/app/proteste/page.tsx:328` · PROBLEMĂ: card protest `hover:border... hover:shadow-[var(--shadow-2)] transition-all` fără card-lift. · FIX: `card-lift`.
- [P3] · `src/components/county/CountyStatCards.tsx:67` (variant grid) · PROBLEMĂ: grid de 4 stat-carduri fără `stagger-children` (apare pe /[judet] mobile). · FIX: `stagger-children` (opțional; stat-carduri necliccabile, deci fără card-lift).
- NOTĂ · Grep `hover:-translate-y|hover:shadow-[var(--shadow` → 31 fișiere. Pattern recurent: fiecare suprafață de carduri și-a hand-rollat hover-ul. Recomandare sistemică: o singură primitivă `.card-lift` aplicată peste tot (vezi triplicarea Card.tsx/card-lift/card-hover de mai sus).

### Elemente OK (referințe — păstrează)
- OK · `src/app/sesizari/[code]/page.tsx:556` — timeline `<ol stagger-children>`; nodul curent `animate-pulse` (L584). Corect.
- OK · `src/app/promisometru/page.tsx:65,83` — singura folosire corectă de `Reveal` + `bar-grow` pe gauge; `CountUp` pe procent (L71). Model de urmat pentru toate barele/statisticile.
- OK · `src/components/sesizari/SesizariPublice.tsx:389` — skeleton-carduri la load + `stagger-children` + `card-lift` pe carduri. Referință pentru liste async.
- OK · `src/components/layout/PageHero.tsx:101,115,119,124,129` — hero-enter-1/2/3 + animate-scale-in pe icon. Model pentru orice hero (de replicat în CountyPageHero).
- OK · `src/components/home/LiveStatsBar.tsx:98,116` — ticker cu `height` fix (zero CLS) + `animate-ticker` reduced-motion-guarded.

## Top 10

1. [P1] `src/components/county/CountyPageHero.tsx` — heroul de JUDEȚ nu are `hero-enter-1/2/3` / `animate-scale-in` (PageHero național le are). Afectează ~14 pagini × 42 județe; toate intră abrupt. Replică structura din PageHero.
2. [P1] `src/app/impact/page.tsx` — dashboard-ul de cifre nu folosește `CountUp` (KpiCard L310) nici `bar-grow`+`Reveal` (FunnelRow L325, status L237, top-județe L269). Cele mai vizibile statistici ale produsului, complet statice.
3. [P1] `src/app/clasament/page.tsx:300` — scorul național flagship `{nationalScore}%` (text-6xl) static; bare fix-rate fără bar-grow; 4 liste fără stagger; podium cu hover hand-rolled. Cea mai „celebrativă" pagină, fără motion celebrativ.
4. [P1] `src/components/ui/Card.tsx:25` — a TREIA implementare divergentă de card-hover (pe lângă `.card-lift` și `.card-hover`). Sursa sistemică a inconsistenței. Consolidează pe `.card-lift`.
5. [P2] `src/app/[judet]/page.tsx` (L218/551/899/936) — home-ul de județ (×42) are 4 grupe de carduri cu hover hand-rolled `hover:-translate-y-0.5 transition-all` + zero stagger + zero hero-enter. Anti-patternul interzis de AGENTS, multiplicat.
6. [P2] Quick-link grids sesizari — `src/app/sesizari/page.tsx:147`, `src/app/[judet]/sesizari/page.tsx:136`, `src/app/ghiduri/page.tsx:59` — toate hand-rolled, fără card-lift, fără stagger. Înlocuiește cu `card-lift` + `stagger-children`.
7. [P2] Bare fără `bar-grow` peste tot — `bar-grow`+`Reveal` e folosit DOAR în promisometru. Impact (pâlnie/status/top-județe), clasament (fix-rate), promisometru cards — toate cresc instant. Adaugă bar-grow pe fill + Reveal pe secțiune.
8. [P2] Liste fără `stagger-children` — clasament (4 liste), petiții închise (L196), StiriWidget `<ul>` (L146), impact (status/top-județe), CountyStatCards. Surorile din aceleași pagini au stagger → inconsistență vizibilă.
9. [P2] `src/components/home/TopVotedWidget.tsx:103` + `IntreruperiWidget.tsx:45` + `StiriWidget.tsx:101/151` — carduri pe homepage cu hover hand-rolled în loc de `card-lift` (deși au stagger). Prima impresie a produsului.
10. [P2] Skeleton-uri loading + StiriList spinner — `stiri/loading.tsx` generic (nu seamănă cu layout-ul real → salt), `StiriList.tsx:276` spinner unde ar trebui skeleton-grid. Sister-ul SesizariPublice randează skeleton-carduri corect.

### Recomandări sistemice (transversale)
- O singură primitivă de hover card (`.card-lift`); migrează cele 31 de fișiere cu hover hand-rolled + propul `Card hover` + `.card-hover`.
- O singură componentă `CountUp` (consolidează `ui/` și `home/`); aliniază easing (ease-out-expo) + durata.
- Pattern „statistică care numără" + „bară care crește" (CountUp + Reveal+bar-grow) aplicat pe TOATE dashboard-urile (impact, clasament, compara, statistici-judete).
- `CountyPageHero` să oglindească exact motion-ul din `PageHero` (un fix → ~14×42 rute animate).
- `btn-press` pe toate butoanele primare/CTA + pills de filtru (azi e pe ~5 fișiere).
- `prefers-reduced-motion`: guard global solid (L455) + componentele JS verifică matchMedia. NU am găsit animații care scapă de guard — acoperirea reduced-motion e CORECTĂ. Singura recomandare: la consolidare, păstrează guard-urile existente.

(de completat la final)
