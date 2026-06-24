-- 2026-06-24 — `sesizare_replies.ai_status` (057) accepta doar un SUBSET
-- (inregistrata/in-lucru/rezolvat/redirectionata/respins/cerere_informatii/
-- necunoscut) → nu puteam marca un răspuns ca „acțiune autoritate" / „intervenție"
-- / „amânată", deși coloana `sesizari.status` le acceptă. Aliniem cele două seturi
-- ca răspunsul să poarte statusul REAL (ex. stâlpișori montați = rezolvat,
-- sancțiuni = acțiune-autoritate), nu unul aproximat.

-- Drop ROBUST: orice CHECK existent care referă ai_status (nume auto-generat).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.sesizare_replies'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%ai_status%'
  LOOP
    EXECUTE format('ALTER TABLE public.sesizare_replies DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.sesizare_replies ADD CONSTRAINT sesizare_replies_ai_status_check CHECK (
  ai_status IN (
    'inregistrata', 'in-lucru', 'actiune-autoritate', 'interventie', 'amanata',
    'rezolvat', 'redirectionata', 'respins', 'cerere_informatii', 'necunoscut'
  )
);

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 107: sesizare_replies.ai_status set complet (aliniat cu sesizari.status).' AS status;
