-- 2026-06-06 — Audit P0 #5: transparența semnăturilor de petiții.
--
-- Petițiile curate de pe Declic/Avaaz au un număr REAL de semnături pe site-ul
-- sursă. Civia ascundea complet acest număr (cetățeanul nu vedea momentum →
-- pierdere de încredere + conversie). Adăugăm 2 coloane ca să stocăm numărul
-- extern (sincronizat periodic din og:description) + timestamp-ul ultimei
-- sincronizări. Afișăm „N semnături (sursa) · pe Civia: M".
--
-- Idempotent. Rulează în Supabase SQL editor.

ALTER TABLE public.petitii
  ADD COLUMN IF NOT EXISTS external_signature_count INTEGER,
  ADD COLUMN IF NOT EXISTS last_external_sync_at TIMESTAMPTZ;

COMMENT ON COLUMN public.petitii.external_signature_count IS
  'Nr. de semnături raportat de site-ul sursă (Declic/Avaaz), sincronizat periodic. NULL = încă nesincronizat.';
COMMENT ON COLUMN public.petitii.last_external_sync_at IS
  'Când a fost extras ultima oară external_signature_count din sursă.';

NOTIFY pgrst, 'reload schema';
SELECT 'Migration 094: petitii.external_signature_count + last_external_sync_at.' AS status;
