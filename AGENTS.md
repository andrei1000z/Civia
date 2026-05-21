<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Civia — codebase guide for AI agents

## What this project is

Civia.ro is an independent civic platform for Romania. Citizens can:

- File AI-formalized complaints (`/sesizari`) addressed to the right authority via OG 27/2002.
- Sign curated civic petitions (`/petitii`) sourced from Declic, Avaaz, etc.
- Read AI-summarized national news (`/stiri`) with a structured "TL;DR" panel per article.
- See planned utility outages (`/intreruperi`).
- Browse interactive maps (`/harti`) for cycling, pedestrian, road, transit and air-quality layers.
- Compare counties (`/compara`), browse open budget data (`/buget`), and follow live impact metrics (`/impact`).

Every county (`/[judet]/...`) carries its own scoped versions of the maps + air + outages + stats + news. The action surfaces (sesizari, petitii, ghiduri) are deliberately **national-only** — they live at `/sesizari`, `/petitii`, `/ghiduri` and never get a `/[judet]/` prefix.

## Stack at a glance

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** App Router, Turbopack, React 19 |
| Database | **Supabase** Postgres + Auth + Storage + Realtime |
| AI | **Groq** — `llama-3.3-70b-versatile` (text), `llama-3.1-8b-instant` (classify), Llama 4 Scout 17B vision |
| Cache + rate limit | **Upstash Redis** |
| Maps | **Leaflet** + react-leaflet, OSM tiles, custom Canvas IDW heatmap for AQI |
| Styling | **Tailwind CSS v4** with CSS-variable design tokens (dark mode) |
| Mail | **Resend** + magic-link auth (no passwords) |
| Errors | **Sentry** with PII redaction |
| Hosting | **Vercel** (Hobby plan — daily cron only, see "Background work" below) |
| Tests | **Vitest** for unit + lib tests |

## Routing rules (the one you'll trip on)

`src/lib/constants.ts → NAV_LINKS` carries a `national: true` flag. Items with that flag are **never** prefixed with `/[judet]/` even when the user has selected a county. Today: `/sesizari`, `/petitii`, `/ghiduri` are national-only. `/harti` and `/stiri` are county-aware.

The "come home to your county" redirect lives in `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`). Visiting `/` with a `county` cookie 307-redirects to `/{slug}`. To opt out, the user picks "Național" in `/cont` — that clears the cookie via the `CountyPickerInline` component (which sets `max-age=0` AND `expires=epoch` defensively, because some browsers honor only one).

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

Vercel Hobby plan caps cron jobs at 1×/day. Two strategies in use:

1. **Daily cron** for `/api/stiri/fetch` (RSS pull) and `/api/newsletter/digest` (Mondays).
2. **Self-healing on traffic** for stiri: every visit to `/api/stiri` fires `/api/stiri/fetch` in `after()` (Next 16 background-after), throttled by a Redis NX lock with 5-min TTL. Lets articles surface within minutes of being posted on Digi24/HotNews/etc., without external cron infrastructure.

Auth on `/api/stiri/fetch` accepts either `Authorization: Bearer ${CRON_SECRET}` (cron path) or a logged-in admin session.

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

## Don't do

- **Don't add new full-bleed `<section>` heroes.** Use `<PageHero>` from `src/components/layout/PageHero.tsx`.
- **Don't import directly from `@supabase/ssr` or `@supabase/supabase-js`** in app code — go through `src/lib/supabase/{client,server,admin}.ts`.
- **Don't use ASCII straight quotes inside JS string literals when they appear in Romanian text** (curly „" are safe in `"..."` but ASCII `"` will close the string early). Use template literals or escape.
- **Don't write hand-rolled gradient classes per page.** Pick `HERO_GRADIENT.primary | petition | news | success | warning | data | authority | health`.
- **Don't bypass `SESIZARE_EVENT_META`** when rendering timeline rows. Adding a new event_type? Add it to the catalog first.
