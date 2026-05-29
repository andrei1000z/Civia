-- 2026-05-29 — Sesizari retries audit trail + retry tracking columns + perf indexes
--
-- Combina mai multe migration-uri inrudite intr-un singur fisier idempotent:
-- (a) Auto-retry pe partial bounce — nou tabel sesizari_retries + 2 coloane pe sesizari
-- (b) Indexes lipsa pe queries hot (improvements P1 #21)
-- (c) statement_timeout + idle_in_transaction_session_timeout (P1 #22)
-- (d) inbox_filter_log retention 90 zile (P1 #43)

-- ─── (a) Auto-retry tracking ────────────────────────────────────────────

ALTER TABLE sesizari
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

COMMENT ON COLUMN sesizari.retry_count IS
  'Numarul de retransmisii automate dupa bounce partial. Max 3 (vezi /api/cron/sesizari-retry-bounce).';
COMMENT ON COLUMN sesizari.last_retry_at IS
  'Cand a fost ultima retrimitere — cooldown 4h intre retry-uri.';

CREATE TABLE IF NOT EXISTS sesizari_retries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesizare_id UUID NOT NULL REFERENCES sesizari(id) ON DELETE CASCADE,
  retry_count INTEGER NOT NULL,
  retried_to TEXT[] NOT NULL,
  excluded_bounced TEXT[],
  resend_message_id TEXT,
  retried_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  notes TEXT
);

COMMENT ON TABLE sesizari_retries IS
  'Audit trail pentru toate retrimisiile automate dupa partial_bounced. Pentru admin debug si statistici per primarie.';

CREATE INDEX IF NOT EXISTS idx_sesizari_retries_sesizare_id
  ON sesizari_retries(sesizare_id, retried_at DESC);

-- RLS: doar admin
ALTER TABLE sesizari_retries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'sesizari_retries admin only'
      AND tablename = 'sesizari_retries'
  ) THEN
    CREATE POLICY "sesizari_retries admin only" ON sesizari_retries
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END$$;

-- ─── (b) Perf indexes ─────────────────────────────────────────────────────

-- sesizare_replies(authority_id) — query frecvent in admin/inbox
CREATE INDEX IF NOT EXISTS idx_sesizare_replies_authority_id
  ON sesizare_replies(authority_id);

-- sesizari(status, sent_at) — pentru cron sesizari-mark-overdue
CREATE INDEX IF NOT EXISTS idx_sesizari_status_sent_at
  ON sesizari(status, sent_at);

-- sesizari(moderation_status, created_at DESC) — admin queue
CREATE INDEX IF NOT EXISTS idx_sesizari_moderation_status_created
  ON sesizari(moderation_status, created_at DESC);

-- sesizare_votes(user_id) — list votes per user
CREATE INDEX IF NOT EXISTS idx_sesizare_votes_user_id
  ON sesizare_votes(user_id);

-- Notifications partial index pentru unread count (skip dacă tabela lipseşte)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL';
  END IF;
END$$;

-- sesizari(delivery_status, retry_count) pentru cron auto-retry
CREATE INDEX IF NOT EXISTS idx_sesizari_partial_bounced_retry
  ON sesizari(delivery_status, retry_count, last_retry_at)
  WHERE delivery_status = 'partial_bounced';

-- ─── (c) Statement timeouts ──────────────────────────────────────────────

DO $$
BEGIN
  ALTER ROLE authenticated SET statement_timeout = '15s';
  ALTER ROLE authenticated SET idle_in_transaction_session_timeout = '5min';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Cannot ALTER ROLE — skip (needs DB superuser).';
END$$;

-- ─── (d) inbox_filter_log retention pg_cron ──────────────────────────────

-- Idempotent: if pg_cron + cron schema exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Drop existing if any
    PERFORM cron.unschedule('inbox-filter-log-cleanup-87')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'inbox-filter-log-cleanup-87'
      );
    -- Schedule daily at 04:15
    PERFORM cron.schedule(
      'inbox-filter-log-cleanup-87',
      '15 4 * * *',
      $cmd$DELETE FROM inbox_filter_log WHERE created_at < NOW() - INTERVAL '90 days'$cmd$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron schedule skip: %', SQLERRM;
END$$;
