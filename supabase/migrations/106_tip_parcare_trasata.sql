-- 2026-06-20 — tip nou `parcare_trasata` (loc de parcare TRASAT ILEGAL pe
-- domeniul public — marcaj neautorizat, ≠ „parcare" = mașină parcată ilegal).
-- Re-sincronizăm CHECK-ul pe `sesizari.tip` cu lista COMPLETĂ. (Lecția din 105:
-- Zod acceptă tipul, dar Postgres îl respinge la INSERT cu 23514 dacă lipsește
-- din constraint → „Date invalide — nu respectă constrângerile.")
ALTER TABLE public.sesizari DROP CONSTRAINT IF EXISTS sesizari_tip_check;
ALTER TABLE public.sesizari ADD CONSTRAINT sesizari_tip_check CHECK (
  tip IN (
    'groapa','trotuar','iluminat','copac','gunoi',
    'parcare','parcare_trasata','stalpisori','canalizare','semafor','semaforizare',
    'graffiti','mobilier','transport','afisaj',
    'amenajare_parcare','banda_transport','trecere_pietoni',
    'rampa_acces','colectare_selectiva','fumat_interzis','animale',
    -- legacy (deprecate, păstrate pentru rândurile istorice):
    'pietonal','zgomot',
    'altele'
  )
);
NOTIFY pgrst, 'reload schema';
SELECT 'Migration 106: tip parcare_trasata adăugat la CHECK.' AS status;
