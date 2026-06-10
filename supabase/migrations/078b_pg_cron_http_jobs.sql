-- ============================================================
-- Migration 078b: pg_cron HTTP jobs (necesită app.cron_secret)
-- ============================================================
--
-- ⚠️ DEPRECATED (2026-06-10, audit statusuri). NU rula această migrare alături
-- de dispecerul canonic /api/cron/daily (vercel.json). Ar DUBLA emisia: pg_cron
-- programează `reminders` la 6h, iar dispecerul zilnic îl rulează deja 1×/zi →
-- emailuri duplicate către cetățeni. Dispecerul Vercel e canonic (acoperă și
-- joburile noi: auto-status, purge-retention, winback, streaks — pe care pg_cron
-- nu le are). Dacă pg_cron a fost activat anterior, dezactivează-l (vezi
-- migrația 101_deprecate_pgcron pentru cron.unschedule defensiv).
--
-- 2026-05-27 — Sub-daily jobs care apelează endpoint-uri Vercel cu
-- Bearer auth. Separate de 078 pentru că necesită Postgres setting
-- `app.cron_secret` setat ÎNAINTE de a rula migrarea.
--
-- SETUP NECESAR (o singură dată, ÎNAINTE de această migrare):
-- ----------------------------------------------------------------
-- În Supabase Dashboard → SQL Editor, rulează ÎNTÂI (cu valoare reală):
--
--   ALTER DATABASE postgres SET app.cron_secret = 'VALOAREA_DIN_VERCEL_CRON_SECRET';
--
-- Unde VALOAREA_DIN_VERCEL_CRON_SECRET = valoarea env-ului CRON_SECRET
-- din Vercel (Settings → Environment Variables → CRON_SECRET → Reveal).
--
-- Verifică setarea cu:
--   SELECT current_setting('app.cron_secret', true);
--
-- Apoi rulează această migrare.
-- ----------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sanity check: dacă app.cron_secret nu e setat, fail loud.
DO $$
DECLARE
  v_secret TEXT;
BEGIN
  v_secret := current_setting('app.cron_secret', true);
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'app.cron_secret not set. Run first: ALTER DATABASE postgres SET app.cron_secret = ''<value>''';
  END IF;
END $$;

-- ─── 1. Stiri RSS refresh la 30 min ────────────────────────────────
SELECT cron.schedule(
  'stiri-refresh-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.civia.ro/api/stiri/fetch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- ─── 2. Sesizari reminders escalate (la fiecare 6h) ────────────────
SELECT cron.schedule(
  'sesizari-reminders-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.civia.ro/api/sesizari/reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) AS request_id;
  $$
);

-- ─── 3. Petitii scrape updates (la fiecare 12h) ────────────────────
SELECT cron.schedule(
  'petitii-scrape-12h',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.civia.ro/api/petitii/scrape-updates',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

-- ─── 4. Intreruperi refresh (la fiecare 4h) ────────────────────────
SELECT cron.schedule(
  'intreruperi-refresh-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://www.civia.ro/api/intreruperi/refresh',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.cron_secret', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) AS request_id;
  $$
);

-- ─── Verify ────────────────────────────────────────────────────────
-- SELECT jobid, schedule, jobname FROM cron.job WHERE jobname LIKE 'stiri-%' OR jobname LIKE 'sesizari-%' OR jobname LIKE 'petitii-%' OR jobname LIKE 'intreruperi-%';
