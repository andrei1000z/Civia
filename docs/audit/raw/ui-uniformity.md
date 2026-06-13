# Audit UI Uniformity — Civia.ro

Scop: uniformitate UI în `src/app/**` + `src/components/**`.
Categorii: (1) #hex brand hardcodat → token; (2) gradiente hand-rolled vs HERO_GRADIENT; (3) pagini fără PageHero; (4) butoane cu înălțimi/radius/font divergente; (5) carduri inconsistente; (6) spacing sărit; (7) dark-mode breaks; (8) iconițe lucide cu size-uri amestecate; (9) badge-uri/pills divergente.

Referință tokens (globals.css): brand = `var(--color-primary)` (#059669 light / #10b981 dark), `--color-primary-hover` (#047857/#34d399), `--color-secondary` (#0891b2), `--color-petition` (#7C3AED), `--color-news` (#2563EB), `--color-warning` (#F59E0B), `--color-error`/`--color-accent` (#DC2626).
Standard buton acțiune (brief): `h-11 px-4 text-sm font-medium`. Componenta canonică `Button` (src/components/ui/Button.tsx): `md = h-11 px-5 text-sm`, `sm = h-10 sm:h-9 px-3`, `lg = h-13 px-7`.
HERO_GRADIENT presets: primary/petition/news/success/warning/data/authority/health (src/components/layout/PageHero.tsx).

---

## Constatări

### Categorie 1 — #hex brand hardcodat în clase Tailwind (UI layer)

- [P2] · `src/app/[judet]/page.tsx:958` · `bg-gradient-to-br from-[#047857] via-[#065f46] to-[#0a0a0a]` — `#047857` = exact `--color-primary-hover` (light), `#065f46` = `--color-primary-soft`/dark accent. Hardcodare brand în gradient hand-rolled. · FIX: folosește token: `from-[var(--color-primary-hover)] via-emerald-800 to-[#0a0a0a]` sau preset `HERO_GRADIENT.authority`.
- [P3] · `src/app/[judet]/page.tsx:699` · `bg-gradient-to-br from-[var(--color-primary)] via-emerald-800 to-[#0a0a0a]` — mix de token + `emerald-800` + hex pur `#0a0a0a`. Acceptabil (hero full-bleed dark) dar inconsistent cu 958 (un fișier, două CTA-uri dark cu rețete diferite: 699 pleacă din token, 958 din hex). · FIX: aliniază ambele la aceeași rețetă (ambele din token sau ambele din HERO_GRADIENT.authority).
- [P3] · `src/app/petitii/[slug]/page.tsx:168` · `bg-gradient-to-br from-purple-600 via-purple-800 to-[#1a0a2e]` — placeholder imagine petiție, gradient hand-rolled violet care nu corespunde `HERO_GRADIENT.petition` (`from-violet-600 via-purple-600 to-indigo-700`). · FIX: aliniază la paleta petition (violet/purple/indigo) sau folosește `--color-petition`.

Note: culorile sociale third-party (`#25D366` WhatsApp, `#0078d4` Outlook, `#0088cc` Telegram, `#0085ff`/`#1877F2` Facebook/Bluesky în `ShareMenu.tsx`/`SuccessScreen.tsx`/`EmailChoicePanel.tsx`) sunt brand-uri externe legitime — NU se tokenizează. Hex-urile din `src/data/**` și `src/lib/email/**` (HTML email nu suportă CSS vars) sunt în afara scope-ului UI brand.

### Categorie 4 — butoane: înălțimi/padding divergente

- [P3] · `src/components/ui/Button.tsx:42` · componenta canonică `md` folosește `px-5`, dar standardul din brief e `px-4`. Sursă de divergență sistemică: orice buton hand-rolled cu `px-4` va arăta mai îngust decât `<Button>`. · FIX: decide o singură convenție (recomand `px-4` ca în brief SAU actualizează brief-ul la `px-5`); aici doar semnalez discrepanța standard-vs-componentă.
- [P2] · `src/components/sesizari/EmailChoicePanel.tsx:114` · buton `h-12 px-4` (Outlook). Pe aceeași suprafață coexistă butoane `h-12` și alte CTA-uri `h-11`. Înălțime divergentă față de standard `h-11`. · FIX: `h-11` dacă e aliniat cu restul acțiunilor din panel (verific suprafața).
- [P2] · `src/components/sesizari/SuccessScreen.tsx:218,229,240` · butoane share `h-16` (verticale, icon+text). Înălțime mult peste standard — justificabil ca grilă de share verticală, dar de verificat consistența cu ShareMenu. · FIX: confirmă intenția (grilă share) sau aliniază.

#### Cluster petiții — același CTA „Semnează", înălțimi/padding/fill divergente (P1 — suprafață vizibilă, brief evidențiază petiții)

- [P1] · `src/app/petitii/[slug]/page.tsx:260` vs `:395` vs `:480` vs `:525` · butonul primar „Semnează acum/Semnează" apare cu **înălțimi diferite pe aceeași pagină**: `h-12 px-5` (260), `h-11 px-6` (395), `h-12` (480), `h-12 px-5` (525). Padding-ul oscilează `px-4/px-5/px-6`. · FIX: standardizează CTA-ul de semnare la o singură rețetă (recomand `h-12 px-6` ca CTA principal full-width, consecvent) — sau folosește componenta `<Button size="lg">`.
- [P1] · `src/app/petitii/[slug]/page.tsx` · **fill divergent pe același CTA**: `bg-purple-600` plat (260), gradient `from-purple-600 to-fuchsia-700` (480), `from-purple-600 to-fuchsia-600` (525), `bg-white` invers (395). Trei rețete de gradient + 1 plat pentru aceeași acțiune. · FIX: alege o singură rețetă brand petiție (ex. `from-[var(--color-petition)]` sau gradient unic) și reutilizeaz-o; albul pe fundal violet (395) e ok ca invers pe card colorat.
- [P2] · `src/app/petitii/[slug]/page.tsx:262,381,384,527` · iconița inline a aceluiași label „Semnează/Susține petiția" variază `Megaphone size={16}` (262), `size={12}` (381), `size={18}` (527), `Share2 size={11}` (452) vs `size={16}` (204). · FIX: fixează dimensiunea iconiței inline la 14 (text-sm) peste tot în acest grup.
- [P2] · `src/app/petitii/[slug]/SharePetitie.tsx:223` (h-12, gradient `from-purple-600 to-purple-800`) vs `src/app/petitii/[slug]/page.tsx:480` (h-12, `from-purple-600 to-fuchsia-700`) · două butoane „Distribuie/Semnează" în același flux petiție cu gradiente violet diferite (purple-800 vs fuchsia-700). · FIX: o singură paletă petiție.
- [P2] · `src/app/petitii/page.tsx:280` · placeholder card petiție `bg-gradient-to-br from-purple-500/20 via-purple-700/15 to-purple-900/20` — încă o rețetă violet, diferită de `petitii/[slug]/page.tsx:168` (`from-purple-600 via-purple-800 to-[#1a0a2e]`) și de `HERO_GRADIENT.petition`. · FIX: un singur preset placeholder petiție.

#### CTA-uri full-bleed hand-rolled cu înălțimi „mari" inconsistente (h-12/h-13/h-14)

- [P2] · `src/app/page.tsx:145` · CTA hero principal `h-12 px-7`. · `src/app/sesizare/[oras]/page.tsx:206` · `h-14 px-8 text-lg`. · `src/app/cum-functioneaza/page.tsx:300` · `h-14 px-8 text-lg`. · `src/app/og-27-2002/page.tsx` CTA. · Trei pagini-sori cu CTA-uri „mari" diferite: `h-12` vs `h-14`. Componenta `<Button size="lg">` = `h-13`. · FIX: aliniază CTA-urile mari la `<Button size="lg">` (`h-13 px-7 text-base`).

#### Butoane gradient hand-rolled admin (h-9/h-11 amestec, radius-xs)

- [P3] · `src/app/admin/proteste/page.tsx:628` (`h-9 px-3`), `src/app/admin/petitii/page.tsx:234` (`h-11 px-4`), `:884` (`h-11 ... px-4 text-xs`), `ApproveTicketDialog.tsx:212` (`h-9 px-3 text-xs`) · butoane gradient admin cu `h-9` și `h-11` amestecate; `radius-xs` peste tot (consecvent), dar înălțimea acțiunii primare variază. · FIX: acțiunile primare la `h-11`, secundarele compacte la `h-9`, declarат explicit.

### Categorie 7 — dark-mode breaks

- [P1] · `src/components/sesizari/ShareMenu.tsx:240,242,245,249` · modal QR: `bg-white` + `text-slate-900` + `text-slate-600` + buton `bg-slate-900 text-white` — **fără variante `dark:`**. În dark mode rămâne card alb cu text închis (ok pe alb), dar pe restul UI-ului dark e o spărtură vizuală (card alb pur). · FIX: `bg-[var(--color-surface)] text-[var(--color-text)]`, subtitle `text-[var(--color-text-muted)]`, buton `bg-[var(--color-primary)] text-white` sau folosește `<Modal>` canonic.
- [P3] · `src/components/cont/MfaSetup.tsx:180` · `bg-white p-3` pentru containerul QR — **legitim** (codul QR necesită fundal alb pt. scanare). Nu necesită fix; notat pentru a nu fi confundat cu un break real.

### Categorie 2 — gradiente hand-rolled (rezumat surse multiple)

- [P2] · gradiente emerald/cyan hand-rolled repetate în loc de `HERO_GRADIENT.primary`/`var(--color-primary)`: `src/app/page.tsx:126,145`, `src/app/autoritati/page.tsx:89`, `src/app/sesizare/[oras]/page.tsx:196,206`, `src/app/cum-functioneaza/page.tsx:300`, `src/app/sesizari/strada/[slug]/page.tsx:156`, `src/app/statistici-sesizari-romania/page.tsx:241`. Rețete ușor diferite (`from-emerald-500 to-cyan-600`, `from-emerald-600 to-cyan-600`, `from-emerald-600 to-teal-600`, `from-emerald-500/10 to-cyan-500/10`). · FIX: extrage 1-2 utilitare (CTA-gradient + soft-card-gradient) sau folosește tokens.
- [P3] · `src/app/cont/page.tsx:496` hero `from-[var(--color-primary)] via-emerald-700 to-indigo-800` — hero custom care **nu** folosește `<PageHero>` deși e exact tiparul (icon chip + gradient). Gradientul nu e în `HERO_GRADIENT`. · FIX: migrează la `<PageHero gradient={HERO_GRADIENT.primary}>` sau adaugă preset.
- [P3] · `src/app/cont/page.tsx:870` · `bg-gradient-to-r from-red-500 to-red-600` (zona danger) — folosește roșu Tailwind în loc de `--color-error`. · FIX: `from-[var(--color-error)]` sau gradient danger din `<Button variant="danger">` paletă.

### Categorie 9 — badge-uri / pills divergente față de componenta `<Badge>`

Componenta canonică `src/components/ui/Badge.tsx` = `px-2.5 py-1 rounded-[var(--radius-pill)] text-xs font-medium` cu variante semantice token (`--color-*-soft`/`-on-soft`). Codebase plin de pills hand-rolled care o ocolesc:

- [P1] · `src/app/decizii-deschise/page.tsx:97` · pill `bg-emerald-100 text-emerald-700` / `bg-rose-100 text-rose-700` **fără `dark:`** → în dark mode pastel deschis pe fundal închis (text aproape invizibil + spărtură). · FIX: `<Badge variant="success">`/`<Badge variant="error">` SAU adaugă `dark:bg-emerald-900/40 dark:text-emerald-300`.
- [P1] · `src/app/compass-ue/page.tsx:107` · trei pills `bg-red-100 text-red-700` / `bg-amber-100 text-amber-700` / `bg-emerald-100 text-emerald-700` **fără `dark:`** → break dark-mode. · FIX: variante `<Badge>` sau perechi `dark:`.
- [P1] · `src/app/propuneri-legislative/[id]/page.tsx:115` · `bg-emerald-100 text-emerald-700` **fără `dark:`**. · FIX: `<Badge variant="success">` sau adaugă `dark:`.
- [P2] · padding pill inconsistent pe aceeași clasă de element: `px-2 py-0.5` (feedback/admin/propuneri/decizii), `px-2 py-1` (drepturile/glosar/sesizari-strada), `px-2.5 py-1` (Badge canonic, intreruperi/[id], propuneri-legislative/[id]:105), `px-3 py-1` (sesizari/[code]:194, [judet]/page:721). · FIX: standardizează la `px-2.5 py-1` (componenta `<Badge>`).
- [P2] · radius pill inconsistent: hand-rolled folosesc `rounded-full`, dar `<Badge>` folosește `rounded-[var(--radius-pill)]` (20px ≠ full). Două „forme" de pill coexistă. · FIX: aliniază hand-rolled-urile la `<Badge>` sau invers.
- [P3] · culori pill raw-Tailwind în loc de tokens semantici chiar și unde au `dark:`: `admin/feedback/FeedbackList.tsx:30,34,36`, `admin/intreruperi/IntreruperiSubmissions.tsx:21-25`, `propuneri-legislative/page.tsx:118`, `intreruperi/IntreruperiFilters.tsx:549-550` folosesc `bg-emerald-100/red-100/amber-100 + dark:...-900/...`. Funcțional ok, dar ocolesc `--color-success-soft` etc. · FIX: migrează la variantele `<Badge>` pentru consecvență.

### Categorie 5 — radius carduri inconsistent (Tailwind `rounded-md/lg/2xl` vs token)

- [P2] · Multe carduri folosesc `rounded-md` Tailwind (6px) în loc de `rounded-[var(--radius-md)]` (16px) / `--radius-card` (12px): `src/app/admin/inbox/[id]/page.tsx:135,147,193,246,257,273` (toate secțiunile card admin), `admin/inbox/page.tsx:107`, `sesizari/page.tsx:189`. Pe aceeași suprafață admin coexistă `rounded-md` (6px) și `rounded-[var(--radius-md)]` (16px) → colțuri vizibil diferite. · FIX: standardizează cardurile la `rounded-[var(--radius-md)]`.
- [P3] · `rounded-2xl` Tailwind (16px) folosit în `components/liquid-civic/*` (KonamiEasterEgg:111, CivicSprite:107, CiviaAssistant:245,257) — coincide numeric cu `--radius-md` dar e exprimat altfel. · FIX: `rounded-[var(--radius-md)]` pentru consecvență semantică.

### Categorie 6 — spacing pagină (wrapper `py-*`) sărit față de convenția dominantă

Convenția dominantă a paginilor full-width: `container-narrow py-8 md:py-12`. Outliers:

- [P2] · `src/app/impact/page.tsx:141` · `container-narrow py-16` — fără responsive split, dublu față de surori. · FIX: `py-8 md:py-12` (sau `py-10 md:py-16` dacă vrei generos, dar consecvent).
- [P2] · `src/app/compara/[a]/[b]/page.tsx:90` · `container-narrow py-12 md:py-16` — scală diferită de `compara/page.tsx:20` care e `py-8 md:py-12`. Două pagini din același flux compara cu spacing diferit. · FIX: aliniază la `py-8 md:py-12`.
- [P3] · `src/app/admin/categorii-noi/page.tsx:74` (`py-12`), `admin/primarie/page.tsx:42` (`py-12`) · `py-12` fix fără `md:` split (pe mobil prea mult). · FIX: `py-8 md:py-12`.
- [P3] · `src/app/cont/page.tsx:440,455,494` · `py-4 sm:py-8 md:py-14` — scală proprie (max py-14), diferită de restul (py-12). · FIX: aliniază la `py-8 md:py-12` dacă nu există motiv specific.

### Categorie 8 — token brand exprimat în două forme (util-class vs var())

- [P3] · `src/app/sesizari/page.tsx:189,192` și `sesizari/[code]/page.tsx:625` folosesc forma scurtă Tailwind `bg-surface-2 border-border text-text-muted` (mapată valid în `@theme inline`), pe când >99% din codebase folosește `bg-[var(--color-surface-2)]` etc. Funcțional identic, dar inconsecvent stilistic. · FIX: alege o singură formă (recomand `var(--color-*)` ca în restul codebase-ului).

### Categorie 3/2 — chip AiSummary gradient divergent cross-surface

- [P3] · `src/app/stiri/[id]/page.tsx:342` (`from-violet-500 to-fuchsia-600`) vs `src/app/petitii/[slug]/page.tsx:284` (`from-purple-500 to-fuchsia-600`) · chip-ul AiSummary (aceeași componentă vizuală pe ambele surfețe, cf. AGENTS.md) folosește violet-500 într-un loc, purple-500 în altul. · FIX: o singură rețetă pentru chip-ul AI.

### Categorie 4 (CTA copy) — card link „Detalii →" încalcă convenția (trebuie „Vezi detalii")

- [P2] · `src/app/[judet]/evenimente/page.tsx:133` · `Detalii <ArrowRight size={12} />` în interiorul unui `<Link>` care wrap-uiește tot cardul — exact tiparul „Detalii →" interzis de AGENTS.md. · FIX: înlocuiește textul cu `Vezi detalii`.
- [P3] · `src/app/calendar/page.tsx:171` · link card `Detalii` + `<ExternalLink>` (link extern la sursă). Borderline — convenția cere descriptiv. · FIX: `Vezi sursa` sau `Detalii pe sursă` (mai descriptiv decât „Detalii").
- [P3] · `src/components/maps/SesizariMarkersLayer.tsx:49` · `Vezi detalii →` — conform convenției (notat ca exemplu corect; săgeata e ok aici că textul e descriptiv).
- [P3] · `src/app/ghiduri/page.tsx:113` (`Citește`) și `:86` icon · card-link „Citește" pentru ghiduri — verb diferit de convenție, dar contextual potrivit ghidurilor. Notat pentru consecvență cross-card (alte carduri folosesc „Vezi detalii").

### Categorie 4 (focus) — două convenții de focus-ring coexistă

- [P2] · Componenta `Button` (`src/components/ui/Button.tsx:78-80`) folosește `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-*`, dar marea majoritate a butoanelor hand-rolled folosesc `focus:outline-none focus-visible:ring-2 focus-visible:ring-*`. Două stiluri de inel de focus pe aceeași aplicație (outline vs ring). · FIX: alege o singură convenție (recomand `ring-2` ca dominanta, sau aliniază Button-ul la ring). Notă: e și a11y — outline vs box-shadow ring se comportă diferit pe colțuri rotunjite.

### Categorie 4 — submit hand-rolled vs componenta Button (radius/height)

- [P3] · `src/components/sesizari/SesizareForm.tsx:2121` · submit `h-12 rounded-[var(--radius-xs)]` (8px). Alte submit-uri primare folosesc `rounded-[var(--radius-full)]` (page.tsx:145) sau `rounded-[var(--radius-button)]`. Radius-ul butonului primar variază între suprafețe (`xs`=8px / `button`=8px / `full`). · FIX: definește un radius unic pentru CTA primar (recomand `--radius-full` pe entry CTAs, `--radius-xs` pe form-submit — dar declară-l explicit).
- [P3] · `src/app/admin/petitii/page.tsx:234,884` (`rounded-[var(--radius-xs)]`) vs `src/app/petitii/[slug]/page.tsx:480,525` (`rounded-[var(--radius-full)]`) · butoane petiție: admin = radius-xs colțuri mici, public = pill complet. Diferență de „formă" pentru aceeași familie de acțiune. (Acceptabil admin vs public, dar notat.)

### Categorie 5 — shadow card: Tailwind `shadow-md/lg/xl` vs token `shadow-[var(--shadow-N)]`

Cardul canonic folosește `shadow-[var(--shadow-2)]` (tokenii au definiții separate light/dark). Outliers cu Tailwind shadows (nu se adaptează la dark mode ca tokenii):

- [P2] · `src/app/intreruperi/[id]/CalendarMenu.tsx:39` · dropdown `shadow-lg` (Tailwind) — în dark mode umbra Tailwind e mult mai slabă decât `--shadow-lg` token (care e definit puternic pe dark). · FIX: `shadow-[var(--shadow-3)]`.
- [P2] · `src/app/intreruperi/IntreruperiMap.tsx:461,470,481` · controale hartă `shadow-md`/`shadow-sm` Tailwind. · FIX: token-uri (`--shadow-2`). (Notă: harta are surface alb fix prin design Leaflet — verifică dacă e intenționat.)
- [P3] · `src/app/admin/petitii/page.tsx:884` (`shadow-sm`), `src/app/page.tsx:145` (`shadow-lg`), `cont/page.tsx:507,510,518` (`shadow-lg`/`shadow-md`) · butoane/avatare cu Tailwind shadows. · FIX: token shadows pentru consecvență dark.

### Categorie 4 (touch target) — butoane „close" `w-8 h-8` (32px) sub convenția responsivă

Componentele partajate folosesc `w-11 h-11 sm:w-9 sm:h-9` (Toast, NotificationBell) sau `w-9 h-9 sm:w-8 sm:h-8` (AlertBanner) pentru a respecta 44px touch pe mobil. Butoanele de închidere modal din sesizari sunt flat `w-8 h-8` (32px mobil):

- [P2] · `src/components/sesizari/DeleteSesizareButton.tsx:89`, `MarkResolvedButton.tsx:119`, `StatusTicketButton.tsx:165`, `SignSesizareButton.tsx:270`, `src/app/cont/page.tsx:875`, `src/app/admin/sesizari/page.tsx:239,357` · close-button `w-8 h-8` fix. · FIX: aliniază la `w-9 h-9 sm:w-8 sm:h-8` (sau `w-11 h-11 sm:w-9 sm:h-9`) pentru consecvență + WCAG 2.5.5.

### Categorie 5 — carduri „highlight" `border-2` + culoare raw în loc de token

- [P3] · `src/app/avocatul-poporului-online/page.tsx:247`, `sesizare-vs-petitie/page.tsx:99`, `sesizare/[oras]/page.tsx:196`, `sesizari/strada/[slug]/page.tsx:156`, `proteste/propune/ProteSubmitForm.tsx:294`, `petitii/initiaza/LoginRequiredCard.tsx:15` · carduri „evidențiate" cu `border-2 border-emerald-500/30` (sau purple) raw Tailwind, în loc de `border-2 border-[var(--color-primary)]/30`. Consecvente între ele ca pattern, dar culoarea ocolește tokenul brand (emerald-500 ≠ primary în dark, unde primary=#10b981). · FIX: `border-[var(--color-primary)]/30`.

### Categorie 7 — alte note dark-mode

- [P3] · `src/app/intreruperi/IntreruperiMap.tsx:461` · control hartă `bg-white text-slate-900 ... border-slate-300` — pe hartă Leaflet (fundal tile fix) e ok, dar e singurul loc cu `text-slate-900` hardcodat. Notat ca excepție acceptabilă (overlay pe hartă, nu pe surface-ul app).

### Categorie 1 — render-markdown / data colors (în afara UI brand, notat informativ)

- [P3] · `src/lib/actualizari/render-markdown.tsx:29-40`, `src/components/admin/MarkdownEditor.tsx:21-26` · paleta de evidențiere markdown hardcodează `#DC2626/#F59E0B/#059669/#7C3AED` — identice cu tokenii brand, dar duplicate ca hex. Folosit pentru `style={{color}}` inline pe text user-generated. · FIX (opțional): centralizează într-o singură mapă partajată (azi e duplicată în 2 fișiere cu aceleași valori) → o singură sursă de adevăr.

---

## Top 10

1. **[P1] Cluster „Semnează" pe `petitii/[slug]/page.tsx`** — același CTA primar apare cu înălțimi diferite (`h-12`/`h-11`), padding `px-4/px-5/px-6` și **3 gradiente violet diferite + 1 plat** pe aceeași pagină (linii 260, 395, 480, 525). Cel mai vizibil break de uniformitate, pe o suprafață-cheie. → o singură rețetă CTA petiție (ideal `<Button>`).
2. **[P1] Pills pastel fără `dark:` = break dark-mode** — `decizii-deschise:97`, `compass-ue:107`, `propuneri-legislative/[id]:115` folosesc `bg-emerald-100/red-100/amber-100 text-*-700` fără variantă dark → text aproape invizibil în dark. → `<Badge variant>` sau perechi `dark:`.
3. **[P1] Modal QR `ShareMenu.tsx:240-249`** — `bg-white` + `text-slate-900/600` + `bg-slate-900` fără `dark:` → card alb pur peste UI dark. → tokens `--color-surface`/`--color-text` sau `<Modal>`.
4. **[P2] Hex brand hardcodat în gradient** — `[judet]/page.tsx:958` `from-[#047857] via-[#065f46]` (= primary-hover/primary-soft). → tokens sau `HERO_GRADIENT.authority`.
5. **[P2] Două convenții focus-ring** — `Button` folosește `focus-visible:outline-2`, restul aplicației `focus-visible:ring-2`. → o singură convenție.
6. **[P2] Radius card Tailwind vs token** — `admin/inbox/[id]:135-273` (6 carduri) + `admin/inbox:107` + `sesizari:189` folosesc `rounded-md` (6px) lângă carduri `rounded-[var(--radius-md)]` (16px). → standardizează.
7. **[P2] Pills hand-rolled ocolesc `<Badge>`** — zeci de pills cu padding (`px-2 py-0.5` / `px-2.5 py-1` / `px-3 py-1`) și radius (`rounded-full` vs `--radius-pill`) divergente. → componenta `<Badge>` peste tot.
8. **[P2] Shadow Tailwind vs token în dark** — `CalendarMenu:39` `shadow-lg`, `IntreruperiMap` `shadow-md/sm` → umbre slabe în dark (tokenii au definiții dark dedicate). → `shadow-[var(--shadow-N)]`.
9. **[P2] Spacing pagină inconsistent** — `impact:141` `py-16`, `compara/[a]/[b]:90` `py-12 md:py-16` vs convenția `py-8 md:py-12` (folosită de ~40 pagini). → aliniază.
10. **[P2] „Detalii →" card link interzis** — `[judet]/evenimente:133` `Detalii <ArrowRight>` încalcă convenția CTA (trebuie „Vezi detalii"). + close-buttons `w-8 h-8` (32px) sub convenția responsivă `w-9 h-9 sm:w-8 sm:h-8`.

### Rezumat severitate
- P1: 5 (cluster petiții heights+fill, 3× pills dark-break, modal QR dark-break)
- P2: ~22 (gradiente hand-rolled, focus split, radius card, pills padding/radius, shadow dark, spacing, CTA copy, touch target, butoane mari h-12/h-14)
- P3: ~25 (token short-form vs var(), chip AI, border-2 raw, data-color duplicare, etc.)

(în lucru)
