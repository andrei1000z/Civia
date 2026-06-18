<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Civia — codebase guide for AI agents

## What this project is

Civia.ro is an independent civic platform for Romania. Citizens can:

- File AI-formalized complaints (`/sesizari`) addressed to the right authority via OG 27/2002.
- Sign curated civic petitions (`/petitii`) sourced from Declic, Avaaz, etc.
- See planned utility outages (`/intreruperi`), nationally and per county (`/intreruperi/{slug}`).
- Browse scheduled protests (`/proteste`) and compare counties (`/compara`).

**Civia is national-only.** The county-scoped subtree `/[judet]/...` (per-county landing, sesizari, autoritati, evenimente, istoric) was REMOVED 2026-06-18 — along with the `/stiri` news feature, the `/harti` mobility maps, and the `/aer` air-quality pages (all already gone). Everything lives at national routes (`/sesizari`, `/petitii`, `/ghiduri`, `/intreruperi`, `/proteste`, `/compara`, …). `proxy.ts` 308-redirects any legacy `/{county}/*` URL to the national equivalent (or home). The Leaflet map components survive only for sesizari visualization.

## Stack at a glance

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** App Router, Turbopack, React 19 |
| Database | **Supabase** Postgres + Auth + Storage + Realtime |
| AI | **Groq** — `llama-3.3-70b-versatile` (text), `llama-3.1-8b-instant` (classify), Llama 4 Scout 17B vision |
| Cache + rate limit + analytics | **Cloudflare D1** (Upstash-compatible API via `d1-client`; in-memory fallback if `CLOUDFLARE_API_TOKEN` missing) |
| Maps | **Leaflet** + react-leaflet, OSM tiles — sesizari visualization only (no `/harti` page) |
| Styling | **Tailwind CSS v4** with CSS-variable design tokens (dark mode) |
| Mail | **Resend** + magic-link auth (no passwords) |
| Errors | **Sentry** with PII redaction |
| Hosting | **Vercel** (Hobby plan — daily cron only, see "Background work" below) |
| Tests | **Vitest** for unit + lib tests |

## Routing rules (the one you'll trip on)

`src/lib/constants.ts → NAV_LINKS`. **All nav links are national** — there is no county prefixing anymore (the `/[judet]/` subtree was removed 2026-06-18). Navbar/MobileFab no longer compute a county slug; clicking any nav item goes straight to the national route.

`src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`) 308-redirects legacy county URLs so old Google-cache/share links don't 404: `/{slug}/intreruperi → /intreruperi/{slug}`; `/{slug}/{petitii|ghiduri|sesizari-publice} → /{segment}`; `/{slug}` and any other `/{slug}/*` (sesizari/autoritati/evenimente/istoric/harti/aer) → `/` (home). The `county` cookie is vestigial (UI context only, no routing effect).

## Where things live

```
src/
  app/
    [judet]/           # 14 county-scoped subroutes × 42 counties
    admin/             # role-gated (profiles.role='admin')
    api/               # 35+ API routes
    legal/             # GDPR + ToS — Romanian, EU-grade
    ...
  components/
    layout/PageHero.tsx       # SHARED gradient hero — use this, don't reinvent
    sesizari/, petitii/, stiri/, ai/CivicAssistant.tsx
    maps/HartiMap.tsx + MapTopSwitcher.tsx + AirHeatGrid.tsx
  lib/
    supabase/{client,server,admin}.ts   # 3 distinct client roles
    sesizari/events.ts                  # SHARED event meta (label/icon/color)
    stiri/{ai-summary,extract-facts,sources,rss}.ts
    petitii/ai-summary.ts
    groq/{client,prompts,templates}.ts
    analytics/redis.ts
  data/                # static reference data (counties, ghiduri, evenimente, …)
supabase/
  schema.sql           # base schema (run first)
  migrations/          # 023+ idempotent migrations
public/
  geojson/             # OSM data shipped with the app for fast first-paint maps
scripts/               # one-shot maintenance scripts (migrate, backfill, verify)
```

## Conventions

- **Server Components by default**; mark client with `"use client"` only when needed.
- **Three Supabase client roles**: `client.ts` for browser, `server.ts` for cookie-aware Server Components / route handlers, `admin.ts` (service role) for trusted server work. RLS is enabled on every table — service-role queries bypass it.
- **AI summaries are server-cached**: `getOrGenerateAiSummary` (stiri) / `getOrGeneratePetitieAiSummary` (petitii) read the cached column first, generate via Groq if absent, and persist back. Concurrent requests in the same lambda are coalesced via an in-memory in-flight map.
- **PageHero (`src/components/layout/PageHero.tsx`)** is the canonical hero pattern — gradient + icon chip + Sparkles tagline. Eight gradient presets in `HERO_GRADIENT`. Use it for any new page; don't hand-roll a hero card.
- **Sesizare timeline events** are typed in `src/lib/sesizari/events.ts` (`SESIZARE_EVENT_META`). One source of truth for label + icon + color across `/urmareste` and `/sesizari/[code]`.
- **Civia design tokens**: `var(--color-primary)`, `var(--color-surface)`, `var(--color-surface-2)`, `var(--color-border)`, `var(--color-text)`, `var(--color-text-muted)`, plus `--radius-{xs,sm,md,lg,full,button,pill,card}` and `--shadow-{1,2,3,4,xl}`. Never hardcode `#xxxxxx` for branded colors — always go through tokens.

## Background work + cron

Vercel Hobby caps cron at **1×/day**. Pattern: **one dispatcher** does the work.

**Canonical scheduler = `/api/cron/daily`** (the only cron in `vercel.json`, 09:00). It fans out via `fetch` to all sub-jobs (each fetch = a separate serverless invocation, so the daily-frequency cap is sidestepped without breaking it): reminders, auto-status, drafts/nudge, streaks, winback, **purge-retention**; newsletter on Mon/Tue/Fri.

`purge-retention` (`/api/cron/purge-retention`) enforces the GDPR retentions AND the storage hygiene: cosigner PII scrubbed at 90d/1y, anonymous sesizari at 3y, **`inbox_debug_log` rows >30d deleted**, and **orphan photos in the `sesizari-photos` Storage bucket** (unreferenced + >7d old, guarded by the `<ms>-<uuid>` filename timestamp against the upload→create race) removed.

The pg_cron migrations `078`/`078b` are **DEPRECATED** — do NOT enable `078b`'s HTTP jobs (reminders-6h, etc.) alongside the daily dispatcher: they call the same endpoints → duplicate emails. Migration `101_deprecate_pgcron_http` defensively unschedules them. The pure-SQL jobs in `078` (cleanup/mark-overdue) are DB-internal maintenance and don't conflict.

## AI guardrails

Read `src/lib/groq/prompts.ts → SYSTEM_PROMPT_FORMAL` before changing how sesizari emails are generated. The prompt has anti-cliché rules tuned to real failure modes we've seen ("pietonii sunt forțați să circule pe carosabil" hallucinated when the photo shows a clear sidewalk, etc.). Don't strip those rules — they're load-bearing.

**Critical anti-minimization rule** (bug 5/22/2026): the prompt MUST NOT contain ANY instruction telling the AI to say "rămâne spațiu de trecere", "mașinile ocupă X% / Y metri", or similar phrasing that minimizes the problem. The citizen is reporting a problem; the email contradicting itself ("there's parking on sidewalk BUT pedestrians have enough space") sabotages the sesizare. Rule 7 in SYSTEM_PROMPT_FORMAL is the source of truth — don't add competing rules that contradict it. Defense-in-depth lives in `src/lib/sesizari/anti-minimization.ts` (regex-based post-processor) — extend its patterns if you spot new minimization phrases in production.

Petition synthesis uses a smaller, structured prompt (`src/lib/petitii/ai-summary.ts`) with a "Pe scurt → Ce cere petiția → De ce contează" skeleton. News synthesis uses the same component (`src/app/stiri/[id]/AiSummary.tsx`) on both surfaces — the rendered output supports `**bold**` inline + `- ` bullets + a toolbar (read-time + copy + listen via `SpeechSynthesis`).

Vision auto-route (`src/lib/groq/vision-routing.ts` + `/api/ai/vision-route`) — analyses sesizare photo with Groq Llama 4 Scout, returns `{ tip, authority, confidence, description, evidence }`. Used to pre-fill the form before user clicks submit. Always returns a result (fallback to `confidence: 30` if model fails); no need to guard against null.

## Tests

`vitest.config.ts` runs unit tests on `src/lib/**`. Smoke-test data extractors before relying on them (e.g. the AQI IDW + dedup, the news fact extractor, the sesizari format helpers). Coverage isn't enforced, but the bar is: any helper you wouldn't ship without a test, ship with one.

## CTA copy convention

To keep the verbs consistent across surfaces:

- **Hero / entry-point CTA** — use **„Fă o sesizare"** (low-friction, friendly, encourages start). Optionally append context: "Fă o sesizare acum", "Fă o sesizare în 90 de secunde".
- **Form-submit button** — use **„Trimite sesizarea"** (action verb, formal, signals completion).
- **Listing card link** — use **„Vezi detalii"** or **„Vezi sesizarea"** (descriptive, not just an arrow). Avoid bare "Detalii →".
- **Share / clipboard** — use **„Distribuie"** or **„Copiază link"** (Romanian, never "Share").

Same convention applies for petitii: hero/entry "Semnează petiția", action button "Semnează acum", card link "Vezi detalii".

## EU compliance (LOAD-BEARING — respect at all times)

Civia targets **exactly** the EU baseline (GDPR / ePrivacy / ENISA / OWASP) — **not above, not below**. The full standard lives in [`docs/EU-COMPLIANCE.md`](docs/EU-COMPLIANCE.md); read it before touching anything that collects, stores, or transmits personal data. The non-negotiables:

- **Minimize at collection.** Only data that's strictly necessary. No auto-GPS (location is map-selected); photo EXIF/GPS is stripped client-side before upload. Never put real email/user-id in analytics payloads.
- **Every processing has a documented legal basis (Art. 6)** and a matching line in `/legal/confidentialitate`. New feature touching personal data → add the policy line + basis BEFORE launch. (This is how `referral_code` should have been handled — don't repeat it.)
- **Consent (non-essential) is opt-in OFF by default**, Accept/Reject at visual parity, retractable in one click. Gate non-essential tracking through `ConsentedAnalytics`.
- **Retention is declared AND enforced.** Anything kept must have a real purge in `/api/cron/purge-retention` (sesizări anonymized at 3y; cosigner email+ip_hash deleted 90d after the parent sesizare closes). Don't promise a retention you don't execute.
- **Docs == code.** The privacy policy must state the truth (storage type, duration, US-vs-EU processors with SCC). Don't claim "Frankfurt only" for a US vendor.
- **Don't over-engineer** (explicitly forbidden as *above* standard): DPIA paperwork, universal MFA, client-side/E2E encryption, k-anonymity analytics, ISO 27001 / SOC2 / NIS2 controls, periodic re-consent banners, blockchain logs, ID-document checks for GDPR requests. GDPR Art. 32 + ASVS L2 is the ceiling for an SME civic platform.

## Don't do

- **Don't add new full-bleed `<section>` heroes.** Use `<PageHero>` from `src/components/layout/PageHero.tsx`.
- **Don't import directly from `@supabase/ssr` or `@supabase/supabase-js`** in app code — go through `src/lib/supabase/{client,server,admin}.ts`.
- **Don't use ASCII straight quotes inside JS string literals when they appear in Romanian text** (curly „" are safe in `"..."` but ASCII `"` will close the string early). Use template literals or escape.
- **Don't write hand-rolled gradient classes per page.** Pick `HERO_GRADIENT.primary | petition | news | success | warning | data | authority | health`.
- **Don't bypass `SESIZARE_EVENT_META`** when rendering timeline rows. Adding a new event_type? Add it to the catalog first.
