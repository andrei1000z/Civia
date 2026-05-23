-- 063_petitie_updates.sql
-- Scrape zilnic update-urile petițiilor de pe Declic (și alte platforme),
-- afișează-le pe /petitii/[slug] ca timeline „Actualizări de la inițiator".
-- Trimite push notif când apare un update nou.

CREATE TABLE IF NOT EXISTS public.petitie_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  petitie_id UUID NOT NULL REFERENCES public.petitii(id) ON DELETE CASCADE,
  -- Data update-ului extrasă din header („Update 27.04.2026" → 2026-04-27).
  -- Poate fi NULL dacă scraper-ul n-a putut parsa data — afișăm doar la
  -- final cu „dată necunoscută" în UI.
  update_date DATE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  -- Hash pentru deduplicare: idempotent re-scrape, insert ON CONFLICT DO NOTHING.
  -- Hash-ul include titlul + body trimmed → modificări minore (typo fix de
  -- inițiator) generează un update nou, ceea ce e OK (notificăm user).
  content_hash TEXT NOT NULL,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  -- Notificare push trimisă pentru acest update? Setat la true după ce
  -- broadcast-ul a fost lansat în /api/petitii/scrape-updates.
  push_notified BOOLEAN DEFAULT FALSE,
  UNIQUE (petitie_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_petitie_updates_petitie ON public.petitie_updates(petitie_id, update_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_petitie_updates_pending_push ON public.petitie_updates(push_notified) WHERE push_notified = false;

ALTER TABLE public.petitie_updates ENABLE ROW LEVEL SECURITY;

-- Public read — orice user vede update-urile.
DROP POLICY IF EXISTS "petitie_updates_read_all" ON public.petitie_updates;
CREATE POLICY "petitie_updates_read_all"
  ON public.petitie_updates FOR SELECT
  USING (true);

-- Insert/update/delete via service role (cron + admin) — RLS strict.
-- (Nu definim policy ALL — service role bypassează RLS oricum.)

-- Pe petitii adăugăm un ts care marchează ultima dată de scrape, pentru
-- a evita re-scrape inutil pe petițiile cu errors persistente.
ALTER TABLE public.petitii
  ADD COLUMN IF NOT EXISTS updates_last_scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updates_last_scrape_error TEXT;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 063 aplicata: petitie_updates table + scrape tracking columns.' AS status;
