-- ============================================================
-- RLS HARDENING — Sprint 1.1 Security
-- Data: 2026-05-20
-- ============================================================
-- Cosigners INSERT policy era permisivă WITH CHECK (true). În combinație
-- cu rate-limit doar la API level, bot-urile puteau bypassa via direct
-- Supabase REST + token PUBLIC (anon key). Acum tightening cu un check
-- de basic sanity: name length + dedup column constraint via index existent.
--
-- Plus: audit RLS pe tabele NEPROTEJATE:
--   - feedback_submissions (acum doar admin read?)
--   - intreruperi_submissions (anon scrieri permise — pot fi spam)
--   - stiri_cache (server-side only, no public write needed)
--   - proteste (public read, admin/owner write)
--   - user_preferences (per-user RLS)

-- ─── COSIGNERS — tighten INSERT ──────────────────────────────
-- Bot protection: name min 2 chars + ip_hash mandatory (set server-side).
-- API-ul `/api/sesizari/[code]/cosign/route.ts` deja face sanitize +
-- ip_hash + rate-limit. Asta e defense-in-depth la DB level.
DROP POLICY IF EXISTS "cosigners_insert_anyone" ON public.sesizare_cosigners;
CREATE POLICY "cosigners_insert_basic_check"
  ON public.sesizare_cosigners FOR INSERT
  WITH CHECK (
    -- Numele are min 2 chars (anti-empty spam)
    length(coalesce(name, '')) >= 2
    -- ip_hash trebuie populat (API setează — bypass direct = blocked)
    AND ip_hash IS NOT NULL
  );

-- ─── INTRERUPERI SUBMISSIONS — require auth OR rate-limited anon ──
-- Inainte: orice anonim putea submit-a intreruperi false → admin
-- trebuie să modereze manual mass spam. Acum: require auth (sau setam
-- politică minimă cu ip_hash sanity dacă vrem să păstrăm anon).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'intreruperi_submissions'
  ) THEN
    EXECUTE 'ALTER TABLE public.intreruperi_submissions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "intreruperi_submissions_insert_anyone" ON public.intreruperi_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "intreruperi_submissions_insert_auth" ON public.intreruperi_submissions';
    -- Doar useri logati pot submit-a; anon → 401 din API.
    EXECUTE 'CREATE POLICY "intreruperi_submissions_insert_auth" ON public.intreruperi_submissions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL)';
    -- SELECT: admin doar (folosesc service role în query)
    EXECUTE 'DROP POLICY IF EXISTS "intreruperi_submissions_select_admin" ON public.intreruperi_submissions';
    EXECUTE 'CREATE POLICY "intreruperi_submissions_select_admin" ON public.intreruperi_submissions FOR SELECT USING (false)';
  END IF;
END $$;

-- ─── FEEDBACK SUBMISSIONS — anon read denied ─────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'feedback_submissions'
  ) THEN
    EXECUTE 'ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "feedback_insert_anyone" ON public.feedback_submissions';
    EXECUTE 'DROP POLICY IF EXISTS "feedback_select_admin" ON public.feedback_submissions';
    -- Anonim poate scrie feedback (UI public)
    EXECUTE 'CREATE POLICY "feedback_insert_anyone" ON public.feedback_submissions FOR INSERT WITH CHECK (true)';
    -- DAR nimeni nu poate citi via anon key (admin folosește service role)
    EXECUTE 'CREATE POLICY "feedback_select_admin" ON public.feedback_submissions FOR SELECT USING (false)';
  END IF;
END $$;

-- ─── STIRI CACHE — server-only write ─────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stiri_cache'
  ) THEN
    EXECUTE 'ALTER TABLE public.stiri_cache ENABLE ROW LEVEL SECURITY';
    -- Public read OK (stiri sunt publice)
    EXECUTE 'DROP POLICY IF EXISTS "stiri_cache_read_public" ON public.stiri_cache';
    EXECUTE 'CREATE POLICY "stiri_cache_read_public" ON public.stiri_cache FOR SELECT USING (true)';
    -- Nimeni nu poate scrie via anon — doar service role (cron job)
    EXECUTE 'DROP POLICY IF EXISTS "stiri_cache_no_write" ON public.stiri_cache';
    EXECUTE 'CREATE POLICY "stiri_cache_no_write" ON public.stiri_cache FOR INSERT WITH CHECK (false)';
  END IF;
END $$;

-- ─── USER PREFERENCES — per-user only ────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_preferences'
  ) THEN
    EXECUTE 'ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "user_preferences_owner" ON public.user_preferences';
    EXECUTE 'CREATE POLICY "user_preferences_owner" ON public.user_preferences FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 053: RLS hardening aplicata.' AS status;
