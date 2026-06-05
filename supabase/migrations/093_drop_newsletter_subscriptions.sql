-- 2026-06-05 — Consolidare newsletter pe O SINGURĂ tabelă.
--
-- Existau DOUĂ sisteme paralele de abonare:
--   • newsletter_subscribers (006 + 041 double-opt-in) — REALĂ: formularul de
--     pe site (/api/newsletter) scrie aici, iar digestul + weekly TRIMIT de aici.
--   • newsletter_subscriptions (090 mega) — scrisă de /api/newsletter/subscribe
--     (orfan, niciun UI nu-l apela) și de unsubscribe. NIMIC nu trimitea de aici.
--
-- Bug GDPR: dezabonarea actualiza newsletter_subscriptions (moartă), nu
-- newsletter_subscribers → cetățeanul rămânea abonat la digest. Acum unsubscribe
-- țintește newsletter_subscribers (vezi /api/newsletter/unsubscribe rescris) și
-- ștergem tabela redundantă + ruta /api/newsletter/subscribe.
--
-- Idempotent. Safe to run multiple times.

DROP TABLE IF EXISTS public.newsletter_subscriptions CASCADE;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 093: newsletter_subscriptions eliminată (consolidare pe newsletter_subscribers).' AS status;
