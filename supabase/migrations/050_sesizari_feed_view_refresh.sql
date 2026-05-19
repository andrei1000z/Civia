-- Refresh sesizari_feed view ca să includă coloanele noi adăugate la
-- tabela sesizari după ce view-ul a fost creat (migr 042):
--   - custom_category (migr 048)
--   - custom_category_confidence (migr 048)
--   - author_display_name (migr 049)
--
-- PostgreSQL face expansiunea `SELECT s.*` la CREATE VIEW time, deci
-- adăugarea unei coloane pe tabela parinte NU se propagă automat la
-- view. Re-CREATE-uim view-ul aici cu CASCADE ca să ne preia toate
-- coloanele curente.

DROP VIEW IF EXISTS public.sesizari_feed CASCADE;

CREATE VIEW public.sesizari_feed AS
  SELECT s.*,
    COALESCE(SUM(CASE WHEN v.value = 1 THEN 1 ELSE 0 END), 0)::INT AS upvotes,
    COALESCE(SUM(CASE WHEN v.value = -1 THEN 1 ELSE 0 END), 0)::INT AS downvotes,
    COALESCE(SUM(v.value), 0)::INT AS voturi_net,
    (SELECT COUNT(*) FROM public.sesizare_comments c WHERE c.sesizare_id = s.id)::INT AS nr_comentarii,
    (SELECT COUNT(*) FROM public.sesizare_verifications ver
       WHERE ver.sesizare_id = s.id AND ver.agrees = true)::INT AS verif_da,
    (SELECT COUNT(*) FROM public.sesizare_verifications ver
       WHERE ver.sesizare_id = s.id AND ver.agrees = false)::INT AS verif_nu,
    (SELECT COUNT(*) FROM public.sesizare_follows f WHERE f.sesizare_id = s.id)::INT AS nr_followers,
    (SELECT COUNT(*) FROM public.sesizare_cosigners co WHERE co.sesizare_id = s.id)::INT AS nr_cosigners
  FROM public.sesizari s
  LEFT JOIN public.sesizare_votes v ON v.sesizare_id = s.id
  WHERE s.moderation_status = 'approved' AND s.publica = true
  GROUP BY s.id;

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

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 050 aplicata: sesizari_feed refresh cu coloanele noi.' AS status;
