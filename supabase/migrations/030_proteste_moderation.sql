-- ============================================================
-- Migration 030: Public submission + moderation pe proteste
-- ============================================================
-- Permite cetățenilor să propună proteste publice via /proteste/propune.
-- Submisiile intră cu moderation_status='pending' + visibility='draft'
-- și NU apar pe pagina publică decât după ce admin-ul le aprobă.
--
-- Entry-urile create direct de admin rămân default 'approved' (back-compat).

alter table public.proteste
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'rejected'));

alter table public.proteste
  add column if not exists submitter_name text,
  add column if not exists submitter_email text,
  add column if not exists submitter_note text,
  add column if not exists rejected_reason text;

create index if not exists idx_proteste_moderation
  on public.proteste(moderation_status, created_at desc);

-- Public read policy — restrânge la doar entry-urile care sunt în același
-- timp publice ȘI aprobate. Drop și re-create pentru că în 029 era doar
-- pe visibility.
drop policy if exists proteste_read_public on public.proteste;
create policy proteste_read_public on public.proteste
  for select using (
    visibility = 'publica' and moderation_status = 'approved'
  );

-- Submission policy — anyone (anon + authenticated) poate INSERA un row
-- DAR doar cu moderation_status='pending' și visibility='draft'.
-- Asta blochează abuse-ul (n-au cum să publice direct).
drop policy if exists proteste_public_submit on public.proteste;
create policy proteste_public_submit on public.proteste
  for insert
  to anon, authenticated
  with check (
    moderation_status = 'pending'
    and visibility = 'draft'
  );

-- Admin policy din 029 rămâne — admin-ul poate face orice (inclusiv update
-- moderation_status la approved + visibility la publica când publică).

select 'Migration 030 (proteste moderation) aplicată.' as status;
