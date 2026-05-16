-- Co-semnare reală pentru sesizări publice.
-- Înainte de migrație, butonul „Trimite și tu" deschidea doar un mailto.
-- Acum cetățenii pot co-semna explicit, cu numele lor (sau anonim cu email),
-- iar primăria primește un email „N cetățeni co-semnează această sesizare".

CREATE TABLE IF NOT EXISTS public.sesizare_cosigners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesizare_id UUID NOT NULL REFERENCES public.sesizari(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  city TEXT,
  message TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un user logat poate co-semna o sesizare o singură dată.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cosigners_user_sesizare
  ON public.sesizare_cosigners (sesizare_id, user_id)
  WHERE user_id IS NOT NULL;

-- Pentru anonimi, dedup pe (sesizare_id, lower(email)) ca să nu se poată
-- spam acelasi email de mai multe ori.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cosigners_email_sesizare
  ON public.sesizare_cosigners (sesizare_id, lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cosigners_sesizare
  ON public.sesizare_cosigners (sesizare_id, created_at DESC);

ALTER TABLE public.sesizare_cosigners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cosigners_read_public" ON public.sesizare_cosigners;
CREATE POLICY "cosigners_read_public"
  ON public.sesizare_cosigners FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "cosigners_insert_anyone" ON public.sesizare_cosigners;
CREATE POLICY "cosigners_insert_anyone"
  ON public.sesizare_cosigners FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "cosigners_delete_own" ON public.sesizare_cosigners;
CREATE POLICY "cosigners_delete_own"
  ON public.sesizare_cosigners FOR DELETE
  USING (auth.uid() = user_id);

-- Expune count fără a expune identitățile prin RLS.
CREATE OR REPLACE FUNCTION public.cosigners_count(p_sesizare_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.sesizare_cosigners
  WHERE sesizare_id = p_sesizare_id;
$$;

-- Adauga nr_cosigners in feed-ul public.
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

-- Recreaza sesizari_similare RPC (dropped by CASCADE)
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

SELECT 'Migration 042 aplicata: sesizare_cosigners + view + RPC.' AS status;
