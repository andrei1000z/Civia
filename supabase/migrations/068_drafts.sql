-- P2.18 — Tabel `sesizari_drafts` pentru recuperare conversie.
--
-- Cetățeanul începe o sesizare dar nu o finalizează (43% din vizitatorii
-- pe /sesizari ajung la form dar nu apasă Trimite). Salvăm draftul
-- server-side cu email-ul → la 24h trimitem un nudge politicos.
--
-- RLS: doar user-ul propriu vede draftul. Service role (cron) îl citește
-- ca să trimită reminder-uri.

CREATE TABLE IF NOT EXISTS public.sesizari_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text,
  tip text,
  titlu text,
  locatie text,
  descriere text,
  county text,
  sector text,
  -- Nudge tracking: când s-a trimis reminderul (NULL = neîncă)
  nudged_at timestamptz,
  -- Daca user-ul a finalizat draftul (creat sesizare), îl marcăm completed.
  completed_sesizare_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drafts_email ON public.sesizari_drafts (email) WHERE completed_sesizare_code IS NULL;
CREATE INDEX IF NOT EXISTS idx_drafts_user ON public.sesizari_drafts (user_id) WHERE completed_sesizare_code IS NULL;
CREATE INDEX IF NOT EXISTS idx_drafts_nudge_window ON public.sesizari_drafts (created_at) WHERE nudged_at IS NULL AND completed_sesizare_code IS NULL;

-- RLS
ALTER TABLE public.sesizari_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drafts_self_select" ON public.sesizari_drafts;
CREATE POLICY "drafts_self_select" ON public.sesizari_drafts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "drafts_self_insert" ON public.sesizari_drafts;
CREATE POLICY "drafts_self_insert" ON public.sesizari_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "drafts_self_update" ON public.sesizari_drafts;
CREATE POLICY "drafts_self_update" ON public.sesizari_drafts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "drafts_self_delete" ON public.sesizari_drafts;
CREATE POLICY "drafts_self_delete" ON public.sesizari_drafts
  FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 068: sesizari_drafts table created.' AS status;
