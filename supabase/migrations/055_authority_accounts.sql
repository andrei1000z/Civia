-- ============================================================
-- AUTHORITY ACCOUNTS — F9 Sprint 5
-- Data: 2026-05-20
-- ============================================================
-- Permite primariilor sa-si faca cont oficial pe Civia.
-- Workflow:
--   1. Primaria cere cont via /autoritati/inregistrare (form public)
--   2. Civia admin verifica email-ul oficial + autoritatea
--   3. Activeaza contul → flag `is_authority` pe profile + bind la
--      o autoritate specifica (county/sector/primarie)
--   4. Authority user vede dashboard `/admin/primarie` cu:
--      - Lista sesizarilor pe jurisdictia lor
--      - Marcat status (in lucru / rezolvat / respins)
--      - Upload poza rezolvare
--      - Raspuns oficial direct in app

-- Tabela autoritati (entities, nu users)
CREATE TABLE IF NOT EXISTS public.authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Tipul autoritatii: primarie_sector, primarie_municipiu, primarie_judet,
      politie_locala, garda_mediu, etc. */
  kind TEXT NOT NULL CHECK (kind IN (
    'primarie_sector', 'primarie_municipiu', 'primarie_judet',
    'consiliu_judetean', 'politie_locala', 'garda_mediu',
    'salubritate', 'apa_nova', 'termoenergetica', 'cnair', 'altele'
  )),
  /** Numele oficial al autoritatii (afișat public). */
  name TEXT NOT NULL,
  /** Codul ISO al județului (B, CJ, IS, etc.) */
  county TEXT,
  /** Sectorul București daca aplicabil (Sector 1, Sector 2, etc.) */
  sector TEXT,
  /** Email oficial pentru verificare. */
  official_email TEXT NOT NULL,
  /** Telefon contact (afișat public daca verified). */
  phone TEXT,
  /** Site web oficial (linkat public). */
  website TEXT,
  /** Verified prin admin Civia (manual). */
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'authorities' AND column_name = 'county') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_authorities_county ON public.authorities(county) WHERE verified = true';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_authorities_kind ON public.authorities(kind, verified)';
  END IF;
END $$;

-- Legatura user → authority (un user poate fi reprezentant al unei
-- autoritati). Multiple useri pot reprezenta aceeasi autoritate.
CREATE TABLE IF NOT EXISTS public.authority_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  authority_id UUID NOT NULL REFERENCES public.authorities(id) ON DELETE CASCADE,
  /** Rolul in cadrul autoritatii: primar, viceprimar, functionar, etc. */
  role_in_authority TEXT NOT NULL DEFAULT 'reprezentant',
  /** Aprobat de admin Civia? */
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, authority_id)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'authority_users' AND column_name = 'user_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_authority_users_user ON public.authority_users(user_id) WHERE approved = true';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_authority_users_authority ON public.authority_users(authority_id) WHERE approved = true';
  END IF;
END $$;

-- Tabela pentru rasunsuri oficiale ale autoritatilor (in afara de email).
CREATE TABLE IF NOT EXISTS public.authority_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesizare_id UUID NOT NULL REFERENCES public.sesizari(id) ON DELETE CASCADE,
  authority_id UUID NOT NULL REFERENCES public.authorities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  /** Mesajul oficial. */
  message TEXT NOT NULL,
  /** Tipul: raspuns_partial, raspuns_complet, respins, in_lucru, rezolvat */
  response_type TEXT NOT NULL CHECK (response_type IN (
    'raspuns_partial', 'raspuns_complet', 'respins', 'in_lucru', 'rezolvat'
  )),
  /** URL poza rezolvare (Supabase Storage). */
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'authority_responses' AND column_name = 'sesizare_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_authority_responses_sesizare ON public.authority_responses(sesizare_id, created_at DESC)';
  END IF;
END $$;

-- RLS policies

ALTER TABLE public.authorities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authorities_read_verified" ON public.authorities;
CREATE POLICY "authorities_read_verified"
  ON public.authorities FOR SELECT
  USING (verified = true);

-- Insert: anyone (public registration form). Verification by admin.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'authorities' AND column_name = 'official_email') THEN
    EXECUTE 'DROP POLICY IF EXISTS "authorities_insert_public" ON public.authorities';
    EXECUTE 'CREATE POLICY "authorities_insert_public" ON public.authorities FOR INSERT WITH CHECK (length(name) >= 3 AND length(official_email) >= 5)';
  END IF;
END $$;

ALTER TABLE public.authority_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authority_users_read_self" ON public.authority_users;
CREATE POLICY "authority_users_read_self"
  ON public.authority_users FOR SELECT
  USING (user_id = auth.uid() OR approved = true);

DROP POLICY IF EXISTS "authority_users_request_self" ON public.authority_users;
CREATE POLICY "authority_users_request_self"
  ON public.authority_users FOR INSERT
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.authority_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authority_responses_read_public" ON public.authority_responses;
CREATE POLICY "authority_responses_read_public"
  ON public.authority_responses FOR SELECT
  USING (true);

-- View skipped — profiles doesn't have email column directly.
-- Admin can JOIN auth.users in queries when needed.

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 055: authority accounts schema aplicata.' AS status;
