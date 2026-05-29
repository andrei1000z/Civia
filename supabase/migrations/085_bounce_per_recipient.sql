-- 2026-05-29 — Per-recipient bounce tracking
--
-- Context: Resend webhook arunca email-uri cu 4 destinatari (PMB + sector +
-- Brigada Rutiera + Politia Locala). Cand 1-2 din 4 fac bounce, intregul
-- email_id e marked "bounced" → utilizatorul crede ca sesizarea NU a ajuns.
-- In realitate, PMB + sectorul primesc OK si CHIAR RASPUND cu numar de
-- inregistrare (vezi sesizare_replies pe sesizarile 50, 51, 52).
--
-- Aceasta migrare adauga 2 coloane noi:
--   • bounced_recipients TEXT[] — adresele exacte care au facut bounce
--     (extrase din event.data.bounced_recipients in webhook Resend)
--   • bounce_raw JSONB — payload-ul brut al bounce event pentru audit
--     forensic (cazuri cand vrem sa stim diagnosticul SMTP exact)
--
-- Plus: relaxez semantica delivery_status:
--   • "delivered" = TOATE destinatarii primesc
--   • "partial_bounced" = unele bounce + cel putin 1 delivered
--   • "bounced" = TOATE fail
--
-- Migrare idempotenta — safe sa ruleze de mai multe ori.

ALTER TABLE sesizari
  ADD COLUMN IF NOT EXISTS bounced_recipients TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bounce_raw JSONB DEFAULT NULL;

COMMENT ON COLUMN sesizari.bounced_recipients IS
  'Per-recipient bounce list. NULL = no bounce. Subset of sent_to_emails.';

COMMENT ON COLUMN sesizari.bounce_raw IS
  'Raw Resend bounce event for forensic audit (SMTP response, bounce sub_type).';

-- Index partial pentru queries gen „arata-mi toate sesizarile cu bounce"
CREATE INDEX IF NOT EXISTS idx_sesizari_bounced_recipients
  ON sesizari USING GIN (bounced_recipients)
  WHERE bounced_recipients IS NOT NULL;
