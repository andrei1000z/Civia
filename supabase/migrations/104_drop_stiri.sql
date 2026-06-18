-- 104 — Eliminare COMPLETĂ a feature-ului „știri" (pagina /stiri + agregare RSS
-- din surse naționale + sinteză AI). Tot codul aferent a fost scos (rute,
-- componente, lib, cron /api/stiri/fetch, sitemap, search, county column).
-- Aici curățăm DB-ul: tabela `stiri_cache` + toate obiectele dependente
-- (indexuri idx_stiri_*, policy-urile RLS stiri_cache_*) prin CASCADE.
-- Idempotent (IF EXISTS). Nicio funcție/view nu referă tabela → drop curat.

drop table if exists public.stiri_cache cascade;

-- Defensiv: ruta de search semantic referea o tabelă „stiri" (probabil dead code);
-- o dropăm dacă există, fără efect dacă nu.
drop table if exists public.stiri cascade;
