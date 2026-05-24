-- P3.26 — Civic Streak: zile consecutive cu acțiune civică pe Civia.
--
-- O „acțiune" = oricare din:
--  - sesizare depusă
--  - sesizare cosemnată
--  - petiție semnată
--  - comentariu pe sesizare publică
--  - vote up/down pe sesizare publică
--
-- Inspirat de Duolingo streak — engagement masiv pentru utilizatorii loyali.
-- Folosim view materializat doar dacă crește la 10k+ utilizatori — pentru
-- acum: calcul direct la fetch, o coloană cache pe profile.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS civic_streak_days int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS civic_streak_last_action timestamptz,
  ADD COLUMN IF NOT EXISTS civic_total_actions int DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_civic_streak ON public.profiles (civic_streak_days DESC)
  WHERE civic_streak_days > 0;

-- Pattern detection table — sesizările grupate ca systemic issues.
CREATE TABLE IF NOT EXISTS public.sesizari_pattern_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_label text NOT NULL,
  county text,
  sector text,
  tip text,
  sesizare_codes text[] NOT NULL,
  cluster_summary text,
  detected_at timestamptz DEFAULT now(),
  notified_admin boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_pattern_clusters_county ON public.sesizari_pattern_clusters (county, detected_at DESC);

-- RLS — admin only read; nothing else writes.
ALTER TABLE public.sesizari_pattern_clusters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "patterns_admin_read" ON public.sesizari_pattern_clusters;
CREATE POLICY "patterns_admin_read" ON public.sesizari_pattern_clusters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 069: civic_streak + pattern clusters.' AS status;
