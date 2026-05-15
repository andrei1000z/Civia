-- 039_street_follows.sql
-- Adoptă o stradă — useri logați pot „follow" un nume de stradă/cartier
-- și primesc notificări când o sesizare nouă apare în zona acelui pattern.
--
-- Pattern matching (locatie ILIKE %street%) — simplu și suficient pentru
-- volumul de sesizări. Volum mic per user (10-20 follows max, no enforce).
--
-- Schema:
--   user_id    referință la profile, cascade pe delete
--   street     numele/pattern-ul (ex: „Strada Lizeanu", „Drumul Taberei")
--              lowercase la insert pentru match consistent
--   county     slug județ (ex: „b", „cj") — pentru filtrare mai precisă
--              când două orașe au aceeași stradă
--   created_at when followed

create table if not exists public.street_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  street text not null check (length(street) >= 2 and length(street) <= 100),
  county text not null check (length(county) >= 1 and length(county) <= 4),
  created_at timestamptz default now(),
  unique (user_id, street, county)
);

create index if not exists idx_street_follows_user on public.street_follows(user_id);
create index if not exists idx_street_follows_county_street
  on public.street_follows(county, street);

-- RLS — user vede + gestionează doar propriile follow-uri.
alter table public.street_follows enable row level security;

drop policy if exists "street_follows_read_own" on public.street_follows;
create policy "street_follows_read_own"
  on public.street_follows for select
  using (auth.uid() = user_id);

drop policy if exists "street_follows_insert_auth" on public.street_follows;
create policy "street_follows_insert_auth"
  on public.street_follows for insert
  with check (auth.uid() = user_id);

drop policy if exists "street_follows_delete_own" on public.street_follows;
create policy "street_follows_delete_own"
  on public.street_follows for delete
  using (auth.uid() = user_id);
