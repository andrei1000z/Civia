-- ============================================================
-- Migration 059: reply authenticity scoring
-- ============================================================
--
-- Anti-spoofing avansat pe sesizare_replies. Coloane noi:
--   - ai_authenticity_score: 0-100, scor compus din semnale tehnice
--     (domain, DKIM, AUTH catalog match) + analiza semantica AI
--   - ai_authenticity_reasoning: explicatie human-readable de ce a dat
--     scorul (afișat în UI cu tooltip)
--   - ai_authenticity_signals: JSONB cu breakdown-ul fiecarui signal
--     (pentru debug + tuning)
--
-- Logica auto_applied se schimba (in cod, nu aici): aplica direct
-- daca authenticity_score >= 60 SI confidence >= 70.

ALTER TABLE public.sesizare_replies
  ADD COLUMN IF NOT EXISTS ai_authenticity_score INTEGER
    CHECK (ai_authenticity_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ai_authenticity_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS ai_authenticity_signals JSONB;

COMMENT ON COLUMN public.sesizare_replies.ai_authenticity_score IS
  'Scor 0-100 cat de probabil e ca raspunsul vine real de la autoritate. Combinatie technical signals (domain, DKIM, AUTH catalog) + analiza semantica AI. >= 60 = high confidence real.';

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 059: reply authenticity scoring aplicata.' AS status;
