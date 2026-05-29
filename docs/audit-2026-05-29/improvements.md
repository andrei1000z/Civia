# 🎯 130+ Optimizări pentru Civia.ro — Audit 2026-05-29

> Sinteză după sesiune de debugging + analiza activă a codului, infra (Vercel/Supabase/Cloudflare/Resend/Sentry) și 62 inbox replies clasificate.

## 📑 Cuprins

- 🚨 **P0** — Urgent (15)
- 🔴 **P1** — Critical (38)
- 🟡 **P2** — Should-fix (48)
- 🟢 **P3** — Nice-to-have (35)

---

## 🚨 P0 — Urgent

### 1. 📧 Cleanup adrese moarte din `autoritati-contact.ts`
- **Categorie**: 📧 email · **Effort**: S · **Impact**: critical
- **Files**: `src/data/autoritati-contact.ts`, `src/lib/sesizari/authorities.ts`
- **De ce**: `bpr@b.politiaromana.ro` și `office@plmb.ro` fac bounce sistematic (~70% rate). PMB primește OK pe `relatiipublice@pmb.ro`. Trimitem la 4 destinatari, doar 1-2 ajung.
- **Cum**: Marchează `bpr@b.politiaromana.ro` ca DEAD în catalog cu flag `{dead:true, since:"2026-05-29"}`, scoate din TO, mută în CC opțional. Rulează cron săptămânal probe SMTP la fiecare adresă.

### 2. 🔒 Aplicare migration 085 (`bounced_recipients` + `bounce_raw`) confirmată
- **Categorie**: 📊 data · **Effort**: XS · **Impact**: critical
- **Files**: `supabase/migrations/085_bounce_per_recipient.sql`
- **De ce**: Webhook Resend acum captează per-recipient bounce. Fără coloanele noi, status final e tot „bounced" pentru sesizări cu doar 1-2 destinatari fail.
- **Cum**: Migration deja aplicată (`npm run migrate` rulat) — verifică în prod cu `SELECT bounced_recipients FROM sesizari LIMIT 1`.

### 3. 🤖 Sentry SDK init verificare post-`c582ea4`
- **Categorie**: 👁 observability · **Effort**: XS · **Impact**: critical
- **Files**: `instrumentation.ts`, `instrumentation-client.ts`
- **De ce**: Diagnostic `/api/admin/sentry-test` returnat `sdkInitialized:false` o dată. Sync require fix aplicat dar netestat post-deploy.
- **Cum**: Vizitează `/api/admin/sentry-test` → verifică `sdkInitialized:true`. Apoi revine `enabled:NODE_ENV==='production'` din configs (acum forced true).

### 4. 🛡 Force reload service worker pe deploy critic
- **Categorie**: 🛡 reliability · **Effort**: XS · **Impact**: high
- **Files**: `public/sw.js`, `src/components/InstallPrompt.tsx`
- **De ce**: Userii cu PWA installed vedeau JS vechi → eroare „Unexpected token 'A'" pe submit. SW v11 force-reload pe `CIVIA_SW_HARD_RELOAD` deja shipped, dar mecanism activ DOAR la version bump explicit.
- **Cum**: Automatizat — script `scripts/bump-sw.sh` care incrementează `CACHE_VERSION` la fiecare deploy major.

### 5. 🔒 Rate limit pe `/api/sesizari` POST (anti-abuse)
- **Categorie**: 🔒 security · **Effort**: S · **Impact**: critical
- **Files**: `src/app/api/sesizari/route.ts`
- **De ce**: Endpoint public, primește text + images, trimite emailuri reale la primării. Spam→ Resend account suspend risk.
- **Cum**: `rateLimitAsync(\`sesizari:${ip}\`, { limit: 5, windowMs: 3600_000 })` per IP/h. Plus honeypot deja existent — adăugă HMAC-signed CSRF token.

### 6. 🔒 Lockdown `exec_sql` RPC din Supabase
- **Categorie**: 🔒 security · **Effort**: S · **Impact**: critical
- **Files**: migration nouă `086_revoke_exec_sql.sql`
- **De ce**: `exec_sql(query text)` cu SECURITY DEFINER acceptă SQL arbitrar. Dacă SERVICE_ROLE_KEY leak → RCE pe DB.
- **Cum**: `REVOKE EXECUTE ON FUNCTION exec_sql(text) FROM anon, authenticated;` Lasă doar `postgres` role.

### 7. 📧 DMARC `p=quarantine` → `p=none` cu RUA reports
- **Categorie**: 📧 email · **Effort**: S · **Impact**: high
- **Files**: DNS records civia.ro
- **De ce**: `p=quarantine; aspf=s; adkim=s` strict cu Resend → unele primării marchează email-urile noastre ca spam. RUA mailto e gmail personal — nu mailing list.
- **Cum**: Schimbă temporar `p=none` cu `rua=mailto:dmarc@civia.ro` (configurează inbox dedicat) timp de 2 săptămâni pentru a vedea report-uri. Apoi revine `p=quarantine` cu pct=25.

### 8. 🤖 Cloudflare Worker pierde HTML body la inline images
- **Categorie**: 📧 email · **Effort**: M · **Impact**: high
- **Files**: `cloudflare-worker/email-handler.js`
- **De ce**: Confirmat live pe sector5 (sesizare 00006 reply) — body 0 chars, doar logo-uri inline ca atașamente. Pierdem răspuns oficial.
- **Cum**: Modifică MIME parser: când `multipart/related` cu text/html part, păstrează HTML și strip `<img src="cid:..."/>` references — body text rezultat e răspuns oficial.

### 9. 🔒 17 routes hand-roll role check → `requireAdmin()` helper
- **Categorie**: 🔒 security · **Effort**: M · **Impact**: high
- **Files**: `src/lib/auth/require-admin.ts` (nou), 17 routes în `src/app/api/admin/`
- **De ce**: Cod duplicat = drift = una uită check. Risk IDOR/escalation.
- **Cum**: Creează helper unic `requireAdmin(req): Promise<{user, role} | NextResponse>`. Migrate toate `/api/admin/*` routes.

### 10. 🤖 AI auto-route `politia6.ro` la `respins` vs `inregistrata`
- **Categorie**: 🤖 ai · **Effort**: XS · **Impact**: medium
- **Files**: `src/lib/inbox/classify.ts`
- **De ce**: „contact@politia6.ro Informare 'Confirmăm primirea'" e generic acknowledgment, nu acțiune. User vede „📨 Înregistrată" fals positive.
- **Cum**: Pattern subtler — auth_score < 60 + body < 100 + subject „Informare" → `cerere_informatii` cu confidence 60 (user verifică manual).

### 11. 📊 Backup automat zilnic Supabase la R2
- **Categorie**: 🛡 reliability · **Effort**: M · **Impact**: critical
- **Files**: `.github/workflows/backup-supabase.yml` (nou)
- **De ce**: Sesizările + replies = date civice irecuperabile. Zero backup strategy.
- **Cum**: GH Action zilnică: `pg_dump` via Supabase REST + upload R2 cu lifecycle 30 zile retention. Cost: <$1/lună R2.

### 12. 🔒 CSP fără `unsafe-inline` pe `script-src`
- **Categorie**: 🔒 security · **Effort**: M · **Impact**: high
- **Files**: `src/proxy.ts`
- **De ce**: Current CSP permite `unsafe-inline` → XSS surface mare. Next.js 16 suportă strict CSP cu nonce.
- **Cum**: Generate nonce per request în `proxy.ts`, pass via header, Next.js auto-attach pe `<Script>`.

### 13. 📧 Resend webhook signature verification
- **Categorie**: 🔒 security · **Effort**: XS · **Impact**: high
- **Files**: `src/app/api/resend/webhook/route.ts`
- **De ce**: Deja verificat Svix signature ✅. Dar `RESEND_WEBHOOK_SECRET` poate lipsi în env → 500 silent.
- **Cum**: Adaugă health-check endpoint care confirmă secret prezent + signature lib loaded.

### 14. 🔒 CF Worker Bearer token rotation
- **Categorie**: 🔒 security · **Effort**: S · **Impact**: high
- **Files**: `cloudflare-worker/email-handler.js`, Vercel ENV
- **De ce**: `INBOX_WEBHOOK_SECRET` setat odată, nu rotation. Risk: leak → email injection.
- **Cum**: Cron lunar `wrangler secret put INBOX_WEBHOOK_SECRET` cu valoare nouă, sync la Vercel via API.

### 15. 📧 Auto-retry pe bounce parțial cu lista filtrată
- **Categorie**: 📧 email · **Effort**: M · **Impact**: critical
- **Files**: `src/app/api/sesizari/[code]/auto-retry/route.ts` (nou)
- **De ce**: Acum 1-2 din 4 destinatari bounce, sesizarea e marcată „partial_bounced" dar nimic nu retrimite. Cetățeanul crede că totul a mers.
- **Cum**: Cron 4h: query `sesizari WHERE delivery_status='partial_bounced' AND retry_count<3` → resend la doar adresele nepicate, log în nou tabel `sesizari_retries`.

---

## 🔴 P1 — Critical

### 16. ⚡ React `cache()` wrapper pe `getSesizareByCode`/`getPetitieBySlug`/`getStire`
- **Categorie**: ⚡ perf · **Effort**: S · **Impact**: high
- **Files**: `src/lib/sesizari/repository.ts`, `petitii/`, `stiri/`
- **De ce**: Acelaș cod e citit de 2-3 ori în render server (page + JSON-LD + open graph) → 3x DB roundtrips.
- **Cum**: Wrap funcțiile cu `import { cache } from 'react'` — dedup per request.

### 17. ⚡ Cache-Control `s-maxage=60, stale-while-revalidate=300` pe API publice
- **Categorie**: ⚡ perf · **Effort**: S · **Impact**: high
- **Files**: `src/app/api/sesizari/route.ts`, `petitii/`, `stiri/`, `v2/clasament/`, `statistici/summary/`
- **De ce**: Acestea nu se schimbă instant. Edge cache pe Vercel = elimină 80% din requests la Supabase.
- **Cum**: `return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } })`.

### 18. 📊 Migrare RLS `auth.uid()` → `(SELECT auth.uid())` (65 occurrences)
- **Categorie**: 📊 data · **Effort**: L · **Impact**: high
- **Files**: `supabase/migrations/087_rls_select_auth_uid.sql`
- **De ce**: `auth.uid()` direct în policy = re-evaluat per row. `(SELECT auth.uid())` = singleton, planner optimizează. Win 5-50x pe queries cu RLS.
- **Cum**: Migration cu DROP+CREATE pe fiecare policy. Test pe staging întâi.

### 19. 📊 14 migrations folosesc `subquery profiles WHERE role='admin'` în RLS
- **Categorie**: 📊 data · **Effort**: L · **Impact**: high
- **Files**: nou `supabase/migrations/088_is_admin_function.sql`
- **De ce**: Subquery duplicat → cache miss + lent. Plus: refactor greu.
- **Cum**: Creează `CREATE FUNCTION is_admin() RETURNS boolean STABLE SECURITY DEFINER` + replace în toate policies cu `is_admin()`.

### 20. 🌐 Apex civia.ro → www redirect 307 → 301
- **Categorie**: 📈 seo · **Effort**: XS · **Impact**: medium
- **Files**: Vercel Domains config / `vercel.json`
- **De ce**: 307 nu cache permanent. Userii mobil care tastează `civia.ro` plătesc 11-34s latency.
- **Cum**: Vercel Domains → set primary domain → automate 301.

### 21. 📊 Indexes lipsă pe queries hot
- **Categorie**: 📊 data · **Effort**: S · **Impact**: high
- **Files**: nou `supabase/migrations/089_perf_indexes.sql`
- **De ce**: `sesizari_replies(authority_id)`, `sesizari(status, sent_at)`, `sesizari(moderation_status, created_at DESC)`, `sesizare_votes(user_id)`, `sesizare_verifications(user_id)` — toate queries frecvente fără index.
- **Cum**: `CREATE INDEX CONCURRENTLY idx_X ON table(col)` pentru fiecare.

### 22. 🛡 `statement_timeout` + `idle_in_transaction_session_timeout`
- **Categorie**: 🛡 reliability · **Effort**: XS · **Impact**: high
- **Files**: nou migration
- **De ce**: Default Supabase = nelimitat. Query slow → connection blocked → cascade.
- **Cum**: `ALTER ROLE authenticated SET statement_timeout = '15s'; ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '5min';`

### 23. ♿ FormField label association în SesizareForm
- **Categorie**: ♿ a11y · **Effort**: S · **Impact**: high
- **Files**: `src/components/sesizari/FormField.tsx`, `SesizareForm.tsx`
- **De ce**: Inputs fără `<label htmlFor>` association — screen readers nu citesc context.
- **Cum**: `<label htmlFor={id}>` + `<input id={id}>` consistent.

### 24. ♿ Focus trap pe modaluri custom
- **Categorie**: ♿ a11y · **Effort**: M · **Impact**: high
- **Files**: `src/components/ui/Dialog.tsx` (nou), `ImageLightbox.tsx`, `ShareMenu.tsx`
- **De ce**: Tab merge afară din modal → user pierdut. WCAG 2.1.2 fail.
- **Cum**: Bibliotecă `focus-trap-react` sau hand-roll: capture first/last focusable, trap Tab.

### 25. ♿ Touch targets <44×44 pe CookieBanner, AlertBanner, NewsletterNudge
- **Categorie**: ♿ a11y · **Effort**: S · **Impact**: medium
- **Files**: `src/components/CookieBanner.tsx` etc.
- **De ce**: Buttons close 24×24 — mobile users frustrant.
- **Cum**: Min `w-11 h-11` (44×44px) pe `<button>`. Hit area pe padding, icon centered.

### 26. 🔧 2 lint errors blocking CI
- **Categorie**: 🔧 devex · **Effort**: XS · **Impact**: medium
- **Files**: `src/app/admin/feedback/page.tsx`, `src/app/admin/petitii/page.tsx`
- **De ce**: CI fail → merge blocked pe Dependabot PRs.
- **Cum**: `npm run lint -- --fix` + manual review.

### 27. 📧 RSS cron HTTP 403 (CRON_SECRET desync)
- **Categorie**: 🛡 reliability · **Effort**: S · **Impact**: high
- **Files**: `.github/workflows/fetch-stiri.yml`, `src/app/api/stiri/fetch/route.ts`
- **De ce**: GH Actions secret diferit de Vercel ENV → cron rate-limit silent fail.
- **Cum**: Sync via `gh secret set CRON_SECRET --body "$(vercel env ls)"` + adaugă healthcheck.

### 28. 👁 8 Dependabot PRs failing CI stalled (din 2026-05-24)
- **Categorie**: 🔧 devex · **Effort**: M · **Impact**: medium
- **Files**: PR-uri Dependabot
- **De ce**: Lint failure (#26) blochează → security patches sunt stuck.
- **Cum**: Fix #26 → Dependabot auto-merge revine. Adaugă `dependabot.yml` cu `target-branch: staging`.

### 29. 👁 ErrorBoundary tagged per surface pentru Sentry
- **Categorie**: 👁 observability · **Effort**: M · **Impact**: medium
- **Files**: `src/app/sesizari/error.tsx`, `petitii/`, `stiri/`, `admin/`
- **De ce**: Errors curent toate sub `unknown` tag. Hard să prioritizezi.
- **Cum**: Per route group: `<ErrorBoundary tags={{ surface: 'sesizari' }}>`.

### 30. 🔒 escapeHtml pe From header în send-via-civia + cosign-send
- **Categorie**: 🔒 security · **Effort**: XS · **Impact**: high
- **Files**: `src/app/api/sesizari/[code]/send-via-civia/route.ts`, `cosign-send/`
- **De ce**: `From: ${author_name} <sesizari@civia.ro>` cu CR/LF în nume → header injection.
- **Cum**: `const safeName = author_name.replace(/[\r\n]/g, ' ').slice(0, 80)`.

### 31. 🔒 Lock `/api/inbox/reply` cu CF Worker IP allowlist
- **Categorie**: 🔒 security · **Effort**: S · **Impact**: high
- **Files**: `src/app/api/inbox/reply/route.ts`
- **De ce**: Bearer secret OK, dar dacă leak → spam injection în sesizare_replies.
- **Cum**: `if (!CF_WORKER_IPS.includes(getClientIp(req))) return 403;` + lista oficială Cloudflare.

### 32. 🔒 Zod + rate limit pe `/api/ai/improve` + `/api/ai/vision-route`
- **Categorie**: 🔒 security · **Effort**: S · **Impact**: high
- **Files**: cele 2 routes
- **De ce**: AI endpoints = $ — abuse → bill spike. Zod prevents malformed.
- **Cum**: `rateLimitAsync(\`ai:${ip}\`, {limit:10, windowMs:60_000})` + zod schema strict.

### 33. ⚡ Replace `.select("*")` cu coloane explicite
- **Categorie**: ⚡ perf · **Effort**: M · **Impact**: medium
- **Files**: `src/lib/sesizari/repository.ts` și similar
- **De ce**: `select(*)` wasteful — bandwith + Supabase egress costs.
- **Cum**: Tipuri TS + explicit columns per query.

### 34. 📊 Pin React 19.2.4 + Next 16.0.11 exact (CVE-2025-55182)
- **Categorie**: 🔒 security · **Effort**: XS · **Impact**: high
- **Files**: `package.json`
- **De ce**: Carat versions deschid la auto-upgrade vulnerabil.
- **Cum**: Exact pins, Dependabot patch updates.

### 35. 🔒 XSS în `/api/sesizari/[code]/pdf` — user fields raw în HTML
- **Categorie**: 🔒 security · **Effort**: S · **Impact**: high
- **Files**: `src/app/api/sesizari/[code]/pdf/route.ts`
- **De ce**: `<p>${sesizare.descriere}</p>` — descriere = user input → XSS în PDF render.
- **Cum**: `escapeHtml()` din `src/lib/html-utils.ts` (există) — wrap toate fields.

### 36. 🔒 Routes `/api/debug/schema` + `/api/debug/ai` publice
- **Categorie**: 🔒 security · **Effort**: XS · **Impact**: high
- **Files**: cele 2 routes
- **De ce**: Endpoints debug expun schema DB + prompts AI → reconnaissance attack.
- **Cum**: `requireAdmin()` gate sau șterge în prod.

### 37. 📧 Catalog adresele primării — health check săptămânal
- **Categorie**: 📧 email · **Effort**: M · **Impact**: high
- **Files**: nou `scripts/check-primarii-emails.ts`
- **De ce**: Adrese moarte se acumulează silent.
- **Cum**: SMTP probe weekly via Resend test API, alert pe >30% bounce rate per adresă.

### 38. ⚡ Dynamic import pentru Leaflet + recharts + tesseract
- **Categorie**: ⚡ perf · **Effort**: S · **Impact**: high
- **Files**: componente care le folosesc
- **De ce**: Heavy libs în initial bundle → INP slow pe mobile.
- **Cum**: `const Map = dynamic(() => import('@/components/maps/HartiMap'), { ssr: false })`.

### 39. 📱 PWA `display_override: ["window-controls-overlay"]`
- **Categorie**: 📱 mobile · **Effort**: XS · **Impact**: medium
- **Files**: `public/manifest.webmanifest`
- **De ce**: Better PWA UX pe Windows/Mac standalone.
- **Cum**: 1 line config.

### 40. 🤖 Inbox classifier — Sentry breadcrumb pe fallback
- **Categorie**: 🤖 ai · **Effort**: XS · **Impact**: medium
- **Files**: `src/lib/inbox/classify.ts`
- **De ce**: 2% fallback acum — vrem să vedem ce inputs ratează ca să improve.
- **Cum**: `Sentry.addBreadcrumb({category:'classify.fallback', data:{subject, body_len}})`.

### 41. 🎨 PageHero usage pe `/admin/*` (currently hand-rolled)
- **Categorie**: 🎨 ux · **Effort**: M · **Impact**: medium
- **Files**: `src/app/admin/*/page.tsx`
- **De ce**: Inconsistency vizual. CLAUDE.md convention rule.
- **Cum**: Migrate cu `<PageHero gradient="authority" icon={Shield}>`.

### 42. ♿ Skip-to-content link
- **Categorie**: ♿ a11y · **Effort**: XS · **Impact**: high
- **Files**: `src/app/layout.tsx`
- **De ce**: Screen reader users tab prin tot Navbar — WCAG 2.4.1 fail.
- **Cum**: First focusable: `<a href="#main" className="sr-only focus:not-sr-only">Sări la conținut</a>`.

### 43. 📊 `inbox_filter_log` retention 90 zile
- **Categorie**: 📊 data · **Effort**: XS · **Impact**: medium
- **Files**: nou migration
- **De ce**: Tabela crește unbounded.
- **Cum**: pg_cron daily: `DELETE FROM inbox_filter_log WHERE created_at < NOW() - INTERVAL '90 days'`.

### 44. ⚡ Streaming SSR pe `/sesizari-publice` (large list)
- **Categorie**: ⚡ perf · **Effort**: M · **Impact**: high
- **Files**: `src/app/sesizari-publice/page.tsx`
- **De ce**: 50 sesizări = blocked render. Suspense + RSC stream → user vede primele 10 instant.
- **Cum**: Split component, wrap cu `<Suspense fallback={<Skeleton />}>`.

### 45. 🤖 OCR fallback la Tesseract local când Gemini Vision fail
- **Categorie**: 🤖 ai · **Effort**: M · **Impact**: medium
- **Files**: `src/lib/inbox/screenshot.ts`
- **De ce**: Gemini API outage → 0 atașamente extrase.
- **Cum**: Catch Gemini error → fallback `tesseract.js` în Edge runtime (lent dar reliable).

### 46. 🛡 Sesizări fără response în 30 zile → email reminder auto
- **Categorie**: 🛡 reliability · **Effort**: M · **Impact**: high
- **Files**: nou cron + `src/app/api/sesizari/[code]/remind/route.ts`
- **De ce**: OG 27/2002 — autoritatea legal must respond. Reminder cu citation = pressure.
- **Cum**: Daily cron → query overdue → trimite "[REAMINTIRE] Sesizare X — Termenul de 30 zile a expirat".

### 47. 📈 Schema.org `GovernmentService` per sesizare publică
- **Categorie**: 📈 seo · **Effort**: S · **Impact**: high
- **Files**: `src/app/sesizari/[code]/page.tsx` (deja are)
- **De ce**: JSON-LD existent dar nu validat la Schema.org spec actual.
- **Cum**: Validate cu Google Rich Results Test, add `provider` + `audience` + `serviceType`.

### 48. 🤖 Cache layer pentru `reformulateDescriere` + `generateContextualActions`
- **Categorie**: 🤖 ai · **Effort**: M · **Impact**: high
- **Files**: `src/lib/sesizari/reformulate-descriere.ts`
- **De ce**: Userii apasă „Refac" de 3 ori → 3x Groq calls pentru același input.
- **Cum**: Redis cache `key = hash(input)`, TTL 24h.

### 49. 📊 Cleanup 5 `sesizare_replies` orphans cu `sesizare_id` NULL
- **Categorie**: 📊 data · **Effort**: XS · **Impact**: low
- **Files**: nou script
- **De ce**: Orphans = noise în admin inbox view.
- **Cum**: Script Python: list orphans → manual review → bulk update sau delete.

### 50. ⚡ `loading="eager"` pe LCP hero images
- **Categorie**: ⚡ perf · **Effort**: XS · **Impact**: high
- **Files**: hero images în PageHero
- **De ce**: Default lazy → LCP whiff. Hero e ABOVE FOLD always.
- **Cum**: `<Image priority loading="eager" />` pe hero.

### 51. 🔒 HMAC CSRF token pe forms publice
- **Categorie**: 🔒 security · **Effort**: M · **Impact**: high
- **Files**: forms + middleware
- **De ce**: Origin check (existent) e bypassable cu null origin.
- **Cum**: Token în cookie + hidden input, verify HMAC server-side.

### 52. 🛡 Bounce rate alerting în Sentry
- **Categorie**: 👁 observability · **Effort**: S · **Impact**: medium
- **Files**: Sentry alert rules
- **De ce**: Acum bounces silent. Vrem alert pe >5%/h.
- **Cum**: Sentry alert: `event.tags['email.bounce_rate'] > 5` per hour.

### 53. 🎨 Empty state pe `/sesizari-publice` filtered
- **Categorie**: 🎨 ux · **Effort**: S · **Impact**: medium
- **Files**: `src/app/sesizari-publice/page.tsx`
- **De ce**: User filtrează → 0 rezultate → blank page → confuz.
- **Cum**: `<EmptyState icon={SearchX} title="Nicio sesizare în această categorie" cta="Reset filtre">`.

### 54. 📱 Disable browser zoom inputs `font-size: 16px` minimum
- **Categorie**: 📱 mobile · **Effort**: XS · **Impact**: medium
- **Files**: `src/app/globals.css`
- **De ce**: iOS Safari auto-zoom pe inputs <16px → user frustrant.
- **Cum**: `input, textarea, select { font-size: 16px; }`.

---

## 🟡 P2 — Should-fix

### 55. 📊 Funnel data sesizare-create → conversion rate dashboard
- **Categorie**: 👁 observability · **Effort**: M · **Impact**: medium
- **Files**: `src/app/admin/analytics/page.tsx`
- **De ce**: Existent dar nu vizualizat — pierdem insights.
- **Cum**: Recharts BarChart cu drop-off per step.

### 56. 🤖 Telemetria pentru `detectsPoliceContext` (true/false rate)
- **Categorie**: 🤖 ai · **Effort**: XS · **Impact**: medium
- **Files**: `src/lib/sesizari/authorities.ts`
- **De ce**: Pattern matching nou — vrem să știm cât escaladează auto.
- **Cum**: Sentry breadcrumb on each detection.

### 57. 🎨 Sesizare timeline view cu icons + colors
- **Categorie**: 🎨 ux · **Effort**: M · **Impact**: medium
- **Files**: `src/components/sesizari/Timeline.tsx`
- **De ce**: Status changes greu de scanat fără visual hierarchy.
- **Cum**: Folosesc `SESIZARE_EVENT_META` deja definit, add Lucide icons.

### 58. 🎨 Print-friendly CSS pe sesizare details
- **Categorie**: 🎨 ux · **Effort**: S · **Impact**: low
- **Files**: `src/app/sesizari/[code]/print.css`
- **De ce**: Cetățeni imprimă pentru depunere fizică. Current = navbar + footer in print.
- **Cum**: `@media print { nav, footer { display: none; } }`.

### 59. ⚡ Preload font subset Romanian (cu diacritice)
- **Categorie**: ⚡ perf · **Effort**: XS · **Impact**: medium
- **Files**: `src/app/layout.tsx`
- **De ce**: Font swap visible pe LCP. Latin Extended subset → mai mic.
- **Cum**: `next/font` cu `subsets: ['latin-ext']`.

### 60. 📈 Sitemap.xml dinamic cu lastmod
- **Categorie**: 📈 seo · **Effort**: S · **Impact**: medium
- **Files**: `src/app/sitemap.ts`
- **De ce**: Static sitemap → Google miss updates pe sesizări noi.
- **Cum**: `export default async function sitemap() { ... }` cu recent sesizari.

### 61. 🎨 Sesizare share image generate dinamic (Open Graph)
- **Categorie**: 📈 seo · **Effort**: M · **Impact**: medium
- **Files**: `src/app/sesizari/[code]/opengraph-image.tsx`
- **De ce**: Share pe FB/Twitter = link plat fără preview cu detalii.
- **Cum**: `next/og` ImageResponse cu titlu sesizare + status + locație.

### 62. 📊 Tabelă `sesizari` partition by month (long-term)
- **Categorie**: 📊 data · **Effort**: L · **Impact**: medium
- **Files**: nou migration
- **De ce**: 1000 sesizări/lună × 5 ani = 60k rows. Partitioning improve query speed.
- **Cum**: `CREATE TABLE sesizari_2026_05 PARTITION OF sesizari ...`.

### 63. 🤖 AI vision route — confidence threshold per tip
- **Categorie**: 🤖 ai · **Effort**: S · **Impact**: medium
- **Files**: `src/lib/groq/vision-routing.ts`
- **De ce**: Acum threshold uniform 70%. Unele tipuri (parcare) needs >85%.
- **Cum**: Map per tip cu threshold custom.

### 64. 📱 Offline indicator în Navbar
- **Categorie**: 📱 mobile · **Effort**: S · **Impact**: medium
- **Files**: `src/components/layout/Navbar.tsx`
- **De ce**: Userii nu știu când sunt offline → submit fail confuz.
- **Cum**: `useEffect` cu `navigator.onLine` + banner roșu.

### 65. 🔧 `vercel.json` cleanup — duplicate redirects
- **Categorie**: 🔧 devex · **Effort**: XS · **Impact**: low
- **Files**: `vercel.json`
- **De ce**: 3 redirects pentru același pattern → maintenance nightmare.
- **Cum**: Consolidate într-un singur catch-all.

### 66. 📧 Email signature template pentru toate emailurile
- **Categorie**: 📧 email · **Effort**: S · **Impact**: medium
- **Files**: `src/lib/email/templates/`
- **De ce**: Curent fiecare email reinvented. Inconsistent.
- **Cum**: Component `<EmailSignature />` cu logo + disclaimer GDPR + unsubscribe.

### 67. 🎨 Sesizare „distribuie" cu butoane Facebook/WhatsApp/Twitter
- **Categorie**: 🎨 ux · **Effort**: S · **Impact**: medium
- **Files**: `src/components/sesizari/ShareMenu.tsx`
- **De ce**: Distribuie e generic Web Share API. Mai mult engagement cu butoane direct.
- **Cum**: Adaug butoane explicite cu pre-fill text.

### 68. ♿ Live region pentru status updates în SesizareForm
- **Categorie**: ♿ a11y · **Effort**: S · **Impact**: medium
- **Files**: `src/components/sesizari/SesizareForm.tsx`
- **De ce**: AI improve status („Generăm...") nu anunțat la screen readers.
- **Cum**: `<div aria-live="polite" role="status">`.

### 69. 📊 Index pe `notifications(user_id, read_at)` (partial)
- **Categorie**: 📊 data · **Effort**: XS · **Impact**: medium
- **Files**: nou migration
- **De ce**: Bell icon cu unread count = full scan.
- **Cum**: `CREATE INDEX ON notifications(user_id) WHERE read_at IS NULL`.

### 70. 🤖 Inbox classifier — pattern pentru „Prefectura"
- **Categorie**: 🤖 ai · **Effort**: XS · **Impact**: medium
- **Files**: `src/lib/inbox/classify.ts`
- **De ce**: Prefectura email pattern diferit de primării — currently goes to fallback.
- **Cum**: Add „prefectura\..*\.ro" detection + specific patterns.

### 71. 📱 Mobile bottom nav bar (4 tab-uri)
- **Categorie**: 📱 mobile · **Effort**: M · **Impact**: high
- **Files**: nou `src/components/layout/MobileBottomNav.tsx`
- **De ce**: Mobile users tab-uiesc între sesizări + stiri + cont — current nav e top-only.
- **Cum**: Fixed bottom: Acasă / Sesizări / Știri / Cont. Hide pe desktop.

### 72. 📊 `civic_streak` table cu trigger update
- **Categorie**: 📊 data · **Effort**: M · **Impact**: medium
- **Files**: migration + trigger
- **De ce**: Streak hand-rolled în app code → race condition.
- **Cum**: PostgreSQL trigger pe `sesizari` insert.

### 73. ⚡ Compress images via Cloudflare Images
- **Categorie**: ⚡ perf · **Effort**: M · **Impact**: high
- **Files**: `src/lib/cf-images.ts` (nou)
- **De ce**: Supabase Storage = no auto-compress. Imagini sesizări = 2-5MB.
- **Cum**: Pipe upload prin CF Images API, store URL cu transforms.

### 74. 🛡 Cron `vacuum analyze` pe tabelele hot
- **Categorie**: 📊 data · **Effort**: XS · **Impact**: medium
- **Files**: pg_cron migration
- **De ce**: Supabase auto-vacuum default, dar pentru tabele hot insuficient.
- **Cum**: pg_cron weekly: `VACUUM ANALYZE sesizari, sesizare_replies, stiri`.

### 75. 📈 Robots.txt cu Sitemap reference
- **Categorie**: 📈 seo · **Effort**: XS · **Impact**: low
- **Files**: `public/robots.txt` sau `app/robots.ts`
- **De ce**: Sitemap referință în robots → crawlers găsesc rapid.
- **Cum**: `Sitemap: https://civia.ro/sitemap.xml`.

### 76. 🤖 Groq fallback la Llama 3.1 8B pe rate-limit
- **Categorie**: 🤖 ai · **Effort**: S · **Impact**: medium
- **Files**: `src/lib/groq/client.ts`
- **De ce**: 70B rate limit hit → user vede error. 8B lower quality dar funcționează.
- **Cum**: Catch 429 → retry cu `GROQ_MODEL_FAST`.

### 77. 👁 Log retention 30 zile pe Vercel
- **Categorie**: 💰 cost · **Effort**: XS · **Impact**: low
- **Files**: Vercel project settings
- **De ce**: Default 30 zile OK; verifică nu mai mult.
- **Cum**: Vercel dashboard → Logs → Retention.

### 78. 🎨 Loading state pentru AI vision-route
- **Categorie**: 🎨 ux · **Effort**: S · **Impact**: medium
- **Files**: `src/components/sesizari/SesizareForm.tsx`
- **De ce**: Photo upload → AI analizează 2-3s — user nu știe ce se întâmplă.
- **Cum**: Spinner + text „Analizăm poza cu AI...".

### 79. 📧 BCC autorului pe send-via-civia (există)
- **Categorie**: 📧 email · **Effort**: XS · **Impact**: low
- **Files**: deja
- **De ce**: Confirmat funcționează. Doc în CLAUDE.md.
- **Cum**: N/A — verifying.

### 80. 🤖 Stiri AI summary cache validate (când recheck)
- **Categorie**: 🤖 ai · **Effort**: S · **Impact**: medium
- **Files**: `src/lib/stiri/ai-summary.ts`
- **De ce**: Cached summary poate fi stale dacă articolul update.
- **Cum**: Hash body, regenerate dacă schimb.

### 81. 🔧 ESLint custom rule: no `process.env` în Client Components
- **Categorie**: 🔒 security · **Effort**: S · **Impact**: medium
- **Files**: `.eslintrc.json`
- **De ce**: Risk leak server-only env vars la client.
- **Cum**: Custom rule sau `no-restricted-imports`.

### 82. 📊 Search via Postgres `pg_trgm` în loc de ILIKE
- **Categorie**: ⚡ perf · **Effort**: M · **Impact**: medium
- **Files**: search routes
- **De ce**: ILIKE = full scan. trgm = indexed.
- **Cum**: `CREATE EXTENSION pg_trgm; CREATE INDEX ON sesizari USING gin(titlu gin_trgm_ops)`.

### 83. 🎨 Confirm modal pentru destructive actions admin
- **Categorie**: 🎨 ux · **Effort**: S · **Impact**: high
- **Files**: `src/components/admin/ConfirmDialog.tsx`
- **De ce**: Delete sesizare = no undo, no confirm.
- **Cum**: Modal cu „type CODE to confirm".

### 84. 🛡 Sentry release tag pe deploy
- **Categorie**: 👁 observability · **Effort**: XS · **Impact**: medium
- **Files**: Vercel build hook + Sentry CLI
- **De ce**: Errors auto-correlated cu deploy.
- **Cum**: `sentry-cli releases new $VERCEL_GIT_COMMIT_SHA`.

### 85. 📱 Manifest icons în WebP + SVG
- **Categorie**: 📱 mobile · **Effort**: S · **Impact**: low
- **Files**: `public/icons/`
- **De ce**: PNG only — mai mare.
- **Cum**: Add WebP + maskable SVG.

### 86. 🤖 Dedup sesizări similare via embeddings
- **Categorie**: 🤖 ai · **Effort**: L · **Impact**: high
- **Files**: nou pipeline
- **De ce**: 2 cetățeni raportează aceeași groapă → 2 sesizări separate la primărie = spam.
- **Cum**: pgvector + embedding la submit → dacă similarity > 0.9 → suggest co-sign.

### 87. 🔒 Security headers Permissions-Policy mai strict
- **Categorie**: 🔒 security · **Effort**: XS · **Impact**: low
- **Files**: `src/proxy.ts`
- **De ce**: Acum permite multe — strict by default.
- **Cum**: Disable `interest-cohort`, `usb`, `serial`, `bluetooth`.

### 88. 📊 Indexes pe `follows(target_user_id, created_at)`
- **Categorie**: 📊 data · **Effort**: XS · **Impact**: low
- **Files**: migration
- **De ce**: Lista followers per user neperformant.
- **Cum**: Compound index.

### 89. 🎨 Sesizare „mai vechi" pagination cu link state
- **Categorie**: 🎨 ux · **Effort**: M · **Impact**: medium
- **Files**: `src/components/sesizari/Pagination.tsx`
- **De ce**: Current „Load more" → user pierde scroll state pe back.
- **Cum**: URL `?page=2` → preserved on browser back.

### 90. 🤖 Petitie AI summary structure validation
- **Categorie**: 🤖 ai · **Effort**: S · **Impact**: medium
- **Files**: `src/lib/petitii/ai-summary.ts`
- **De ce**: AI return uneori fără „Pe scurt:" — display broken.
- **Cum**: Regex validation + retry on fail.

### 91. 📧 Resend webhook events tabela pentru audit
- **Categorie**: 📊 data · **Effort**: M · **Impact**: medium
- **Files**: nou migration `email_events_log`
- **De ce**: Webhook events sunt processed dar nu stored long-term — debug greu.
- **Cum**: Append-only table cu retention 90 zile.

### 92. ⚡ ISR pentru `/sesizari-publice` cu revalidate 60s
- **Categorie**: ⚡ perf · **Effort**: S · **Impact**: high
- **Files**: `src/app/sesizari-publice/page.tsx`
- **De ce**: Page dynamic per request — costly. Lista publică update lentă.
- **Cum**: `export const revalidate = 60`.

### 93. 🔧 `tsconfig.json` strict mode incremental fixes
- **Categorie**: 🔧 devex · **Effort**: L · **Impact**: medium
- **Files**: `tsconfig.json`
- **De ce**: Strict mode catch bugs early.
- **Cum**: Enable `noUncheckedIndexedAccess` + fix all errors gradual.

### 94. 🎨 Newsletter unsubscribe one-click
- **Categorie**: 📧 email · **Effort**: S · **Impact**: medium
- **Files**: `src/app/api/newsletter/unsubscribe/route.ts`
- **De ce**: GDPR compliance — user trebuie să poată unsub fără login.
- **Cum**: Signed token în link → 1 click.

### 95. 📊 `analytics:vitalSamples` reservoir sampling efficient
- **Categorie**: 📊 data · **Effort**: S · **Impact**: low
- **Files**: `src/app/api/analytics/route.ts`
- **De ce**: LPUSH + LTRIM = bias toward recent. Reservoir = uniform.
- **Cum**: Algorithm R implementation.

### 96. 🛡 Honeypot enforce server-side
- **Categorie**: 🔒 security · **Effort**: XS · **Impact**: medium
- **Files**: `src/app/api/sesizari/route.ts`
- **De ce**: Honeypot existent dar trim accept oricum.
- **Cum**: If `_honey.length > 0` → silent 200 fără insert.

### 97. 🤖 Inbox classifier — language detection
- **Categorie**: 🤖 ai · **Effort**: S · **Impact**: low
- **Files**: `src/lib/inbox/classify.ts`
- **De ce**: Reply în engleză sau alta limbă → fallback. Detect + early return.
- **Cum**: simple ngram check.

### 98. 📱 Touch gestures pentru `/harti` (pinch zoom etc)
- **Categorie**: 📱 mobile · **Effort**: M · **Impact**: medium
- **Files**: `src/components/maps/HartiMap.tsx`
- **De ce**: Leaflet default — but check feedback iOS.
- **Cum**: Confirm `touchZoom: true` + `dragging: true`.

### 99. ⚡ Bundle analyzer in CI
- **Categorie**: ⚡ perf · **Effort**: S · **Impact**: medium
- **Files**: `.github/workflows/bundle-size.yml`
- **De ce**: Vrem alert dacă bundle crește >5%.
- **Cum**: `@next/bundle-analyzer` + comparison cu main.

### 100. 🎨 Dark mode toggle în footer
- **Categorie**: 🎨 ux · **Effort**: XS · **Impact**: low
- **Files**: Footer
- **De ce**: Userii Win11 light mode forced — preferință vizuală.
- **Cum**: Localstorage flag + CSS class toggle.

### 101. 📈 hreflang pentru SEO (ro-RO default)
- **Categorie**: 📈 seo · **Effort**: XS · **Impact**: low
- **Files**: `src/app/layout.tsx`
- **De ce**: Google understands language explicit.
- **Cum**: `<link rel="alternate" hreflang="ro-RO" href="...">`.

### 102. 🔒 Rotating session secret pentru NextAuth (dacă folosit)
- **Categorie**: 🔒 security · **Effort**: M · **Impact**: medium
- **Files**: Auth config
- **De ce**: Long-lived secret = compromise window mare.
- **Cum**: Rotation lunar via Vercel API.

---

## 🟢 P3 — Nice-to-have

### 103. 🎨 Animation polish pe submit success
- **Categorie**: 🎨 ux · **Effort**: S · **Impact**: low
- **Files**: `SuccessScreen.tsx`
- **De ce**: Confetti delight micro-moment.
- **Cum**: `canvas-confetti` lazy import.

### 104. 📊 Heatmap clicks pe analytics admin
- **Categorie**: 👁 observability · **Effort**: M · **Impact**: low
- **Files**: nou
- **De ce**: Visual click hotspots.
- **Cum**: Tracker cu x/y position normalized.

### 105. 🤖 AI suggested tags pentru petitii
- **Categorie**: 🤖 ai · **Effort**: M · **Impact**: low
- **Files**: petitii ai-summary
- **De ce**: Categorize automat.
- **Cum**: 1 extra Groq call.

### 106. 📱 Haptic feedback pe submit (iOS)
- **Categorie**: 📱 mobile · **Effort**: XS · **Impact**: low
- **Files**: SesizareForm
- **De ce**: Delight pe iOS.
- **Cum**: `navigator.vibrate()` sau iOS bridge.

### 107. 🎨 Emoji reactions pe sesizări (existent?)
- **Categorie**: 🎨 ux · **Effort**: M · **Impact**: low
- **Files**: nou
- **De ce**: Engagement.
- **Cum**: Like/Dislike already; add 🚨 urgent.

### 108. 📧 Email templates în i18n (ENG version)
- **Categorie**: 📧 email · **Effort**: M · **Impact**: low
- **Files**: templates
- **De ce**: Expats cetățeni.
- **Cum**: Localization fallback.

### 109. 🔧 Pre-commit hook husky + lint-staged
- **Categorie**: 🔧 devex · **Effort**: S · **Impact**: low
- **Files**: `.husky/`
- **De ce**: Prevent broken commits.
- **Cum**: Standard setup.

### 110. 📊 Materialized view pentru clasament primării
- **Categorie**: ⚡ perf · **Effort**: M · **Impact**: medium
- **Files**: migration
- **De ce**: Calcul scor primării = heavy aggregate. Refresh nightly.
- **Cum**: `CREATE MATERIALIZED VIEW clasament_mat AS ...`.

### 111. 🎨 Tour guidat first-time user
- **Categorie**: 🎨 ux · **Effort**: L · **Impact**: medium
- **Files**: nou
- **De ce**: Onboarding friction.
- **Cum**: `driver.js` cu 5 steps.

### 112. 🤖 Sentiment analysis pe feedback
- **Categorie**: 🤖 ai · **Effort**: M · **Impact**: low
- **Files**: admin feedback
- **De ce**: Prioritize negative.
- **Cum**: Groq batch nightly.

### 113. 📱 Apple Wallet pass pentru sesizări active
- **Categorie**: 📱 mobile · **Effort**: L · **Impact**: low
- **Files**: nou
- **De ce**: Cool gadget — track sesizare în Wallet.
- **Cum**: `.pkpass` format.

### 114. 📈 Google My Business integration
- **Categorie**: 📈 seo · **Effort**: M · **Impact**: low
- **Files**: nou
- **De ce**: Local SEO Romania.
- **Cum**: GMB API submit.

### 115. 🛡 Chaos engineering Friday
- **Categorie**: 🛡 reliability · **Effort**: L · **Impact**: low
- **Files**: chaos scripts
- **De ce**: Test resilience.
- **Cum**: Kill Redis pentru 1h, see what breaks.

### 116. 📊 Anonimizare sesizări vechi (>2 ani)
- **Categorie**: 🔒 security · **Effort**: M · **Impact**: medium
- **Files**: cron + migration
- **De ce**: GDPR data minimization.
- **Cum**: NULL out author_name + email după 2 ani.

### 117. 🎨 Sketch button în submit form pentru rapid sketch
- **Categorie**: 🎨 ux · **Effort**: L · **Impact**: low
- **Files**: nou
- **De ce**: Cu degetul desenezi diagrama unde mașina parchează.
- **Cum**: Canvas + touch handlers.

### 118. 🤖 OCR pentru carduri identitate (verify cetățean RO)
- **Categorie**: 🔒 security · **Effort**: XL · **Impact**: low
- **Files**: nou
- **De ce**: Anti-bot strong + verificat cetățean.
- **Cum**: Privacy concerns — opt-in only.

### 119. 📧 SMS notifications via Twilio fallback
- **Categorie**: 📧 email · **Effort**: M · **Impact**: medium
- **Files**: nou
- **De ce**: Email delivery issue → SMS reliable.
- **Cum**: Twilio integration.

### 120. 📊 Public API v1 cu rate limit per token
- **Categorie**: 🔧 devex · **Effort**: L · **Impact**: medium
- **Files**: nou `src/app/api/v1/`
- **De ce**: Jurnaliști / cercetători want machine-readable.
- **Cum**: REST cu OpenAPI spec.

### 121. 🎨 Print PDF cu QR code spre online version
- **Categorie**: 🎨 ux · **Effort**: S · **Impact**: low
- **Files**: PDF generator
- **De ce**: Printed sesizare → scan to see updates.
- **Cum**: `qrcode` library add.

### 122. 🤖 Auto-translate news pentru minorități
- **Categorie**: 🤖 ai · **Effort**: M · **Impact**: low
- **Files**: stiri
- **De ce**: Hungarian / Ucrainean comunități.
- **Cum**: Groq translate + cached.

### 123. 📱 Widget iOS pentru sesizări active
- **Categorie**: 📱 mobile · **Effort**: XL · **Impact**: low
- **Files**: nou native
- **De ce**: Glanceable status.
- **Cum**: WidgetKit (necesită native app).

### 124. 🛡 Disaster recovery runbook
- **Categorie**: 🛡 reliability · **Effort**: M · **Impact**: medium
- **Files**: `docs/runbooks/`
- **De ce**: Solo dev → bus factor.
- **Cum**: Step-by-step recovery procedures.

### 125. 📊 GraphQL endpoint experimental
- **Categorie**: 🔧 devex · **Effort**: L · **Impact**: low
- **Files**: nou
- **De ce**: Modern API access.
- **Cum**: graphql-yoga.

### 126. 🎨 Civia logo animat pe landing
- **Categorie**: 🎨 ux · **Effort**: M · **Impact**: low
- **Files**: hero
- **De ce**: Delight.
- **Cum**: Lottie animation.

### 127. 🤖 Voice transcription pentru audio uploads (sesizări)
- **Categorie**: 🤖 ai · **Effort**: L · **Impact**: medium
- **Files**: nou
- **De ce**: Cetățeni vârstnici preferă voce.
- **Cum**: Groq Whisper + STT.

### 128. 📈 Wikipedia article pentru Civia (manual)
- **Categorie**: 📈 seo · **Effort**: M · **Impact**: medium
- **Files**: N/A (extern)
- **De ce**: Domain authority backlink.
- **Cum**: Submit la wikipedia Romania.

### 129. 🔒 Bug bounty program (HackerOne)
- **Categorie**: 🔒 security · **Effort**: M · **Impact**: medium
- **Files**: N/A
- **De ce**: Community security audit.
- **Cum**: $50-$500 bounties.

### 130. 📊 Time-series database (TimescaleDB) pentru analytics
- **Categorie**: ⚡ perf · **Effort**: L · **Impact**: low
- **Files**: migration
- **De ce**: Redis good for now, but long-term analytics queries slow.
- **Cum**: Supabase suporta TimescaleDB extension.

### 131. 🎨 Sesizare „shame wall" — primării care nu răspund 60+ zile
- **Categorie**: 🎨 ux · **Effort**: M · **Impact**: high
- **Files**: nou page `/ignorate`
- **De ce**: Social pressure → primării răspund mai rapid.
- **Cum**: Query sesizări fără reply în 60+ zile + display ranking primării.

### 132. 🤖 AI face redaction în poze sesizări (faces blur)
- **Categorie**: 🔒 security · **Effort**: M · **Impact**: medium
- **Files**: PhotoUploader
- **De ce**: GDPR + privacy. Acum doar plates blur.
- **Cum**: TensorFlow.js face detection client-side.

### 133. 📱 Lock screen widget Android
- **Categorie**: 📱 mobile · **Effort**: XL · **Impact**: low
- **Files**: native
- **De ce**: Status sesizare glance-able.
- **Cum**: Native app required.

### 134. 🎨 Mod „prezentare" pentru ședințe consiliu (large fonts)
- **Categorie**: ♿ a11y · **Effort**: S · **Impact**: low
- **Files**: nou query param
- **De ce**: Ședințe consiliu — present site pe screen.
- **Cum**: `?presentation=1` → CSS overrides.

### 135. 🤖 Reverse image search pe sesizări (find duplicates)
- **Categorie**: 🤖 ai · **Effort**: L · **Impact**: medium
- **Files**: nou
- **De ce**: Detect aceeași poză sub diferite sesizări.
- **Cum**: pHash + similarity threshold.

### 136. 📧 ARC seal pentru forwarded emails
- **Categorie**: 📧 email · **Effort**: M · **Impact**: low
- **Files**: Worker config
- **De ce**: Authenticated Received Chain — forwarded emails preserve DKIM.
- **Cum**: Resend support if available.

---

## 📊 Sinteză Categorii

| Categorie | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| 🔒 security | 4 | 6 | 4 | 3 | 17 |
| ⚡ perf | 0 | 6 | 4 | 1 | 11 |
| 📧 email | 3 | 4 | 2 | 3 | 12 |
| 🤖 ai | 1 | 4 | 7 | 5 | 17 |
| 📊 data | 1 | 4 | 5 | 1 | 11 |
| 🎨 ux | 0 | 2 | 7 | 5 | 14 |
| ♿ a11y | 0 | 3 | 2 | 1 | 6 |
| 📱 mobile | 0 | 2 | 3 | 4 | 9 |
| 🛡 reliability | 2 | 2 | 1 | 2 | 7 |
| 👁 observability | 1 | 2 | 2 | 1 | 6 |
| 📈 seo | 0 | 1 | 3 | 2 | 6 |
| 🔧 devex | 0 | 2 | 2 | 4 | 8 |
| 🏗 arch | 1 | 0 | 0 | 0 | 1 |
| 💰 cost | 0 | 0 | 1 | 0 | 1 |

**TOTAL: 136 optimizări** distincte cu effort/impact estimat.
