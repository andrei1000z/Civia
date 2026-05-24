-- ============================================================
-- Migration 073: intreruperi_alerts
-- ============================================================
--
-- 2026-05-25 — Feature alerte adresă personalizate.
-- User pune email + adresă pe /intreruperi → primește email automat
-- când e întrerupere planificată care îți afectează strada.
--
-- Cron logic (separat): match intreruperi noi cu abonați după
-- normalized_address contains in entries.locations + county/sector.
--
-- Schema: simple opt-in cu confirmare email + unsubscribe token.

CREATE TABLE IF NOT EXISTS public.intreruperi_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  -- Adresa raw, exact ce a scris user-ul.
  address_raw TEXT NOT NULL,
  -- Normalizat (lowercase, fără diacritice, strip accents) — folosit pentru
  -- match-uri parțiale cu locations din intreruperi entries.
  address_normalized TEXT NOT NULL,
  -- County code (B, CJ, IF etc.) — detectat din adresă sau pus de user.
  county TEXT,
  -- Sector pentru București (S1-S6) — opțional.
  sector TEXT,
  -- Token unic pentru link unsubscribe în email.
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid(),
  -- Email confirmat (double opt-in): true după ce user-ul a apăsat link-ul
  -- de confirmare. Dacă false după 48h, deletăm record-ul.
  confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,
  -- Track ultima notificare trimisă ca să nu spam-uim aceeași intrerupere.
  last_notified_at TIMESTAMPTZ,
  -- Lista de intrerupere IDs care au fost deja notificate (anti-spam).
  notified_interruption_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  -- Anti-spam: max 5 abonamente per email.
  CONSTRAINT email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Index pentru match-uri rapide pe cron (county + active).
CREATE INDEX IF NOT EXISTS idx_alerts_active_county
  ON public.intreruperi_alerts (county, confirmed, unsubscribed_at)
  WHERE confirmed = TRUE AND unsubscribed_at IS NULL;

-- Unsubscribe lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_unsubscribe_token
  ON public.intreruperi_alerts (unsubscribe_token);

-- Anti-duplicat: o adresă unică per email + adresă.
CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_unique_email_addr
  ON public.intreruperi_alerts (email, address_normalized);

-- RLS: doar admin can read (PII = email + adresă reală).
ALTER TABLE public.intreruperi_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read alerts"
  ON public.intreruperi_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert + update via service role (anti-spam, normalization server-side).

COMMENT ON TABLE public.intreruperi_alerts IS
  'Faza 5/25 — alerte adresă personalizate. User abonat → notificat email când e întrerupere pe strada lui.';

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 073: intreruperi_alerts creat.' AS status;
