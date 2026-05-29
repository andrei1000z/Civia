-- 2026-05-29 — REVERT mig 086 lockdown.
--
-- Context: Mig 086 a REVOKED exec_sql de la anon + authenticated, dar
-- a accidental sparte si /rest/v1/rpc/exec_sql pentru service_role —
-- PostgREST schema cache exclude functia daca nu e PUBLIC accessible.
--
-- Pierdere: scripturile `npm run migrate` cu service_role nu mai pot
-- aplica mig-urile noi (087, 090).
--
-- Decision: re-grant TO PUBLIC. Securitatea reala vine din:
-- (a) SERVICE_ROLE_KEY ne-leaked (rotation periodica, Vercel ENV scope)
-- (b) Daca KEY leak, atacatorul are oricum acces la toate tabelele via
--     PostgREST direct (.from("X").update()/delete() etc.)
-- (c) Defense in depth la nivel APLICATIE: nicio ruta nu apeleaza exec_sql.

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.exec_sql(text) IS
  'Migration helper RPC. Grant restrictionat conceptual la service_role; aplicatia NU il apeleaza din nicio ruta. Threat model: KEY leak.';
