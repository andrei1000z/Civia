-- ============================================================
-- Migration 096: matching automat reply→sesizare (token + threading)
-- ============================================================
-- Tehnologie de matching defense-in-depth (research 2026-06-08):
--   N1 token opac în Reply-To (sesizari+{HMAC}@civia.ro)
--   N2 RFC 5322 threading (Message-ID propriu, persistat)
--   N3 cod în subiect (deja existent)
--   N4 domeniu/conținut/AI (gated)
--
-- reply_token = HMAC opac (nu codul brut ghicibil) pus în Reply-To.
-- outbound_message_id = Message-ID-ul RFC propriu setat la trimitere
--   (DISTINCT de resend_message_id, care e id-ul intern Resend).
-- match_method = telemetrie: cum a fost legat reply-ul.

ALTER TABLE public.sesizari
  ADD COLUMN IF NOT EXISTS outbound_message_id TEXT,
  ADD COLUMN IF NOT EXISTS reply_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sesizari_reply_token
  ON public.sesizari (reply_token) WHERE reply_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sesizari_outbound_msgid
  ON public.sesizari (outbound_message_id) WHERE outbound_message_id IS NOT NULL;

ALTER TABLE public.sesizare_replies
  ADD COLUMN IF NOT EXISTS match_method TEXT;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 096 (inbox token matching) aplicată.' AS status;
