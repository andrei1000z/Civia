# 🏗️ Architecture Decisions + Risk Register — Civia.ro 2026-05-29

---

## 📐 Architecture Decision Records (ADRs)

> Format: Status → Context → Decision → Consequences

### ADR-001: Switch Vercel Hobby → Pro pentru multi-cron + extended functions

**Status**: 🟡 PROPOSED (recommended for Q1)

**Context**: Vercel Hobby plan permite 1 cron/zi. Avem deja 8 pg_cron jobs sub-daily (RSS fetch 30min, intreruperi 4h, petitii 12h, sesizari reminders 6h, etc.) — folosim pg_cron Supabase ca workaround. Plus, feature #1 (Agent AI Insistent) necesită multiple daily crons pentru escalation pipeline (zile 30/45/60). Hobby limit function duration 60s — depășit la generate AI summary batch.

**Decision**: Upgrade la Vercel Pro ($20/mo) la Q1 start, sau cel târziu când lansăm Agent AI Insistent. Migrate cron-uri critice din pg_cron Supabase la Vercel native crons pentru centralizat monitoring + logs unificat în Vercel.

**Consequences**:
- ✅ Multi-cron native (până la 100/proiect)
- ✅ Function timeout 5min (vs 60s)
- ✅ 1TB bandwidth/mo (vs 100GB)
- ✅ Better build cache + custom domains unlimited
- ❌ $240/an cost (acceptabil pentru civic project sponsorizat)
- ❌ Migration pg_cron → Vercel cron = 1 zi efort

---

### ADR-002: pgvector pentru search semantic + dedup sesizări (vs Pinecone/Weaviate)

**Status**: 🟡 PROPOSED (Q2)

**Context**: Avem deja sesizări/petitii/stiri ca text. Vrem search semantic + dedup similare. Opțiuni: pgvector (în Supabase), Pinecone managed ($70/mo start), Weaviate self-host.

**Decision**: pgvector. Activăm extension în Supabase, generăm embeddings via Groq (sau Cloudflare AI gratuit), store ca coloană `embedding vector(384)`. HNSW index pentru speed.

**Consequences**:
- ✅ Zero extra service — colocated cu data
- ✅ JOIN cu sesizari direct
- ✅ Zero cost extra
- ❌ Slower decât Pinecone la >1M docs (acum: sub 100k = ok)
- ❌ Migration la alt vendor dacă scale = pain

---

### ADR-003: Edge runtime selective pentru hot routes

**Status**: 🟡 PROPOSED (P1)

**Context**: `/api/analytics` (track) + `/api/v2/clasament` + simple GET routes execute frecvent. Edge runtime = TTFB <100ms global, dar nu suportă unpdf/sharp/canvas.

**Decision**: Edge runtime DOAR pentru:
- `/api/analytics` (POST track — Redis only)
- `/api/v2/clasament` (read materialized view)
- `/api/v2/sesizari` (read public sesizari feed)
- `/api/healthz`

Node runtime continuă pentru:
- `/api/sesizari` (POST, geocoding + AI + Resend)
- `/api/inbox/reply` (heavy PDF/DOCX/image extraction)
- `/api/ai/*` (Groq SDK + Sentry)

**Consequences**:
- ✅ TTFB ms pe routes hot
- ✅ Less Node serverless cost
- ❌ Bifurcation cognitive (dev trebuie să știe cu ce runtime lucreaza)
- ❌ Edge dependencies limited

---

### ADR-004: Cloudflare R2 pentru poze noi (vs Supabase Storage)

**Status**: 🟡 PROPOSED (Q1-Q2)

**Context**: Poze sesizări stocate în Supabase Storage. Supabase egress = $$ la scale. R2 = zero egress. Plus, Worker R2 transforms native (resize, compress, format webp/avif).

**Decision**:
- Migrate poze NOI la R2 bucket `civia-sesizari-photos`
- Keep poze ISTORICE în Supabase Storage (no migration unnecessary)
- Pipe upload prin Worker pentru auto-compress + WebP/AVIF transforms
- Public URL: `https://photos.civia.ro/{key}` cu CDN gratuit

**Consequences**:
- ✅ Zero egress cost (poze servesc multe — share, embed)
- ✅ Auto-transform native (no client-side compression overhead)
- ✅ Better caching (CF CDN global)
- ❌ Worker complexity adițional
- ❌ Dual storage (Storage + R2) = mental overhead

---

### ADR-005: RLS-first cu helper `is_admin()` STABLE SECURITY DEFINER

**Status**: 🟢 ACCEPTED (recommended Q1)

**Context**: Currently 14 migrations folosesc inline subquery `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`. Lent (re-evaluated per row), greu de menținut.

**Decision**:
- Creează `CREATE FUNCTION is_admin() RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER`
- Migrează toate policies să folosească `is_admin()` în loc de subquery
- Plus `(SELECT auth.uid())` în loc de `auth.uid()` pentru caching planner

**Consequences**:
- ✅ 5-50x speedup pe queries cu RLS
- ✅ Refactor centralizat — 1 funcție vs 14 inline
- ✅ Type safety (boolean return)
- ❌ STABLE function caching subtle — needs testing
- ❌ SECURITY DEFINER = needs review pentru privilege escalation

---

### ADR-006: Sentry SaaS de.sentry.io rămâne (vs self-host GlitchTip)

**Status**: 🟢 ACCEPTED

**Context**: Sentry SaaS Free tier = 5k errors/mo + 10k performance/mo. Civia actual ~under quota. Self-host GlitchTip viable dar = ops burden.

**Decision**: KEEP Sentry SaaS Free tier. Switch la self-host (Hetzner $5/mo) DOAR dacă:
- Hit quota frecvent (alert: >80% usage)
- Privacy concerns (PII în breadcrumbs imposibil de scrubbed)
- Cost paid tier ($26/mo) nejustificat

**Consequences**:
- ✅ Zero ops
- ✅ EU region (de.sentry.io) — GDPR friendly
- ❌ Quota limita scale
- ❌ Vendor lock-in (SDK swap = effort)

---

### ADR-007: Resend continuă ca email provider primar

**Status**: 🟢 ACCEPTED

**Context**: Resend EU verified domain civia.ro. Send + receive via Cloudflare Email Routing + Worker. Current bounce issues sunt cu destinatari (politia romana), nu Resend.

**Decision**: KEEP Resend. Setup secondary provider (Postmark) DOAR ca fallback emergency dacă Resend account suspended.

**Consequences**:
- ✅ Excellent DX (verified domain, webhooks, SDK)
- ✅ EU region
- ❌ Dependency single-vendor pentru critical infra
- 🟡 Mitigation: Postmark account warm idle ($0 până folosit)

---

### ADR-008: PWA hybrid offline-first cu network-first HTML

**Status**: 🟢 ACCEPTED (SW v11 deployed)

**Context**: Service Worker (sw.js v11) current: cache-first pe `/_next/static`, network-first pe HTML, network-only pe `/api/*`.

**Decision**: Pattern current rămâne. ADD:
- Cache GET `/api/v2/sesizari` (public feed) cu stale-while-revalidate 60s
- Cache GET `/api/v2/clasament` cu SWR 5min
- Browse sesizări publice offline = OK
- Submit = require network (queue dacă offline?)

**Consequences**:
- ✅ Read-only browse funcționează offline
- ✅ Mobile users tunel pierd conexiune = nu pierd UI
- ❌ Submit queue offline = complex (race conditions, retry logic)
- 🟡 Phase 2 implementation

---

### ADR-009: Public API v1 cu API keys + rate limits per tier

**Status**: 🟡 PROPOSED (Q3)

**Context**: Big feature #7 (Open Data Marketplace) necesită API public. Trebuie design solid pentru sustainability + anti-abuse.

**Decision**:
- API surface în `/api/v1/*`: sesizari, petitii, stiri, autoritati, statistici
- Authentication: API key în header `Authorization: Bearer civia_pk_...`
- Tiers:
  - Anonymous: 100 req/h global
  - Free key: 1000 req/h
  - Paid $20/mo: 100k req/h
  - Press partner: unlimited (whitelisted)
- Rate limit via Upstash Redis
- OpenAPI spec + Swagger UI public
- Stripe Subscriptions pentru paid tiers

**Consequences**:
- ✅ Revenue stream pentru sustainability
- ✅ Pressure pentru data quality (cu API public, dev pretenții)
- ✅ Foundation pentru jurnaliști + cercetători
- ❌ Maintenance overhead (versioning, breaking changes)
- ❌ Spec & docs effort important

---

## ⚠ Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| 1 | Resend account suspended (volume mare emailuri spam classified) | Medium | **Critical** | (a) Cleanup dead addresses (cron weekly) (b) Postmark account warm idle (c) Monitor bounce rate alert >5%/h | dev |
| 2 | Supabase Free tier hit (db egress, requests) | Medium | High | (a) Monitor usage Vercel dashboard (b) Switch Pro $25/mo proactively at 70% (c) Migrate cold data la R2 archive | dev |
| 3 | Cloudflare Worker abuse — spam inbox endpoint | Medium | High | (a) Bearer secret + IP allowlist (b) Rate limit per IP (c) Sentry alert on >100 req/min | dev |
| 4 | AI quality regression — Groq deprecates Llama 3.3 70B | High | High | (a) Multi-model fallback (b) Eval suite cu sample inputs (c) Anthropic API ca backup | dev |
| 5 | DMARC reports flood (RUA mailto setup) | Medium | Medium | (a) Dedicated inbox dmarc@civia.ro NOT personal email (b) Auto-archive after parse (c) `pct=25` la start | dev |
| 6 | DDoS via /api/sesizari open endpoint | Low | **Critical** | (a) Cloudflare WAF rules (b) Rate limit aggressive 5/h/IP (c) Honeypot enforced (d) CSRF token | dev |
| 7 | Image upload abuse (Supabase Storage fill quota) | Medium | High | (a) Max 5MB per upload enforced (b) Max 5 per sesizare enforced (c) Compress client-side before upload (d) Move la R2 cu lifecycle 1 an | dev |
| 8 | GDPR breach (PII în Sentry logs) | Medium | **Critical** | (a) `scrubSentryEvent` extended (b) PII test suite (c) Privacy policy clear (d) Right to deletion endpoint | dev + legal |
| 9 | Maintainer burnout (solo dev) | High | **Critical** | (a) Recruit 1 co-maintainer (b) Document runbooks (c) Sentry alert paging rotation (d) Vacation calendar | maintainer |
| 10 | Legal challenge from primării (defamation pe „shame wall") | Medium | High | (a) Legal review feature P3 #131 before launch (b) Disclaimers cu „dată oficială ANI/Curtea Conturi" (c) Right of reply | dev + legal |
| 11 | Data loss (no backup strategy) | Medium | **Critical** | (a) **URGENT** GH Actions daily pg_dump → R2 (b) Test restore quarterly (c) Off-site backup S3 cross-region | dev |
| 12 | Browser API changes (View Transitions deprec) | Low | Medium | (a) Use only stable APIs (b) Feature detection + graceful fallback (c) Sentry breadcrumb on unsupported | dev |
| 13 | Sentry quota exceeded (errors flood unexpected) | Medium | Medium | (a) Sentry sample rate adaptive (b) Alert at 80% quota (c) Self-host GlitchTip pregătit ca fallback | dev |
| 14 | Domain renewal lapse civia.ro | Low | **Critical** | (a) Auto-renew enabled (b) Calendar reminder 30 zile înainte (c) 2FA pe registrar account | maintainer |
| 15 | Groq API key leaked în git history | Low | High | (a) Pre-commit hook detect-secrets (b) Rotation lunar (c) Vault management Vercel ENV | dev |
| 16 | Cetățean depune fals positive cu sesizare frauduloasă | Medium | Medium | (a) Honeypot + bot detection (b) Rate limit per IP (c) Manual review admin (d) Report abuse button | dev |
| 17 | Primărie raportează site la Cloudflare ca „spam source" → blocked | Low | High | (a) Whitelist civia.ro la primării proactiv (b) DKIM strict (c) Visible „from sesizari@civia.ro on behalf of cetățean X" în email | dev |
| 18 | Database corruption (rare dar fatal) | Very Low | **Critical** | (a) Daily backup (b) Point-in-time recovery Supabase Pro (c) Replica region dacă upgrade | dev |
| 19 | Vercel ENV vars leaked (preview deploy) | Low | High | (a) Vercel preview deployments scope vars (b) Audit env per environment (c) Rotate secrets quarterly | dev |
| 20 | Cetățeni vulnerabili expun PII în descriere (CNP, telefon) | Medium | High | (a) Pre-submit AI scan pentru PII detection (b) Warn user before submit (c) Auto-redact server-side | dev |

---

## 🎯 Risk Heatmap

```
                Impact →
                Low      Medium    High     Critical
Likelihood ↓
   High         #12      #5        #4,#9    (none)
   Medium       (none)   #16       #2,#3,#7 #1,#11
                                   #10,#13,#20
   Low          (none)   (none)    #15,#17  #6,#14,#18
                                            #19,#8
```

**Top 5 risks to actively monitor**:
1. **#1 Resend suspended** — single point of failure pe email
2. **#11 Data loss** — fără backup strategy (CRITICAL P0)
3. **#9 Maintainer burnout** — solo dev sustainability
4. **#8 GDPR breach** — legal + reputational damage
5. **#6 DDoS open endpoint** — abuse posibil

**Mitigation effort prioritization**:
- Q1: #1 + #11 + #6 (security + reliability foundations)
- Q2: #9 + #8 (sustainability + privacy)
- Q3-Q4: restul gradual ca features se adaugă

---

## 📚 Anexe

### Conventions Civia (din AGENTS.md)
- Server Components by default
- 3 Supabase client roles (browser/server/admin)
- PageHero pattern pentru hero-uri
- SESIZARE_EVENT_META single source truth
- CSS-var design tokens (no hardcoded #hex)

### Stack Frozen (no swap fără ADR)
- Next.js 16 + React 19 + Turbopack
- Supabase Postgres + Auth + Storage (EU)
- Groq Llama models (text + vision)
- Upstash Redis EU
- Cloudflare R2 + Workers + Email Routing
- Vercel hosting
- Resend EU email
- Sentry de.sentry.io
- Tailwind v4 dark-only

### Key Files Critical (touch carefully)
- `src/proxy.ts` — Next 16 middleware rename
- `src/lib/sesizari/authorities.ts` — routing logic + police detection
- `src/lib/inbox/classify.ts` — recent rewrite cu mojibake
- `src/components/sesizari/SesizareForm.tsx` — 1500+ lines, the heart
- `cloudflare-worker/email-handler.js` — MIME parsing critical
- `public/sw.js` — version bump pe deploys breaking changes
- `supabase/migrations/*` — append-only, never edit applied

---

*Document maintained by: dev maintainer. Update on each major decision. Review quarterly.*
