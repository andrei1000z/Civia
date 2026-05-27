-- ============================================================
-- Migration 075: Inbox hardening (RFC 5322 dedup + threading + delivery)
-- ============================================================
--
-- Plan 2026-05-27 — audit pe inbox-ul sesizari@civia.ro a relevat:
--   1. DEDUP slab: constraint UNIQUE(sesizare_id, from_email, received_at)
--      e prea tolerant — same-second arrivals trec ca duplicate adevărate
--      (caz confirmat: Cluj-Napoca 5 confirmări pentru 00049 cu același nr 563).
--   2. Lipsă Message-ID extras explicit — disponibil în raw_headers JSONB
--      dar nu indexat / unique. RFC 5322 §3.6.4 zice că Message-ID e global
--      unique → ideal pentru dedup. Adăugăm coloană generated extrasă din
--      raw_headers + UNIQUE INDEX.
--   3. Lipsă threading via In-Reply-To / References — un email reply nu se
--      atașează corect la sesizarea originală dacă subject-ul e generic
--      („Informare", „Confirmare"). 2 din 22 replies actuale unmatched.
--   4. Migration 060 (delivery_status + bounced_at) NU a fost aplicat în
--      DB-ul prod. Recreăm-o aici idempotent.
--   5. Lipsă audit pentru ce a fost FILTRAT de worker (auto-reply,
--      self-forward, mailer-daemon) — tabel nou inbox_filter_log.

-- ─── 1. Aplică 060 (delivery tracking pe sesizari) idempotent ──────
ALTER TABLE public.sesizari
  ADD COLUMN IF NOT EXISTS delivery_status TEXT CHECK (
    delivery_status IN ('sent', 'delivered', 'bounced', 'complained', 'delayed')
  ),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounce_reason TEXT;

COMMENT ON COLUMN public.sesizari.delivery_status IS
  'Status livrare Resend: sent (initial) → delivered/bounced/complained/delayed. Actualizat de webhook /api/email/resend-webhook.';

CREATE INDEX IF NOT EXISTS idx_sesizari_delivery_status
  ON public.sesizari (delivery_status) WHERE delivery_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sesizari_bounced
  ON public.sesizari (bounced_at DESC) WHERE bounced_at IS NOT NULL;

-- ─── 2. sesizare_replies: extract message_id + threading headers ──
ALTER TABLE public.sesizare_replies
  ADD COLUMN IF NOT EXISTS message_id TEXT,
  ADD COLUMN IF NOT EXISTS in_reply_to TEXT,
  ADD COLUMN IF NOT EXISTS references_chain TEXT;

-- Backfill message_id din raw_headers pentru rândurile existente.
-- Trim < > delimitatori RFC 5322 + lowercase pentru case-insensitive match.
UPDATE public.sesizare_replies
SET message_id = LOWER(TRIM(BOTH '<>' FROM (raw_headers->>'message-id')))
WHERE message_id IS NULL
  AND raw_headers->>'message-id' IS NOT NULL;

UPDATE public.sesizare_replies
SET in_reply_to = LOWER(TRIM(BOTH '<>' FROM (raw_headers->>'in-reply-to')))
WHERE in_reply_to IS NULL
  AND raw_headers->>'in-reply-to' IS NOT NULL;

UPDATE public.sesizare_replies
SET references_chain = LOWER(raw_headers->>'references')
WHERE references_chain IS NULL
  AND raw_headers->>'references' IS NOT NULL;

COMMENT ON COLUMN public.sesizare_replies.message_id IS
  'RFC 5322 §3.6.4 — globally unique message identifier. Folosit pentru dedup ingestie (worker poate retry pe același mesaj).';
COMMENT ON COLUMN public.sesizare_replies.in_reply_to IS
  'RFC 5322 — Message-ID-ul mesajului parent (sesizarea originală trimisă de Civia). Folosit pentru threading.';
COMMENT ON COLUMN public.sesizare_replies.references_chain IS
  'RFC 5322 — Chain-ul complet de Message-IDs din thread. Walk inverse → găsim sesizarea originală.';

-- ─── 3. Index UNIQUE pe message_id (dedup hard) ────────────────────
-- NULL permis (unele emailuri vechi nu au message-id; nu invalidăm baza).
-- WHERE message_id IS NOT NULL → unique partial index, NULL nu intră în check.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sesizare_replies_message_id
  ON public.sesizare_replies (message_id)
  WHERE message_id IS NOT NULL;

-- Index pe in_reply_to + references pentru threading lookups
CREATE INDEX IF NOT EXISTS idx_sesizare_replies_in_reply_to
  ON public.sesizare_replies (in_reply_to)
  WHERE in_reply_to IS NOT NULL;

-- ─── 4. Tabel inbox_filter_log — audit ce a fost dropped de worker ─
CREATE TABLE IF NOT EXISTS public.inbox_filter_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  from_email TEXT,
  subject TEXT,
  filter_reason TEXT NOT NULL,
  worker_version TEXT,
  raw_payload JSONB
);

COMMENT ON TABLE public.inbox_filter_log IS
  'Audit log pentru emailuri respinse de Cloudflare Worker la ingress (auto-reply, self-forward, mailer-daemon). Permite analize pe pattern-uri și debug.';

CREATE INDEX IF NOT EXISTS idx_inbox_filter_log_received
  ON public.inbox_filter_log (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_filter_log_reason
  ON public.inbox_filter_log (filter_reason);

-- RLS off — admin-only via service role (worker folosește direct PostgREST)
ALTER TABLE public.inbox_filter_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox_filter_log_admin_only"
  ON public.inbox_filter_log FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 075: inbox hardening (dedup + threading + delivery + filter audit) aplicată.' AS status;
