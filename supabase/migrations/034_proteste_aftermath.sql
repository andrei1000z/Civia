-- ============================================================
-- Migration 034: Aftermath ("Cum a fost") pe proteste
-- ============================================================
-- Permite documentarea protestului DUPĂ ce a avut loc — câți au fost,
-- ce s-a scandat, poze, video-uri, link-uri către presă, narative.
-- Submisia e public (anyone can submit aftermath); moderarea e admin-only.
-- Doar entry-urile aprobate apar pe pagina publică.
--
-- Câmpurile sunt grupate cu prefix `aftermath_` ca să nu se amestece cu
-- meta-ul protestului în sine (planificat → încheiat).

alter table public.proteste
  -- Estimare participanți observată (vs `expected_attendance` care e ex-ante)
  add column if not exists aftermath_attendance_estimate integer
    check (aftermath_attendance_estimate is null or aftermath_attendance_estimate >= 0),

  -- Narativ liber (markdown light, ca `description`) — cum a decurs:
  -- atmosfera, traseul, reacțiile autorităților, momente cheie.
  add column if not exists aftermath_narrative text,

  -- Sloganuri scandate — array de string-uri (1 per slogan).
  add column if not exists aftermath_chants text[] not null default array[]::text[],

  -- Momente cheie (ex: „17:00 — discurs reprezentant cetățeni",
  -- „17:30 — pornire marș spre Guvern"). Array de string-uri.
  add column if not exists aftermath_key_moments text[] not null default array[]::text[],

  -- Outcome / consecințe — declarații oficiale, decizii ulterioare,
  -- promisiuni, etc. Plain text (sub 4000 chars).
  add column if not exists aftermath_outcome text,

  -- Galerie poze — JSONB array cu obiecte {url, credit?, caption?}.
  -- JSONB ne permite schimbe ulterioare fără migration nou.
  add column if not exists aftermath_images jsonb not null default '[]'::jsonb,

  -- Video-uri (YouTube, TikTok, Instagram, link direct) — JSONB array
  -- cu obiecte {url, title?, source?}.
  add column if not exists aftermath_videos jsonb not null default '[]'::jsonb,

  -- Surse presă — JSONB array cu obiecte {url, title?, publication?, snippet?}.
  -- Acestea sunt link-urile pe care AI-ul le scrape-uiește când user-ul cere
  -- auto-fill. Le păstrăm ca să afișăm „Citește mai multe" pe pagina publică.
  add column if not exists aftermath_sources jsonb not null default '[]'::jsonb,

  -- Audit submission (cine a trimis aftermath-ul, când)
  add column if not exists aftermath_submitter_name text,
  add column if not exists aftermath_submitter_email text,
  add column if not exists aftermath_submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists aftermath_submitted_at timestamptz,

  -- Moderation — aftermath-ul are flow propriu, separat de moderation_status
  -- al protestului în sine (un protest aprobat poate avea aftermath pending).
  add column if not exists aftermath_moderation_status text not null default 'none'
    check (aftermath_moderation_status in ('none', 'pending', 'approved', 'rejected')),
  add column if not exists aftermath_moderator_note text,
  add column if not exists aftermath_published_at timestamptz;

-- Index pentru filtrarea în admin queue (aftermath pending).
create index if not exists idx_proteste_aftermath_moderation
  on public.proteste(aftermath_moderation_status, aftermath_submitted_at desc)
  where aftermath_moderation_status in ('pending', 'approved');

-- Public read policy din 030 e încă valid (protest aprobat). Aftermath
-- approved e vizibil dacă protestul e vizibil — nu blocăm decât prin
-- aftermath_moderation_status la nivel SELECT din lib (ușor de filtrat
-- în query). N-avem nevoie de policy nou.

-- Submission policy: anyone (anon + authenticated) poate face UPDATE
-- pe aftermath_* DAR doar dacă protestul e public + aftermath_moderation
-- e încă 'none' sau 'rejected' (nu poate suprascrie un aftermath approved
-- sau pending).
-- Asta e mai permisiv decât pentru insert original — acceptăm că un
-- update accidental poate fi corectat prin moderare.
drop policy if exists proteste_public_aftermath_update on public.proteste;
create policy proteste_public_aftermath_update on public.proteste
  for update
  to anon, authenticated
  using (
    visibility = 'publica'
    and moderation_status = 'approved'
    and aftermath_moderation_status in ('none', 'rejected')
  )
  with check (
    -- După update, aftermath_moderation_status TREBUIE să fie 'pending'
    -- (nu poate sări direct la approved).
    aftermath_moderation_status = 'pending'
  );

-- Notă: policy_admin_all din 029 acoperă deja CRUD admin pentru orice
-- coloană inclusiv noile aftermath_*.

select 'Migration 034 (proteste aftermath) aplicată.' as status;
