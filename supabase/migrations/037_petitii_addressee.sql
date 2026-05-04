-- ============================================================
-- Migration 037: petitii.addressee — către cine se adresează petiția
-- ============================================================
-- User a cerut: la formularul de inițiere petiție să fie un câmp
-- pentru autoritatea destinatară (Primăria X, Ministerul Y,
-- Parlamentul, Guvernul, Consiliul Local, etc.). Apare ca subtitle
-- pe cardul petiției și pe pagina de detaliu, dând context imediat
-- cititorului despre cui i se adresează cererea.

alter table public.petitii
  add column if not exists addressee text;

-- Constraint: dacă e setat, max 200 chars (e o singură linie de text,
-- nu un body — limită defensivă să nu intre cineva cu paragrafe întregi).
alter table public.petitii
  drop constraint if exists petitii_addressee_length;
alter table public.petitii
  add constraint petitii_addressee_length
  check (addressee is null or char_length(addressee) <= 200);

select 'Migration 037 (petitii addressee) aplicată.' as status;
