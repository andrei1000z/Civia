-- Auto-reminders pentru sesizari fara raspuns autoritate.
-- OG 27/2002 art. 14: primaria are 30 zile la raspuns. La 7/14/30 zile,
-- trimitem email user-ului care a depus sesizarea (daca a lasat email)
-- cu CTA escaladare (Avocatul Poporului, Agentia Antidiscriminare, etc).

CREATE TABLE IF NOT EXISTS public.sesizari_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesizare_id UUID NOT NULL REFERENCES public.sesizari(id) ON DELETE CASCADE,
  -- 'd7', 'd14', 'd30', 'd60' — step-ul reminderului
  step TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'email',
  UNIQUE (sesizare_id, step)
);

CREATE INDEX IF NOT EXISTS idx_sesizari_reminders_sesizare
  ON public.sesizari_reminders (sesizare_id);

CREATE INDEX IF NOT EXISTS idx_sesizari_reminders_recent
  ON public.sesizari_reminders (sent_at DESC);

ALTER TABLE public.sesizari_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_admin_select" ON public.sesizari_reminders;
CREATE POLICY "reminders_admin_select"
  ON public.sesizari_reminders FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 043 aplicata: sesizari_reminders.' AS status;
