-- P4.980-982 — Verification tiers pentru cetățeni, jurnaliști, activiști.
--
-- Verified citizen = opt-in, scrutin manual de Civia (real-name verified).
-- Verified journalist = press card valid + email instituțional (rate limit
--   API mai relaxat, badge public).
-- Verified activist = ONG recunoscut RO (badge + priority).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_tier TEXT CHECK (
    verified_tier IS NULL OR verified_tier IN (
      'citizen',     -- standard verified (rare — la cerere)
      'journalist',  -- jurnalist acreditat
      'activist',    -- activist ONG recunoscut
      'authority',   -- reprezentant primărie (legat de authority_*)
      'admin'        -- Civia admin
    )
  ),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS verification_org TEXT; -- nume organizație (jurnalist/activist)

CREATE INDEX IF NOT EXISTS idx_profiles_verified_tier
  ON public.profiles (verified_tier)
  WHERE verified_tier IS NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 071: verification tiers added.' AS status;
