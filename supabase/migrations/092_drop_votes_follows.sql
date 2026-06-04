-- 2026-06-04 — Eliminare completă „like" sesizări + „Urmărește" (cerere user).
--
-- Votarea (sesizare_votes) și urmărirea (sesizare_follows) au fost scoase din
-- UI + API. Aici curățăm baza de date: recreăm view-ul sesizari_feed FĂRĂ
-- agregatele de voturi/followers, apoi ștergem tabelele. „Nicio urmă."
--
-- upvotes/downvotes/voturi_net/nr_followers erau coloane CALCULATE în view
-- (nu pe tabela sesizari) → nu e nevoie de ALTER TABLE DROP COLUMN.
--
-- Idempotent. Safe to run multiple times.

-- ─── 1. Recreează sesizari_feed fără voturi/followers ────────────────────────
-- CASCADE dropează și RPC-ul sesizari_similare (recreat mai jos).
DROP VIEW IF EXISTS public.sesizari_feed CASCADE;

CREATE VIEW public.sesizari_feed AS
  SELECT s.*,
    (SELECT COUNT(*) FROM public.sesizare_comments c WHERE c.sesizare_id = s.id)::INT AS nr_comentarii,
    (SELECT COUNT(*) FROM public.sesizare_verifications ver
       WHERE ver.sesizare_id = s.id AND ver.agrees = true)::INT AS verif_da,
    (SELECT COUNT(*) FROM public.sesizare_verifications ver
       WHERE ver.sesizare_id = s.id AND ver.agrees = false)::INT AS verif_nu,
    (SELECT COUNT(*) FROM public.sesizare_cosigners co WHERE co.sesizare_id = s.id)::INT AS nr_cosigners
  FROM public.sesizari s
  WHERE s.moderation_status = 'approved' AND s.publica = true;

-- Recreate sesizari_similare RPC (dropped by CASCADE)
CREATE OR REPLACE FUNCTION public.sesizari_similare(
  p_sesizare_id UUID,
  p_radius_m INTEGER DEFAULT 300
)
RETURNS SETOF public.sesizari_feed
LANGUAGE sql
STABLE
AS $$
  WITH origin AS (
    SELECT tip, lat, lng, id
    FROM public.sesizari
    WHERE id = p_sesizare_id
  )
  SELECT s.*
  FROM public.sesizari_feed s, origin o
  WHERE s.id != o.id
    AND s.tip = o.tip
    AND ABS(s.lat - o.lat) < (p_radius_m::FLOAT / 111000.0)
    AND ABS(s.lng - o.lng) < (p_radius_m::FLOAT / (111000.0 * COS(RADIANS(o.lat))))
  ORDER BY s.created_at DESC
  LIMIT 10;
$$;

-- ─── 2. Drop tabelele de voturi + urmăriri ───────────────────────────────────
DROP TABLE IF EXISTS public.sesizare_votes CASCADE;
DROP TABLE IF EXISTS public.sesizare_follows CASCADE;

-- ─── 3. Curăță feedback-ul de la like/dislike știri ──────────────────────────
-- StireFeedbackCard salva dislike-urile în feedback_submissions cu topic
-- specific. Tabela feedback_submissions e GENERALĂ (păstrată) — ștergem doar
-- rândurile legate de știri.
DELETE FROM public.feedback_submissions
  WHERE topic IN ('stire-dislike', 'stire-like', 'stiri-feedback');

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 092: votes + follows + stiri-feedback eliminate.' AS status;
