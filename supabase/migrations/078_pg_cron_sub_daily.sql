-- ============================================================
-- Migration 078: Supabase pg_cron sub-daily scheduled jobs
-- ============================================================
--
-- 2026-05-27 — Vercel Hobby plan limitează cron la 1×/zi. Pentru
-- following sub-daily tasks switchăm la Supabase pg_cron + pg_net:
--   1. Stiri RSS refresh la 30 min (acum: 1×/zi + self-healing pe traffic)
--   2. Sesizari reminders escalate 7d/14d/30d (acum: doar zilnic — funcțional
--      dar cu lag până la 24h între rule firing)
--   3. Cleanup inbox_debug_log > 30d (acum: lipsește, table crește unbound)
--   4. Cleanup expired drafts > 7d (acum: doar local-storage, server cruft)
--   5. Refresh sesizari_feed_view materialized view la 5 min (acum: pe write)
--
-- Folosim pg_net.http_post pentru a apela endpoint-uri Vercel cu Bearer auth.
-- Necesar: CRON_SECRET în Vault (Supabase Dashboard → Settings → Vault)
-- sau hardcoded în SQL ca string (acceptat doar pe Supabase Pro, dar nu
-- security-perfect — preferred Vault).

-- ─── Prereq: enable extensions ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── Helper: get CRON_SECRET din Supabase Vault ────────────────────
-- Vault se accesează via vault.decrypted_secrets view.
-- Dacă vault nu e setup, folosim NULL → cron-ul va eșua silent (Vercel
-- 401), iar admin va vedea în Sentry. Setup recomandat:
--   1. Supabase Dashboard → Settings → Vault → Add secret name=cron_secret
--   2. value = same as Vercel ENV CRON_SECRET

-- ─── 1. Stiri RSS refresh la 30 min ────────────────────────────────
-- ÎNCONJURĂ daily cron Vercel cu self-healing trigger. Reducem lag-ul
-- pe știri proaspete (Digi24/HotNews publish 6 ori/zi).
SELECT cron.schedule(
  'stiri-refresh-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.civia.ro/api/stiri/fetch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- ─── 2. Sesizari reminders escalate (la fiecare 6h) ────────────────
-- Endpoint deja există: /api/sesizari/reminders rulează 1×/zi.
-- La 6h prinde sesizari care ating threshold 7/14/30 zile mai aproape
-- de momentul real (nu cu 24h lag).
SELECT cron.schedule(
  'sesizari-reminders-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.civia.ro/api/sesizari/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- ─── 3. Cleanup inbox_debug_log > 30 zile (zilnic 4 AM) ────────────
-- Table crește unbound — fiecare email primit la sesizari@civia.ro
-- inserează 1-3 rânduri. La 100 emails/zi = ~1000 rânduri/lună fără
-- cleanup. 30 zile retention e suficient pentru debug + GDPR.
SELECT cron.schedule(
  'inbox-debug-log-cleanup',
  '0 4 * * *',
  $$
  DELETE FROM public.inbox_debug_log
  WHERE received_at < NOW() - INTERVAL '30 days';
  $$
);

-- ─── 4. Cleanup inbox_filter_log > 60 zile ─────────────────────────
SELECT cron.schedule(
  'inbox-filter-log-cleanup',
  '15 4 * * *',
  $$
  DELETE FROM public.inbox_filter_log
  WHERE received_at < NOW() - INTERVAL '60 days';
  $$
);

-- ─── 5. Cleanup analytics events > 7 zile (Redis are TTL, dar SQL fallback) ──
-- Skipped — analytics e în Redis cu TTL. Nu mai trebuie.

-- ─── 6. Refresh stiri trending counters (la 10 min) ────────────────
-- Dacă există un materialized view, refresh-uim ca să arate counter-urile
-- proaspete pe homepage. Detect dacă view există:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'stiri_trending') THEN
    PERFORM cron.schedule(
      'stiri-trending-refresh',
      '*/10 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.stiri_trending;'
    );
  END IF;
END $$;

-- ─── Verify all jobs registered ────────────────────────────────────
-- SELECT * FROM cron.job ORDER BY jobid;

COMMENT ON EXTENSION pg_cron IS
'Sub-daily scheduled jobs replacing Vercel Hobby 1×/zi limit. Jobs:
- stiri-refresh-30min: news every 30 min
- sesizari-reminders-6h: escalation every 6h
- inbox-debug-log-cleanup: nightly
- inbox-filter-log-cleanup: nightly
- stiri-trending-refresh: if matview exists, every 10 min';
