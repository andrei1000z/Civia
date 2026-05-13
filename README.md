# Civia — Platforma civică a României

Platformă civică independentă, gratuită, pentru cetățenii din România. Sesizări AI-formalizate către primării, petiții civice, calitatea aerului live, hărți de mobilitate, știri agregate, ghiduri practice și date publice — pentru toate cele 42 de județe.

**Live:** [civia.ro](https://civia.ro)

> Civia.ro nu promovează niciun partid politic, nicio poziționare ideologică. Militam pentru o lume corectă, modernă și pentru oameni.

---

## Stack

| | |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack, React 19) |
| **Bază de date** | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| **AI** | Groq — `llama-3.3-70b-versatile` (text formal), `llama-3.1-8b-instant` (clasificare + extractor petiții), Llama 4 Scout 17B vision (analiză foto sesizări) |
| **Hărți** | Leaflet + react-leaflet, OSM tiles, IDW heatmap pentru calitatea aerului |
| **Styling** | Tailwind CSS v4 cu CSS variables, dark mode complet |
| **Email** | Resend + magic-link (fără parole) |
| **Rate limit + cache** | Upstash Redis |
| **Erori** | Sentry cu PII redacted |
| **Deploy** | Vercel |

## Funcționalități

### Acțiuni civice
- **Sesizări AI** (`/sesizari`) — descrii problema în 2 cuvinte + atașezi o poză, AI-ul generează scrisoarea formală cu temei legal OG 27/2002 către autoritatea corectă; co-semnături, urmărire status, înainte/după.
- **Petiții civice** (`/petitii`) — catalog curatat din Declic, Avaaz, Change.org, petitie.civica.ro; admin-ul folosește scraperul AI pentru a auto-completa titlul, sumarul, conținutul, categoria și imaginea dintr-un singur URL.
- **Ghiduri practice** (`/ghiduri`) — Legea 544, contestare amendă, dezbatere publică, înființare ONG, ajutoare sociale, ghid cutremur ș.a.m.d.

### Date civice live
- **Proteste programate** (`/proteste`) — calendar civic cu mitinguri, marșuri, evenimente civice anunțate. Mod „cum a fost" cu imagini + presa.
- **Întreruperi** (`/intreruperi`) — apă, caldură, gaz, curent, lucrări — agregate din Apa Nova, Termoenergetica, Distrigaz, E-Distribuție, PMB, RADP. iCal + RSS + JSON API.
- **Știri** (`/stiri`) — RSS din Digi24, HotNews, G4Media, Mediafax, News.ro + ziare locale per județ. Sinteză AI structurată per articol cu reading-time + copy + listen, refresh la 30s pe traffic.

### Date publice deschise
- **Sesizări publice** (`/sesizari-publice`) — feed live cu sesizările publice ale altor cetățeni, vot + co-semnături.
- **Sesizări rezolvate** (`/sesizari-rezolvate`) — galerie înainte/după cu probleme rezolvate de primării.
- **Embed widget** (`/embed/[judet]`) — iframe gratuit pentru jurnaliști și bloggeri; sesizările live din județ + counter total, util pentru investigații locale.
- **42 județe** (`/judete`) — fiecare cu sesizări, întreruperi, știri, ghiduri, autorități, evenimente, educație, sănătate, siguranță.

### Cont + GDPR
- **Magic-link auth** — fără parole, opțional Google + Apple OAuth.
- **GDPR** — toate datele exportabile JSON, ștergere cont definitiv, granular cookie consent (Accept toate / Respinge non-esențiale / Personalizează — egal de easy de respins).
- **Newsletter opt-in dual** — email + SMS, auto-save la toggle, lista vizibilă admin-ului la `/admin/newsletter`.
- **Pagini legale EU-grade** (`/legal/confidentialitate`, `/legal/termeni`) — GDPR (UE 2016/679), DSA (UE 2022/2065), ePrivacy, drepturile consumatorilor, Legea 506/2004 + 365/2002.

---

## Setup local

```bash
git clone https://github.com/<your-org>/civia.git
cd civia
npm install
cp .env.local.example .env.local
# Editează .env.local cu valorile reale
npm run migrate   # aplică toate migrațiile pe DB-ul Supabase
npm run dev       # http://localhost:3000
```

Detalii complete despre variabilele de mediu, migrații, OAuth, DNS și runbook de deploy: vezi [`DEPLOY.md`](./DEPLOY.md).

---

## Structură

```
src/
  app/                      # Next.js 16 App Router
    [judet]/                # 14 subroute county-scoped × 42 județe
    admin/                  # role-gated (profiles.role='admin')
    api/                    # 35+ route handlers
    legal/                  # GDPR + ToS + cookies, EU-grade
    sesizari/, petitii/, proteste/, intreruperi/, stiri/, ghiduri/, embed/, ...
  components/
    layout/PageHero.tsx     # canonical gradient hero — folosește-l, nu reinventa
    sesizari/, petitii/, stiri/, ai/CivicAssistant.tsx
    maps/                   # Leaflet wrappers + custom AQI canvas
  lib/
    supabase/{client,server,admin}.ts
    sesizari/events.ts      # catalog comun pentru timeline events
    stiri/, petitii/, groq/, analytics/
  data/                     # date statice (counties, ghiduri, evenimente, ...)
supabase/
  schema.sql                # base
  migrations/               # 023+ idempotente
public/geojson/             # OSM data shipped pentru first-paint maps
scripts/                    # scripturi one-shot (migrate, backfill, verify)
```

---

## Convenții pentru contributori

- Server Components by default, `"use client"` doar când chiar e nevoie.
- Trei roluri Supabase: `client.ts` (browser), `server.ts` (cookie-aware SSR), `admin.ts` (service role, server-only).
- Hero pentru orice pagină nouă: `<PageHero>` din `src/components/layout/PageHero.tsx` cu unul din cele 8 preset-uri din `HERO_GRADIENT`.
- Sesizare timeline events: declară-le în `src/lib/sesizari/events.ts → SESIZARE_EVENT_META`. Toate suprafețele care randează timeline-ul citesc de aici.
- Routing rules: `NAV_LINKS` din `src/lib/constants.ts` — `national: true` înseamnă fără prefix `/[judet]/` chiar dacă userul are județ salvat.
- Niciun `#xxxxxx` hardcodat pentru culori brand. Folosește `var(--color-*)` și `var(--radius-*)` din `globals.css`.

Mai mult în [`AGENTS.md`](./AGENTS.md).

---

## Date și surse

- **Populație** — INS Recensământ 2021
- **Accidente rutiere** — DRPCIV 2023 (estimări proporționale per județ)
- **Calitate aer** — Sensor.Community + OpenAQ + WAQI + ANPM
- **Primari** — BEC, alegeri locale 2024
- **Sesizări publice** — date generate de utilizatori, anonimizate conform GDPR
- **Buget** — Ministerul Finanțelor, INS

Datele agregate publice sunt licențiate **CC BY 4.0** — reutilizează cu atribuire. API public la `/dezvoltatori`.

---

## Privacy & analytics (transparență)

Civia colectează **analytics anonime** prin Upstash Redis cu retenție de 30 de zile:
- Hash de visitor ID, country/city derivat din IP, clasă de device, pageview-uri, click-uri, web vitals, AI usage counts.
- **Nu** se colectează email, nume, sau adresă în analytics.
- Per-visitor session timeline în `/admin/analytics/sessions` — last 200 events / visitor, TTL 30 zile, cap 1000 vizitatori. Folosit pentru debugging UX (rage-clicks, error spikes), niciodată pentru profilare individuală.
- Cookie consent granular pe homepage (Accept toate / Respinge non-esențiale / Personalizează — egal de easy de respins).

User-ul poate exporta toate datele lui (JSON) sau șterge contul definitiv din `/cont`. Politica completă: `/legal/confidentialitate`.

Pentru raportare vulnerabilități de securitate: vezi [`SECURITY.md`](./SECURITY.md).

## Contribuie

- **GitHub Issues** — bug reports + feature requests
- **PR-uri** — bine venite, citește [`CONTRIBUTING.md`](./CONTRIBUTING.md) și [`AGENTS.md`](./AGENTS.md) pentru convenții
- **Date locale lipsă** — emailuri primării, ziare locale, surse oficiale lipsă din catalog: deschide un issue sau folosește formularul de feedback din footer
- **Conținut** — petiții civice de adăugat, ghiduri de scris, evenimente locale: la fel
- **Code of Conduct** — vezi [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- **Securitate** — raportează vulnerabilitățile **privat**, vezi [`SECURITY.md`](./SECURITY.md)

## Licență

- Cod sursă: **MIT** — vezi [`LICENSE`](./LICENSE).
- Date agregate publice: **CC BY 4.0** — reutilizează cu atribuire.
- Branding-ul Civia (logo, identitate vizuală, nume „Civia") rămâne proprietatea operatorului. Dacă faci fork și deploy public, te rugăm să rebrand-uiești.
