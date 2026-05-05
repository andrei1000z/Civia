# Contributing to Civia

Mulțumim că ești interesat să contribui! Civia e o platformă civică
independentă pentru România — oricine poate trimite PR-uri, deschide
issue-uri sau ajuta cu date locale.

## Setup

```bash
git clone https://github.com/<your-fork>/civia.git
cd civia
npm install
cp .env.local.example .env.local
# Editează .env.local cu valorile reale (Supabase, Groq, Resend, Upstash)
npm run migrate   # aplică migrațiile pe DB-ul Supabase
npm run dev       # http://localhost:3000
```

Detalii complete în [`DEPLOY.md`](./DEPLOY.md).

## Înainte de PR

```bash
npm run lint           # ESLint + TypeScript
npx tsc --noEmit       # type-check
npm test -- --run      # vitest unit tests
```

Toate trei trebuie să treacă.

## Convenții

Lectură obligatorie înainte de a scrie cod:

- [`AGENTS.md`](./AGENTS.md) — codebase guide complet (stack, routing
  rules, three Supabase client roles, AI guardrails, PageHero pattern,
  SESIZARE_EVENT_META catalog).
- [`README.md`](./README.md) — feature overview + structură.

Pe scurt:
- **Server Components by default**; `"use client"` doar când chiar e
  nevoie (interactivitate, hooks, browser API).
- **Trei clienți Supabase**: `client.ts` (browser), `server.ts` (cookie-
  aware SSR), `admin.ts` (service role, server-only — bypass RLS).
- **Hero pentru pagini noi**: `<PageHero>` din `src/components/layout/
  PageHero.tsx`. Nu reinventa.
- **Culori brand**: `var(--color-*)`. Niciun `#xxxxxx` hardcodat.
- **Sesizare timeline events**: declară în `src/lib/sesizari/events.ts →
  SESIZARE_EVENT_META`.

## Tipuri de contribuții

### Bug reports + feature requests
GitHub Issues. Include:
- Pași de reproducere
- Browser + OS dacă e UI
- URL exact dacă e o pagină
- Screenshot dacă vizual

### PR-uri
- Branch din `main`
- Commit-uri mici, mesaj clar (`feat(petitii): ...`, `fix(sesizari):
  ...`, `refactor(ai): ...`)
- Descrie *de ce*, nu doar *ce*
- Adaugă teste pentru lib helpers și data extractors

### Date și conținut
- **Emailuri primării lipsă**: editează
  `src/data/autoritati-contact.ts` cu sursa oficială (site primărie,
  ANFP).
- **Ghiduri practice noi**: `src/data/ghiduri.ts`.
- **Petiții civice de adăugat**: foloseste admin scraper-ul (`/admin/
  petitii`) sau deschide un issue cu URL-ul.
- **Ziare locale lipsă**: `src/data/news-sources.ts`.

### Securitate
**Nu** deschide issue public. Vezi [`SECURITY.md`](./SECURITY.md).

## Code of Conduct

Vezi [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Pe scurt: respect,
zero toleranță pentru hărțuire, focus pe problemă nu pe persoană.

## Licență

Contribuind, accepți că PR-ul tău va fi licențiat sub MIT (vezi
[`LICENSE`](./LICENSE)). Dacă fork-ul tău e proprietate intelectuală
sensibilă, nu trimite PR.
