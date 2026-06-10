-- ============================================================
-- Migration 101: dezactivează joburile pg_cron HTTP (078b)
-- ============================================================
--
-- 2026-06-10 (audit statusuri) — sursă UNICĂ de programare. Dispecerul canonic
-- e /api/cron/daily (vercel.json), care acoperă TOATE joburile, inclusiv cele noi
-- (auto-status, purge-retention, winback, streaks). Joburile HTTP din migrația
-- 078b apelau aceleași endpoint-uri (reminders la 6h etc.) → dublă emisie de
-- emailuri dacă ambele sisteme rulau.
--
-- Această migrare DEZACTIVEAZĂ doar joburile HTTP din 078b (care duplică Vercel).
-- Joburile SQL pur din 078 (cleanup-uri, feed-refresh, mark-overdue) NU sunt
-- atinse — sunt mentenanță internă a bazei, nu duplică nimic.
--
-- DEFENSIVĂ + IDEMPOTENTĂ: no-op dacă pg_cron nu e instalat sau joburile nu există.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname IN (
      'stiri-refresh-30min',
      'sesizari-reminders-6h',
      'petitii-scrape-12h',
      'intreruperi-refresh-4h'
    );
  END IF;
END $$;
