-- ============================================================
-- Migration 057: sesizare_replies + nr_inregistrare
-- ============================================================
--
-- Feature: AI-tracked replies from authorities.
--
-- When the user clicks „Trimite cu Civia" we send the sesizare to
-- multiple authorities via Resend with Reply-To set to
-- sesizari+CODE@civia.ro. Cloudflare Email Routing intercepts replies
-- to that subdomain (plus-addressing), forwards them to a Worker,
-- which POSTs to /api/inbox/reply. There, Groq AI classifies the
-- reply and we auto-update the sesizare status when confidence is high.
--
-- This migration:
--   1. Adds `nr_inregistrare` column on sesizari (instituția dă un
--      număr oficial când înregistrează sesizarea — îl extragem din
--      răspuns prin AI și-l afișăm public)
--   2. Creates `sesizare_replies` table — fiecare email primit, plus
--      ce a clasificat AI-ul. Toate emailurile primite se păstrează,
--      chiar și cele necunoscute / spam (cu flag).
--   3. RLS: public can read replies for public sesizari (so the
--      timeline can show them). Insert only via service-role (the
--      webhook endpoint uses admin client).
--   4. Index pe sesizare_id pentru lookup rapid pe pagina detail.

-- ─── 1. Add nr_inregistrare coloana pe sesizari ────────────────────
ALTER TABLE public.sesizari
  ADD COLUMN IF NOT EXISTS nr_inregistrare TEXT;

COMMENT ON COLUMN public.sesizari.nr_inregistrare IS
  'Numar de inregistrare oficial alocat de institutie (ex: 7421/2026). Extras de AI din raspunsul autoritatii.';

-- ─── 2. Tabela replies ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sesizare_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesizare_id UUID REFERENCES public.sesizari(id) ON DELETE CASCADE,

  -- Sender info din emailul primit
  from_email TEXT NOT NULL,
  from_name TEXT,
  -- Match pe AUTH catalog daca putem identifica institutia
  authority_id TEXT,
  authority_name TEXT,

  -- Email content
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  -- Raw headers pentru debug
  raw_headers JSONB,
  attachments JSONB,

  -- AI clasificare
  ai_status TEXT CHECK (ai_status IN (
    'inregistrata', 'in-lucru', 'rezolvat',
    'redirectionata', 'respins', 'cerere_informatii', 'necunoscut'
  )),
  ai_confidence INTEGER CHECK (ai_confidence BETWEEN 0 AND 100),
  ai_summary TEXT,
  ai_nr_inregistrare TEXT,
  ai_deadline TEXT,
  ai_suggested_action TEXT,
  ai_raw_response JSONB,

  -- A fost aplicat AI-ul ca status update automat? (confidence > 80)
  auto_applied BOOLEAN DEFAULT FALSE,
  -- Userul a confirmat manual clasificarea AI? (NULL = pending review)
  user_confirmed BOOLEAN,
  user_corrected_status TEXT,

  -- Anti-spoofing: domeniul From: e cunoscut (autoritate verificata)?
  trusted_sender BOOLEAN DEFAULT FALSE,

  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  CONSTRAINT replies_sesizare_received_unique UNIQUE (sesizare_id, from_email, received_at)
);

CREATE INDEX IF NOT EXISTS idx_replies_sesizare_received
  ON public.sesizare_replies (sesizare_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_replies_pending_review
  ON public.sesizare_replies (sesizare_id)
  WHERE user_confirmed IS NULL AND auto_applied = FALSE;

-- ─── 3. RLS ────────────────────────────────────────────────────────
ALTER TABLE public.sesizare_replies ENABLE ROW LEVEL SECURITY;

-- Public read pentru replies aferente unei sesizari publice + approved.
DROP POLICY IF EXISTS "replies_public_read" ON public.sesizare_replies;
CREATE POLICY "replies_public_read"
  ON public.sesizare_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sesizari s
      WHERE s.id = sesizare_replies.sesizare_id
        AND s.publica = TRUE
        AND s.moderation_status = 'approved'
    )
  );

-- Owner read (own sesizari, indiferent de public/approved status).
DROP POLICY IF EXISTS "replies_owner_read" ON public.sesizare_replies;
CREATE POLICY "replies_owner_read"
  ON public.sesizare_replies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sesizari s
      WHERE s.id = sesizare_replies.sesizare_id
        AND s.user_id = auth.uid()
    )
  );

-- Owner can update ai_confirmation fields (confirm/correct AI classification)
DROP POLICY IF EXISTS "replies_owner_confirm" ON public.sesizare_replies;
CREATE POLICY "replies_owner_confirm"
  ON public.sesizare_replies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sesizari s
      WHERE s.id = sesizare_replies.sesizare_id
        AND s.user_id = auth.uid()
    )
  );

-- Insert: NU permitem din client direct. Doar service-role (webhook
-- endpoint /api/inbox/reply foloseste createSupabaseAdmin).
DROP POLICY IF EXISTS "replies_no_client_insert" ON public.sesizare_replies;
CREATE POLICY "replies_no_client_insert"
  ON public.sesizare_replies
  FOR INSERT
  WITH CHECK (FALSE);

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 057: sesizare_replies + nr_inregistrare aplicata.' AS status;
