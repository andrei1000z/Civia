# Audit IA + Navigare — Civia.ro

Status: FINAL · 13 iunie 2026

Surse citite: `src/lib/constants.ts` (NAV_LINKS / NAV_MORE / NAV_DATE_PUBLICE / GHID_DROPDOWN / CTA), `src/lib/copy/cta.ts`, `src/components/layout/Navbar.tsx`, `src/components/layout/Footer.tsx`, `src/app/sitemap.ts`, `src/proxy.ts`, `src/components/ui/SearchModal.tsx`, `src/app/api/search/route.ts` (STATIC_PAGES), `src/app/page.tsx`, `src/app/not-found.tsx`, `src/components/sesizari/SuccessScreen.tsx`, `src/components/ui/Breadcrumbs.tsx`, `src/data/cum-fac-tipuri.ts`, lista completă a celor ~100 rute din `src/app`.

Structura nav actuală:
- NAV_LINKS (top-level): Sesizări · Petiții · Știri · Proteste · Întreruperi (5 itemi)
- NAV_MORE („Explorează"): Provocarea lunii · Cere informații (544) · Promisometru · Bugetare participativă · Ghiduri civice · Propuneri legislative · Clasament primării (7 itemi, dropdown plat)
- Footer: DOAR legal (4 link-uri + buton cookies) + social (Bluesky, eYou) + ThemeToggle + copyright. ZERO link-uri de produs/conținut, ZERO contact.
- Home: linkuri doar către /sesizari, /petitii, /sesizari-publice + widgets.
- Search modal: STATIC_PAGES = 11 pagini hardcodate.

---

## 1. Pagini valoroase ORFANE (neaccesibile din nav / footer / home)

Pagini cu `metadata.title` lucrat, în sitemap, dar invizibile pentru userul mediu (doar search-dacă-sunt-în-STATIC_PAGES sau cross-link accidental).

- [P0] · `src/app/impact/page.tsx` + `src/proxy.ts:64` · PROBLEMĂ: `/impact` e SIMULTAN pagină completă („Impactul Civia — cifre publice") ȘI în `LEGACY_REDIRECTS` (`"/impact": "/"`) → ruta e 308-redirectată la home. Pagina e MOARTĂ: utilizatorul nu o poate vedea deloc, deși fișierul + sitemap (n-o conține, dar /scoala o linkează) o presupun vie. Bug clar. FIX: șterge linia `"/impact": "/",` din LEGACY_REDIRECTS și adaugă „Impact" în footer/NAV_MORE; SAU șterge fișierul dacă pagina e abandonată.
- [P0] · `src/proxy.ts:51` + `src/app/buget/*` · PROBLEMĂ: `/buget` → redirect la home, dar `/buget/simulator` și `/buget/personal` EXISTĂ și-s accesibile (linkate doar reciproc + din /bugetare-participativa). Parent mort, copii vii, niciun hub, niciun breadcrumb. User aterizat pe /buget/simulator n-are cale spre un index /buget. FIX: ori restaurează `/buget` ca hub (scoate din redirect) + linkează-l, ori mută simulator/personal sub `/bugetare-participativa/*`.
- [P1] · `src/app/compara/page.tsx` (+ `/compara/[a]/[b]`) · PROBLEMĂ: „diferențiatorul platformei" (cuvintele din proxy.ts:50), restaurat în sitemap, dar NU e în NAV_LINKS, NAV_MORE, Footer, Home. Inaccesibil din UI. FIX: adaugă în NAV_MORE „Compară județe" (icon 🆚) sau secțiune footer „Date publice".
- [P1] · `src/app/statistici-sesizari-romania/page.tsx` · PROBLEMĂ: orfan (singurul link: /press). Priority 0.8 în sitemap, SEO + dataset deschis, zero acces din nav. FIX: footer „Date publice" + STATIC_PAGES în search.
- [P1] · `src/app/verificare-avere/page.tsx` („Verificare avere demnitari — Top salturi suspecte") · PROBLEMĂ: orfan TOTAL (zero cross-link). Conținut cu potențial civic/viral mare, complet ascuns. FIX: NAV_MORE „Date publice".
- [P1] · `src/app/decizii-deschise/page.tsx` („Decizii Deschise — Propuneri consiliu local") · PROBLEMĂ: orfan total. FIX: NAV_MORE „Date publice" sau consolidare.
- [P1] · `src/app/initiative/page.tsx` („Inițiative cetățenești") · PROBLEMĂ: orfan total (doar self-link `/initiative/nou`). FIX: NAV_MORE sau redirect dacă feature abandonat.
- [P2] · `src/app/calendar/page.tsx` („Calendar civic") · PROBLEMĂ: orfan; `/calendar-civic`→/proteste e redirectat, dar `/calendar` fără sufix e o pagină separată neaccesibilă. Posibil duplicat cu /evenimente+/proteste. FIX: link în NAV_MORE sau consolidare (vezi §8).
- [P2] · `src/app/evenimente/page.tsx` · PROBLEMĂ: orfan din nav/footer/home (doar cross-link din /evenimente/[slug]). Versiunea county-aware are link din pagina județului; cea națională e ascunsă. FIX: NAV_MORE sau consolidează cu /calendar.
- [P2] · `src/app/compass-ue/page.tsx` („Compass UE — Apeluri de finanțare") · PROBLEMĂ: orfan (doar self-link `/compass-ue/profil`). Nișă. FIX: decide — NAV_MORE sau redirect la home (arhivare).
- [P2] · `src/app/scoala/page.tsx` („Civia pentru școli") · PROBLEMĂ: orfan total. FIX: footer „Despre Civia" → „Pentru școli".
- [P2] · `src/app/hackathons/page.tsx` („Civic Hackathons") · PROBLEMĂ: orfan total. FIX: footer/press; altfel arhivare.
- [P2] · `src/app/glosar/page.tsx` („Glosar civic — 50+ termeni") · PROBLEMĂ: nu e în nav/footer/home; reachable doar cross-link (intrebari-frecvente, drepturile-cetateanului) + search. Valoros SEO + AI. FIX: footer „Resurse" + link din /ghiduri index.
- [P2] · Hub-uri SEO orfane din nav vizibil: `/cum-functioneaza` (priority 0.9), `/og-27-2002` (0.9), `/sesizare-vs-petitie` (0.85), `/avocatul-poporului-online` (0.85), `/drepturile-cetateanului` (0.8), `/intrebari-frecvente` (0.85) · PROBLEMĂ: accesibile DOAR prin cross-link între ele + search; niciunul nu e în nav top/more sau footer. Userul care vrea „cum funcționează" nu are unde da click. FIX: secțiune footer „Ghiduri & ajutor" cu Întrebări frecvente + Cum funcționează + Drepturile cetățeanului.
- [P3] · `src/app/press/page.tsx` („Press kit") · PROBLEMĂ: orfan; standard ca footerul să aibă „Presă/Media". FIX: footer „Despre Civia" → „Presă".
- [P3] · `/cum-fac` + `/cum-fac/[tip]` (15 ghiduri SEO) · PROBLEMĂ: reachable doar cross-link din /sesizare/[oras]. Nu în nav. Vezi §3 (duplicare). FIX: link în /cum-functioneaza ca index.

## 2. Meniu — supraîncărcare + „Explorează" incoerent

- [P1] · `src/lib/constants.ts:103-130` NAV_MORE · PROBLEMĂ: dropdown PLAT de 7 itemi care amestecă 3 tipuri fără sub-grupare: acțiuni (Provocarea lunii, Cere informații 544, Bugetare participativă), date publice (Promisometru, Clasament primării), învățare (Ghiduri civice, Propuneri legislative). Relație neclară → decision fatigue. FIX: sub-grupare cu headere în dropdown („Acțiuni" / „Date publice" / „Învață") SAU split — acțiunile rămân în „Explorează", datele publice trec într-un footer „Date publice".
- [P1] · Familie „date publice" FRAGMENTATĂ · PROBLEMĂ: NAV_MORE are Clasament + Promisometru + Bugetare, dar surorile lor (`/compara`, `/impact`, `/verificare-avere`, `/statistici-sesizari-romania`, `/decizii-deschise`) sunt orfane (§1). Jumate în meniu, jumate invizibile — categoria nu există coerent. FIX: o singură categorie „Date publice" care le adună pe toate.
- [P2] · `src/lib/constants.ts:122` label „Promisometru" / `:118` „Provocarea lunii" · PROBLEMĂ: jargon intern, opac pentru user nou; dropdown-ul nu are excerpt/subtitlu (ca SearchModal QUICK_ACTIONS). FIX: adaugă o linie de descriere sub fiecare item în dropdown.
- [P3] · NAV top-level 5 itemi · OBSERVAȚIE: „Întreruperi" promovat recent în top (2026-06-03). 5 itemi e încă rezonabil, dar „Întreruperi" + „Știri" sunt browse-passive lângă 2 acțiuni (Sesizări/Petiții) + 1 urgency (Proteste) — mix de altitudini. Acceptabil, doar de monitorizat.

## 3. Dublări de scop (cum-fac vs ghiduri vs faq vs cum-functioneaza)

- [P1] · `/cum-fac/[tip]` (15 tipuri, `src/data/cum-fac-tipuri.ts`) vs `/cum-functioneaza` vs `/ghiduri/ghid-sesizari` · PROBLEMĂ: TREI surse paralele explică „cum faci o sesizare", cu pași+FAQ+temei legal suprapuse. SEO-cannibalization + user confuz care-i canonic. FIX: declară `/cum-functioneaza` hub canonic; `/cum-fac/[tip]` rămâne landing SEO per-problemă DAR link clar înapoi la hub; `/ghiduri/ghid-sesizari` → consolidează/redirect la /cum-functioneaza.
- [P2] · FAQ în 3 locuri: `HOMEPAGE_FAQ` (page.tsx) + `/intrebari-frecvente` + FAQ per `/cum-fac/[tip]` · PROBLEMĂ: aceleași Q&A (OG 27/2002, 30 zile, gratuit) cu wording diferit → risc de inconsistență + dublu mentenanță. FIX: o sursă unică `src/data/faq.ts` reutilizată în homepage JSON-LD + /intrebari-frecvente.
- [P1] · DOUĂ surse „single source of truth" pentru CTA, DIVERGENTE: `src/lib/constants.ts:45` (`CTA.PETITION_HERO="Semnează petiția"`, `CTA.SESIZARE_VIEW="Vezi detalii"`) vs `src/lib/copy/cta.ts:12` (`CTA.PETITIE_HERO="Vezi petițiile civice"`, `CTA.SESIZARE_VIEW="Vezi sesizarea"`). Ambele se autodeclară „single source of truth". `copy/cta.ts` contrazice convenția AGENTS.md („petiții hero = Semnează petiția"). FIX: consolidează într-un singur fișier; aliniază valorile la AGENTS.md (PETITIE_HERO = „Semnează petiția").
- [P2] · `GHID_DROPDOWN` (`constants.ts:133-148`) · PROBLEMĂ: export MORT — grep confirmă că e referit DOAR în constants.ts (niciun component nu-l importă). 11 ghiduri ce dublează structura din /ghiduri. FIX: șterge codul mort (sau implementează mega-menu dacă era intenția).
- [P2] · `NAV_DATE_PUBLICE = []` (`constants.ts:131`) · PROBLEMĂ: export gol neutilizat — rămășiță. FIX: șterge.

## 4. Breadcrumbs lipsă pe sub-pagini adânci

`src/components/ui/Breadcrumbs.tsx` există (vizual + BreadcrumbList JSON-LD), folosit pe ~25 pagini, dar lipsește exact unde contează cel mai mult:

- [P1] · CELE 9 ghiduri `/ghiduri/{ghid-ajutor-social, ghid-biciclist, ghid-contestatie-amenda, ghid-cutremur, ghid-dezbatere-publica, ghid-legea-544, ghid-ong, ghid-transport, ghid-vara}` · PROBLEMĂ: ZERO breadcrumb, deși surorile lor (`ghid-sesizari`, `ghid-cetatean`, `ghid-parinti`) AU. Inconsistență flagrantă + pierdere SEO BreadcrumbList + user adânc fără cale înapoi la /ghiduri. FIX: `<Breadcrumbs items={[{label:"Ghiduri",href:"/ghiduri"},{label:"<titlu>"}]} />` pe fiecare.
- [P2] · `/promisometru/[slug]`, `/propuneri-legislative/[id]`, `/intreruperi/[id]`, `/compara/[a]/[b]` · PROBLEMĂ: fără breadcrumb (unele au doar buton „înapoi" hardcodat). FIX: Breadcrumbs cu trail-ul corect (ex `Acasă › Promisometru › <primar>`).
- [P3] · Pagini orfane fără breadcrumb: `/buget/simulator`, `/buget/personal`, `/bugetare-participativa`, `/informatii-publice`, `/calendar`, `/initiative`, `/decizii-deschise`, `/verificare-avere`, `/compass-ue`, `/scoala`, `/hackathons`, `/u/[slug]` · PROBLEMĂ: niciun return-path. FIX: breadcrumb minim acolo unde rămân în produs.

## 5. Footer — acoperire legal + contact + social

- [P1] · `src/components/layout/Footer.tsx` · PROBLEMĂ: footerul a fost minimizat la 2 coloane (Legal + Social), ZERO link-uri de produs/conținut. Pentru un site cu ~40 rute publice, footerul ar trebui să fie a doua suprafață de descoperire (sitemap uman) — acum nu salvează niciun orfan din §1. FIX: adaugă 2 coloane: „Produs" (Sesizări, Petiții, Proteste, Întreruperi, Știri, Clasament) + „Resurse" (Cum funcționează, Ghiduri, Glosar, Întrebări frecvente, Drepturile cetățeanului).
- [P1] · Footer FĂRĂ CONTACT · PROBLEMĂ: niciun email de contact / pagină contact / identitate operator de date în footer. GDPR (Art. 13 — identitatea operatorului) + UX standard cer un punct de contact vizibil. FIX: „Contact" + email (ex contact@civia.ro) în footer.
- [P2] · Footer social = doar Bluesky + eYou (Fediverse) · PROBLEMĂ: lipsesc canale mainstream RO; OK ca principiu dar reduce descoperirea. FIX (dacă există conturi): adaugă-le; altfel OK.
- [P3] · Niciun link „Hartă site" / sitemap uman pentru orfani · FIX: opțional link discret „Toate paginile".

## 6. Consistență denumiri nav ↔ title ↔ H1

- [P2] · NAV „Sesizări" → `<title>`„Sesizări" → PageHero H1 „Trimite o sesizare formală" (`src/app/sesizari/page.tsx:118`) · PROBLEMĂ: H1-ul diferă de nav/title. Acceptabil ca marketing, dar utilizatorul care dă click pe „Sesizări" aterizează pe un H1 care nu reflectă label-ul. FIX (opțional): aliniază H1 spre „Sesizări" sau adaugă subtitlu care reconectează.
- [P2] · NAV „Petiții" → title „Petiții civice" → H1 „Petiții civice" · CONSISTENT, OK.
- [P2] · NAV „Întreruperi" → title „Întreruperi programate — apă, caldură, gaz..." → H1 „Întreruperi programate" · CONSISTENT, dar atenție: title conține „caldură" fără diacritic corect (ar trebui „căldură"). FIX: „căldură".
- [P3] · NAV_MORE „Cere informații (544)" → pagina title „Cerere de informații publice (Legea 544/2001)" · divergență minoră intenționată (label scurt). OK.
- [P3] · NAV_MORE „Clasament primării" → pagina title „Clasament — răspuns primării pe județe" · OK, consistent în esență.

## 7. Fluxuri rupte (next-step după acțiune)

- [BINE] · Post-submit sesizare (`SuccessScreen.tsx`) · next-step EXCELENT: „Vezi sesizarea ta →", „Altă sesizare", push-notify prompt, share, RelatedPetitiiCard (chaining sesizare→petiție). Nimic de reparat aici.
- [P2] · `src/app/not-found.tsx:7` quick-link „Trimit o sesizare" · PROBLEMĂ: CTA copy non-standard (persoana I „Trimit"). Convenția AGENTS.md: entry-point CTA = „Fă o sesizare". FIX: schimbă în „Fă o sesizare".
- [P2] · `/sesizare/[oras]` (30 landing-uri SEO) · PROBLEMĂ: fără breadcrumb / return-path clar către /sesizari; userul aterizat din Google nu vede unde e în ierarhie. FIX: breadcrumb `Acasă › Sesizări › <oraș>`.
- [P3] · Post-sign petiție · de verificat dacă există un next-step echivalent cu SuccessScreen (SUCCESS_MSG.PETITIE_SIGNED există în copy, dar fluxul de redirecționare/recomandare petiție-conexă nu a fost confirmat). FIX: asigură un „ce urmează" (vezi alte petiții / distribuie) post-semnare.

## 8. Rute de redirect / consolidat

- [P0] · `/impact`: fișier-pagină ȘI redirect→home simultan (vezi §1). FIX: rezolvă conflictul.
- [P0] · `/buget`→home dar `/buget/simulator`+`/buget/personal` trăiesc orfane. FIX: hub coerent (vezi §1).
- [P2] · `/calendar` vs `/calendar-civic`(→/proteste) vs `/evenimente` vs `/[judet]/evenimente` · PROBLEMĂ: 4 suprafețe „ce se întâmplă când" fără ierarhie clară. FIX: consolidează /calendar + /evenimente într-una singură (sau redirect /calendar → /evenimente), păstrează /proteste separat.
- [P2] · `/compass-ue`, `/hackathons`, `/initiative`, `/scoala` · candidați de decizie: ori se aduc în nav/footer, ori se redirectează (arhivare) ca alte pagini ghost-traffic deja șterse (proxy.ts). FIX: decide per pagină — nu lăsa pagini orfane „vii" fără rampă de acces (consumă crawl budget + mentenanță).
- [P3] · Search `STATIC_PAGES` (`api/search/route.ts:45-57`) acoperă 11 pagini · PROBLEMĂ: multe pagini valoroase NU-s căutabile direct (cum-functioneaza, og-27-2002, sesizare-vs-petitie, drepturile-cetateanului, statistici, compara, impact, glosar e via GLOSAR dar nu ca pagină, etc.). Search e singura rampă pentru unii orfani — și nu-i acoperă. FIX: extinde STATIC_PAGES cu hub-urile SEO + paginile de date publice.

---

## Top 10

1. [P0] `/impact` — pagină completă DAR redirectată la home (proxy.ts:64). Pagina e moartă. Scoate din LEGACY_REDIRECTS + linkează, sau șterge fișierul.
2. [P0] `/buget` redirect→home dar `/buget/simulator`+`/buget/personal` orfane vii fără hub. Consolidează.
3. [P1] Familie „date publice" fragmentată: /compara, /verificare-avere, /statistici-sesizari-romania, /decizii-deschise, /initiative — orfane complet. Adună-le într-o categorie „Date publice" (NAV_MORE sub-grup sau footer).
4. [P1] Footer fără NICIUN link de produs/conținut și fără CONTACT. Adaugă coloane „Produs" + „Resurse" + email de contact (și pentru GDPR Art. 13).
5. [P1] 9 ghiduri din /ghiduri/* fără breadcrumb (surorile lor au) — inconsistență + SEO + user fără return-path. Adaugă Breadcrumbs pe toate 9.
6. [P1] Două fișiere CTA „single source of truth" divergente (constants.ts CTA vs copy/cta.ts CTA), copy/cta.ts contrazice AGENTS.md (PETITIE_HERO). Consolidează + aliniază la convenție.
7. [P1] Triplă explicație „cum faci o sesizare" (/cum-fac, /cum-functioneaza, /ghiduri/ghid-sesizari) — cannibalization. Declară un hub canonic, link-uiește restul spre el.
8. [P1] NAV_MORE „Explorează" = dropdown plat de 7 itemi eterogeni fără grupare. Sub-grupează cu headere sau split acțiuni vs date publice.
9. [P2] Hub-uri SEO (cum-functioneaza, og-27-2002, intrebari-frecvente, drepturile-cetateanului, glosar) accesibile doar prin cross-link între ele. Footer „Ghiduri & ajutor" + extinde search STATIC_PAGES.
10. [P2] Cod mort în constants.ts: `GHID_DROPDOWN` (neimportat nicăieri) + `NAV_DATE_PUBLICE = []`. Șterge. Plus: 404 quick-link „Trimit o sesizare" → „Fă o sesizare"; title „caldură" → „căldură".
