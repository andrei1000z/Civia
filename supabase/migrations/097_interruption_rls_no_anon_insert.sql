-- ============================================================
-- Migration 097: anti-bypass validare — fără INSERT public pe
-- interruption_submissions (audit 2026-06-08)
-- ============================================================
-- Politica `isub_insert_public` (insert to anon/authenticated, check true)
-- permitea oricui să insereze DIRECT, ocolind complet validarea din ruta API
-- (/api/intreruperi/submit). Insert-ul se face EXCLUSIV prin service-role
-- (createSupabaseAdmin), care bypassează RLS — deci nu avem nevoie de nicio
-- politică de INSERT pentru roluri publice.

DROP POLICY IF EXISTS isub_insert_public ON public.interruption_submissions;

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 097 (interruption RLS no anon insert) aplicată.' AS status;
