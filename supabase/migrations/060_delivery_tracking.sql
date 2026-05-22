-- ============================================================
-- Migration 060: Resend delivery tracking
-- ============================================================
--
-- Plan 5/22/2026 — adăugăm coloane pentru a urmări delivery lifecycle al
-- emailurilor trimise prin Resend către primării:
--   sent → delivered / bounced / complained / delayed
--
-- Populate prin webhook Resend (/api/email/resend-webhook). Webhook
-- folosește resend_message_id ca lookup-key spre sesizari.
--
-- Fără asta, „ghost sends" (Resend returnează ok=true dar emailul face
-- bounce) sunt invizibile — primăria nu primește, dar DB zice „trimis".

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

-- Author address — ADD column dacă lipsește (din audit a rezultat că lipsea
-- o coloană dedicată; era pus doar inline în formal_text).
ALTER TABLE public.sesizari
  ADD COLUMN IF NOT EXISTS author_address TEXT;

COMMENT ON COLUMN public.sesizari.author_address IS
  'Adresa cetățeanului. Obligatorie pentru identificare oficială în emailul către primărie (OG 27/2002 art. 12).';

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 060: delivery_status + bounce tracking aplicata.' AS status;
