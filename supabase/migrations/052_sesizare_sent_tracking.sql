-- Tracking real al sesizarilor trimise via Civia (Resend) vs mailto.
--
-- Bug pre-fix: nu stiam daca user-ul chiar a apasat „Trimite" in app-ul
-- lui de email — dropoff invizibil ~70%.
--
-- Solutie: feature „Trimite via Civia" cu un cont logat. Server-ul
-- trimite emailul direct via Resend cu Reply-To la user. Persistam ca
-- a fost trimis si cand, pentru status dashboard + reminders calibrate.

ALTER TABLE public.sesizari
  ADD COLUMN IF NOT EXISTS sent_via_civia BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_to_emails TEXT[],
  ADD COLUMN IF NOT EXISTS resend_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sesizari_sent_via_civia
  ON public.sesizari (sent_via_civia, sent_at DESC)
  WHERE sent_via_civia = TRUE;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 052: sent_via_civia tracking aplicata.' AS status;
