-- 2026-05-29 — Agent Insistent schema (Big Feature #1)
--
-- Adauga columns + tabel pentru escalation pipeline:
--   sesizari.escalation_stage (0-3): 0=nimic, 1=reamintire 30zi, 2=AVP 45zi, 3=contencios 60zi
--   sesizari.escalation_last_at: timestamp ultima escalare
--   sesizare_escalations: audit trail al fiecărei escaladări

ALTER TABLE sesizari
  ADD COLUMN IF NOT EXISTS escalation_stage SMALLINT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS escalation_last_at TIMESTAMPTZ;

COMMENT ON COLUMN sesizari.escalation_stage IS
  'Stage de escalare automata Agent Insistent: 0=initial, 1=reamintire OG 27/2002 (zi 30), 2=AVP+Prefectura (zi 45), 3=template contencios (zi 60).';

CREATE TABLE IF NOT EXISTS sesizare_escalations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesizare_id UUID NOT NULL REFERENCES sesizari(id) ON DELETE CASCADE,
  stage SMALLINT NOT NULL,
  type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resend_message_id TEXT,
  recipients TEXT[],
  notes TEXT
);

COMMENT ON TABLE sesizare_escalations IS
  'Audit trail pentru Agent Insistent — fiecare escaladare e logata aici.';

CREATE INDEX IF NOT EXISTS idx_sesizare_escalations_sesizare_id
  ON sesizare_escalations(sesizare_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_sesizari_escalation_lookup
  ON sesizari(delivery_status, escalation_stage, sent_at)
  WHERE escalation_stage < 3;

-- RLS: admin + author cetatean
ALTER TABLE sesizare_escalations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'sesizare_escalations admin all'
  ) THEN
    CREATE POLICY "sesizare_escalations admin all" ON sesizare_escalations
      FOR ALL TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'sesizare_escalations author read'
  ) THEN
    CREATE POLICY "sesizare_escalations author read" ON sesizare_escalations
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM sesizari s
          WHERE s.id = sesizare_escalations.sesizare_id
            AND s.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END$$;
