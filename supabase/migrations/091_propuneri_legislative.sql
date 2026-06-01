-- 2026-06-01 — Propuneri legislative cetățenești
--
-- Cetățenii pot propune schimbări la lege (Codul Rutier, urbanism, etc.)
-- trimise oficial la MAI, IGPR, MT, MDLPA, Parlament via Legea 52/2003.
--
-- Flow:
--   1. Cetățean scrie problema + soluția propusă
--   2. AI formalizează într-un document legislativ structurat
--   3. Alți cetățeni votează (susțin) propunerea
--   4. La 100 voturi → trimitere automată la autoritate prin email oficial
--   5. La 500 voturi → notificare presă
--
-- Idempotent. Safe to run multiple times.

-- ─── TABEL PRINCIPAL ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS propuneri_legislative (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Conținut propus de cetățean
  titlu           TEXT NOT NULL CHECK (char_length(titlu) BETWEEN 10 AND 200),
  problema        TEXT NOT NULL CHECK (char_length(problema) BETWEEN 50 AND 5000),
  solutia         TEXT NOT NULL CHECK (char_length(solutia) BETWEEN 50 AND 5000),
  categorie       TEXT NOT NULL CHECK (categorie IN (
                    'trafic_rutier', 'urbanism', 'mobilitate',
                    'mediu', 'siguranta', 'sanatate', 'educatie',
                    'administrativ', 'altele'
                  )),

  -- Destinatar (autoritate)
  destinatar_key  TEXT NOT NULL CHECK (destinatar_key IN (
                    'MAI', 'IGPR', 'MT', 'MDLPA', 'CAMERA_DEPUTATILOR',
                    'SENAT', 'ANAP', 'CNAIR', 'PRIMARIA_GENERALA'
                  )),

  -- Text AI formalizat (generat de Groq)
  ai_formal_text  TEXT,
  ai_temei_legal  TEXT,
  ai_impact       TEXT,
  ai_precedente   TEXT,
  ai_generated_at TIMESTAMPTZ,

  -- Statistici voturi
  votes_count     INTEGER DEFAULT 0 NOT NULL,
  sent_at         TIMESTAMPTZ,  -- când a fost trimis la autoritate

  -- Status
  status          TEXT DEFAULT 'active' NOT NULL CHECK (status IN (
                    'draft', 'active', 'sent', 'archived', 'rejected'
                  )),

  -- Metadate
  author_display_name TEXT,
  is_anonymous    BOOLEAN DEFAULT FALSE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── VOTURI (1 vot per user per propunere) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS propuneri_votes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propunere_id    UUID NOT NULL REFERENCES propuneri_legislative(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Pentru utilizatori neautentificați: fingerprint IP hash
  anon_hash       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Un user poate vota o singură dată per propunere
  UNIQUE (propunere_id, user_id),
  -- Un anon poate vota o singură dată per propunere (fallback)
  UNIQUE (propunere_id, anon_hash)
);

-- ─── COMENTARII ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS propuneri_comentarii (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propunere_id    UUID NOT NULL REFERENCES propuneri_legislative(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 2000),
  display_name    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_propuneri_status
  ON propuneri_legislative(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_propuneri_destinatar
  ON propuneri_legislative(destinatar_key, status);

CREATE INDEX IF NOT EXISTS idx_propuneri_votes_count
  ON propuneri_legislative(votes_count DESC) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_propuneri_votes_propunere
  ON propuneri_votes(propunere_id);

CREATE INDEX IF NOT EXISTS idx_propuneri_comentarii_propunere
  ON propuneri_comentarii(propunere_id, created_at);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE propuneri_legislative ENABLE ROW LEVEL SECURITY;
ALTER TABLE propuneri_votes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE propuneri_comentarii  ENABLE ROW LEVEL SECURITY;

-- Oricine poate citi propunerile active
CREATE POLICY IF NOT EXISTS "propuneri_public_read"
  ON propuneri_legislative FOR SELECT
  USING (status IN ('active', 'sent'));

-- User autentificat poate crea propuneri
CREATE POLICY IF NOT EXISTS "propuneri_auth_insert"
  ON propuneri_legislative FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- User poate edita propria propunere (cât timp e draft)
CREATE POLICY IF NOT EXISTS "propuneri_owner_update"
  ON propuneri_legislative FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'draft');

-- Voturi: oricine poate vedea numărul (agregat), insert cu dedup
CREATE POLICY IF NOT EXISTS "votes_public_read"
  ON propuneri_votes FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "votes_insert"
  ON propuneri_votes FOR INSERT
  WITH CHECK (true);  -- service role verifica dedup

-- Comentarii: public read, auth insert
CREATE POLICY IF NOT EXISTS "comentarii_public_read"
  ON propuneri_comentarii FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "comentarii_auth_insert"
  ON propuneri_comentarii FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── TRIGGER: updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_propuneri_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_propuneri_updated_at ON propuneri_legislative;
CREATE TRIGGER trg_propuneri_updated_at
  BEFORE UPDATE ON propuneri_legislative
  FOR EACH ROW EXECUTE FUNCTION update_propuneri_updated_at();

-- ─── TRIGGER: sync votes_count ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_propunere_votes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE propuneri_legislative
      SET votes_count = votes_count + 1
      WHERE id = NEW.propunere_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE propuneri_legislative
      SET votes_count = GREATEST(0, votes_count - 1)
      WHERE id = OLD.propunere_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_votes_count ON propuneri_votes;
CREATE TRIGGER trg_sync_votes_count
  AFTER INSERT OR DELETE ON propuneri_votes
  FOR EACH ROW EXECUTE FUNCTION sync_propunere_votes_count();
