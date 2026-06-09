-- ============================================================
-- Migration 098: Referral cu atribuire reală (Faza 1 — BIG BET creștere)
-- ============================================================
--
-- Transformă share-ul anonim într-un viral loop MĂSURABIL (modelul Nextdoor):
--   • referral_code  — cod scurt, stabil, public, per user (intră în ?ref= pe
--                      toate share-urile). Generat LAZY în app (ensureReferralCode)
--                      ca să nu riscăm să spargem signup-ul pe o coliziune unică.
--   • referred_by    — cine a adus userul (first-touch, setat o singură dată la
--                      signup din cookie-ul civia_ref). NU se suprascrie niciodată.
--   • referred_at    — când.
--
-- Badge „ambasador" (1/5/20) + linia „a activat N cetățeni" pe /u/[slug] și
-- /clasament se calculează dinamic din count(referred_by = user).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

-- Cod unic per user (parțial — doar rândurile cu cod setat). Lazy-gen în app.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles(referral_code)
  WHERE referral_code IS NOT NULL;

-- Pentru count(referred_by = X) rapid (badge ambasador, clasament).
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by
  ON public.profiles(referred_by)
  WHERE referred_by IS NOT NULL;

-- ─── Backfill cod pentru userii existenți ──────────────────────────
-- Retry-safe pe coliziune (unique_violation) — 8 hex chars = 4.3B spațiu,
-- coliziunea e improbabilă dar tratată corect.
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
  ok BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    ok := FALSE;
    WHILE NOT ok LOOP
      v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      BEGIN
        UPDATE public.profiles SET referral_code = v_code WHERE id = r.id;
        ok := TRUE;
      EXCEPTION WHEN unique_violation THEN
        ok := FALSE; -- regenerează
      END;
    END LOOP;
  END LOOP;
END $$;

SELECT 'Migration 098 (referral attribution) aplicată.' AS status;
