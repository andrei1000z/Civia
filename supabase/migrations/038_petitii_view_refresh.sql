-- ============================================================
-- Migration 038: refresh petitii_with_count view după add addressee
-- ============================================================
-- Migration 037 a adăugat petitii.addressee, dar view-ul
-- petitii_with_count are column list ÎNGHEȚAT la momentul creării
-- (PostgreSQL standard) — chiar și cu `select p.*`, view nu expune
-- coloane noi adăugate ulterior la baza-table.
--
-- Listing-ul /petitii folosește acum un select explicit care include
-- `addressee`. PostgREST returnează error pe coloană inexistentă în
-- view → `data: null` → frontend afișează 0 petiții.
--
-- Fix: drop + recreate view ca să prindă coloana nouă. Same fix
-- pattern ca migration 025.

drop view if exists public.petitii_with_count;
create view public.petitii_with_count as
  select
    p.*,
    coalesce(s.signature_count, 0)::int as signature_count
  from public.petitii p
  left join (
    select petitie_id, count(*) as signature_count
    from public.petitie_signatures
    group by petitie_id
  ) s on s.petitie_id = p.id;

-- PostgREST cache reload — fără asta, edge function-urile pot încă
-- folosi schema veche cached pentru câteva minute.
notify pgrst, 'reload schema';

select 'Migration 038 (petitii_with_count view refresh după addressee) aplicată.' as status;
