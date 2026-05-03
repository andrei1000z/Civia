-- ============================================================
-- Migration 035: aftermath_messages — separat de chants
-- ============================================================
-- Câmpul `aftermath_chants` din 034 era amestecat: și sloganuri scandate
-- și mesaje de pe pancarte/declarații publice. UI-ul afișa „Sloganuri
-- scandate" cu chestii care de fapt erau bannere.
--
-- Separăm: aftermath_chants = ce s-a strigat efectiv în timpul protestului,
-- aftermath_messages = ce era scris pe pancarte / declarații / mesaje
-- transmise (oamenii care au luat cuvântul, banner-e, etc.).

alter table public.proteste
  add column if not exists aftermath_messages text[] not null default array[]::text[];

select 'Migration 035 (proteste aftermath_messages) aplicată.' as status;
