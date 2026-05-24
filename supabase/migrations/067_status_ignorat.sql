-- Status nou: `ignorat` — sesizările pe care primăria NU le-a răspuns
-- în 60+ zile sunt marcate automat ca ignorate. Conform OG 27/2002 art. 8,
-- termen legal = 30 zile + extensie 15 = 45 zile MAX. La 60 zile clar a
-- expirat fără răspuns → cetățeanul are dreptul să escaladeze la AVP.
--
-- User a cerut explicit (2026-05-24): „PUNE IGNORAT NU RESPINS HAIDEE".
-- „Respins" sună ca refuz formal al primăriei (care nu s-a întâmplat).
-- „Ignorat" e literal exact ce s-a întâmplat — primăria a tăcut.
--
-- Modificăm CHECK constraint-ul ca să includă noul status.

ALTER TABLE public.sesizari DROP CONSTRAINT IF EXISTS sesizari_status_check;

ALTER TABLE public.sesizari ADD CONSTRAINT sesizari_status_check CHECK (
  status IN (
    'nou', 'trimis',
    'inregistrata', 'redirectionata',
    'in-lucru', 'actiune-autoritate', 'interventie', 'amanata',
    'rezolvat', 'respins',
    'ignorat'
  )
);

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 067: status `ignorat` adăugat.' AS status;
