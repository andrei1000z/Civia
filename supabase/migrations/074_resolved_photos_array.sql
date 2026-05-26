-- 2026-05-26 — Suport multi-photo pentru rezolvarea sesizărilor.
--
-- Înainte: o singură poză „după" stocată în `resolved_photo_url` (text).
-- Acum: până la 5 poze stocate în `resolved_photos` (text[]). Pentru
-- backwards compat, `resolved_photo_url` rămâne și ia prima poză din
-- array — toate consumerii vechi (BeforeAfter, /image-sitemap, etc.)
-- continuă să funcționeze fără schimbări.
--
-- Idempotent: rulează safe de mai multe ori.

alter table public.sesizari
  add column if not exists resolved_photos text[] default '{}'::text[];

-- Index opțional pentru query-uri care filtrează „are dovadă vizuală
-- multi-photo" — folosit pe galerie sesizari rezolvate. Sparse → low cost.
create index if not exists idx_sesizari_resolved_photos_present
  on public.sesizari (resolved_at desc)
  where array_length(resolved_photos, 1) > 0;

-- Backfill: dacă există resolved_photo_url dar resolved_photos e gol,
-- copiem url-ul vechi în array. Asta menține istoricul vizual existent
-- accesibil prin noua API (sesizari deja marcate rezolvate înainte de
-- migration).
update public.sesizari
set resolved_photos = array[resolved_photo_url]
where resolved_photo_url is not null
  and resolved_photo_url <> ''
  and (resolved_photos is null or array_length(resolved_photos, 1) is null);
