# 🎁 Medium Features Roadmap — Implementation Status

User aprobat 11 features (skip #2 alt judet, #4 quiz, #5 glosar, #11 PDF semnatura, #15 1-tap, #16 cosemnatari OTP, #18 mod presa, #19 audit CC, #20 alert termen).

---

## 🟡 Feature #1 — Search semantic AI cu pgvector (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Activează `CREATE EXTENSION vector;` în Supabase
- Adaugă `embedding vector(384)` coloană pe `sesizari` + `petitii` + `stiri`
- Background cron: pentru fiecare row nou, generează embedding via Groq embeddings API
- Endpoint `/api/search?q=...` → ANN search HNSW index
- Frontend: SearchBar component cu instant results

**Effort**: M. **Q2 priority.**

---

## 🟡 Feature #3 — Calendar civic (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Aggregator: scrape consilii locale agenda + Avocatul Poporului audieri + proteste programate (deja) + finantări UE deadlines
- `/calendar` page cu vizualizare iCal
- Export iCal: `/api/calendar/export.ics`
- Push notification opt-in pentru event-uri urmărite

**Effort**: M. **Q2-Q3 priority.**

---

## 🟡 Feature #6 — Profil public opțional (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- ALTER profiles ADD `public_profile_slug TEXT UNIQUE` + `public_bio TEXT` + `public_avatar_url TEXT`
- New route `/u/[slug]` — server component
- Settings page `/cont/profil-public` cu toggle + slug edit
- Privacy: numai sesizările cu `publica = true` apar pe profil

**Effort**: M. **Q2 priority.**

---

## 🟢 Feature #7 — Streak civic (SCAFFOLDED)

**Status**: 🟢 SCAFFOLDED

**Files shipped**:
- `src/app/api/cron/civic-streak/route.ts` — placeholder cron

**TODO continuare**:
- Component `<StreakFlame />` cu Redis sorted set
- Daily cron logic real (increment / reset)
- Notification opt-in pentru streak risk
- Display in Navbar profile dropdown

**Effort rămas**: S. **Q2 priority.**

---

## 🟡 Feature #8 — Newsletter săptămânal personalizat (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Resend audience + segmentation per județ + interes
- Cron weekly luni 09:00 → AI personalize email per user
- ALTER profiles ADD `newsletter_pref TEXT[]` (categorii) + `newsletter_freq TEXT` ('weekly' | 'monthly' | 'off')
- Template `<NewsletterEmail />` cu PageHero analog

**Effort**: M. **Q2 priority.**

---

## 🟡 Feature #9 — Voice input (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Web Speech API + fallback Groq Whisper pentru iOS
- Component `<VoiceInputButton />` în SesizareForm description textarea
- Real-time transcription preview
- Acord GDPR explicit

**Effort**: M. **Q2-Q3 priority.**

---

## 🟡 Feature #10 — Heatmap intensitate sesizări (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Materialized view `sesizari_heatmap_per_street(lat, lng, count, intensity)`
- Refresh weekly via pg_cron
- Component `<HeatmapLayer />` cu Leaflet.heat plugin
- Filter pe tip + status
- Page `/[judet]/harti?layer=heatmap` query param

**Effort**: M. **Q2 priority.**

---

## 🟡 Feature #12 — Embed widget presă (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Route `/embed/sesizari/[judet]?count=5` — iframe-friendly
- CSS izolat (no Civia chrome)
- CORS open
- JS snippet `<script src="https://www.civia.ro/embed/sesizari.js" data-judet="cj">`

**Effort**: M. **Q3 priority.**

---

## 🟡 Feature #13 — Push lucrări programate (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Match intreruperi data cu user addresses (geofence)
- Push notification API (deja avem service worker)
- ALTER profiles ADD `notify_intreruperi BOOLEAN` + `address_lat NUMERIC` + `address_lng NUMERIC`
- Cron: check intreruperi noi + match users + send push

**Effort**: M. **Q2 priority.**

---

## 🟡 Feature #14 — Counter „Azi rezolvate" homepage (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- Redis counter `civia:today:resolved`, `civia:today:new`, `civia:today:votes`
- Daily reset la 00:00 via cron
- SSE stream `/api/stats/today` pentru live update
- Component `<TodayCounter />` cu CountUp.js animation

**Effort**: S. **Q1-Q2 quick win.**

---

## 🟡 Feature #17 — Multilang RO + HU + UK (PLAN)

**Status**: 📐 PLAN draft

**Implementare**:
- `next-intl` library install
- Locale folder `messages/{ro,hu,uk}.json`
- AI prompts adaptate per limbă via Groq
- Persistent cookie + browser detect
- Translator wizard: maintainer rulează `npm run translate:hu` pentru AI bulk

**Effort**: M. **Q3 priority.**

---

## 📊 Sinteză Status

| # | Feature | Status | Effort | Quarter | Impact |
|---|---|---|---|---|---|
| 1 | Search semantic AI | 📐 PLAN | M | Q2 | High |
| 3 | Calendar civic | 📐 PLAN | M | Q2-Q3 | Medium |
| 6 | Profil public | 📐 PLAN | M | Q2 | Medium |
| 7 | Streak civic | 🟢 SCAFFOLDED | S | Q2 | Medium |
| 8 | Newsletter | 📐 PLAN | M | Q2 | High |
| 9 | Voice input | 📐 PLAN | M | Q2-Q3 | Medium |
| 10 | Heatmap | 📐 PLAN | M | Q2 | High |
| 12 | Embed widget | 📐 PLAN | M | Q3 | Medium |
| 13 | Push intreruperi | 📐 PLAN | M | Q2 | High |
| 14 | Counter today | 📐 PLAN | S | Q1-Q2 | Medium |
| 17 | Multilang | 📐 PLAN | M | Q3 | Medium |

**Total effort**: ~110 zile dev. Q2 priority: 7 features (high-impact data-driven).
