-- 2026-05-24: scoate feature-ul „carusel media în pagina stire".
-- User a cerut să fie eliminat complet (UX-ul nu merita complexitatea
-- scrape + AI captioning per articol). Curățăm coloana introdusă de
-- vechea migrare 065_stiri_media (rebrand local — vezi git history
-- commit 712bcad reverted).

ALTER TABLE stiri_cache DROP COLUMN IF EXISTS media;
