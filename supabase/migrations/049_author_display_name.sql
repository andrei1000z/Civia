-- Author display name pe sesizari — pentru vizualizarea publica.
-- Inainte: peste tot apareau numele complete (din author_name) — GDPR
-- privacy issue + user request.
-- Acum: separam:
--   - author_name (numele COMPLET, trimis la primarie in email)
--   - author_display_name (NUMELE AFISAT public — display_name din profile,
--     sau primul cuvant din author_name daca user nu are cont)
--
-- Denormalizat ca sa evitam JOIN-uri pe lista de sesizari publice.
-- La schimbare display_name din /cont, se sincronizeaza prin trigger
-- sau prin update manual la PUT /api/profile (vezi src/app/api/profile/route.ts).

ALTER TABLE public.sesizari
  ADD COLUMN IF NOT EXISTS author_display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_sesizari_author_display
  ON public.sesizari (author_display_name)
  WHERE author_display_name IS NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 049 aplicata: author_display_name pe sesizari.' AS status;
