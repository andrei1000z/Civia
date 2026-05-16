-- Authority role pe profiles + linking la judet/sector ca cetateanul logat
-- ca primar/funcționar public să vadă DOAR sesizările lui:
--   profiles.role = 'primarie'
--   profiles.authority_county = 'B' / 'CJ' / etc.
--   profiles.authority_sector = 'S1' / 'S2' / NULL (county-level)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS authority_county TEXT,
  ADD COLUMN IF NOT EXISTS authority_sector TEXT;

-- Roluri permise: 'user' (default), 'admin', 'primarie'.
-- Constraint NU se aplica daca exista deja date — folosim CHECK conditional.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_valid
      CHECK (role IS NULL OR role IN ('user', 'admin', 'primarie'));
  END IF;
END $$;

-- Index pentru lookup rapid de catre primarie (county + role).
CREATE INDEX IF NOT EXISTS idx_profiles_authority
  ON public.profiles (authority_county, role)
  WHERE role = 'primarie';

-- RLS adjust: primarie poate vedea TOATE sesizarile (public + private)
-- din county-ul/sector-ul lor — pe acelasi pattern ca admin.
DROP POLICY IF EXISTS "sesizari_select_primarie" ON public.sesizari;
CREATE POLICY "sesizari_select_primarie"
  ON public.sesizari FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'primarie'
        AND (
          (p.authority_sector IS NOT NULL AND p.authority_sector = sesizari.sector)
          OR (p.authority_sector IS NULL AND p.authority_county = sesizari.county)
        )
    )
  );

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 045 aplicata: authority role on profiles.' AS status;
