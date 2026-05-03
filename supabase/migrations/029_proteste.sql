-- ============================================================
-- Migration 029: Proteste programate
-- ============================================================
-- Catalog public de proteste / mitinguri / marșuri civice. Admin-only
-- write (RLS), public read pentru entry-urile cu visibility='publica'.
-- Detail page la /proteste/<slug>, listing la /proteste, management
-- la /admin/proteste.
--
-- Acoperă orice protest din România — civic, ecologist, anti-corupție,
-- pentru drepturi, etc. Fiecare entry are slug stabil pentru SEO + share.

create table if not exists public.proteste (
  id uuid primary key default gen_random_uuid(),

  -- Slug unic — folosit în URL (/proteste/<slug>). Generat din title la
  -- create, dar admin-ul poate edita manual ulterior dacă vrea.
  slug text not null unique,

  -- Identitate publică
  title text not null,
  subtitle text,
  -- Cauza pe scurt (4-8 cuvinte). Apare ca tagline sub titlu pe card.
  cause text,

  -- Body în markdown light (## subtitlu, - bullet, **bold**) — același
  -- subset ca /updateuri ca să refolosim renderer-ul.
  description text not null,

  -- Revendicări concrete — array de string-uri. Afișate ca listă pe
  -- pagina de detaliu („Ce cer protestatarii").
  demands text[] not null default array[]::text[],

  -- Tag-uri libere pentru filtrare/ căutare ulterioară.
  tags text[] not null default array[]::text[],

  -- Timing
  start_at timestamptz not null,
  end_at timestamptz,

  -- Locație
  location_name text not null,
  city text,
  county_slug text,
  -- Coordonate optionale (pin pe hartă în viitor).
  lat double precision,
  lng double precision,

  -- Organizator
  organizer text,
  organizer_url text,
  contact_email text,

  -- Atașamente / link-uri externe
  external_url text,           -- Facebook event, site oficial etc.
  hashtag text,                -- ex: "#nuVrem"
  cover_image_url text,
  cover_image_credit text,

  -- Estimări
  expected_attendance integer check (expected_attendance is null or expected_attendance >= 0),

  -- Stare
  status text not null default 'planificat'
    check (status in ('planificat', 'in_desfasurare', 'incheiat', 'anulat')),

  -- Vizibilitate / featured
  visibility text not null default 'publica'
    check (visibility in ('publica', 'draft')),
  featured boolean not null default false,

  -- Tema vizuală — un slug din HERO_GRADIENT (warning, primary, etc).
  color_theme text not null default 'warning',

  -- Audit
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_proteste_visibility_start
  on public.proteste(visibility, start_at desc);
create index if not exists idx_proteste_status_start
  on public.proteste(status, start_at desc);
create index if not exists idx_proteste_county
  on public.proteste(county_slug);

comment on table public.proteste is
  'Catalog public de proteste programate. Admin-managed la /admin/proteste, listing public la /proteste.';

-- updated_at maintenance
create or replace function public.set_proteste_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_proteste_updated_at on public.proteste;
create trigger trg_proteste_updated_at
  before update on public.proteste
  for each row execute function public.set_proteste_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.proteste enable row level security;

-- Public poate citi DOAR entry-urile cu visibility='publica'. Draft-urile
-- rămân ascunse până când admin-ul le publică.
drop policy if exists proteste_read_public on public.proteste;
create policy proteste_read_public on public.proteste
  for select using (visibility = 'publica');

-- Admin poate citi tot (inclusiv draft-uri) + write/update/delete.
drop policy if exists proteste_admin_all on public.proteste;
create policy proteste_admin_all on public.proteste
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

select 'Migration 029 (proteste) aplicată.' as status;
