-- ============================================================
-- Migration 033: User-initiated petitions on Civia
-- ============================================================
-- Permite utilizatorilor autentificați să creeze propriile petiții
-- via /petitii/initiaza. Spre deosebire de petițiile vechi (agregate
-- din Declic/Avaaz cu external_url + scrape), acestea sunt 100% pe
-- Civia: signatures se colectează direct în petitie_signatures.
--
-- Workflow:
-- 1. User logged-in submits → row creat cu status='draft',
--    moderation_status='pending', is_user_initiated=true
-- 2. Apare în /admin/petitii la tab „Pending submissions" pentru review
-- 3. Admin aprobă → status='active', moderation_status='approved' →
--    apare public la /petitii și poate fi semnată

alter table public.petitii
  add column if not exists is_user_initiated boolean not null default false,
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  add column if not exists rejected_reason text;

-- Body devine optional pentru flow-ul user-initiated — useri-i scriu
-- direct summary + body, deci body e cerut. Pentru cele din scrape
-- vechi, body e mereu populat. Constraint rămâne not null.

create index if not exists idx_petitii_pending
  on public.petitii(moderation_status, created_at desc)
  where moderation_status = 'pending';

create index if not exists idx_petitii_user_initiated
  on public.petitii(is_user_initiated, status)
  where is_user_initiated = true;

-- ============================================================
-- RLS — permite users autentificați să INSEREZE doar cu condiții stricte
-- ============================================================

-- Drop policy veche „petitii_modify_admin" și o reconstruiesc ca să
-- separăm INSERT (oricine auth, cu condiții) de UPDATE/DELETE (doar admin).
drop policy if exists "petitii_modify_admin" on public.petitii;

-- ADMIN — full access pe orice petitie (citire/insert/update/delete).
create policy "petitii_admin_all"
  on public.petitii for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- USER auth — poate INSERA DOAR petiție în starea inițială pending+draft
-- ca să fie verificată de admin înainte să apară public. Restricția
-- e enforced la nivel DB ca să blocheze abuse-ul (chiar dacă cineva
-- bypass-ează UI-ul).
create policy "petitii_user_initiate"
  on public.petitii for insert
  to authenticated
  with check (
    is_user_initiated = true
    and moderation_status = 'pending'
    and status = 'draft'
    and created_by = auth.uid()
  );

-- USER auth — poate vedea propria petiție în orice stare (inclusiv pending)
-- ca să-i poată trimite link-ul propriu sau să verifice statusul moderării.
create policy "petitii_owner_read"
  on public.petitii for select
  to authenticated
  using (created_by = auth.uid());

-- USER auth — poate UPDATE propria petiție DOAR cât e încă pending
-- (admin n-a apucat să o reviewuiască). După approve, e frozen — orice
-- modificare ar însemna re-review, ceea ce e complicat. Pentru moment
-- păstrăm simplu: pending = editabilă, restul = frozen (doar admin).
create policy "petitii_owner_edit_pending"
  on public.petitii for update
  to authenticated
  using (
    created_by = auth.uid()
    and moderation_status = 'pending'
  )
  with check (
    created_by = auth.uid()
    and moderation_status = 'pending'
    and is_user_initiated = true
  );

-- Public read policy: actualizez ca să excludă explicit pending submissions
-- (care altfel ar putea apărea pe /petitii dacă status devine 'active'
-- înainte de moderation_status='approved').
drop policy if exists "petitii_read_public" on public.petitii;
create policy "petitii_read_public"
  on public.petitii for select
  using (
    status in ('active','closed')
    and moderation_status = 'approved'
  );

-- ============================================================
-- View update — petitii_with_count moștenește de la base table,
-- deci RLS-ul nou se aplică automat. Nu trebuie schimbată view-ul.
-- ============================================================

-- Schema reload notify (PostgREST cache)
notify pgrst, 'reload schema';

select 'Migration 033 (petitii user-initiated + moderation) aplicată.' as status;
