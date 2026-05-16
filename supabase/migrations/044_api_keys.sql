-- Public API keys pentru jurnalisti, ONG-uri, dezvoltatori.
-- Tier free: 100 req/h, 1000 req/zi. Pe (key, hour) ramane in Redis;
-- aici stocam doar metadata + hash-ul cheii (NU plain text — daca leak
-- DB, atacatorul tot are nevoie sa stie cheia originala).

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 hex al cheii — 64 chars. Cheia originala se afiseaza userului
  -- O SINGURA DATA la generare, dupa care nu mai poate fi recuperata.
  key_hash TEXT NOT NULL UNIQUE,
  -- Prefix vizibil al cheii pentru UI ("civia_pk_a1b2..." pentru dashboard).
  key_prefix TEXT NOT NULL,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Email contact + label descriere (ex: „proiectul X de jurnalism").
  contact_email TEXT NOT NULL,
  label TEXT NOT NULL,
  -- Use case: 'journalism' / 'research' / 'ngo' / 'civic-tech'.
  use_case TEXT NOT NULL DEFAULT 'civic-tech',
  -- Scopes: array de string-uri (deocamdata doar 'read:sesizari' + 'read:stats').
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:sesizari', 'read:stats'],
  -- Rate-limit tier (free / pro). Free: 100/h, Pro: 1000/h.
  tier TEXT NOT NULL DEFAULT 'free',
  -- NULL = nelimitat. Atributul `revoked_at` taie cheia fara delete.
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash
  ON public.api_keys (key_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_owner
  ON public.api_keys (owner_id, created_at DESC);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_select_own" ON public.api_keys;
CREATE POLICY "api_keys_select_own"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "api_keys_insert_self" ON public.api_keys;
CREATE POLICY "api_keys_insert_self"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "api_keys_update_own" ON public.api_keys;
CREATE POLICY "api_keys_update_own"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = owner_id);

-- Audit log: cine a apelat API-ul, de unde, ce path. Pe (timestamp, key_id).
CREATE TABLE IF NOT EXISTS public.api_key_audit (
  id BIGSERIAL PRIMARY KEY,
  key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  status_code INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_audit_key
  ON public.api_key_audit (key_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_audit_recent
  ON public.api_key_audit (created_at DESC);

ALTER TABLE public.api_key_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_audit_select_owner" ON public.api_key_audit;
CREATE POLICY "api_audit_select_owner"
  ON public.api_key_audit FOR SELECT
  USING (
    key_id IN (SELECT id FROM public.api_keys WHERE owner_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 044 aplicata: api_keys + api_key_audit.' AS status;
