-- 2026-05-29 — is_admin() helper function pentru RLS policies
--
-- Context: 14 migrations folosesc inline subquery in RLS policies:
--   `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`
-- Subquery e re-evaluat per row → slow. Plus: refactor centralizat e ușor cu functie.
--
-- Decision: create function is_admin() RETURNS boolean STABLE SECURITY DEFINER
-- + auth.uid() folosit prin (SELECT auth.uid()) pattern în viitoare policies.
--
-- STABLE permite caching planner (NOT VOLATILE = re-eval per call).
-- SECURITY DEFINER allows policy to query profiles independent of viewer's RLS.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Returns true daca current authenticated user are role=''admin''. STABLE pentru caching planner.';

-- Grant execute la authenticated + anon (return false pentru anon — safe).
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Sanity check: should return false when no auth context
-- (SELECT is_admin() pe anonymous returns false)

-- ─── BONUS: helper functions related ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_id() IS
  'Wrapper pentru auth.uid() folosit in policies. STABLE pentru caching planner.';

GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, anon;
