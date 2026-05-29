-- 2026-05-29 — Mega migration: schema pentru TOATE features-uri activate
--
-- BIG features:
--   #4 Buget "pe banii MEI"
--   #5 Initiative cetatenesti OTP
--   #8 Compass UE
--   #9 Verificare avere demnitari (ANI)
--   #10 Decizii Deschise consilii locale
--   #3 Consultatii publice / agenda consiliu (lite version pana stream)
--
-- MEDIUM features:
--   #1 Search semantic AI (pgvector)
--   #6 Profil public opt-in
--   #7 Civic Streak (Redis dar audit DB)
--   #8 Newsletter personalizat
--   #13 Push intreruperi (subscriptions table)
--   #10 Heatmap (materialized view)
--   #17 Multilang (column de locale pe profiles)
--
-- Idempotent. Safe to run multiple times.

-- ─── PGVECTOR EXTENSION (medium #1 Search semantic) ──────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE sesizari
  ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE petitii
  ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE stiri
  ADD COLUMN IF NOT EXISTS embedding vector(384);

-- HNSW indexes pentru ANN search rapid
CREATE INDEX IF NOT EXISTS idx_sesizari_embedding
  ON sesizari USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_petitii_embedding
  ON petitii USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_stiri_embedding
  ON stiri USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─── PROFIL PUBLIC OPT-IN (medium #6) ────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS public_profile_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS public_bio TEXT,
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT DEFAULT 'ro' NOT NULL CHECK (preferred_locale IN ('ro', 'hu', 'uk')),
  ADD COLUMN IF NOT EXISTS notify_intreruperi_address TEXT,
  ADD COLUMN IF NOT EXISTS notify_intreruperi_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS notify_intreruperi_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS newsletter_pref TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_profiles_public_slug
  ON profiles(public_profile_slug)
  WHERE public_profile_slug IS NOT NULL;

-- ─── PUSH SUBSCRIPTIONS (medium #13) ─────────────────────────────────────────
-- push_subscriptions table already exists from earlier migration cu columns
-- p256dh + auth + user_agent + last_used_at. We just add topic + active columns
-- for intreruperi targeting.

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT 'intreruperi' NOT NULL,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subs_user_topic
  ON push_subscriptions(user_id, topic, active);

-- ─── CIVIC STREAK (medium #7) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_streak (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0 NOT NULL,
  longest_streak INTEGER DEFAULT 0 NOT NULL,
  last_active_date DATE,
  total_activities INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE civic_streak ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'civic_streak own read') THEN
    CREATE POLICY "civic_streak own read" ON civic_streak
      FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'civic_streak public read') THEN
    CREATE POLICY "civic_streak public read" ON civic_streak
      FOR SELECT TO anon USING (TRUE);
  END IF;
END$$;

-- ─── NEWSLETTER SUBSCRIPTIONS (medium #8) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  county TEXT,
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  unsubscribe_token TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_sent_at TIMESTAMPTZ,
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_newsletter_active_county
  ON newsletter_subscriptions(active, county) WHERE active = TRUE;

-- ─── BUGET "PE BANII MEI" (big #4) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS buget_primarii_annual (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  county TEXT NOT NULL,
  primarie TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_revenue NUMERIC(15,2),
  -- Categorii principale buget primării
  cheltuieli_salarizare NUMERIC(15,2),
  cheltuieli_intretinere NUMERIC(15,2),
  cheltuieli_investitii NUMERIC(15,2),
  cheltuieli_invatamant NUMERIC(15,2),
  cheltuieli_sanatate NUMERIC(15,2),
  cheltuieli_cultura NUMERIC(15,2),
  cheltuieli_politie_locala NUMERIC(15,2),
  cheltuieli_salubrizare NUMERIC(15,2),
  cheltuieli_infrastructura NUMERIC(15,2),
  cheltuieli_alte NUMERIC(15,2),
  source_url TEXT,
  raw_data JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (county, primarie, year)
);

CREATE INDEX IF NOT EXISTS idx_buget_county_year
  ON buget_primarii_annual(county, year DESC);

-- ─── INITIATIVE CETATENESTI (big #5) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS initiative (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  initiator_user_id UUID REFERENCES profiles(id),
  titlu TEXT NOT NULL,
  descriere TEXT NOT NULL,
  obiectiv TEXT NOT NULL,
  county TEXT NOT NULL,
  locality TEXT,
  signatures_target INTEGER DEFAULT 100 NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'active', 'submitted', 'voted', 'rejected', 'closed')),
  consiliu_destinatar TEXT,
  vote_result TEXT,
  vote_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_initiative_status_county
  ON initiative(status, county);

CREATE TABLE IF NOT EXISTS initiative_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  initiative_id UUID NOT NULL REFERENCES initiative(id) ON DELETE CASCADE,
  -- Privacy: stocăm hash de telefon + CNP, NU raw
  phone_hash TEXT NOT NULL,
  cnp_hash TEXT,
  -- Numele e public (afisat in lista semnatari)
  display_name TEXT NOT NULL,
  county TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  otp_verified BOOLEAN DEFAULT FALSE NOT NULL,
  UNIQUE (initiative_id, phone_hash)
);

CREATE INDEX IF NOT EXISTS idx_initiative_sigs_count
  ON initiative_signatures(initiative_id, signed_at);

ALTER TABLE initiative ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiative_signatures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'initiative public read') THEN
    CREATE POLICY "initiative public read" ON initiative FOR SELECT TO anon, authenticated USING (status != 'draft');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'initiative draft own') THEN
    CREATE POLICY "initiative draft own" ON initiative FOR SELECT TO authenticated USING (initiator_user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'initiative_sigs public count') THEN
    CREATE POLICY "initiative_sigs public count" ON initiative_signatures FOR SELECT TO anon, authenticated USING (otp_verified = TRUE);
  END IF;
END$$;

-- ─── COMPASS UE (big #8) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ue_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  description TEXT,
  target_audience TEXT,
  amount_min NUMERIC(15,2),
  amount_max NUMERIC(15,2),
  currency TEXT DEFAULT 'EUR',
  deadline DATE,
  county_restrictions TEXT[],
  topics TEXT[],
  embedding vector(384),
  ai_summary TEXT,
  status TEXT DEFAULT 'open' NOT NULL CHECK (status IN ('open', 'closed', 'upcoming')),
  scraped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ue_programs_status_deadline
  ON ue_programs(status, deadline) WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_ue_programs_embedding
  ON ue_programs USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS ue_program_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  profile_role TEXT NOT NULL,  -- antreprenor, ONG, primarie, student, fermier
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  county TEXT,
  active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE ue_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ue_program_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ue_programs public read') THEN
    CREATE POLICY "ue_programs public read" ON ue_programs FOR SELECT TO anon, authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ue_subs own') THEN
    CREATE POLICY "ue_subs own" ON ue_program_subscriptions FOR ALL TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END$$;

-- ─── VERIFICARE AVERE DEMNITARI (big #9) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS demnitari_avere (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  display_slug TEXT NOT NULL UNIQUE,
  position TEXT NOT NULL,
  institution TEXT,
  county TEXT,
  party TEXT,
  source_url TEXT,
  data_year INTEGER NOT NULL,
  -- Avere structurata (din declaratie ANI)
  cash_lei NUMERIC(15,2),
  cash_eur NUMERIC(15,2),
  real_estate_count INTEGER DEFAULT 0,
  real_estate_value NUMERIC(15,2),
  vehicles_count INTEGER DEFAULT 0,
  income_total NUMERIC(15,2),
  -- AI extraction
  raw_pdf_text TEXT,
  ai_summary TEXT,
  -- Pattern detection flags
  suspicious_jump_pct NUMERIC(5,2),  -- % crestere YoY (>50% = flag)
  ai_flags JSONB,
  scraped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (display_slug, data_year)
);

CREATE INDEX IF NOT EXISTS idx_demnitari_jump
  ON demnitari_avere(suspicious_jump_pct DESC) WHERE suspicious_jump_pct > 50;

CREATE INDEX IF NOT EXISTS idx_demnitari_position_year
  ON demnitari_avere(position, data_year DESC);

ALTER TABLE demnitari_avere ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'demnitari public read') THEN
    CREATE POLICY "demnitari public read" ON demnitari_avere FOR SELECT TO anon, authenticated USING (TRUE);
  END IF;
END$$;

-- ─── DECIZII DESCHISE (big #10) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consiliu_propuneri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT,
  consiliu TEXT NOT NULL,
  county TEXT,
  titlu TEXT NOT NULL,
  descriere TEXT,
  ai_summary TEXT,
  category TEXT,  -- urbanism, buget, transport, etc.
  date_published DATE NOT NULL,
  date_voting DATE,
  vote_result TEXT,
  votes_pro INTEGER DEFAULT 0,
  votes_contra INTEGER DEFAULT 0,
  votes_abtinere INTEGER DEFAULT 0,
  vote_details JSONB,
  source_url TEXT,
  embedding vector(384),
  scraped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (consiliu, external_id)
);

CREATE INDEX IF NOT EXISTS idx_consiliu_propuneri_recent
  ON consiliu_propuneri(consiliu, date_published DESC);

CREATE INDEX IF NOT EXISTS idx_consiliu_propuneri_embedding
  ON consiliu_propuneri USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS consiliu_propunere_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  propunere_id UUID NOT NULL REFERENCES consiliu_propuneri(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('pro', 'contra', 'neutru')),
  moderation_status TEXT DEFAULT 'approved' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_propunere_comments
  ON consiliu_propunere_comments(propunere_id, created_at DESC);

ALTER TABLE consiliu_propuneri ENABLE ROW LEVEL SECURITY;
ALTER TABLE consiliu_propunere_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'consiliu_propuneri public') THEN
    CREATE POLICY "consiliu_propuneri public" ON consiliu_propuneri FOR SELECT TO anon, authenticated USING (TRUE);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'propunere_comments public read') THEN
    CREATE POLICY "propunere_comments public read" ON consiliu_propunere_comments FOR SELECT TO anon, authenticated USING (moderation_status = 'approved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'propunere_comments insert auth') THEN
    CREATE POLICY "propunere_comments insert auth" ON consiliu_propunere_comments FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END$$;

-- ─── CONSULTATII PUBLICE / AGENDA CONSILIU (big #3 lite version) ─────────────

CREATE TABLE IF NOT EXISTS consultatii_publice (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consiliu TEXT NOT NULL,
  county TEXT,
  titlu TEXT NOT NULL,
  ai_summary TEXT,
  body TEXT,
  date_published DATE NOT NULL,
  date_deadline DATE,
  date_sedinta DATE,
  source_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (consiliu, titlu, date_published)
);

CREATE INDEX IF NOT EXISTS idx_consultatii_recent
  ON consultatii_publice(date_published DESC);

ALTER TABLE consultatii_publice ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'consultatii public') THEN
    CREATE POLICY "consultatii public" ON consultatii_publice FOR SELECT TO anon, authenticated USING (TRUE);
  END IF;
END$$;

-- ─── HEATMAP MATERIALIZED VIEW (medium #10) ──────────────────────────────────

-- Drop daca exista cu schema veche
DROP MATERIALIZED VIEW IF EXISTS sesizari_heatmap;

CREATE MATERIALIZED VIEW sesizari_heatmap AS
SELECT
  ROUND(lat::numeric, 3) AS lat_bucket,
  ROUND(lng::numeric, 3) AS lng_bucket,
  county,
  tip,
  status,
  COUNT(*) AS count_total,
  COUNT(*) FILTER (WHERE status != 'rezolvat') AS count_unresolved,
  MAX(created_at) AS last_at
FROM sesizari
WHERE lat IS NOT NULL AND lng IS NOT NULL AND publica = TRUE
GROUP BY 1, 2, 3, 4, 5;

CREATE INDEX IF NOT EXISTS idx_heatmap_lookup
  ON sesizari_heatmap(county, tip, lat_bucket, lng_bucket);

-- Refresh function — apelat de pg_cron weekly
CREATE OR REPLACE FUNCTION refresh_sesizari_heatmap()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW sesizari_heatmap;
END;
$$;

-- ─── COUNTER „AZI REZOLVATE" (medium #14) ────────────────────────────────────
-- Implementat ca view (lightweight), no separate table needed

CREATE OR REPLACE VIEW today_civic_stats AS
SELECT
  (SELECT COUNT(*) FROM sesizari WHERE status = 'rezolvat' AND resolved_at >= CURRENT_DATE) AS resolved_today,
  (SELECT COUNT(*) FROM sesizari WHERE created_at >= CURRENT_DATE) AS new_today,
  (SELECT COUNT(*) FROM sesizare_votes WHERE created_at >= CURRENT_DATE) AS votes_today,
  (SELECT COUNT(*) FROM sesizari WHERE sent_at >= CURRENT_DATE) AS sent_today;

-- ─── REFRESH RECOMANDARI (RPC pentru search semantic) ────────────────────────

-- Function: similar_sesizari prin embedding cosine distance
CREATE OR REPLACE FUNCTION similar_sesizari(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  code text,
  titlu text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.code, s.titlu,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM sesizari s
  WHERE s.embedding IS NOT NULL
    AND s.publica = TRUE
    AND 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION similar_sesizari IS
  'Semantic search pe sesizari publice via pgvector cosine. Returneaza top N matches cu similarity > threshold.';
