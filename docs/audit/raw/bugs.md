# Audit bugs — Civia.ro

> Data: 13 iunie 2026. Status: FINALIZAT.

## Metodologie
Bug-hunt pe cod real, cu dovadă din context. 10 categorii: ghilimele ASCII după „, await/catch lipsă, race conditions, null/undefined Supabase, loading/error/empty lipsă, z-index, link-uri rupte, validare client, date expirate, listeners fără cleanup.

**Concluzie generală:** codebase neobișnuit de defensiv. Majoritatea categoriilor de bug (race conditions, double-submit, null-handling Supabase, listener cleanup, loading/error/empty) sunt **curate** — formularele și componentele client folosesc consecvent `disabled` pe submit, `AbortController` cu cleanup, guard-uri `json.data?.x`, și stări distincte loading/error/empty. Constatările reale sunt concentrate în: link-uri interne rupte (P1), bypass al scalei de tokeni z-index (P2/P3) și inconsistențe minore.

---

## Constatări

### 1. Link-uri interne rupte (rute inexistente) — VERIFICATE contra src/app

**[P1] · src/app/autoritati/page.tsx:73 și :99 · Link către rută inexistentă `/autoritati/inregistrare`**
Două referințe: text inline („Trimiteți o cerere pe pagina /autoritati/inregistrare") + CTA buton principal „Solicită cont oficial" (`href="/autoritati/inregistrare"`). NU există `src/app/autoritati/inregistrare/page.tsx` (director absent — confirmat). CTA-ul primar al paginii dă 404. Există API `/api/authority/register` dar lipsește pagina UI.
FIX: creează `src/app/autoritati/inregistrare/page.tsx` (formular care lovește `/api/authority/register`) SAU schimbă href-ul către o rută existentă. Verifică intenția înainte.

**[P1] · src/app/compass-ue/page.tsx:81 · Link către rută inexistentă `/compass-ue/profil`**
`<Link href="/compass-ue/profil">Setează preferințe →</Link>`. NU există `src/app/compass-ue/profil/page.tsx`. Link-ul „Setează preferințe" dă 404.
FIX: creează pagina de preferințe sau ascunde link-ul până e gata feature-ul (componentul are deja un empty-state „Scrapers încep să ruleze post-deploy mig 090" — feature pare incomplet).

### 2. z-index — conflicte și bypass al scalei de tokeni

Scala canonică (globals.css:241-254): `--z-sticky:30, --z-fab:40, --z-nav:50, --z-banner:55, --z-mobile-menu:70, --z-install-prompt:80, --z-cookie:90, --z-modal:100, --z-modal-priority:120, --z-toast:200, --z-nav-progress:250, --z-skip-link:300`. Mai multe componente hardcodează valori care contrazic scala.

**[P2] · src/app/propuneri-legislative/PropuneFormClient.tsx:103 · Modal full-screen la `z-50`, EGAL cu Navbar (`--z-nav:50`)**
`<div className="fixed inset-0 z-50 ... bg-black/60 backdrop-blur-sm ...">` — overlay de modal la `z-50`, identic cu Navbar-ul fix (`z-50`, Navbar.tsx:117). Navbar-ul are stacking context propriu (backdrop-blur) și e fixed → poate apărea PESTE backdrop-ul modalului, cu z egal ordinea DOM decide. Toate celelalte modale folosesc `z-[var(--z-modal)]` (100).
FIX: schimbă `z-50` → `z-[var(--z-modal)]`.

**[P3] · src/components/InstallPrompt.tsx:233,281,328 · Folosește `--z-toast` (200) în loc de `--z-install-prompt` (80)**
`z-[var(--z-toast)]` — install prompt-ul randează la nivel de toast (200). Tokenul dedicat `--z-install-prompt:80` există dar e ignorat. Pe mobile (`fixed left-4 right-4 ... bottom`) se poate suprapune cu Toast-ul (tot 200, bottom).
FIX: `z-[var(--z-install-prompt)]`.

**[P3] · src/components/CookieBanner.tsx:173 · Hardcodează `z-40` (`--z-fab`) în loc de `--z-cookie` (90)**
Banner-ul de consimțământ cookies la nivel FAB (40). Meniul mobil (z-60) și AlertBanner (z-55) ar putea acoperi banner-ul de consimțământ — UX/legal problematic (consimțământul trebuie să rămână accesibil).
FIX: `z-[var(--z-cookie)]`.

**[P3] · src/components/layout/Navbar.tsx:267 · Mobile menu hardcodează `z-[60]` în loc de `--z-mobile-menu` (70)**
Tokenul dedicat e 70, meniul folosește 60. Acoperă AlertBanner (55) OK, dar e sub `--z-install-prompt`/`--z-cookie` ca valoare nominală.
FIX: `z-[var(--z-mobile-menu)]`.

**[P3] · src/components/OfflineIndicator.tsx:57,71 · Hardcodează `z-[200]` (magic number = `--z-toast`)**
Banner top fixed la `z-[200]`. Coincide cu `--z-toast`. Spațial nu se ciocnește (top vs bottom), dar e magic number.
FIX: introdu `--z-offline` sau folosește un token documentat.

### 3. Route handlers — robustețe & info-leak

**[P3] · src/app/api/sesizari/live-stats/route.ts:15-52 · Lipsă try/catch în GET**
`GET()` apelează `createSupabaseAdmin()` + `Promise.all([...])` fără try/catch. La eroare DB → 500 nehandled, fără fallback grațios. Widget-ul social-proof homepage primește eroare în loc de zerouri. (Inconsecvent cu `/api/stats/today` și `/api/petitii/count` care fac soft-fallback.)
FIX: wrap în try/catch, returnează `{ lastHour: 0, lastDay: 0, total: 0 }` pe eroare.

**[P3] · MULTIPLE route handlers · Mesaj de eroare intern leak-uit la client pe 500**
Pattern repetat: `const msg = e instanceof Error ? e.message : "Unknown error"; return NextResponse.json({ error: msg }, { status: 500 });` — expune mesajul Postgres/intern. Confirmat în: `api/petitii/[id]/sign/route.ts:93`, `api/sesizari/recent/route.ts:36`, `api/sesizari/[code]/comments/[commentId]/vote/route.ts:69` (și altele cu același șablon).
FIX: log la Sentry + returnează mesaj generic („Eroare internă") către client.

**[P3] · src/app/api/sesizari/recent/route.ts:21 · `limit` non-numeric → NaN în `.limit()`**
`const limit = Math.min(Number(searchParams.get("limit") ?? 10), 50);` — dacă `?limit=abc`, `Number("abc")=NaN`, `Math.min(NaN,50)=NaN`, `.limit(NaN)` e comportament nedefinit.
FIX: `const raw = Number(searchParams.get("limit")); const limit = Number.isFinite(raw) ? Math.min(Math.max(1, raw), 50) : 10;`

### 4. Client fetch — shape mismatch

**[P3] · src/components/TodayCounter.tsx:29-31 · Fetch fără check `r.ok`; shape mismatch → NaN**
```
const r = await fetch("/api/stats/today");
const data = (await r.json()) as Stats;
if (mounted) setStats(data);
```
Nu verifică `r.ok` și nu validează shape-ul. Dacă API-ul răspunde alt shape, `data.resolved_today` e `undefined` → animația face `Math.round(... + (undefined - 0) * e)` = `NaN` afișat. Inconsecvent cu `SocialProofCounter.tsx:19` care face `r.ok ? r.json() : null` corect.
FIX: `if (!r.ok) return; const data = await r.json(); if (mounted && typeof data?.resolved_today === "number") setStats(data);`

### 5. Date statice expirate

**[P3] · src/data/intreruperi.ts:95-114 · Seed cu dată trecută încă marcat „programat"; getteri non-active nu filtrează**
Prima intrare (`cmteb-sds5-2026-05-04`): `startAt: "2026-05-04"`, `endAt: "2026-05-08"`, `status: "programat"` — eveniment trecut (azi 2026-06-13) marcat „programat". `getActiveInterruptions()` (store.ts:155) filtrează `endAt > now` corect, dar `getInterruptionById()`, `getInterruptionsForCounty()`, `getAllInterruptions()` NU filtrează — deci pagina de detaliu `/intreruperi/cmteb-sds5-2026-05-04` și listările pe județ pot afișa un eveniment trecut ca „programat".
FIX: fie șterge seed-urile expirate hardcodate (restul folosesc helper-ul `iso(offsetDays)` relativ la NOW, deci rămân fresh), fie aplică filtrul `endAt > now` și în getterii non-active / la nivel de detaliu marchează status efectiv „finalizat".

### 6. Convenții CTA (copy)

**[P3] · src/app/petitii/[slug]/SignPetitieButton.tsx:158 · Buton de acțiune folosește „Semnează petiția" în loc de „Semnează acum"**
Per AGENTS.md: hero/entry „Semnează petiția", buton de acțiune (submit) „Semnează acum". Acesta e butonul care efectiv semnează la click.
FIX: textul butonului din „Semnează petiția" → „Semnează acum".

### 7. A11y minor (focus indicators lipsă)

**[P3] · src/app/propuneri-legislative/[id]/VoteButtonClient.tsx:68,86 · Butoane fără `focus-visible:ring`**
Butonul „Susțin această propunere" (l.68) și „Distribuie" (l.86) nu au inel de focus vizibil — inconsecvent cu restul butoanelor din codebase (care au `focus-visible:ring-2`). Și `handleShare` (l.52-63) eșuează silențios dacă nici clipboard nici `navigator.share` nu sunt disponibile (fără feedback).
FIX: adaugă `focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2`; pe handleShare adaugă fallback de eroare (toast „Nu am putut copia").

**[P3] · src/app/cont/page.tsx:425 (și :940) · `setTimeout` fără cleanup → setState potențial după unmount**
`setTimeout(() => setSaved(false), 2500)` în handler async, fără `clearTimeout` la unmount. Dacă utilizatorul navighează în <2.5s, setState pe component demontat (warning React, nu crash). (Cel de la :271 navighează oricum, deci e benign.)
FIX: stochează id-ul timer-ului într-un ref + clearTimeout în cleanup, sau folosește un guard `mounted`.

---

## Categorii VERIFICATE și CURATE (fără bug-uri)

- **TS1005 (ghilimele ASCII după „):** toate aparițiile `„..."` sunt în comentarii, string-uri single-quoted (`'...'`) sau text JSX — unde ASCII `"` NU închide string-ul. Nu există string literal `"..."` cu `"` ASCII după `„`. Proiectul build-uiește → compilatorul ar fi prins orice scăpare. Regex-urile din `ai-helper/route.ts:89` și `reformulate-descriere.ts:702` (char-class `["'„`]`) sunt corecte, nu bug.
- **Double-submit:** `SesizareForm` (`canSubmit` include `!submitting`), `SignPetitieButton` (`disabled={signing}`), `ProposePetitieForm` (`disabled={sending}`), `VoteButtonClient` (`if (voted||loading) return` + disabled), `EscalateAvpButton` (`disabled={busy}` pe submit), `MarkResolvedButton`, `StatusTicketButton`, `SignSesizareButton`, `DeleteSesizareButton` — toate guard-ate corect.
- **AbortController + cleanup:** `SesizareForm` (geocode effects), `StiriList`, `TopVotedWidget`, `SesizariPublice`, `SocialProofCounter` — toate abort + clearTimeout în cleanup.
- **Listeners cleanup:** `Modal` (keydown + raf + body.overflow restaurate), `NotificationBell` (mousedown/keydown + realtime channel removeChannel), `VoiceInput` (rec.stop la unmount) — toate cu cleanup.
- **null/undefined Supabase:** zero `data!` non-null assertions în tot src. Accesele `json.data.x` sunt guard-ate (`if (!json.data?.code) throw`, `if (!json.data?.sesizare) throw`, blocuri `if (json.data)`).
- **loading/error/empty:** `StiriList` (loading skeleton + error cu retry + empty distinct), `SesizariPublice` (fetchError distinct de empty — fix de audit menționat în cod), `TopVotedWidget` (skeleton + empty), `cont/page.tsx` (loadError + 401 handling).
- **Race condition state-after-unmount:** `TodayCounter`, `SocialProofCounter` (`mounted`/`cancelled` flags), `NotificationBell` (channel name unic per mount cu uuid pentru Strict Mode).

---

## Top 10

1. **[P1]** `autoritati/page.tsx:73,99` — CTA principal „Solicită cont oficial" → 404 (`/autoritati/inregistrare` inexistent).
2. **[P1]** `compass-ue/page.tsx:81` — link „Setează preferințe" → 404 (`/compass-ue/profil` inexistent).
3. **[P2]** `propuneri-legislative/PropuneFormClient.tsx:103` — modal la `z-50` egal cu Navbar; navbar-ul poate acoperi modalul. Folosește `--z-modal`.
4. **[P3]** `CookieBanner.tsx:173` — banner consimțământ la `z-40`; poate fi acoperit de meniul mobil/AlertBanner (UX/legal). Folosește `--z-cookie`.
5. **[P3]** `InstallPrompt.tsx:233+` — folosește `--z-toast` (200) în loc de `--z-install-prompt` (80); overlap cu Toast pe mobile.
6. **[P3]** `api/sesizari/live-stats/route.ts` — lipsă try/catch; 500 fără fallback grațios pe widget homepage.
7. **[P3]** Multiple route handlers — `e.message` intern leak-uit la client pe 500 (info disclosure).
8. **[P3]** `TodayCounter.tsx:29` — fetch fără `r.ok` + fără validare shape → potențial `NaN` în UI (inconsecvent cu SocialProofCounter).
9. **[P3]** `intreruperi.ts:95-114` — seed cu dată trecută marcat „programat"; getterii non-active nu filtrează `endAt > now`.
10. **[P3]** `SignPetitieButton.tsx:158` — buton de acțiune „Semnează petiția" în loc de „Semnează acum" (convenție CTA).
