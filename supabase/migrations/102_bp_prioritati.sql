-- ============================================================
-- Migration 102: Prioritățile orașului (bugetare participativă, iterația 2)
-- ============================================================
--
-- 2026-06-11 (FAZA 4, iterația 2 — designul „buget umbră" din research):
-- cetățenii PROPUN priorități de investiții pe orașul lor și VOTEAZĂ
-- (k-approval: max 3 voturi active per oraș per utilizator). Topul se
-- transmite formal primăriei de către Civia (OG 27/2002), manual în pilot.
--
-- Anti-abuz: propunerea + votul cer cont (magic-link). Moderare: filtrul de
-- conținut la creare (threats/profanity → respins) + status pentru control
-- editorial ulterior (admin poate respinge post-hoc). Voturile sunt 1/user/
-- propunere (unique) + plafonate la 3/oraș în API.
--
-- Idempotentă.

CREATE TABLE IF NOT EXISTS public.bp_propuneri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  titlu TEXT NOT NULL CHECK (char_length(titlu) BETWEEN 8 AND 120),
  descriere TEXT NOT NULL CHECK (char_length(descriere) BETWEEN 20 AND 1000),
  categorie TEXT NOT NULL DEFAULT 'altele',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','rejected','pending')),
  votes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bp_propuneri_county_status ON public.bp_propuneri (county, status, votes_count DESC);

CREATE TABLE IF NOT EXISTS public.bp_voturi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propunere_id UUID NOT NULL REFERENCES public.bp_propuneri(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (propunere_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bp_voturi_user ON public.bp_voturi (user_id);

-- Contor denormalizat — sortarea listei nu face COUNT() pe voturi.
CREATE OR REPLACE FUNCTION public.bp_sync_votes_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.bp_propuneri SET votes_count = votes_count + 1 WHERE id = NEW.propunere_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.bp_propuneri SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = OLD.propunere_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bp_votes_count ON public.bp_voturi;
CREATE TRIGGER trg_bp_votes_count
  AFTER INSERT OR DELETE ON public.bp_voturi
  FOR EACH ROW EXECUTE FUNCTION public.bp_sync_votes_count();

-- RLS — citire publică doar pe approved; scrierea trece prin API (service
-- role face insert-urile după moderare + plafonare; clientul NU scrie direct).
ALTER TABLE public.bp_propuneri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bp_voturi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bp_propuneri_select_public ON public.bp_propuneri;
CREATE POLICY bp_propuneri_select_public ON public.bp_propuneri
  FOR SELECT USING (status = 'approved' OR created_by = auth.uid());

DROP POLICY IF EXISTS bp_voturi_select_own ON public.bp_voturi;
CREATE POLICY bp_voturi_select_own ON public.bp_voturi
  FOR SELECT USING (user_id = auth.uid());

COMMENT ON TABLE public.bp_propuneri IS 'Priorități de investiții propuse de cetățeni (FAZA 4 it.2). Top-ul per oraș se transmite formal primăriei.';
COMMENT ON TABLE public.bp_voturi IS 'Voturi k-approval (max 3 active/oraș/user, plafonat în API).';
