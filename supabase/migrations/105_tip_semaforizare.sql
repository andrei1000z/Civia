-- 2026-06-19 — CHECK-ul pe `sesizari.tip` rămăsese în urmă față de
-- SESIZARE_TIPURI (src/lib/constants.ts). Lipseau `semaforizare` (adăugat azi)
-- ȘI `amenajare_parcare` (drift mai vechi, latent) → INSERT pica cu codul 23514
-- „Date invalide — nu respectă constrângerile." la trimiterea unei sesizări de
-- acel tip (raport user 19.06.2026). Re-sincronizăm constraint-ul cu LISTA
-- COMPLETĂ (toate tipurile active + legacy pietonal/zgomot pentru rânduri vechi).
--
-- LECȚIE: când adaugi un tip nou în SESIZARE_TIPURI, adaugă ȘI o migrare care
-- updatează acest CHECK — altfel Zod trece dar Postgres respinge la INSERT.

ALTER TABLE public.sesizari DROP CONSTRAINT IF EXISTS sesizari_tip_check;

ALTER TABLE public.sesizari ADD CONSTRAINT sesizari_tip_check CHECK (
  tip IN (
    'groapa','trotuar','iluminat','copac','gunoi',
    'parcare','stalpisori','canalizare','semafor','semaforizare',
    'graffiti','mobilier','transport','afisaj',
    'amenajare_parcare','banda_transport','trecere_pietoni',
    'rampa_acces','colectare_selectiva','fumat_interzis','animale',
    -- legacy (deprecate, păstrate pentru rândurile istorice):
    'pietonal','zgomot',
    'altele'
  )
);

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 105: tip CHECK re-sincronizat (added semaforizare + amenajare_parcare).' AS status;
