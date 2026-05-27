-- ============================================================
-- Migration 078: Supabase pg_cron — cleanup-only (no auth required)
-- ============================================================
--
-- 2026-05-27 — Cleanup jobs care nu necesită CRON_SECRET (pur SQL).
-- Aplicat autonom prin npm run migrate.
--
-- Jobs care AU nevoie de http_post + CRON_SECRET (stiri refresh la 30 min,
-- sesizari reminders la 6h) sunt în migration 078b separat, aplicat
-- manual de user după ce setează app.cron_secret în Database Settings.

-- ─── Prereq: enable pg_cron ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── 1. Cleanup inbox_debug_log > 30 zile (zilnic 4 AM UTC) ────────
-- Table crește unbound — fiecare email primit la sesizari@civia.ro
-- inserează 1-3 rânduri. 30 zile retention e suficient pentru debug
-- + GDPR.
SELECT cron.schedule(
  'inbox-debug-log-cleanup',
  '0 4 * * *',
  $$
  DELETE FROM public.inbox_debug_log
  WHERE received_at < NOW() - INTERVAL '30 days';
  $$
);

-- ─── 2. Cleanup inbox_filter_log > 60 zile ─────────────────────────
SELECT cron.schedule(
  'inbox-filter-log-cleanup',
  '15 4 * * *',
  $$
  DELETE FROM public.inbox_filter_log
  WHERE received_at < NOW() - INTERVAL '60 days';
  $$
);

-- ─── 3. Cleanup drafts expirate > 7 zile (dacă table exists) ───────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drafts') THEN
    PERFORM cron.schedule(
      'drafts-cleanup',
      '30 4 * * *',
      $cron$
      DELETE FROM public.drafts
      WHERE updated_at < NOW() - INTERVAL '7 days';
      $cron$
    );
  END IF;
END $$;

-- ─── 4. Cleanup feedback_submissions > 90 zile (păstrăm doar recente) ────
-- Acceptat: ștergem old feedback ca GDPR retention. Admin a procesat deja
-- ce era important.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback_submissions') THEN
    PERFORM cron.schedule(
      'feedback-cleanup',
      '45 4 * * *',
      $cron$
      DELETE FROM public.feedback_submissions
      WHERE created_at < NOW() - INTERVAL '90 days'
        AND status IN ('done', 'wontfix', 'duplicate');
      $cron$
    );
  END IF;
END $$;

-- ─── 5. Refresh sesizari_feed_view (dacă materialized view exists) ────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'sesizari_feed_view') THEN
    PERFORM cron.schedule(
      'sesizari-feed-refresh',
      '*/5 * * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.sesizari_feed_view;'
    );
  END IF;
END $$;

-- ─── 6. Auto-resolve sesizari foarte vechi fără răspuns (60+ zile) ────
-- OG 27/2002 limită = 30 zile. La 60 zile, autoritatea oficial e în
-- depășire. Marcăm cu status special pentru followup AvocatulPoporului.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sesizari' AND column_name = 'status'
  ) THEN
    PERFORM cron.schedule(
      'sesizari-mark-overdue',
      '0 5 * * *',
      $cron$
      UPDATE public.sesizari
      SET status = 'amanata'
      WHERE status IN ('trimis', 'inregistrata', 'in-lucru')
        AND sent_at IS NOT NULL
        AND sent_at < NOW() - INTERVAL '60 days'
        AND (
          SELECT COUNT(*) FROM public.sesizare_replies sr
          WHERE sr.sesizare_id = public.sesizari.id
        ) = 0;
      $cron$
    );
  END IF;
END $$;

-- ─── Verify all jobs registered ────────────────────────────────────
-- SELECT jobid, schedule, jobname, command FROM cron.job ORDER BY jobid;

COMMENT ON EXTENSION pg_cron IS
'Sub-daily SQL-only cron jobs: inbox debug/filter log cleanup, drafts expire,
feedback retention, materialized view refresh, sesizari mark-overdue.

HTTP cron jobs (stiri refresh la 30 min, sesizari reminders la 6h)
necesită Postgres setting app.cron_secret — aplicate separat în 078b
după setup.';
