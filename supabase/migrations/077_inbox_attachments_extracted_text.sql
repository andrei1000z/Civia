-- ============================================================
-- Migration 077: Inbox attachments — extracted text + AI input audit
-- ============================================================
--
-- 2026-05-27 — Permite AI-ului să „vadă" conținutul atașamentelor
-- emailurilor primite de la autorități. Înainte: doar body_text se
-- trimitea la Groq Llama 3.3 → AI ignora PDF-urile atașate (60% din
-- răspunsurile primăriilor vin ca PDF cu body email gol/minim).
--
-- Pipeline nou (Sprint A-C):
--   1. Cloudflare Email Worker postal-mime → parse attachments + upload R2
--   2. /api/inbox/reply primește signed URLs + metadata
--   3. Routes attachments la extractors (unpdf, Gemini Vision, mammoth)
--   4. Concatenează extracted_text per attachment → ai_input_text
--   5. classifyReply(subject + ai_input_text) → status detection
--
-- Această migrare:
--   1. Adaugă ai_input_text coloana (audit: ce a văzut AI exact)
--   2. Documentează schema extinsă a attachments JSONB
--   3. Index full-text search pe textul extras (admin search „caută în PDF-uri")

-- ─── 1. ai_input_text — textul total trimis la AI ──────────────────
-- Stocăm textul concatenat (body_text + textele extrase din atașamente)
-- ca să avem audit complet: „de ce a clasificat AI așa?" Vizibil în
-- /admin/inbox/<reply_id>. Util și pentru re-classify dacă schimbăm
-- promptul AI fără să refacem toată extracția.

ALTER TABLE public.sesizare_replies
ADD COLUMN IF NOT EXISTS ai_input_text TEXT;

COMMENT ON COLUMN public.sesizare_replies.ai_input_text IS
'Textul exact pasat la classifyReply: body_text concatenat cu textele
extrase din atașamente (PDF, DOCX, imagini). Backward-compatible:
emailurile vechi (înainte de attachment pipeline) au valoarea NULL —
se asumă body_text era singura sursă. Permite re-clasificare fără a
re-rula extracția costisitoare (OCR).';

-- ─── 2. Schema îmbogățită attachments JSONB ────────────────────────
-- Coloana attachments e JSONB existent (m. 057). Schimbăm DOAR
-- formatul per-item, backward compatible (extragem cu IS DISTINCT FROM
-- NULL în UI). Nu mutăm date — UI tratează lipsa câmpurilor noi ca
-- legacy entries.
--
-- Format vechi (m. 057-076):
--   { filename, content_type, size }
--
-- Format nou (m. 077+):
--   {
--     filename: string,
--     content_type: string,           -- MIME validat (vs magic bytes)
--     size: number,                   -- bytes
--     r2_key: string | null,          -- key în bucket civia-inbox-attachments
--     extracted_text: string | null,  -- textul extras (max 50k chars)
--     extraction_method: 'unpdf' | 'gemini-vision-pdf' | 'gemini-vision-image'
--                      | 'mammoth-docx' | 'skipped' | 'failed',
--     extraction_ms: number,          -- ms total extracție
--     extraction_error: string | null -- err message dacă failed
--   }

COMMENT ON COLUMN public.sesizare_replies.attachments IS
'JSONB array. Schema 2026-05-27+: { filename, content_type, size, r2_key,
extracted_text, extraction_method, extraction_ms, extraction_error }.
Legacy entries (pre-077) au doar { filename, content_type, size }. R2
bucket = civia-inbox-attachments cu TTL 90 zile.';

-- ─── 3. Full-text search pe ai_input_text ──────────────────────────
-- Admin /admin/inbox poate căuta „autoritatea X confirmă...". Înainte
-- search-ul era doar pe body_text → ratam ce era în PDF. Acum prinde
-- și textul extras. Romanian language config pentru stemming.

CREATE INDEX IF NOT EXISTS idx_sesizare_replies_ai_input_search
  ON public.sesizare_replies
  USING gin (to_tsvector('romanian', COALESCE(ai_input_text, '')));

COMMENT ON INDEX idx_sesizare_replies_ai_input_search IS
'GIN index pentru full-text search Romanian pe ai_input_text. Folosit
de /admin/inbox pentru a căuta in conținutul răspunsurilor (inclusiv
PDF-urile decoded).';

-- ─── 4. Audit: cazuri legacy explicite ─────────────────────────────
-- Backfill semantic: replies vechi care au DOAR body_text au
-- ai_input_text = body_text. Reduce confusion în UI „de ce ai_input_text
-- e NULL pe răspunsuri existente?"

UPDATE public.sesizare_replies
SET ai_input_text = body_text
WHERE ai_input_text IS NULL
  AND body_text IS NOT NULL;

-- Note: NU stocăm ai_input_text dacă body_text e NULL — păstrăm NULL
-- ca să distingem „n-am avut nimic de procesat" vs „am procesat string gol".

-- ─── 5. Verificare integritate (informativ, nu blocking) ───────────
-- DO $$
-- DECLARE
--   v_replies_count INT;
--   v_with_input_count INT;
-- BEGIN
--   SELECT COUNT(*) INTO v_replies_count FROM public.sesizare_replies;
--   SELECT COUNT(*) INTO v_with_input_count FROM public.sesizare_replies
--     WHERE ai_input_text IS NOT NULL;
--   RAISE NOTICE 'sesizare_replies total: %, cu ai_input_text: %',
--     v_replies_count, v_with_input_count;
-- END $$;
