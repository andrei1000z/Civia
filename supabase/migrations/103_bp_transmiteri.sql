-- ============================================================
-- Migration 103: jurnalul transmiterilor formale BP (FAZA 4 it.2)
-- ============================================================
-- 2026-06-12 — automatizarea transmiterii topului „Prioritățile orașului":
-- cron lunar (ziua 1) compilează top 5 per județ (dacă pragul de voturi e
-- atins) într-o adresă formală OG 27/2002 și o trimite primăriei reședinței
-- de județ. Acest tabel = jurnal public + idempotență (max 1/lună/județ).
-- Idempotentă.

CREATE TABLE IF NOT EXISTS public.bp_transmiteri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipients TEXT[] NOT NULL,
  total_votes INTEGER NOT NULL,
  propuneri_snapshot JSONB NOT NULL,
  resend_message_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_bp_transmiteri_county ON public.bp_transmiteri (county, sent_at DESC);

ALTER TABLE public.bp_transmiteri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bp_transmiteri_select_public ON public.bp_transmiteri;
CREATE POLICY bp_transmiteri_select_public ON public.bp_transmiteri FOR SELECT USING (true);

COMMENT ON TABLE public.bp_transmiteri IS 'Jurnalul adreselor formale „Prioritățile orașului" trimise primăriilor (transparență + idempotență lunară).';
