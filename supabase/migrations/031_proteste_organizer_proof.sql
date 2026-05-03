-- ============================================================
-- Migration 031: Organizer self-identification + proof upload
-- ============================================================
-- Permite submitter-ului să-și declare statutul de organizator și să
-- atașeze dovada (aprobarea de la primărie / autoritate). Admin-ul
-- vede badge prominent + linkul la dovadă, ca să poată valida rapid.

alter table public.proteste
  add column if not exists is_organizer_submission boolean not null default false,
  add column if not exists organizer_proof_url text;

-- Index light pentru filtrare în admin (pending + organizer = priority).
create index if not exists idx_proteste_organizer_pending
  on public.proteste(moderation_status, is_organizer_submission)
  where moderation_status = 'pending';

select 'Migration 031 (organizer proof) aplicată.' as status;
