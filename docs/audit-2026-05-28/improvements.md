# Civia — Plan OPTIMIZĂRI (200+ items)

_Generat 2026-05-28 via mega-audit workflow_

Audit complet pe infrastructure (Vercel + Supabase + Cloudflare + Sentry + GitHub) + 40 research topics (120+ web fetches).

---

## Performance (62 items)

- **[P0]** Apex civia.ro → www.civia.ro redirect costs 11-34s on mobile — single biggest finding by an order of magnitude; switch canonical to apex in Vercel Domains or send 301 (permanent) instead of 307 so browsers cache. Files: `next.config.ts`.
- **[P0]** Mobile performance scores 16-51 across the board — 9/10 URLs fail Core Web Vitals on mobile; LCP exceeds 10s on every mobile page (worst: cluj 21.7s, stiri 14.5s). Files: `C:\tmp\psi\summary.json`.
- **[P0]** /sesizari mobile is the worst page (perf=16, LCP=13.6s, CLS=0.376) — citizens reach it ready to file, takes 13.6s to LCP; fix apex redirect + move heavy form/AI bundle behind interaction boundary + reserve footer space. Files: `src/app/sesizari/page.tsx`, `src/components/sesizari/SesizariPublice.tsx`.
- **[P0]** /stiri/:id pageload p95 = 12.4s, p75 LCP = 4556ms — page unusable on slow networks; hotlinked CDN images dominate LCP. Files: `src/app/stiri/[id]/page.tsx`, `src/app/stiri/[id]/AiSummary.tsx`.
- **[P0]** /sesizari-publice navigation p95 = 6.5s — three sequential Supabase round-trips each ~3s; collapse into single RPC/view, Promise.all client effects, move to Server Component. Files: `src/components/sesizari/SesizariPublice.tsx`, `src/app/api/sesizari/route.ts`.
- **[P0]** Branded splash overlay blocks /sesizari, /petitii, /B on first paint — Cloudflare Browser Rendering capture shows full splash still up after 11.7s; investigate SplashScreen state machine. Files: `src/app/layout.tsx`.
- **[P1]** sesizari_feed view with 7 correlated subqueries per row — O(N) join + 7×O(N) scans; convert to materialized view or rewrite with LEFT JOIN + GROUP BY, or denormalize counts. Files: `supabase/migrations/050_sesizari_feed_view_refresh.sql`.
- **[P1]** Footer CLS shift driven by DeferredClientMount widgets — reserve space at SSR via min-height placeholders for cookie banner + bottom nav; mount BottomNav eagerly. Files: `src/app/layout.tsx`, `src/components/DeferredClientMount.tsx`, `src/components/layout/BottomNav.tsx`.
- **[P1]** Single JS chunk takes 1.8-11.7s to execute on mobile — Sentry SDK eagerly bundled; use lazyLoadIntegrations, sample tracesSampleRate=0.05, or lazyOnload Script strategy. Files: `next.config.ts`, `src/app/layout.tsx`.
- **[P1]** Proxy.ts runs Supabase getUser() on every HTML request — TTFB tax; short-circuit auth refresh when no 'sb-' cookie present. Files: `src/proxy.ts`, `src/lib/supabase/proxy.ts`.
- **[P1]** County pages pull 5.7MB of full-resolution external news images (cluj 2.3MB single image) — enforce sizes prop, explicit width/quality on StiriWidget. Files: `next.config.ts`, `src/components/home/StiriWidget.tsx`.
- **[P1]** /intreruperi mobile TBT = 9.6s with 23.6s of main-thread work — lazy-load IntreruperiFilters + gate buildings/map fetch behind IntersectionObserver. Files: `src/app/intreruperi/page.tsx`, `src/app/intreruperi/IntreruperiMap.tsx`.
- **[P1]** /CJ county hits 21.7s LCP on mobile and 4.8s on desktop — all 42 counties share template; lazy-render news/intreruperi widgets below fold via Suspense + dynamic. Files: `src/app/[judet]/page.tsx`.
- **[P1]** POST /api/analytics p95 = 5.97s — endpoint self-amplifies; share sessionUser across batch, collapse 4 sequential Redis round-trips into pipeline, skip getSessionUser on unload. Files: `src/app/api/analytics/route.ts`, `src/components/analytics/CiviaTracker.tsx`.
- **[P1]** p75 CLS = 0.310 on /sesizari and 0.211 on /stiri/:id — both POOR; reserve list area height, add aspect-ratio on news images, font-display: optional already used. Files: `src/app/sesizari/page.tsx`, `src/components/layout/PageHero.tsx`.
- **[P1]** Third-party news images (hotnews, mediafax) hotlinked — uncontrollable LCP + privacy + bandwidth; pipe through next/image with remotePatterns allowlist + AVIF/WebP. Files: `src/lib/stiri/sources.ts`, `next.config.ts`.
- **[P1]** GET /api/alerts p95 = 4s with 120 hits/7d — fired on every navigation; cache in Upstash 60s TTL with stale-while-revalidate header. Files: `src/app/api/alerts/route.ts`.
- **[P1]** /sesizari-publice ships zero SSR content — entire viewport is skeleton placeholders; convert initial render to Server Component reading public sesizari list. Files: `src/app/sesizari-publice/page.tsx`.
- **[P1]** RLS uses auth.uid() direct (not (SELECT auth.uid())) — re-evaluated per row; rewrite policies with `(SELECT auth.uid())` pattern across 65 occurrences. Files: `supabase/schema.sql`, `supabase/migrations/057_sesizare_replies.sql`.
- **[P1]** 14 migrations use subquery profiles WHERE role='admin' in RLS instead of is_admin() — perf cliff; refactor to use the STABLE SECURITY DEFINER is_admin(). Files: `supabase/migrations/072_admin_audit_log.sql`, `supabase/schema.sql`.
- **[P1]** Duplicate getSesizareByCode/getPetitieBySlug/getStire queries between generateMetadata and page render — wrap fetchers in React `cache()` to dedupe per-request. Files: `src/lib/sesizari/repository.ts`, `src/app/stiri/[id]/page.tsx`.
- **[P1]** /impact and /clasament aggregate via in-app GROUP BY on 5k+ row pulls — needs SQL aggregation RPC returning (county, status, count) rows. Files: `src/app/impact/page.tsx`, `src/app/clasament/page.tsx`.
- **[P1]** Sequential `for…of` loops with awaited send/insert blocks cron — parallelize with Promise.allSettled + p-limit cap. Files: `src/app/api/newsletter/weekly-rezolvate/route.ts`, `src/app/api/sesizari/reminders/route.ts`.
- **[P1]** Missing composite indexes for `(filter, sort)` patterns on sesizari — add (moderation_status, county, created_at desc) and similar. Files: `src/lib/sesizari/repository.ts`, `src/lib/cached-queries.ts`.
- **[P1]** Enable cacheComponents + adopt PPR on /stiri and /[judet]/stiri — Next 16.2 stabilized cacheComponents; add flag in next.config.ts + wrap fetchers with `'use cache'` + cacheLife. Files: `next.config.ts`, `src/app/stiri/page.tsx`.
- **[P1]** Use `'use cache'` + cacheTag on AI summaries petitii/stiri — eliminate Supabase round-trip on cache hit (60-80% of traffic). Files: `src/lib/stiri/ai-summary.ts`, `src/lib/petitii/ai-summary.ts`.
- **[P1]** PPR static shell for /[judet]/* — 42 counties × 14 subroutes = ~588 routes that share identical shell; pre-build per-county at build-time. Files: `src/app/[judet]/layout.tsx`, `src/app/[judet]/page.tsx`.
- **[P1]** searchParams trap in /stiri and /sesizari-publice — forces entire tree dynamic; move consumption into child component wrapped in Suspense. Files: `src/app/stiri/page.tsx`, `src/app/sesizari-publice`.
- **[P1]** generateStaticParams used in only 12 dynamic routes — county subroutes (autoritati/ghiduri/intreruperi/etc.) skip prerender; add ALL_COUNTIES generation. Files: `src/app/[judet]/autoritati/page.tsx`, `src/app/[judet]/stiri/page.tsx`.
- **[P1]** Public Server Component pages embed entire client fetchers without Suspense boundary — wrap TopVotedWidget/IntreruperiWidget/StiriWidget in Suspense. Files: `src/app/page.tsx`, `src/app/sesizari-publice/page.tsx`.
- **[P1]** Root layout mounts heavy always-on client tree on every route — convert eager imports (CiviaAssistant, InstallPrompt, NewsletterNudge) to next/dynamic with ssr:false. Files: `src/app/layout.tsx`.
- **[P1]** Admin pages shipped 100% as monolithic client bundles (~4.7K LOC of "use client") — convert to RSC + Server Actions; estimated 200-400KB JS off the wire. Files: `src/app/admin/sesizari/page.tsx`, `src/app/admin/proteste/page.tsx`, `src/app/admin/petitii/page.tsx`, `src/app/admin/analytics/AnalyticsDashboard.tsx`.
- **[P1]** Stream stiri AI summaries to client via use(promise) — currently blocks article page render; use Suspense fallback so article body streams instantly. Files: `src/app/stiri/[id]/page.tsx`, `src/app/stiri/[id]/AiSummary.tsx`.
- **[P1]** Set preferredRegion='fra1' on Romanian-traffic routes — default iad1 crosses Atlantic twice; ~80-120ms saved per DB call. Files: `vercel.json`, `src/app/api/stiri/route.ts`.
- **[P1]** Add SWR for GET /api/authorities + /api/ghiduri — service worker bypasses /api/* entirely; whitelist safe-to-cache public endpoints. Files: `public/sw.js`.
- **[P1]** Switch navigations from network-first to SWR with 1.5s timeout — on slow 3G users wait full RTT before fallback; race fetch vs cache. Files: `public/sw.js`.
- **[P1]** Add Cache-Control `s-maxage` + `stale-while-revalidate` on public API routes — /api/stiri, /api/authorities, /api/v2/clasament, /api/statistici/summary. Files: `src/app/api/stiri/route.ts`, `src/app/api/authorities/route.ts`.
- **[P1]** Replace Vercel Image Optimization with Cloudflare loader for /stiri/[id] press thumbnails — 10x cheaper per 2026 benchmarks, zero-egress with existing R2. Files: `next.config.ts`, `src/components/stiri/StiriList.tsx`.
- **[P1]** Migrate sesizari-photos bucket from Supabase Storage to R2 with public custom domain — R2 is $0 egress vs $0.09/GB Supabase. Files: `src/app/api/upload/route.ts`.
- **[P1]** Set Cache-Control immutable + content-hash filenames for Supabase Storage — currently `cacheControl: '3600'` means primarie re-fetches every hour. Files: `src/app/api/upload/route.ts`.
- **[P1]** Add btree indexes on all user_id / sesizare_id columns referenced in RLS — seq scan to indexed lookup saves 50ms→2ms on 10k rows. Files: `supabase/migrations/054_performance_indexes.sql`.
- **[P1]** Hoist role check into JWT custom claim — eliminate per-query profiles lookup in every admin policy. Files: `supabase/migrations/006_security_newsletter_role.sql`, `supabase/migrations/072_admin_audit_log.sql`.
- **[P1]** Wrap auth.uid() in (select auth.uid()) across all RLS policies — 30+ usages re-evaluate per row; pure planner win. Files: `supabase/schema.sql`, `supabase/migrations/053_rls_hardening.sql`.
- **[P2]** RLS policy on sesizari_reminders uses inline subquery profiles — switch to `is_admin()`. Files: `supabase/migrations/043_sesizari_reminders.sql`.
- **[P2]** Lipsește index pe sesizare_replies(authority_id) — admin queries scan whole table; add partial index. Files: `supabase/migrations/057_sesizare_replies.sql`.
- **[P2]** sesizari fără index pe (status, sent_at) — cron sesizari-mark-overdue scans full. Files: `supabase/migrations/078_pg_cron_sub_daily.sql`.
- **[P2]** Lipsește index pe sesizari(moderation_status, created_at DESC) pentru admin queue. Files: `supabase/migrations/054_performance_indexes.sql`.
- **[P2]** Index idx_sesizari_filtering suboptimal — rebuild with (county, status, tip, created_at DESC) + separate admin pending index. Files: `supabase/migrations/054_performance_indexes.sql`.
- **[P2]** sesizari_similare RPC does nested loop on sesizari_feed without spatial index — add PostGIS geom + ST_DWithin, or bounding-box pre-filter on county. Files: `supabase/migrations/050_sesizari_feed_view_refresh.sql`.
- **[P2]** Turbopack output split into 13+ chunks each ~4s for /stiri/:id — raise merge threshold or audit dynamic Lucide imports. Files: `next.config.ts`, `src/app/stiri/[id]/page.tsx`.
- **[P2]** Supabase EU region from Vercel deploy — verify vercel.json regions includes 'fra1' so Lambda same-region as Supabase. Files: `src/lib/supabase/server.ts`, `vercel.json`.
- **[P2]** Profile/preferences endpoint p95 = 3.27s called on every visit — short-circuit anon users without Supabase round-trip. Files: `src/app/api/profile/preferences/route.ts`.
- **[P2]** Heavy county landing page payload — /B desktop screenshot took 11.7s and was 1MB; audit /[judet]/page.tsx for components to lazy-import. Files: `src/app/[judet]/page.tsx`, `src/components/maps/HartiMap.tsx`.
- **[P2]** /sesizari mainthread breakdown: 4.7s JS execution on mobile — move tesseract/groq/vision to dynamic imports inside event handlers. Files: `src/app/sesizari/page.tsx`.
- **[P2]** Reduce unused JavaScript fires on 18/20 reports — 200KB+ shipped but not used at render; run ANALYZE=true and audit framework chunk. Files: `next.config.ts`.
- **[P2]** Service worker fingerprint mismatch may cause double-download of chunks — confirm in DevTools Network; remove SW runtime cache for /_next/static. Files: `public/sw.js`.
- **[P2]** `unstable_cache` keys do not include input args — getImpactDataCached(countyId) cache may collide; explicit key with countyId. Files: `src/lib/cached-queries.ts`.
- **[P2]** Wasteful `.select("*", { count: "exact", head: true })` pattern on /impact and /statistici — bypasses cached-queries optimization. Files: `src/app/impact/page.tsx`, `src/app/statistici-sesizari-romania/page.tsx`.
- **[P2]** Search uses `.or(titlu.ilike.%word%, descriere.ilike.%word%)` — non-sargable, full-table scans; needs pg_trgm GIN index or tsvector + Romanian dictionary. Files: `src/app/api/search/route.ts`.
- **[P2]** Wildcard `.select("*")` on sesizari/sesizari_feed detail/timeline reads — ships 5-20 KB unused columns; replace with explicit column lists. Files: `src/lib/sesizari/repository.ts`.
- **[P2]** `profiles` lookups for role-check on every admin request — wrap in React `cache()` to dedup per request. Files: `src/lib/admin/require-admin.ts`, `src/lib/sesizari/repository.ts`.
- **[P2]** /api/sesizari/[code] sequential awaits — getSesizareByCode then timeline could be parallel via join. Files: `src/app/api/sesizari/[code]/route.ts`, `src/app/api/sesizari/[code]/cosign/route.ts`.
- **[P2]** generateUniqueSlug does up to 50 sequential SELECT round-trips — batch with `.in()` filter. Files: `src/actions/petitii-actions.ts`, `src/app/api/admin/proteste/route.ts`.
- **[P2]** Wrap CivicAssistant + maps + AI-heavy components in granular Suspense + ErrorBoundary pairs — Groq blip currently crashes full page. Files: `src/components/ErrorBoundary.tsx`, `src/components/ai/CivicAssistant.tsx`.

## Security (35 items)

- **[P0]** 82% din authorities (209/256) au email NULL — emailul Civia n-are unde trimite; backfill emails din complaint_routing + scraping AUTH oficial. Files: `supabase/migrations/010_romania_authorities.sql`, `src/app/api/sesizari/[code]/resend-via-civia/route.ts`.
- **[P0]** Stored XSS in /api/sesizari/[code]/pdf — user-controlled fields injected raw into HTML; port escapeHtml from sibling routes. Files: `src/app/api/sesizari/[code]/pdf/route.ts`.
- **[P0]** Anonymous email impersonation via /api/sesizari/[code]/cosign-send — fully anonymous POST sends official emails to primarii; require auth or email-confirmation token. Files: `src/app/api/sesizari/[code]/cosign-send/route.ts`.
- **[P0]** Send-via-civia allows anonymous send within 24h with arbitrary author identity — any visitor can flip author_name/address and trigger Civia email; require login or one-time token. Files: `src/app/api/sesizari/[code]/send-via-civia/route.ts`.
- **[P0]** Inconsistent admin gate: 17 routes hand-roll role check instead of `requireAdmin` — each is potential auth bypass; migrate + add ESLint rule. Files: `src/app/api/admin/perf/route.ts`, `src/app/api/analytics/route.ts`, `src/app/api/stiri/fetch/route.ts`.
- **[P0]** Move R2 inbox-attachments bucket to EU jurisdiction — primarie PII currently transits US-anchored R2; recreate with Location=EU. Files: `src/lib/inbox/r2-client.ts`.
- **[P0]** Stop trusting browser-direct uploads to public Supabase bucket without server validation — switch to presigned upload URLs from /api/upload/presign. Files: `src/app/proteste/[slug]/cum-a-fost/edit/AftermathForm.tsx`.
- **[P0]** Add security_invoker=true to all public views (sesizari_feed, petitii_with_count) — views bypass RLS by default. Files: `supabase/schema.sql`, `supabase/migrations/050_sesizari_feed_view_refresh.sql`.
- **[P0]** Lock /api/inbox/reply with CF Worker IP allowlist — current Bearer-only auth means a leaked secret = forged primarie replies. Files: `src/app/api/inbox/reply/route.ts`.
- **[P0]** Pin React 19.2.4+ and Next 16.0.11+ exactly — mitigates CVE-2025-55182 (React2Shell) and Ouroboros DoS on RSC Flight. Files: `package.json`.
- **[P1]** exec_sql RPC is SECURITY DEFINER with arbitrary input — RCE if SUPABASE_SERVICE_ROLE_KEY leaks; revoke EXECUTE from authenticated/anon. Files: `scripts/apply-migration.ts`.
- **[P1]** JSON-LD scripts inject DB-controlled fields without `<script>`/U+2028 escaping — replace JSON.stringify with safeJsonLd helper. Files: `src/app/proteste/[slug]/page.tsx`, `src/app/intreruperi/[id]/page.tsx`.
- **[P1]** Public /api/debug/ai endpoint leaks API key prefixes — anyone can burn Gemini quota; gate behind requireAdmin(). Files: `src/app/api/debug/ai/route.ts`.
- **[P1]** Drop or harden /api/debug/schema endpoint — schema introspection is reconnaissance for attackers. Files: `src/app/api/debug/schema/route.ts`, `src/app/api/admin/sentry-test/route.ts`.
- **[P1]** Add Zod validation + rate limiting on /api/ai/improve, /api/ai/vision-route — currently no body schema; cost-amplification attack vector on paid Groq. Files: `src/app/api/ai/improve/route.ts`, `src/app/api/ai/vision-route/route.ts`.
- **[P1]** Lock down sesizari-photos storage bucket — require auth + user folder scoping; current `public/` folder pattern bypasses server checks. Files: `supabase/schema.sql`, `src/app/api/upload/route.ts`.
- **[P1]** Move SECURITY DEFINER functions out of public schema — callable via PostgREST RPC by anon; relocate to private 'internal' schema. Files: `supabase/schema.sql`, `supabase/migrations/004_profiles_extended.sql`.
- **[P1]** Audit 135 createSupabaseAdmin call-sites — service_role bypasses RLS; add requireUser/requireAdmin helper + CI lint rule. Files: `src/lib/supabase/admin.ts`, `src/app/api/inbox/reply/[id]/route.ts`.
- **[P1]** Audit `service_role` usage in 180 files — every admin client must enforce its own authorization; migrate public-read routes to createSupabaseAnon. Files: `src/app/api/public/sesizari/route.ts`, `src/app/api/v1/sesizari/route.ts`.
- **[P1]** Pin search_path on every SECURITY DEFINER function — Postgres privilege-escalation vector without `SET search_path = ''`. Files: `supabase/schema.sql`, `supabase/migrations/042_sesizare_cosigners.sql`.
- **[P1]** All 8 Dependabot PRs failing CI and stalled since 2026-05-24 — security patches not landing; fix lint errors then batch-merge. Files: `.github/dependabot.yml`.
- **[P1]** Column-level GRANT/REVOKE on profiles.email, address, phone — defense in depth against future bugs joining profiles into views. Files: `supabase/schema.sql`, `supabase/migrations/004_profiles_extended.sql`.
- **[P1]** Enable leaked-password protection and MFA enforcement for admin role — require AAL2 on admin moderation tables. Files: `supabase/migrations/072_admin_audit_log.sql`, `src/lib/api/auth.ts`.
- **[P1]** Cookie-aware Supabase server client + cacheComponents — cross-tenant data leak risk; ESLint rule forbidding server.ts imports in `'use cache'` files. Files: `src/lib/supabase/server.ts`.
- **[P2]** sesizare_replies INSERT policy WITH CHECK (false) — service-role bypass works but no audit log; add AFTER INSERT trigger logging to admin_audit_log. Files: `supabase/migrations/057_sesizare_replies.sql`.
- **[P2]** 12-char SHA-256-truncated loop-confirm token compared with `!==` — timing + brute-force risk; use crypto.timingSafeEqual + expiry. Files: `src/app/api/sesizari/[code]/loop-confirm/route.ts`.
- **[P2]** CSP allows `'unsafe-inline'` in script-src — defeats CSP as XSS mitigation; promote nonce-mode to default-on. Files: `next.config.ts`.
- **[P2]** From-header email-header injection risk via raw user-controlled author_name — strip CR/LF/NUL/`<`/`>`/`"` before composing From-header. Files: `src/app/api/sesizari/[code]/cosign-send/route.ts`, `src/app/api/sesizari/[code]/send-via-civia/route.ts`.
- **[P2]** Anonymous draft endpoint accepts any email — enables targeted nudge spam; require Supabase session match or captcha. Files: `src/app/api/sesizari/drafts/route.ts`.
- **[P2]** WAF rate-limit ruleset for /api/petitii/[id]/sign — bot-net signing with disposable accounts; rate-limit on (IP + JA4 fingerprint). Files: `src/app/api/petitii/[id]/sign/route.ts`, `src/lib/ratelimit.ts`.
- **[P2]** CI uses `npm install` not `npm ci` — supply-chain integrity gap; regenerate lockfile then switch to `npm ci`. Files: `.github/workflows/ci.yml`, `package-lock.json`.
- **[P2]** Tighten next/image SSRF: drop wildcard remotePatterns — enumerate press hostnames at build time from sources.ts. Files: `next.config.ts`, `src/lib/stiri/sources.ts`.
- **[P2]** Restrict user_metadata in RLS — prefer app_metadata for role/county claims (user_metadata is user-modifiable). Files: `supabase/migrations/004_profiles_extended.sql`, `supabase/migrations/026_oauth_display_name.sql`.
- **[P2]** Add RESTRICTIVE policies to enforce moderation_status visibility — hard floor even if buggy future PERMISSIVE policies. Files: `supabase/schema.sql`.
- **[P3]** Cosign GET endpoint reveals first names + creation timestamps — recon oracle for cosign POST; require auth or aggregated counts only. Files: `src/app/api/sesizari/[code]/cosign/route.ts`.
- **[P3]** package-lock.json in top hotspot list (10 commits/30d) — manual npm install flows mixed with feature work; pre-commit hook for dedupe. Files: `package-lock.json`, `package.json`.

## Reliability (18 items)

- **[P0]** CI workflow is red on every push to main — blocking nothing because branch protection has no required status checks; fix 2 lint errors + enable required checks. Files: `src/app/admin/feedback/page.tsx`, `src/app/admin/petitii/page.tsx`, `.github/workflows/ci.yml`.
- **[P0]** Fetch Știri RSS cron fails ~hourly with HTTP 403 since 2026-05-27 — CRON_SECRET desynced between GitHub Actions and Vercel; rotate in lockstep. Files: `.github/workflows/fetch-stiri.yml`, `src/app/api/stiri/fetch/route.ts`.
- **[P1]** Add Postgres statement_timeout + idle_in_transaction_session_timeout on authenticated role — single slow RLS query can pin Supavisor pool slot. Files: `supabase/migrations/`.
- **[P1]** Switch Civia from PostgREST-only to mixed Supavisor transaction-mode (6543) for batch jobs and cron — heavy /api/intreruperi/refresh + /api/petitii/scrape-updates. Files: `src/lib/supabase/admin.ts`, `src/app/api/intreruperi/refresh/route.ts`.
- **[P1]** Add Vercel Fluid Compute `attachDatabasePool` lifecycle — prevent Supavisor connection leak from `after()` calls during VM suspension. Files: `src/app/api/stiri/route.ts`, `src/lib/intreruperi/store.ts`.
- **[P1]** Migrate /api/geocode + OG-image routes off deprecated Edge Runtime — Vercel deprecated standalone Edge Functions April 8, 2026. Files: `src/app/api/geocode/route.ts`, `src/app/opengraph-image.tsx`.
- **[P1]** 138 API routes, 0 API route tests — critical paths (sesizari POST, vision-route, stiri/fetch, admin/*) untested; add contract tests for top 5-10 routes. Files: —.
- **[P1]** Convert SignSesizareButton submission to useTransition + idempotent action — double-click between renders can send duplicate emails to primarie. Files: `src/components/sesizari/SignSesizareButton.tsx`, `src/app/api/sesizari/[code]/cosign-send/route.ts`.
- **[P1]** main branch protection enforce_admins=false — solo committer bypasses every gate; enable required_status_checks + enforce_admins. Files: —.
- **[P1]** after() pe /api/inbox/reply Cloudflare webhook — verify timeout serverless Vercel; respond Worker before launching after(). Files: `src/app/api/inbox`.
- **[P1]** Pune /api/inbox/reply behind backoff retry — webhook critic primarie; CF Worker should buffer in KV with exponential retry. Files: `src/app/api/inbox/reply/route.ts`.
- **[P1]** Outstanding TODO marker ships to prod: `teamIdentifier: "TODO_APPLE_TEAM_ID"` — every wallet pass invalid; gate behind feature flag. Files: `src/app/api/sesizari/[code]/wallet-pass/route.ts`.
- **[P2]** 5 sesizare_replies orphans with sesizare_id NULL — bypass FK CASCADE; ALTER COLUMN sesizare_id SET NOT NULL after backfill. Files: `supabase/migrations/057_sesizare_replies.sql`.
- **[P2]** Sesizari Reminders cron silently degraded — succeeds 2/3 last days; add continue-on-error step posting failure to Slack/Telegram. Files: `.github/workflows/sesizari-reminders.yml`.
- **[P2]** Lint job 94 warnings accumulating — react-compiler set-state-in-effect flagging real cascading-render bugs; dedicate cleanup sprint. Files: `src/components/sesizari/SesizareForm.tsx`, `src/app/admin/analytics/AnalyticsDashboard.tsx`.
- **[P2]** Many list endpoints have neither `.limit()` nor `.order()` — unbounded growth; add explicit limit + deterministic order. Files: `src/app/api/admin/actualizari/route.ts`, `src/lib/notify/broadcast-civic.ts`.
- **[P2]** Cache key serialization gotcha — Supabase client/Date/URL not serializable inside `'use cache'`; audit candidate helpers. Files: `src/lib/stiri/ai-summary.ts`, `src/lib/petitii/ai-summary.ts`.
- **[P2]** Cron daily limit + after() self-heal — add circuit breaker on Redis NX lock + in-memory fallback Map for in-process coalesce. Files: `src/app/api/stiri/route.ts`, `src/app/api/stiri/fetch`.

## Architecture (16 items)

- **[P1]** SesizareForm.tsx is a 2147-LOC client mega-component (67 hooks) — split into useSesizareForm hook + GeoCaptureSection + ParkingSection + DescriereAiBlock + CosignerSection + SubmitActions. Files: `src/components/sesizari/SesizareForm.tsx`.
- **[P1]** /api/analytics/route.ts is a 1231-LOC god-route with 9 inline handlers — split into /api/analytics/{track,summary,sessions,user} + shared helpers module. Files: `src/app/api/analytics/route.ts`.
- **[P1]** Standardize Server Actions for mutations — 37 fetch('/api/...') from client components vs only 1 file using Server Actions; eliminates manual CSRF + enables useActionState. Files: `src/actions/petitii-actions.ts`, `src/components/sesizari/VoteButtons.tsx`.
- **[P1]** Scoped cache tags per-entity — never use generic 'sesizari'; use `sesizare:${code}`, `stire:${id}`, `judet:${slug}:aqi` to avoid wiping entire cache. Files: `src/lib`.
- **[P2]** POST handler in /api/inbox/reply is a ~470-line single function — split into authenticateWebhook + dedupeByMessageId + processAttachments + applyAuthenticityDecision. Files: `src/app/api/inbox/reply/route.ts`.
- **[P2]** scrapers.ts (1259 LOC) bundles 9 utility-outage scrapers in one file — split into src/lib/intreruperi/scrapers/{pmb,apa-nova,...}.ts. Files: `src/lib/intreruperi/scrapers.ts`.
- **[P2]** Move /api/inbox/reply to dedicated Supavisor session-mode for LISTEN/NOTIFY — admin inbox dashboard could benefit from real-time updates. Files: `src/app/api/inbox/reply/route.ts`.
- **[P2]** Coalesce sesizari heatmap + live-stats reads into single materialized view, refreshed by cron — eliminates connection-pool churn on 42-county fanout. Files: `src/app/api/sesizari/heatmap/route.ts`, `src/app/api/sesizari/live-stats/route.ts`.
- **[P2]** Move /api/v2/open311/requests.json + RSS feeds to ISR + stale-while-revalidate — completely removes them from connection pool. Files: `src/app/api/v2/open311/requests.json/route.ts`, `src/app/feed.xml/route.ts`.
- **[P2]** Coalesce per-county Stiri/Sesizari API routes into one Fluid instance — cache admin Supabase client at module scope. Files: `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`.
- **[P3]** petitie_signatures: table + FK + RLS + index for 0 rows (dead infrastructure) — Declic redirect doesn't persist; decide reactivate or drop. Files: `supabase/migrations/020_petitii.sql`.
- **[P3]** sesizari_pattern_clusters and sesizari_drafts have RLS but minimal activity — verify /admin/patterns is used; mark deprecated if not. Files: `supabase/migrations/069_civic_streak.sql`, `supabase/migrations/068_drafts.sql`.
- **[P3]** Three `/api/v2/*` routes exist alongside v1 — versioning duplication; add deprecation headers on v1 or consolidate. Files: `src/app/api/v2/sesizari/route.ts`, `src/app/api/sesizari/route.ts`.
- **[P3]** DOM size + FCP within target on desktop — design system is sound; only delivery is broken. (positive finding for architecture). Files: —.
- **[P3]** Skip SWR pe /api/v1/* + /api/v2/open311/* — public API for third parties; CDN must respect client cache headers. Files: `src/app/api/v1/`, `src/app/api/v2/`.
- **[P3]** Document the 'Civia client-action playbook' in AGENTS.md — which pattern (Server Action / useOptimistic / fetch / Suspense+use) for which mutation. Files: `AGENTS.md`.

## Accessibility (18 items)

- **[P0]** FormField label not associated with input — labels closed before children render; every field in core sesizare flow announced as bare textbox. Files: `src/components/sesizari/FormField.tsx`, `src/components/sesizari/SesizareForm.tsx`.
- **[P0]** FeedbackBox and FooterFeedback textarea + email have no `<label>` or aria-label — placeholders aren't accessible names; appears on every page. Files: `src/components/FeedbackBox.tsx`, `src/components/layout/FooterFeedback.tsx`.
- **[P1]** NewsletterNudge email input has no accessible name — add aria-labelledby='newsletter-nudge-title'. Files: `src/components/NewsletterNudge.tsx`.
- **[P1]** Custom modals across the codebase lack focus trap and initial focus management — only ui/Modal.tsx implements properly; refactor 15+ hand-rolled modals or extract useFocusTrap hook. Files: `src/components/ImageLightbox.tsx`, `src/components/sesizari/ShareMenu.tsx`, `src/components/functioneaza/InteractiveOrgChart.tsx`.
- **[P1]** InteractiveOrgChart custom modal missing role=dialog, aria-modal, Escape handler — keyboard users have no way to dismiss except backdrop click. Files: `src/components/functioneaza/InteractiveOrgChart.tsx`.
- **[P1]** Navbar mobile menu has no focus trap and no initial focus shift — keyboard users tab into content beneath overlay. Files: `src/components/layout/Navbar.tsx`.
- **[P1]** Tabs component does not implement WAI-ARIA tab pattern — missing role='tablist', aria-selected, arrow-key navigation. Files: `src/components/ui/Tabs.tsx`.
- **[P1]** Touch targets under 44×44px on persistent UI elements — CookieBanner X, AlertBanner close, NewsletterNudge close, InstallPrompt close all below WCAG threshold. Files: `src/components/CookieBanner.tsx`, `src/components/AlertBanner.tsx`, `src/components/NewsletterNudge.tsx`.
- **[P1]** A11y Audit workflow registered but has zero runs — accessibility gates never actually execute; verify triggers + gate on PRs touching src/components/**. Files: `.github/workflows/a11y.yml`.
- **[P2]** Avatar profile picture has empty alt text — meaningful image identifying logged-in user; set alt to display name. Files: `src/app/cont/page.tsx`, `src/components/profile/AvatarCropModal.tsx`.
- **[P2]** Heading hierarchy skip: Footer uses `<h4>` at top level — Footer column titles should be `<h2>`. Files: `src/components/layout/Footer.tsx`, `src/components/layout/FooterFeedback.tsx`.
- **[P2]** Light-mode body text-muted on body bg is at AA boundary (4.83:1) — for text under 14px bump muted to #52525B for ~6.85:1 contrast. Files: `src/app/globals.css`.
- **[P2]** White-on-gradient text at low opacity in heroes risks contrast failure — raise to text-white/85 or add dark overlay. Files: `src/components/layout/PageHero.tsx`, `src/app/cont/page.tsx`.
- **[P2]** Vision confidence badges + status chips encode meaning by color only — colorblind users can't differentiate; add label/icon/sr-only text. Files: `src/components/sesizari/SesizareForm.tsx`, `src/app/proteste/page.tsx`.
- **[P3]** Inline SVG icons treated as interactive via aria-label inside non-interactive paragraphs — add role='img' or render text next to aria-hidden icon. Files: `src/components/InstallPrompt.tsx`.
- **[P3]** NotificationBell dropdown lacks menu/menuitem roles and arrow-key navigation — implement menu pattern or drop aria-haspopup='menu'. Files: `src/components/NotificationBell.tsx`.
- **[P3]** Modal backdrop with role='presentation' has onClick but no keyboard equivalent — InteractiveOrgChart has no Escape handler at all. Files: `src/components/functioneaza/InteractiveOrgChart.tsx`.
- **[P3]** BottomNav focus state uses background change only with no visible focus ring — add focus-visible:ring-2 ring-inset. Files: `src/components/layout/BottomNav.tsx`.

## User Experience (12 items)

- **[P1]** Homepage live-stats strip stuck on 'Se încarcă statistici live...' — SSR initial values or show last-known cached values with 'updated Xm ago' instead of infinite spinner. Files: `src/app/page.tsx`, `src/lib/analytics/redis.ts`.
- **[P1]** Lock skeleton dimensions in loading.tsx — Cache Components PPR streaming pitfall #1 is dimension mismatch causing CLS > 0.1. Files: `src/app/stiri/loading.tsx`, `src/app/[judet]/loading.tsx`, `src/app/sesizari/loading.tsx`.
- **[P2]** /stiri hero crammed with 14 rainbow-colored source-name chips — collapse to single line ellipsis or hide behind 'Surse' expandable. Files: `src/app/stiri/page.tsx`.
- **[P2]** /clasament shows '6% rezolvate din 50 sesizări' — denominator too small for percentage in big red type; suppress until n>=200. Files: `src/app/clasament/page.tsx`.
- **[P2]** Form abandon tracking — wrap heavy fields in startTransition so user keeps typing while AI rewrites in background. Files: `src/components/sesizari/SesizareForm.tsx`, `src/app/api/ai/improve/route.ts`.
- **[P2]** Inbox reply webhook: surface near-realtime status via useTransition + Suspense streaming on /sesizari/[code]. Files: `src/app/api/inbox/reply/route.ts`, `src/components/sesizari/UrmarireSesizare.tsx`.
- **[P2]** Convert /petitii/initiaza success path to useOptimistic — currently shows blank during 400ms server-side redirect. Files: `src/app/petitii/initiaza/InitiatePetitieForm.tsx`.
- **[P3]** Sesizare detail header chips wrap awkwardly on narrow mobile widths — drop the 'S1' chip since address line already conveys sector. Files: `src/app/sesizari/[code]/page.tsx`.
- **[P3]** No visible heartbeat / freshness indicator on /clasament or stats — users can't tell if data is live; add 'Actualizat acum 3 min' caption. Files: `src/app/page.tsx`, `src/app/clasament/page.tsx`.
- **[P3]** next/font display:'optional' silently drops Sora/Inter on slow networks — consider 'swap' for Sora (brand font) only. Files: `src/app/layout.tsx`.
- **[P3]** View Transitions API (React 19.2) pentru navigation /[judet] county switch — shared-element animation on map markers + AQI widgets. Files: `src/app/[judet]/layout.tsx`.
- **[P3]** Splash screen safari iOS — apple-touch-startup-image for each device class; cold boot PWA white screen 2-3s perceived as broken. Files: `src/app/layout.tsx`, `public/splash/`.

## Cost (8 items)

- **[P1]** Wasteful `.select("*", { count: 'exact', head: true })` count pattern bypasses cached-queries optimization on /impact and /statistici — replace with select('id'); already saved ~10GB/day Fast Origin Transfer where applied. Files: `src/app/impact/page.tsx`, `src/app/statistici-sesizari-romania/page.tsx`.
- **[P1]** Confirm Fluid compute is enabled in project dashboard — I/O-bound routes (Groq AI, Supabase, Resend) save up to 90% on Active CPU pricing. Files: `vercel.json`.
- **[P2]** 127 API routes are force-dynamic with no Cache-Control — add `s-maxage=60, stale-while-revalidate=300` to read-only list/aggregation endpoints. Files: `src/app/api/sesizari/top-voted/route.ts`, `src/app/api/sesizari/heatmap/route.ts`.
- **[P2]** Switch /api/upload from base64 → Supabase Storage signed upload URL — removes 30s lambda + pool slot. Files: `src/app/api/upload/route.ts`, `vercel.json`.
- **[P2]** Add minimumCacheTTL=14400 + qualities=[60,75,90] for next/image (Next 16 defaults) — sesizare photos may revalidate 60×/hour with old config. Files: `next.config.ts`.
- **[P2]** Add Cache-Control + stale-while-revalidate to Server Component fetches in /stiri & /petitii — Active CPU billing means repeat viewers should be served from edge cache. Files: `src/app/stiri/page.tsx`, `src/app/petitii/page.tsx`.
- **[P2]** Cache-Control public for Supabase Storage sesizari images — current `cacheControl: '3600'` means primarie re-fetches every hour; set 'public, max-age=31536000, immutable'. Files: `src/lib/sesizari/upload.ts`.
- **[P3]** /api/profile/sesizari and /api/profile/export pull `select('*')` twice on user's sesizari — use explicit columns or unify via parameterized RPC. Files: `src/app/api/profile/sesizari/route.ts`, `src/app/api/profile/export/route.ts`.

## Observability (14 items)

- **[P0]** Sentry capturing zero errors across 30d — SDK init likely still broken; hit /api/admin/sentry-test in production, verify captureException fires, check beforeSend isn't dropping everything. Files: `instrumentation.ts`, `instrumentation-client.ts`, `src/app/api/admin/sentry-test/route.ts`.
- **[P1]** INP measurement is null for every route — Web Vitals data missing most important interaction metric; configure @sentry/nextjs browserTracingIntegration with `_metrics: ['inp']`. Files: `src/components/analytics/CiviaTracker.tsx`.
- **[P1]** 9 production releases in 10 hours, all with 0 new issues — release health signal is broken; verify source maps upload, sample rate, tunnel route. Files: `.sentryclirc`, `next.config.ts`, `vercel.json`.
- **[P1]** Civic KPI route returns hardcoded `medianMs: 0` while UI displays it as truth — admins see fake data; compute from Redis funnel timestamps or remove KPI tile. Files: `src/app/api/admin/analytics/civic-kpi/route.ts`, `src/app/admin/analytics/AnalyticsDashboard.tsx`.
- **[P1]** Observability: track cache hit ratio per-route before cacheComponents rollout — without X-Cache-Status header + Vercel Observability dashboard, can't distinguish PPR win vs regression. Files: `src/lib/analytics/redis.ts`, `src/app/admin/analytics`.
- **[P2]** Cron jobs have no error handling — pg_cron failures are mute in Sentry; add /api/admin/cron-status reading cron.job_run_details. Files: `supabase/migrations/078b_pg_cron_http_jobs.sql`, `supabase/migrations/078_pg_cron_sub_daily.sql`.
- **[P2]** Web Vitals capture only 20 samples per route per 7d — sample rate too low for reliable percentiles; verify NEXT_PUBLIC_ANALYTICS_SAMPLE in Vercel + tracesSampleRate=1.0. Files: `src/components/analytics/CiviaTracker.tsx`.
- **[P2]** /api/health: replace `count: exact, head: true` with `select 1` — Supavisor-friendly probe; BetterStack probes currently issue full COUNT(*) every minute. Files: `src/app/api/health/route.ts`.
- **[P2]** Surface Supavisor `cl_waiting` and `sv_idle` in /api/admin/perf dashboard — predict pooler outage hours before it hits users. Files: `src/app/api/admin/perf/route.ts`, `src/app/admin/page.tsx`.
- **[P2]** Add R2 health-check + Sentry alert when fetchR2Object silently returns null — currently null returns are a silent-failure black hole. Files: `src/lib/inbox/r2-client.ts`.
- **[P2]** Add ErrorBoundary section-tags for Sentry to discriminate Civia surfaces — wrap each functional region (sesizari-list, petition-card, ai-vision) with tagged boundary. Files: `src/components/ErrorBoundary.tsx`, `src/components/sesizari/SesizariPublice.tsx`.
- **[P2]** Add ServiceWorker postMessage telemetry — measure cache hit ratio in prod; trim TTL per route based on data, not intuition. Files: `public/sw.js`, `src/app/api/analytics/sw/route.ts`.
- **[P2]** Filtered React #418/#419 hydration errors in CiviaTracker — root cause not investigated; route 1% sample to separate bucket and identify real culprits. Files: `src/components/analytics/CiviaTracker.tsx`, `src/app/layout.tsx`.
- **[P3]** No visible 'updated at' timestamp on counters or leaderboard — users can't distinguish 'data is current' vs 'failed' vs 'cached'. Files: `src/app/page.tsx`, `src/app/clasament/page.tsx`.

## Data (8 items)

- **[P0]** 82% din authorities have email NULL — already listed under Security/P0 (cross-category). Files: `supabase/migrations/010_romania_authorities.sql`.
- **[P1]** Enforce R2 lifecycle rule on inbox attachments matching declared 90-day retention — no IaC sets the rule; add scripts/r2-set-lifecycle.ts. Files: `src/lib/inbox/r2-client.ts`.
- **[P2]** 5 sesizare_replies orphans (cross-listed under Reliability). Files: `supabase/migrations/057_sesizare_replies.sql`.
- **[P2]** 2 sesizari sent_via_civia=true with author_address NULL — violates OG 27/2002 art. 12; add CHECK constraint. Files: `supabase/migrations/060_delivery_tracking.sql`.
- **[P2]** Differentiate cache TTL per endpoint — /api/stiri 30min vs /api/petitii 1h vs /api/authorities 24h+ stale-while-revalidate. Files: `src/lib/cached-queries.ts`.
- **[P3]** Inbox debug log persists raw request body + headers (PII at rest) — add TTL/purge cron + redact body_text/body_html. Files: `src/app/api/inbox/reply/route.ts`.
- **[P3]** Feedback endpoint stores raw IP + email indefinitely in Redis list — hash IP + add EXPIRE on key. Files: `src/app/api/feedback/route.ts`.
- **[P3]** inbox_debug_log grows 20/day — no index for cron DELETE; partition by month for O(1) drop. Files: `supabase/migrations/058_inbox_debug_log.sql`, `supabase/migrations/078_pg_cron_sub_daily.sql`.

## SEO (3 items)

- **[P1]** /sesizari-publice ships zero SSR content — Google indexes empty page, hurting SEO for public-complaints corpus (cross-listed under Performance). Files: `src/app/sesizari-publice/page.tsx`.
- **[P2]** stiri/[id] sets `generateStaticParams = () => []` — every article SSR on first hit; prerender latest N at build. Files: `src/app/stiri/[id]/page.tsx`.
- **[P3]** /sesizari/strada/[slug] only prerenders 7-10 popular streets — auto-generate from distinct locatie values, top 200. Files: `src/app/sesizari/strada/[slug]/page.tsx`.

## Mobile (4 items)

- **[P0]** Mobile performance scores 16-51 across the board (cross-listed under Performance). Files: `C:\tmp\psi\summary.json`.
- **[P0]** /sesizari mobile is the worst page (perf=16, LCP=13.6s, CLS=0.376) (cross-listed under Performance). Files: `src/app/sesizari/page.tsx`.
- **[P1]** Touch targets under 44×44px on persistent UI elements (cross-listed under Accessibility). Files: `src/components/CookieBanner.tsx`, `src/components/AlertBanner.tsx`.
- **[P2]** /intreruperi mobile TBT = 9.6s with 23.6s of main-thread work (cross-listed under Performance). Files: `src/app/intreruperi/page.tsx`, `src/app/intreruperi/IntreruperiMap.tsx`.

## Operations (10 items)

- **[P1]** Node.js 20 actions deprecated — workflows will break by 2026-06-02 (4 days); land Dependabot PRs or opt-in pre-cutover. Files: `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`.
- **[P1]** main branch protection enforce_admins=false + no required status checks (cross-listed under Reliability). Files: —.
- **[P1]** 9 production releases in 10 hours with 0 new issues (cross-listed under Observability). Files: `.sentryclirc`, `vercel.json`.
- **[P1]** Cap Supavisor pool usage at 40% via dashboard — leaves headroom for Auth + Realtime + Storage; one-click change. Files: —.
- **[P2]** Static export NOT supported for cacheComponents — verify deployment shape on standalone + document in AGENTS.md 'Don't do'. Files: `next.config.ts`, `AGENTS.md`.
- **[P2]** Single active maintainer + 572 commits/month — bus factor = 1 with high blast radius; write 'good first issue' set + ISSUE/PR templates. Files: `CONTRIBUTING.md`, `README.md`.
- **[P2]** Pin Vercel function regions in vercel.json — Hobby plan doesn't include multi-region failover; declare `regions: ['fra1']`. Files: `vercel.json`.
- **[P2]** Document IPv4 add-on dependency for Cloudflare Worker → Supabase egress — never connect directly to db.*.supabase.co from Worker; use pooler hostname. Files: `AGENTS.md`, `DEPLOY.md`.
- **[P2]** Replace Vercel Hobby daily-only cron with Cloudflare Worker cron trigger — Worker cron triggers are FREE with sub-minute granularity. Files: `vercel.json`, `src/app/api/stiri/fetch/route.ts`.
- **[P3]** No CODEOWNERS file — review routing manual; pre-create with one owner so it's drop-in ready when scaling. Files: —.

## DevEx (16 items)

- **[P1]** Add Vercel Fluid Compute `attachDatabasePool` lifecycle (cross-listed under Reliability). Files: `src/app/api/stiri/route.ts`.
- **[P1]** Migrate vote/sign/comment optimistic patterns from manual setState to useOptimistic — hand-rolled math is fragile. Files: `src/components/sesizari/VoteButtons.tsx`, `src/components/sesizari/CommentsSection.tsx`.
- **[P2]** Repeated cookie+session+role boilerplate in 77 API route files — wire `withApiHandler` as default; migrate to consolidate. Files: `src/lib/api/handler.ts`, `src/app/api/admin/perf/route.ts`.
- **[P2]** /cont/page.tsx is 1141 LOC of client state — split into tab routes under /cont/(tabs)/{profil,setari,notificari} as Server Components. Files: `src/app/cont/page.tsx`.
- **[P2]** Dead exports in src/lib/ai/* and authority helpers (~5 modules with 0 importers) — `maskPii`, `resolveAuthorities`, `aiScoreResponse`, `hashApiKey`; add knip to CI. Files: `src/lib/ai/pii-mask.ts`, `src/lib/authorities/resolver.ts`, `src/lib/api/auth.ts`.
- **[P2]** `as any` and `: any` escape hatches sprinkled to bypass Supabase deep types — use shared type helper instead. Files: `src/lib/cached-queries.ts`, `src/actions/petitii-actions.ts`, `src/app/api/sesizari/heatmap/route.ts`.
- **[P2]** AnalyticsDashboard.tsx is 1515 LOC with only 22 top-level declarations — extract KpiCard, RoutesTable, GeoBreakdown as sibling client components. Files: `src/app/admin/analytics/AnalyticsDashboard.tsx`.
- **[P2]** 320 of all TS/TSX files modified in last 7 days — high change velocity; lock down formal-text + send-via-civia with integration tests. Files: `src/components/sesizari/SesizareForm.tsx`, `src/lib/sesizari/formal-template.ts`.
- **[P2]** Drop typescript.ignoreBuildErrors + measure Turbopack build speedup — Next 16 Turbopack offers 2-5x build speedup; reactivate TS check at build. Files: `next.config.ts`.
- **[P2]** Migrate `revalidateTag(tag)` to new signature `revalidateTag(tag, profile)` — deprecated in Next 16; use updateTag for read-your-writes. Files: `src/app/api/admin/petitii/route.ts`, `src/app/api/admin/proteste/[id]/route.ts`.
- **[P2]** Pre-flight Supabase Performance Advisor lint sweep before each release — surface unindexed FKs, unused indexes, RLS auth.uid() misuse. Files: `scripts`, `.github/workflows`.
- **[P2]** Wrap multi-table user-owned RLS reads in SECURITY DEFINER aggregate functions — /cont fans out to ~8 tables; add `user_dashboard_counts(uid)`. Files: `src/app/cont/page.tsx`, `src/app/profil/[id]/page.tsx`.
- **[P2]** No .github/ISSUE_TEMPLATE or PULL_REQUEST_TEMPLATE — add bug.yml/feature.yml + PR template with migration/RLS/AGENTS.md alignment checkboxes. Files: —.
- **[P2]** Enable Supabase Security Advisor + Splinter in CI — checks for RLS off, exposed SECURITY DEFINER, mutable search_path. Files: `.github/workflows`.
- **[P3]** Add PAGESPEED_API_KEY env var to unblock /api/admin/perf — keyless tier is now hard-blocked; restrict key to PSI API + domain. Files: `src/app/api/admin/perf/route.ts`, `.env.local`.
- **[P3]** AnalyticsDashboardLazy comment lies — recharts is NOT actually used; remove misleading comment. Files: `src/app/admin/analytics/AnalyticsDashboardLazy.tsx`.

## Indexes & Database Cleanup (11 items)

- **[P1]** Drop or harden /api/debug/schema and /api/debug/ai endpoints (cross-listed under Security). Files: `src/app/api/debug/schema/route.ts`, `src/app/api/debug/ai/route.ts`.
- **[P1]** Split FOR ALL policies into per-operation policies — lets Postgres pick best index per operation and skip WITH CHECK on reads. Files: `supabase/migrations/053_rls_hardening.sql`, `supabase/migrations/047_user_preferences.sql`.
- **[P2]** Add TO clause (anon/authenticated/service_role) on every policy — reduces planner work and clarifies intent. Files: `supabase/schema.sql`, `supabase/migrations/053_rls_hardening.sql`.
- **[P2]** Add pgTAP RLS tests — silent SELECT/DELETE failures are invisible; verify anon can read sesizari_feed but NOT sesizari directly. Files: `supabase/tests/`.
- **[P2]** Use IN (SELECT ...) set-based pattern instead of correlated EXISTS for multi-row joins — transforms correlated subqueries into set-based ops. Files: `supabase/migrations/024_status_workflow_and_tickets.sql`, `supabase/migrations/057_sesizare_replies.sql`.
- **[P2]** Tighten inbox_filter_log + admin_audit_log policies — auth.role() is unreliable; use TO service_role clause + RESTRICTIVE. Files: `supabase/migrations/072_admin_audit_log.sql`, `supabase/migrations/075_inbox_hardening.sql`.
- **[P2]** Migrate to Supabase 2025 publishable + scoped secret keys — replace shared service_role with per-surface scoped keys. Files: `src/lib/supabase/admin.ts`, `src/lib/env.ts`.
- **[P3]** idx_sesizari_code duplicate with UNIQUE constraint — DROP redundant indexes. Files: `supabase/schema.sql`.
- **[P3]** No index FK on sesizare_votes(user_id), sesizare_verifications(user_id) — JOINs scan; add for /cont profile page hot path. Files: `supabase/schema.sql`.
- **[P3]** Indexes notify_* on profiles probably unused — drop unless idx_scan > 0 after 30 days. Files: `supabase/migrations/064_notify_petitii_proteste.sql`.
- **[P3]** Indexes idx_sesizari_delivery_status and idx_sesizari_bounced created twice (060 + 075) — consolidate migration history. Files: `supabase/migrations/060_delivery_tracking.sql`, `supabase/migrations/075_inbox_hardening.sql`.

## Streaming & React 19 (10 items)

- **[P2]** Parallelize /sesizari/[code] page data fetches with promise-prop streaming instead of awaiting Promise.all — critical details render at 100ms while similar streams in. Files: `src/app/sesizari/[code]/page.tsx`.
- **[P2]** Cache vision-route promise per uploaded photo URL — prevent Suspense loops on re-mount; use module-scope Map keyed by photo SHA. Files: `src/lib/groq/vision-routing.ts`, `src/app/api/ai/vision-route/route.ts`.
- **[P2]** Use server-component direct DB queries instead of /api/sesizari?limit=200 in admin panel useEffect — cuts admin LCP from ~1.2s to ~250ms. Files: `src/app/admin/sesizari/page.tsx`, `src/app/admin/proteste/page.tsx`.
- **[P2]** Surface comment posting failures with action-thrown errors — useOptimistic only rolls back when actions throw, not return error objects. Files: `src/actions/petitii-actions.ts`, `src/components/sesizari/CommentsSection.tsx`.
- **[P2]** Use waitUntil() for AI summary persistence + email reminders instead of awaiting in request path — cuts user-perceived latency 800-2000ms. Files: `src/lib/stiri/ai-summary.ts`, `src/app/api/newsletter/digest/route.ts`.
- **[P2]** Eliminate Supabase service-role storage operations from petitii scrape path — petitii images should live in their own bucket. Files: `src/app/api/admin/petitii/scrape-url/route.ts`.
- **[P3]** Move useFormStatus consumers into child SubmitButton components — must be CHILD of `<form>`, not the form itself. Files: `src/app/petitii/initiaza/InitiatePetitieForm.tsx`, `src/app/admin/actualizari/ActualizariForm.tsx`.
- **[P3]** Replace InitiatePetitieForm draft autosave useEffect with useTransition-scoped writes — keeps textarea input native-priority on mobile. Files: `src/app/petitii/initiaza/InitiatePetitieForm.tsx`.
- **[P3]** Replace SignSesizareButton localStorage lazy init + useEffect with React 19 use(localStorageCache) — eliminates visible flash. Files: `src/components/sesizari/SignSesizareButton.tsx`.
- **[P3]** Stiri feed pagination: use useTransition for 'Load more' — keep filters interactive while new rows stream in. Files: `src/components/stiri/StiriList.tsx`, `src/components/sesizari/SesizariPublice.tsx`.

## Service Worker & PWA (8 items)

- **[P1]** Set `updateViaCache: 'none'` at SW registration — default browser cache for sw.js can be 24h, delaying security fixes. Files: `src/components/InstallPrompt.tsx`.
- **[P1]** Auth-aware cache partitioning — invalidate runtime cache at logout; SW currently has no invalidation on sign-out. Files: `public/sw.js`, `src/components/auth/AuthProvider.tsx`.
- **[P2]** Activate Navigation Preload to avoid SW boot latency — register `navigationPreload.enable()` in activate handler. Files: `public/sw.js`.
- **[P2]** Precache /[judet]/intreruperi for top 5 counties (BV/CJ/B/IS/TM) — when user has power outage, they need outage list available offline. Files: `public/sw.js`.
- **[P2]** Extend outbox to petitii signatures + alerts subscriptions — not just sesizari; signing a petition from the subway is the real case. Files: `public/sw.js`, `src/components/petitii/`.
- **[P2]** Trim inefficient — Cache.keys() doesn't guarantee insertion order in all browsers — attach `x-civia-cached-at` header for predictable LRU. Files: `public/sw.js`.
- **[P2]** Implement Range request handling for media — audio /sesizari/voce and ICS feed need partial-content passthrough. Files: `public/sw.js`.
- **[P3]** Add Periodic Background Sync polyfill for critical outages (Chrome only) — fallback to push notifications server-side on iOS/Safari. Files: `public/sw.js`, `src/app/cont/page.tsx`.

## Edge & Caching (5 items)

- **[P2]** Coordinate Cloudflare cache + Next 16 cacheLife stale time for GeoJSON maps — verify CF respects Cache-Control from Next, set Surrogate-Key for purge-by-tag. Files: `src/app/api/intreruperi/buildings/route.ts`.
- **[P2]** Make Supabase getUser() lazy on PUBLIC_NO_AUTH_PATHS expansion (proxy.ts) — expand to /api/health, /api/intreruperi, /api/stiri; saves 100-300K calls/month. Files: `src/proxy.ts`.
- **[P2]** Edge runtime opportunity missed on read-only ISR APIs — only 7 edge endpoints exist; high-traffic read-only routes could move to edge. Files: `src/app/api/authorities/route.ts`, `src/app/api/v2/clasament/route.ts`.
- **[P2]** Add ETag-based revalidation for /api/sesizari/live-stats — saves 1-3KB JSON on every poll. Files: `src/app/api/sesizari/live-stats/route.ts`.
- **[P3]** Move /api/inbox/reply webhook signature verification to Cloudflare Worker — don't double-bill; Workers cheaper than Fluid for sub-10ms work. Files: `src/app/api/inbox/reply/route.ts`.

## Asset Optimization (8 items)

- **[P2]** Raw `<img>` tags inside client uploaders instead of next/image — no AVIF/WebP, no responsive srcset; PhotoUploader, ParkingProofUploader, admin/petitii thumbs. Files: `src/components/sesizari/PhotoUploader.tsx`, `src/components/sesizari/ParkingProofUploader.tsx`, `src/app/admin/petitii/page.tsx`.
- **[P2]** Heavy AiSummary client component imported eagerly into petition + news detail pages — wrap in next/dynamic with skeleton; split SpeechSynthesis. Files: `src/app/stiri/[id]/page.tsx`, `src/app/petitii/[slug]/page.tsx`.
- **[P2]** lucide-react imported with named-imports — add `experimental.optimizePackageImports: ['lucide-react']` in next.config.ts. Files: `next.config.ts`.
- **[P2]** Heavy lucide-react imports — 16+ icons per admin page; wrap rare ones behind nextDynamic only when tab opens. Files: `src/app/admin/proteste/page.tsx`, `src/app/cont/page.tsx`, `src/components/ui/SearchModal.tsx`.
- **[P2]** Add Supabase Storage image-transformation tier for sesizari thumbnail lists — render?width=400&quality=70 cuts thumbnail payload ~30x. Files: `src/components/sesizari/SesizariPublice.tsx`, `src/app/admin/sesizari/tickets/page.tsx`.
- **[P3]** ScrollRestoration + NavProgress + Analytics + GlobalLiveAnnouncer rendered eager — wrap in next/dynamic({ ssr: false }) or move into DeferredClientMount. Files: `src/app/layout.tsx`.
- **[P3]** MapClient / IntreruperiMap / SesizariMap dynamic-loaded but Leaflet CSS still ships globally — verify CSS chunk isn't preloaded eagerly. Files: `src/app/intreruperi/IntreruperiMap.tsx`, `src/components/maps/LeafletMap.tsx`.
- **[P3]** Inline `<Script>` for external analytics in `<head>` — switch to `strategy="lazyOnload"` since supplementary, saves 30-50ms TTI. Files: `src/app/layout.tsx`.

## Data Files & Bundle (4 items)

- **[P2]** Data files >900 LOC inflate every server-bundle that touches them — convert evenimente-detail/statistici-judete/autoritati-contact to JSON per-key or lazy-load. Files: `src/data/evenimente-detail.ts`, `src/data/autoritati-contact.ts`, `src/data/primari-judete.ts`.
- **[P3]** JsonLd.tsx is 587 LOC — split into src/components/seo/jsonld/{organization,faq,article,...}.tsx for independent imports + tests. Files: `src/components/JsonLd.tsx`.
- **[P3]** Heavy county landing page payload (cross-listed under Performance). Files: `src/app/[judet]/page.tsx`.
- **[P3]** Audit R2 Class A operation usage — multipart upload PUTs from Worker should batch; 1k emails/month × 5-10 attachments = 10k+ ops. Files: `src/lib/inbox/r2-client.ts`.

## Logging & Console (3 items)

- **[P3]** Console statements still in production paths — statistici-judete.ts:1181 fires on every unknown county; ai/classify/route.ts comment admits flooding. Files: `src/data/statistici-judete.ts`, `src/app/api/ai/classify/route.ts`, `src/lib/logger.ts`.
- **[P3]** Email contents written via console.log when Resend not configured (dev path) — route through logger that already strips PII. Files: `src/lib/email/resend.ts`.
- **[P3]** Document the Edge-deprecation policy in AGENTS.md — add 'Runtime policy' section to prevent future PRs reintroducing 'edge'. Files: `AGENTS.md`.

## Misc & Polish (5 items)

- **[P3]** executing api route (app) /icon — 100 hits/7d; add `export const dynamic = 'force-static'` to icon.tsx. Files: `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `next.config.ts`.
- **[P3]** Layout shift on header nav (0.0005) is rendering ghost shift — likely font-display optical metric; residual unavoidable adjustFontFallback noise. Files: `src/app/layout.tsx`.
- **[P3]** Resource.beacon to rhjfutxgmnkonichxpro.supabase.co takes 3s p95 — different Supabase project; investigate and either drop or document. Files: `src/app/layout.tsx`, `src/components/analytics/CiviaTracker.tsx`.
- **[P3]** GitGuardian + CodeQL are the only consistently-green workflows — make these required_status_checks on main protection. Files: `.github/workflows/codeql.yml`, `.github/workflows/gitguardian.yml`.
- **[P3]** Hardcoded hex brand colors in Tailwind className instead of design tokens — bilete operator colors, source chips bypass dark-mode contrast checks. Files: `src/app/[judet]/page.tsx`, `src/components/bilete/BileteTabs.tsx`, `src/components/stiri/StiriList.tsx`.
- **[P3]** Skip-to-content link works but skips to `<main>`, not first heading — add tabIndex={-1} to `<main>` so it receives programmatic focus. Files: `src/app/layout.tsx`.
- **[P3]** InstallPrompt and CookieBanner dialogs have no Escape handler — keyboard convention: Escape dismisses (treat as 'reject all' for CookieBanner). Files: `src/components/InstallPrompt.tsx`, `src/components/CookieBanner.tsx`.
- **[P3]** Use S3-compatible presigned PUT path in /api/upload for video uploads — VIDEO_MAX_BYTES check bypassed by direct Supabase upload. Files: `src/app/proteste/[slug]/cum-a-fost/edit/AftermathForm.tsx`, `src/app/api/upload/route.ts`.
- **[P3]** Stop using Resend 'attachments via URL' for sesizari photos — pin behind Cloudflare-cached R2 URL for higher availability on resend. Files: `src/lib/email/resend.ts`, `src/app/api/sesizari/[code]/send-via-civia/route.ts`.
- **[P3]** Add daily Vercel cron reporting Supabase Storage egress to /admin/analytics — without it, team learns of cost spikes when invoice lands. Files: `src/app/api/stiri/fetch/route.ts`, `src/lib/analytics/redis.ts`.
- **[P3]** Pre-warm Cloudflare cache for /sesizari OG share images — first share is slow due to cold lambda; post-publish hook warms global cache. Files: `src/app/sesizari/share/route.ts`.
- **[P3]** Use R2 jurisdiction='eu' endpoint variant per-bucket, not global env var — per-call jurisdiction maps to per-bucket config. Files: `src/lib/inbox/r2-client.ts`.
- **[P3]** Add CDN purge hook when sesizare admin-moderates a photo — Supabase Smart CDN auto-busts within 60s; explicit purge closes window. Files: `src/app/api/admin/sesizari/[code]/moderate/route.ts`.
- **[P3]** Defensive: explicit `prepare: false` and `pgbouncer: true` flags wherever future postgres.js lands — Supavisor named-prepared-statement quirks reported through early 2026. Files: `AGENTS.md`, `CLAUDE.md`.
- **[P3]** Adopt @vercel/functions package + connection() for env-var freshness on /api/admin routes — env vars are read at BUILD time unless `await connection()` is called. Files: `src/app/api/admin/*/route.ts`, `src/lib/supabase/admin.ts`.
- **[P3]** DevTools MCP integration — accelerate debugging Civia for AI agents; add MCP server in `.mcp.json`. Files: `.mcp.json`.
- **[P3]** Audit maxDuration ceilings — Hobby Fluid default is now 300s, not 10s; lift cron routes to 300s. Files: `vercel.json`.
- **[P3]** NotificationBell lookupSesizare runs one query per timeline event — fetch (id, code, titlu) once at init via .in('id', timelineIds). Files: `src/components/NotificationBell.tsx`.
- **[P3]** /api/admin/analytics/civic-kpi runs 5 sequential awaits — wrap all 5 in single top-level Promise.all (~200-300ms saving). Files: `src/app/api/admin/analytics/civic-kpi/route.ts`.
- **[P3]** Add `Service-Worker-Allowed: /` header for sw.js served from /public — safety net + Cache-Control headers complement updateViaCache. Files: `next.config.ts`.
- **[P3]** SWR with Vary: Accept-Language for ro/en multi-lingual routes — diaspora not folder-targeted today, but document policy. Files: `public/sw.js`.
- **[P3]** Draft Mode for admin preview on AI-summarized stiri — bypass cache safely; admins must see new anti-cliché/anti-minimization rules applied. Files: `src/app/admin/stiri`.
- **[P3]** Add Postgres partial indexes for moderation_status WHERE != 'approved', resolved_at WHERE NOT NULL, bounced_at — sparse-column best practice. Files: `supabase/migrations/075_inbox_hardening.sql`.
- **[P3]** 37 loading.tsx files cover ~40% of pages — 54 pages have no streaming UI; add skeletons to homepage, /petitii/[slug], /proteste/[slug]. Files: `src/app/page.tsx`, `src/app/petitii/[slug]/page.tsx`, `src/app/proteste/page.tsx`.
- **[P3]** Layout deduplication + incremental prefetching — verify Link usage on /sesizari grid; Next 16 dedupes layout chunks across links automatically. Files: `src/app/sesizari-publice`, `src/components/sesizari`.