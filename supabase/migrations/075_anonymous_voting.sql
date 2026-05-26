-- 2026-05-26 — Anonymous voting pe sesizari publice.
--
-- Înainte: sesizare_votes avea PK (sesizare_id, user_id) cu user_id NOT NULL.
-- Userii anonimi nu puteau vota deloc — apare prompt-ul de auth modal,
-- friction inutilă pentru cetățeanul care doar vrea să sprijine vizual o
-- sesizare publică.
--
-- Acum: user_id e nullable. Anonim → dedup pe ip_hash (sha256 truncat).
-- Vote authenticated rămâne identic (user_id NOT NULL path).
--
-- Schema changes:
--   - ADD COLUMN ip_hash text (nullable)
--   - DROP NOT NULL pe user_id
--   - DROP existing PK (sesizare_id, user_id)
--   - 2 partial unique indexes:
--     • (sesizare_id, user_id) WHERE user_id IS NOT NULL
--     • (sesizare_id, ip_hash) WHERE user_id IS NULL
--
-- View-ul sesizari_feed_view care sumează upvotes/downvotes continuă să
-- funcționeze fără modificare — el contează TOATE rândurile cu value=±1
-- indiferent dacă user_id e set sau nu.
--
-- Idempotent: rulează safe de mai multe ori.

-- Step 1: adăugăm coloana ip_hash
alter table public.sesizare_votes
  add column if not exists ip_hash text;

-- Step 2: drop NOT NULL pe user_id ca să acceptăm voturi anonime
alter table public.sesizare_votes
  alter column user_id drop not null;

-- Step 3: drop PK existent (sesizare_id, user_id). Idempotent prin
-- DO block — în Postgres nu există DROP CONSTRAINT IF EXISTS direct
-- pe primary key fără numele exact.
do $$
declare
  pk_name text;
begin
  select conname into pk_name
  from pg_constraint
  where conrelid = 'public.sesizare_votes'::regclass
    and contype = 'p';
  if pk_name is not null then
    execute format('alter table public.sesizare_votes drop constraint %I', pk_name);
  end if;
end$$;

-- Step 4: partial unique indexes pentru dedup
-- (a) Vote authenticated — un user nu poate vota de două ori aceeași sesizare
create unique index if not exists sesizare_votes_user_unique
  on public.sesizare_votes (sesizare_id, user_id)
  where user_id is not null;

-- (b) Vote anonim — un IP hash nu poate vota de două ori aceeași sesizare
create unique index if not exists sesizare_votes_ip_unique
  on public.sesizare_votes (sesizare_id, ip_hash)
  where user_id is null;

-- Check constraint: cel puțin unul din user_id / ip_hash trebuie să fie set.
-- (Postgres allow ambele NULL altfel — dar fără nicio identitate nu putem
-- dedup; o vote „nimănui" e spam.)
alter table public.sesizare_votes
  drop constraint if exists sesizare_votes_identity_check;
alter table public.sesizare_votes
  add constraint sesizare_votes_identity_check
  check (user_id is not null or ip_hash is not null);

-- RLS: păstrăm policy existent (read public) și extindem write să accepte
-- anonim. Service role bypassează RLS oricum (folosit de API server-side).
-- Anon clients NU au permisiune de INSERT direct — totul trece prin
-- /api/sesizari/[code]/vote care folosește admin client.
