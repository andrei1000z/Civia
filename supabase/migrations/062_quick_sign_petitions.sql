-- 062_quick_sign_petitions.sql
-- One-click petition sign — user stochează datele 1 dată, le folosim ca să
-- construim URL Declic cu params prefilled (firstName, lastName, email, county,
-- phoneNumber). User dă 1 click pe site-ul Declic la „Semnează" și gata —
-- formularul e deja completat.
--
-- IMPORTANT: NU semnăm noi în numele user-ului (vezi eIDAS + ToS Declic).
-- Doar prefill URL — user-ul face click-ul final pe site-ul oficial.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quick_sign_first_name TEXT,
  ADD COLUMN IF NOT EXISTS quick_sign_last_name TEXT,
  ADD COLUMN IF NOT EXISTS quick_sign_email TEXT,
  -- Format Declic county: "Cluj", "BUCUREȘTI", "DIASPORA", "Brașov", etc.
  -- (numele complet RO, nu codul ISO).
  ADD COLUMN IF NOT EXISTS quick_sign_county TEXT,
  -- Telefon e opțional pe Declic — păstrăm așa.
  ADD COLUMN IF NOT EXISTS quick_sign_phone TEXT,
  -- Toggle: dacă false, butoanele „Semnează" deschid Declic curat (fără params).
  ADD COLUMN IF NOT EXISTS quick_sign_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quick_sign_updated_at TIMESTAMPTZ;

-- Constraint: county trebuie să fie unul dintre valorile Declic suportate
-- (verified din JSON-ul Vue de la /petitions/<slug> — 42 județe + BUCUREȘTI + DIASPORA).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_quick_sign_county_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_quick_sign_county_valid
      CHECK (
        quick_sign_county IS NULL OR quick_sign_county IN (
          'DIASPORA', 'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud',
          'Botoșani', 'Brașov', 'Brăila', 'BUCUREȘTI', 'Buzău', 'Caraș-Severin',
          'Călărași', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj',
          'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița',
          'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt',
          'Prahova', 'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman',
          'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea'
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 062 aplicata: quick-sign petition fields.' AS status;
