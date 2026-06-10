-- ============================================================
-- Migration 100: consimțământ explicit co-semnatari (conformitate UE)
-- ============================================================
--
-- GDPR Art. 7 (accountability) + EDPB 05/2020: când un co-semnatar trimite
-- nume+adresă către autoritate, trebuie să bifeze un consimțământ explicit, iar
-- noi trebuie să putem DOVEDI consimțământul. Stocăm momentul (consent_at).
--
-- NULL = co-semnatar de DINAINTE de checkbox (legacy). Job-ul de purge
-- (/api/cron/purge-retention) anonimizează email+ip_hash pentru rândurile
-- legacy fără consimțământ ale căror sesizări sunt închise de >90 zile.

ALTER TABLE public.sesizare_cosigners
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sesizare_cosigners.consent_at IS
  'GDPR Art. 7 — momentul consimțământului explicit la co-semnare. NULL = legacy (pre-checkbox).';

SELECT 'Migration 100 (cosigner consent_at) aplicată.' AS status;
