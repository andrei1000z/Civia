-- 2026-05-24 — Extindem CHECK pe coloana `tip` să includă tipurile noi
-- care apar deja în formal-template.ts (TIP_DATA): banda_transport,
-- trecere_pietoni, rampa_acces, colectare_selectiva, fumat_interzis.
-- Bug găsit: 00036 mis-clasificat ca stalpisori pentru că nu puteam updata
-- la banda_transport (CHECK constraint blocked).

ALTER TABLE public.sesizari DROP CONSTRAINT IF EXISTS sesizari_tip_check;

ALTER TABLE public.sesizari ADD CONSTRAINT sesizari_tip_check CHECK (
  tip IN (
    'groapa','trotuar','iluminat','copac','gunoi',
    'parcare','stalpisori','canalizare','semafor','pietonal',
    'graffiti','mobilier','zgomot','animale','transport',
    'afisaj',
    -- Noi (deja în formal-template.ts):
    'banda_transport','trecere_pietoni','rampa_acces',
    'colectare_selectiva','fumat_interzis',
    'altele'
  )
);

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 070: tipuri extinse cu 5 categorii noi.' AS status;
