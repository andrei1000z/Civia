-- 040_push_subscriptions.sql
-- Web Push subscriptions per user — vom trimite notificări native când o
-- sesizare urmărită se schimbă de status, când autoritatea răspunde, sau
-- când e o sesizare nouă pe o stradă urmărită.
--
-- Subscription = ce primește server-ul de la `pushManager.subscribe()` în SW.
-- Conține: endpoint URL (provider-specific FCM/Apple), p256dh + auth keys
-- pentru encrypt-ul payload-ului.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  last_used_at timestamptz default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subs_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- User vede + șterge doar propriile subscription-uri. Insert via service-role
-- (din /api/push/subscribe) — RLS pe insert e strict authenticated.
drop policy if exists "push_subs_read_own" on public.push_subscriptions;
create policy "push_subs_read_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "push_subs_insert_own" on public.push_subscriptions;
create policy "push_subs_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

drop policy if exists "push_subs_delete_own" on public.push_subscriptions;
create policy "push_subs_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
