-- Custom category pentru sesizari cu tip="altele".
-- AI auto-genereaza o eticheta scurta (ex: „Lipsă coș de gunoi", „Capac de
-- canalizare rupt") din descriere, salvata in `custom_category`. Admin
-- vede grupate pe count → poate promova cele frecvente la tipuri oficiale.

ALTER TABLE public.sesizari
  ADD COLUMN IF NOT EXISTS custom_category TEXT,
  ADD COLUMN IF NOT EXISTS custom_category_confidence SMALLINT;

-- Index pentru aggregare (admin view: GROUP BY custom_category ORDER BY count DESC).
-- Doar pe randuri cu valoare (NULL e majoritatea — sesizari cu tip != altele).
CREATE INDEX IF NOT EXISTS idx_sesizari_custom_category
  ON public.sesizari (custom_category)
  WHERE custom_category IS NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 048 aplicata: custom_category pe sesizari.' AS status;
