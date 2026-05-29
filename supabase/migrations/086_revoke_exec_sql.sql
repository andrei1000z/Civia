-- 2026-05-29 — Lockdown exec_sql RPC
--
-- Context: exec_sql(query text) RPC are SECURITY DEFINER si accepta SQL
-- arbitrar. Daca SERVICE_ROLE_KEY este leak-uit (env var, git history),
-- atacatorul poate executa SQL arbitrar pe DB → RCE.
--
-- Solutie: REVOKE EXECUTE de la roluri public + anon + authenticated.
-- Lasam EXECUTE doar pentru `postgres` (super-user) si `service_role`
-- (folosit doar de migrate.ts script pe loop maintainer).
--
-- Astfel: din browser sau client autentificat, RPC NU MAI E APELABIL.
-- Pentru migrations, script `npm run migrate` foloseste SERVICE_ROLE_KEY
-- direct → continua sa funcționeze.

-- Revoke from public + anon + authenticated
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM authenticated;

-- Grant explicit doar la service_role + postgres
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
-- postgres are deja grant via SECURITY DEFINER ownership

COMMENT ON FUNCTION public.exec_sql(text) IS
  'INTERNAL ONLY. SECURITY DEFINER. Grant restrictionat la service_role pentru migration scripts. NU expune anon/authenticated.';
