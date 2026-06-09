-- ============================================================
-- Migration 099: area_subscriptions (Faza 2 — „Urmărește zona")
-- ============================================================
-- Abonare per-arie: județ (obligatoriu) + localitate (opțional, NULL = tot
-- județul) + categorie sesizare (opțional, NULL = toate tipurile). Sursă unică
-- pentru: digestul local săptămânal, push-ul geo (Faza 1) și cosign-invites.
--
-- Format county = id UPPERCASE EXACT din ALL_COUNTIES / sesizari.county
-- (B, CJ, TM…). NU slug. Normalizat în app cu normalizeCounty().
-- Șablon RLS: street_follows. Idempotent — safe to run multiple times.
--
-- GDPR: userul e DEJA logat cu email verificat (magic-link) și bifează explicit
-- consimțământul → single opt-in cu consent_at + consent_source înregistrate e
-- consimțământ demonstrabil (art. 7). Fără double-opt-in (ar fi frecțiune inutilă
-- pe un email deja verificat).

CREATE TABLE IF NOT EXISTS public.area_subscriptions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Email denormalizat (capturat din sesiune la abonare) — digestul îl citește
  -- direct fără join la auth.users + e dovada GDPR a emailului care a consimțit.
  -- Reîmprospătat la fiecare re-abonare (upsert).
  email          text NOT NULL,
  -- id UPPERCASE de județ (B, CJ, TM…). CHECK forțează forma; validarea contra
  -- ALL_COUNTIES se face în app (normalizeCounty), sursa de adevăr e data/counties.
  county         text NOT NULL CHECK (county = upper(county) AND length(county) BETWEEN 1 AND 2),
  -- Localitate / sector liber (ex „Cluj-Napoca", „Sector 3"). NULL = tot județul.
  locality       text CHECK (locality IS NULL OR length(locality) BETWEEN 2 AND 100),
  -- Categorie sesizare (SESIZARE_TIPURI.value). NULL = toate.
  category       text CHECK (category IS NULL OR length(category) BETWEEN 2 AND 40),
  email_optin    boolean NOT NULL DEFAULT true,
  push_optin     boolean NOT NULL DEFAULT false,
  -- GDPR art. 7 — dovada consimțământului explicit la abonare.
  consent_at     timestamptz NOT NULL DEFAULT now(),
  consent_source text NOT NULL DEFAULT 'web'
                 CHECK (consent_source IN ('web','county_page','sesizari_publice','cont','api')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Dedup pe (user_id, zonă). NULL locality/category colapsate cu sentinel ca
-- „tot județul" / „toate categoriile" să fie UN singur rând (în Postgres
-- NULL != NULL la unique → fără sentinel s-ar permite duplicate).
CREATE UNIQUE INDEX IF NOT EXISTS uq_area_sub_user_zone
  ON public.area_subscriptions (
    user_id,
    county,
    COALESCE(locality, '\x00ALL'),
    COALESCE(category, '\x00ALL')
  );

-- Dispecerul digestului: abonările email-active grupate pe arie.
CREATE INDEX IF NOT EXISTS idx_area_sub_county_email
  ON public.area_subscriptions (county, locality) WHERE email_optin = true;
-- Push geo (Faza 1): „cine urmărește county[+locality]" la INSERT sesizare.
CREATE INDEX IF NOT EXISTS idx_area_sub_county_push
  ON public.area_subscriptions (county, locality) WHERE push_optin = true;
CREATE INDEX IF NOT EXISTS idx_area_sub_user
  ON public.area_subscriptions (user_id);

-- RLS — userul gestionează DOAR propriile abonări. Service role (digest/push)
-- bypass RLS prin admin client.
ALTER TABLE public.area_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS area_sub_read_own ON public.area_subscriptions;
CREATE POLICY area_sub_read_own ON public.area_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS area_sub_insert_auth ON public.area_subscriptions;
CREATE POLICY area_sub_insert_auth ON public.area_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS area_sub_update_own ON public.area_subscriptions;
CREATE POLICY area_sub_update_own ON public.area_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS area_sub_delete_own ON public.area_subscriptions;
CREATE POLICY area_sub_delete_own ON public.area_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Guard idempotență cron (anti-dublă-trimitere la retry Vercel) ──────
-- Un job care a rulat deja azi nu se re-execută (digest-local, etc).
-- Service-role only — fără RLS policy (admin client îl scrie/citește).
CREATE TABLE IF NOT EXISTS public.cron_runs (
  job      text NOT NULL,
  run_date date NOT NULL,
  ran_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (job, run_date)
);
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
-- fără policies → doar service role poate accesa (RLS blochează anon/authenticated).

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 099 (area_subscriptions + cron_runs) aplicată.' AS status;
