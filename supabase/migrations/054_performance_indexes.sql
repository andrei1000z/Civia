-- ============================================================
-- PERFORMANCE INDEXES — Sprint 2.3
-- Data: 2026-05-20
-- ============================================================
-- listSesizari() filtreaza pe (moderation_status, publica, tip, sector,
-- status) — fara composite index = full table scan pe 200+ rows si va
-- creste expansiv. Add composite index pentru hot path.

CREATE INDEX IF NOT EXISTS idx_sesizari_filtering
  ON public.sesizari (moderation_status, publica, status, tip, sector)
  WHERE moderation_status = 'approved' AND publica = true;

-- Per-user lookup ordering (profil + cont page)
CREATE INDEX IF NOT EXISTS idx_sesizari_user_created
  ON public.sesizari (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- County + status filtering pentru /clasament-primarii
CREATE INDEX IF NOT EXISTS idx_sesizari_county_status
  ON public.sesizari (county, status)
  WHERE moderation_status = 'approved';

-- Stiri lookup by source + published date (feed pages)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stiri_cache'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_stiri_source_published ON public.stiri_cache (source, published_at DESC)';
  END IF;
END $$;

-- Comments per sesizare (detail page)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sesizare_comments'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_comments_sesizare_created ON public.sesizare_comments (sesizare_id, created_at DESC)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 054: performance indexes aplicata.' AS status;
