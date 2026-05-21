-- ============================================================
-- Migration 058: inbox_debug_log
-- ============================================================
--
-- Diagnostic table — logs EVERY POST to /api/inbox/reply, even when
-- auth fails. Helps debug Cloudflare Email Worker integration when
-- email arrives but webhook doesn't process.
--
-- Also stores heartbeat pings from /api/inbox/heartbeat (no-auth).
--
-- Retention: NO automatic cleanup. Run manual delete after debugging
-- via scripts/cleanup-inbox-debug.ts to keep DB clean.

CREATE TABLE IF NOT EXISTS public.inbox_debug_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL CHECK (endpoint IN ('reply', 'heartbeat')),
  -- Numele worker-ului care a apelat (din User-Agent sau header custom).
  source TEXT,
  -- Status HTTP returnat (200, 401, 400, 500 etc.) — null pentru heartbeat.
  http_status INTEGER,
  -- Toate headerele primite — vrem să verificăm Authorization, User-Agent etc.
  request_headers JSONB,
  -- Body primit (cap la 50KB ca să nu explodeze DB).
  request_body TEXT,
  -- Eroarea de procesare dacă a fost (pentru replies care au eșuat).
  error_message TEXT,
  -- IP-ul de la care a venit request-ul (proxy.ts forward).
  source_ip TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_debug_recent
  ON public.inbox_debug_log (received_at DESC);

-- RLS: admin only (folosesc service_role oricum la insert).
ALTER TABLE public.inbox_debug_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "debug_log_no_client_access" ON public.inbox_debug_log;
CREATE POLICY "debug_log_no_client_access"
  ON public.inbox_debug_log
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 058: inbox_debug_log aplicata.' AS status;
