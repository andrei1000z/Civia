-- ============================================================
-- Civia — Supabase schema
-- ============================================================
-- Run this file in the Supabase SQL Editor.
-- Idempotent: safe to re-run (drop + recreate pattern).

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 2. TABLES
-- ============================================================

-- profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Cetățean',
  full_name text,
  address text,
  phone text,
  role text not null default 'user' check (role in ('user','admin','moderator')),
  created_at timestamptz default now()
);

-- sesizari (citizen complaints)
create table if not exists public.sesizari (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  user_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  author_email text,
  tip text not null check (tip in ('groapa','trotuar','iluminat','copac','gunoi','parcare','stalpisori','canalizare','semafor','pietonal','graffiti','mobilier','zgomot','animale','transport','afisaj','altele')),
  titlu text not null,
  locatie text not null,
  sector text not null check (sector in ('S1','S2','S3','S4','S5','S6')),
  lat double precision not null,
  lng double precision not null,
  descriere text not null,
  formal_text text,
  status text not null default 'nou' check (status in (
    'nou','inregistrata','redirectionata','in-lucru',
    'actiune-autoritate','interventie','amanata',
    'rezolvat','respins'
  )),
  imagini text[] default '{}',
  publica boolean default true,
  moderation_status text default 'approved' check (moderation_status in ('pending','approved','rejected')),
  resolved_at timestamptz,
  resolved_by_author boolean default false,
  resolved_photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- comments
create table if not exists public.sesizare_comments (
  id uuid primary key default gen_random_uuid(),
  sesizare_id uuid references public.sesizari(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  body text not null check (length(body) > 0 and length(body) <= 2000),
  created_at timestamptz default now()
);

-- timeline events
create table if not exists public.sesizare_timeline (
  id uuid primary key default gen_random_uuid(),
  sesizare_id uuid references public.sesizari(id) on delete cascade,
  event_type text not null,
  description text,
  created_at timestamptz default now()
);

-- sesizare verifications (community confirms/disputes resolution)
create table if not exists public.sesizare_verifications (
  sesizare_id uuid references public.sesizari(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  agrees boolean not null,
  created_at timestamptz default now(),
  primary key (sesizare_id, user_id)
);

-- sesizare status tickets (citizen-proposed status updates, admin-approved)
create table if not exists public.sesizare_status_tickets (
  id uuid primary key default gen_random_uuid(),
  sesizare_id uuid not null references public.sesizari(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  proposed_status text not null check (proposed_status in (
    'inregistrata','redirectionata','in-lucru',
    'actiune-autoritate','interventie','amanata',
    'rezolvat','respins'
  )),
  note text not null check (length(trim(note)) > 0 and length(note) <= 1000),
  proof_url text,
  decision text not null default 'pending'
    check (decision in ('pending','approved','rejected')),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

-- newsletter subscribers
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  sectors text[] default '{}',
  confirmed boolean default false,
  created_at timestamptz default now()
);

-- stiri cache (RSS aggregation)
create table if not exists public.stiri_cache (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  title text not null,
  excerpt text,
  content text,
  source text not null,
  category text not null default 'administratie',
  author text,
  image_url text,
  published_at timestamptz not null,
  fetched_at timestamptz default now(),
  ai_summary text,
  ai_summary_version int not null default 0,
  featured boolean default false
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
create index if not exists idx_sesizari_publica_data on public.sesizari(publica, created_at desc) where moderation_status = 'approved';
create index if not exists idx_sesizari_sector on public.sesizari(sector);
create index if not exists idx_sesizari_status on public.sesizari(status);
create index if not exists idx_sesizari_code on public.sesizari(code);
create index if not exists idx_comments_sesizare on public.sesizare_comments(sesizare_id, created_at);
create index if not exists idx_timeline_sesizare on public.sesizare_timeline(sesizare_id, created_at);
create index if not exists idx_verifications_sesizare on public.sesizare_verifications(sesizare_id);
create index if not exists idx_status_tickets_pending
  on public.sesizare_status_tickets(decision, created_at desc)
  where decision = 'pending';
create index if not exists idx_status_tickets_sesizare
  on public.sesizare_status_tickets(sesizare_id, created_at desc);
create index if not exists idx_newsletter_email on public.newsletter_subscribers(email);
create index if not exists idx_stiri_published on public.stiri_cache(published_at desc);

-- ============================================================
-- 4. VIEWS
-- ============================================================
-- 2026-06-04: voturile (upvotes/downvotes/voturi_net) și urmăririle
-- (nr_followers) au fost eliminate. Migrarea 092 recreează acest view +
-- adaugă nr_cosigners (din migrarea 042). Aici păstrăm doar agregatele de
-- bază — restul vine din migrări.
create or replace view public.sesizari_feed as
  select s.*,
    (select count(*) from public.sesizare_comments c where c.sesizare_id = s.id)::int as nr_comentarii,
    (select count(*) from public.sesizare_verifications ver where ver.sesizare_id = s.id and ver.agrees = true)::int as verif_da,
    (select count(*) from public.sesizare_verifications ver where ver.sesizare_id = s.id and ver.agrees = false)::int as verif_nu
  from public.sesizari s
  where s.moderation_status = 'approved' and s.publica = true;

-- ============================================================
-- 5. TRIGGER: auto-create profile on user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 6. TRIGGER: auto-timeline on sesizare insert
-- ============================================================
create or replace function public.handle_new_sesizare()
returns trigger
language plpgsql
as $$
begin
  insert into public.sesizare_timeline (sesizare_id, event_type, description)
  values (new.id, 'depusa', 'Sesizare depusă de cetățean');
  return new;
end;
$$;

drop trigger if exists on_sesizare_created on public.sesizari;
create trigger on_sesizare_created
  after insert on public.sesizari
  for each row execute function public.handle_new_sesizare();

-- ============================================================
-- 7. TRIGGER: updated_at
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_sesizari_updated_at on public.sesizari;
create trigger touch_sesizari_updated_at
  before update on public.sesizari
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.sesizari enable row level security;
alter table public.sesizare_comments enable row level security;
alter table public.sesizare_timeline enable row level security;
alter table public.sesizare_verifications enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.stiri_cache enable row level security;

-- profiles
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- sesizari: public can read approved+public, owners read their own
drop policy if exists "sesizari_read_public" on public.sesizari;
create policy "sesizari_read_public" on public.sesizari for select
  using (publica = true and moderation_status = 'approved');

drop policy if exists "sesizari_read_own" on public.sesizari;
create policy "sesizari_read_own" on public.sesizari for select
  using (auth.uid() is not null and auth.uid() = user_id);

-- Authenticated users can insert (anonymous goes via service role in API)
drop policy if exists "sesizari_insert_authenticated" on public.sesizari;
drop policy if exists "sesizari_insert_anyone" on public.sesizari;
create policy "sesizari_insert_authenticated" on public.sesizari for insert
  with check (auth.uid() is not null and auth.uid() = user_id);

-- Update only by owner within 1h
drop policy if exists "sesizari_update_own" on public.sesizari;
create policy "sesizari_update_own" on public.sesizari for update
  using (auth.uid() = user_id and created_at > now() - interval '1 hour');

-- comments: anyone reads, authenticated write
drop policy if exists "comments_read_all" on public.sesizare_comments;
create policy "comments_read_all" on public.sesizare_comments for select using (true);

drop policy if exists "comments_insert_auth" on public.sesizare_comments;
create policy "comments_insert_auth" on public.sesizare_comments for insert with check (auth.uid() = user_id);

drop policy if exists "comments_delete_own" on public.sesizare_comments;
create policy "comments_delete_own" on public.sesizare_comments for delete using (auth.uid() = user_id);

-- timeline: anyone reads (inserted via trigger/service role only)
drop policy if exists "timeline_read_all" on public.sesizare_timeline;
create policy "timeline_read_all" on public.sesizare_timeline for select using (true);

-- verifications: anyone reads, auth insert/update/delete own
drop policy if exists "verifications_read_all" on public.sesizare_verifications;
create policy "verifications_read_all" on public.sesizare_verifications for select using (true);
drop policy if exists "verifications_insert_auth" on public.sesizare_verifications;
create policy "verifications_insert_auth" on public.sesizare_verifications for insert with check (auth.uid() = user_id);
drop policy if exists "verifications_delete_own" on public.sesizare_verifications;
create policy "verifications_delete_own" on public.sesizare_verifications for delete using (auth.uid() = user_id);

-- newsletter: anyone can subscribe, only admin reads
drop policy if exists "newsletter_insert_anyone" on public.newsletter_subscribers;
create policy "newsletter_insert_anyone" on public.newsletter_subscribers for insert with check (true);

-- stiri: public reads
drop policy if exists "stiri_read_all" on public.stiri_cache;
create policy "stiri_read_all" on public.stiri_cache for select using (true);

-- ============================================================
-- 9. STORAGE BUCKET
-- ============================================================
-- Bucket-ul găzduiește atât poze sesizare (5 MB tipic), cât și
-- aftermath proteste (poze + video până la 50 MB) + PDF-uri pentru
-- evidence-uri admin. Am folosit un singur bucket pentru simplitate
-- în RLS și storage management — distincția e făcută la nivel de
-- folder (`public/`) și de aplicație (validare client + filterValidMedia
-- la save).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sesizari-photos',
  'sesizari-photos',
  true,
  52428800,  -- 50 MB (era 5 MB; bumped pentru video uploads aftermath)
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies
drop policy if exists "photos_read_public" on storage.objects;
create policy "photos_read_public" on storage.objects for select
  using (bucket_id = 'sesizari-photos');

-- Upload: authenticated users only, restricted to public/ path
drop policy if exists "photos_upload_anyone" on storage.objects;
drop policy if exists "photos_upload_auth" on storage.objects;
create policy "photos_upload_auth" on storage.objects for insert
  with check (bucket_id = 'sesizari-photos' and (storage.foldername(name))[1] = 'public');

-- Delete: service role only (cleanup via API)
drop policy if exists "photos_delete_service" on storage.objects;
create policy "photos_delete_service" on storage.objects for delete
  using (bucket_id = 'sesizari-photos');

-- ============================================================
-- 10. REALTIME
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.sesizari;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.sesizare_comments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.sesizare_timeline;
exception when duplicate_object then null; end $$;

-- ============================================================
-- 11. HELPER FUNCTIONS
-- ============================================================
-- Role check for admin operations
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Done!
select 'Schema Civia instalată cu succes.' as status;
