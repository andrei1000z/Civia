-- 065_stiri_media.sql
-- Extra media (toate pozele + videourile din articolul original) pentru
-- afișare ca galerie/carusel sub sinteza AI pe /stiri/[id].
--
-- Shape JSONB (array de obiecte):
--   [
--     {
--       type: "image" | "video",
--       url: "https://...",
--       caption?: "alt sau figcaption text",
--       poster?: "https://..."   -- doar pentru video, preview frame
--     },
--     ...
--   ]
--
-- Populat la fetch RSS în src/lib/stiri/rss.ts (după fetchOgImage).
-- Backfill via scripts/backfill-stire-media.ts pentru articolele existente.

ALTER TABLE public.stiri_cache
  ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.stiri_cache.media IS
  'Array cu toate pozele + videourile din articol. Shape: [{type,url,caption?,poster?}]. Folosit pentru carusel pe /stiri/[id].';

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 065 aplicata: stiri_cache.media JSONB.' AS status;
