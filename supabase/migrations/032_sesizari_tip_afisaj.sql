-- ============================================================
-- Migration 032: Add „afisaj" to sesizari.tip allowed values
-- ============================================================
-- Tipul nou „afișaj/publicitate ilegală" — pentru afișe sălbatice,
-- panouri publicitare neautorizate, bannere stradale fără aviz.
-- Distinct de „graffiti" (care rămâne strict vandalism cu spray).
-- Restu' integrării e în code (constants, prompts, templates,
-- authorities, types, guides) — aici doar deschidem DB-ul.

alter table public.sesizari drop constraint if exists sesizari_tip_check;
alter table public.sesizari add constraint sesizari_tip_check
  check (tip in (
    'groapa','trotuar','iluminat','copac','gunoi','parcare',
    'stalpisori','canalizare','semafor','pietonal',
    'graffiti','mobilier','zgomot','animale','transport',
    'afisaj',
    'altele'
  ));

select 'Migration 032 (afisaj tip) aplicată.' as status;
