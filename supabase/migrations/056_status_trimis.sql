-- ============================================================
-- Migration 056: add 'trimis' to sesizari.status check constraint
-- ============================================================
--
-- Bug raportat user 5/21/2026 pe sesizarea 00044: butonul „Trimite acum
-- cu Civia (1-click)" arăta „Trimis automat" în UI dar DB-ul rămânea
-- sent_via_civia=false, status='nou'. Cauza:
--
--   src/app/api/sesizari/[code]/send-via-civia/route.ts încerca să facă
--   UPDATE cu status='trimis', dar constraint-ul sesizari_status_check
--   (introdus în migration 024) acceptă doar:
--     nou, inregistrata, redirectionata, in-lucru, actiune-autoritate,
--     interventie, amanata, rezolvat, respins
--
--   → CHECK violation 23514 → .update() returna error → ruta nu verifica
--   error → user vedea „Trimis automat" dar DB-ul nu se actualiza.
--
-- Migration:
--   1. Adăugăm 'trimis' la enum-ul de status (state validăm separat în
--      cod ca să nu permitem 'trimis' din UI-ul de admin status-change;
--      e o tranziție automată ce se face DOAR la send-via-civia).
--
-- Route fix complementar: src/app/api/sesizari/[code]/send-via-civia
-- acum verifică error pe .update() și raportează la Sentry.

ALTER TABLE public.sesizari
  DROP CONSTRAINT IF EXISTS sesizari_status_check;

ALTER TABLE public.sesizari
  ADD CONSTRAINT sesizari_status_check
  CHECK (status IN (
    'nou',
    'trimis',
    'inregistrata',
    'redirectionata',
    'in-lucru',
    'actiune-autoritate',
    'interventie',
    'amanata',
    'rezolvat',
    'respins'
  ));

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 056: status trimis aplicata.' AS status;
