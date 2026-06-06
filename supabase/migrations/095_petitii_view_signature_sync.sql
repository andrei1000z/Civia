-- ============================================================
-- Migration 095 (audit #5): refresh petitii_with_count pentru coloanele
-- external_signature_count + last_external_sync_at (adăugate în migrarea 094).
-- ============================================================
-- View-ul are column list ÎNGHEȚAT la momentul creării (PostgreSQL standard) —
-- chiar și cu `select p.*`, NU expune coloane adăugate ulterior la baza-table.
-- Listing-ul /petitii folosește select explicit cu external_signature_count →
-- PostgREST 42703 pe coloană inexistentă → 0 petiții. Drop + recreate (pattern
-- identic cu migrarea 038).

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

notify pgrst, 'reload schema';

select 'Migration 095 (petitii_with_count refresh pentru external_signature_count) aplicată.' as status;
