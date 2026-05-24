-- ============================================================
-- Migration 072: Admin audit log
-- ============================================================
--
-- 2026-05-24 Faza 5 (security): Track all sensitive admin actions cu
-- user_id + timestamp + IP + diff (before→after). Forensics + compliance
-- (GDPR cere log audit pentru access la PII).
--
-- Folosire în cod:
--   import { logAdminAction } from "@/lib/audit";
--   await logAdminAction({
--     actorId: user.id,
--     action: "sesizare.moderate",
--     targetType: "sesizare",
--     targetId: sesizare.id,
--     before: { moderation_status: "pending" },
--     after:  { moderation_status: "approved" },
--     ip,
--     metadata: { note: "spam filter cleared" },
--   });
--
-- RLS: doar admin role can read. Insert e via service role.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Format: "{resource}.{verb}" — e.g. "sesizare.moderate",
  -- "petitie.delete", "user.role_change", "stire.featured".
  action TEXT NOT NULL,
  target_type TEXT,    -- "sesizare" / "petitie" / "stire" / "user" / etc.
  target_id TEXT,      -- UUID, code, slug — whatever IDs the resource
  before JSONB,        -- snapshot relevant fields ÎNAINTE de change
  after  JSONB,        -- snapshot relevant fields DUPĂ change
  ip TEXT,             -- client IP la momentul acțiunii
  user_agent TEXT,
  metadata JSONB       -- free-form note, e.g. {note: "spam cleanup"}
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_time
  ON public.admin_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action_time
  ON public.admin_audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target
  ON public.admin_audit_log (target_type, target_id, created_at DESC);

-- RLS — doar admin can read.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin can read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert e exclusiv prin service role (bypass RLS). Niciun policy de insert.

COMMENT ON TABLE public.admin_audit_log IS
  'Faza 5 — log audit pentru acțiuni admin sensibile. Read-only pentru admin role. Insert via service role.';

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 072: admin_audit_log creat.' AS status;
