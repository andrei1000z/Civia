-- Civia Chat per judet — thread anonim moderat de AI + admin.
-- Mesaje anonime (display_name optional), AI flag automatic pe slurs/PII,
-- pending review pe mesajele suspecte. Vizibile public dupa approved.

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county TEXT NOT NULL, -- 'B' / 'CJ' / etc.
  display_name TEXT,    -- optional, max 40 chars
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 2 AND 500),
  -- Moderation: 'auto_approved' / 'pending' / 'rejected' / 'approved'.
  moderation_status TEXT NOT NULL DEFAULT 'auto_approved'
    CHECK (moderation_status IN ('auto_approved', 'pending', 'rejected', 'approved')),
  -- AI flag reason (slur / pii / spam / ok).
  ai_flag TEXT DEFAULT 'ok',
  ip_hash TEXT,
  upvotes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_county_recent
  ON public.chat_messages (county, created_at DESC)
  WHERE moderation_status IN ('auto_approved', 'approved');

CREATE INDEX IF NOT EXISTS idx_chat_pending_review
  ON public.chat_messages (created_at DESC)
  WHERE moderation_status = 'pending';

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Vizibilitate publica doar pe mesaje approved (sau auto-approved).
DROP POLICY IF EXISTS "chat_select_approved" ON public.chat_messages;
CREATE POLICY "chat_select_approved"
  ON public.chat_messages FOR SELECT
  USING (moderation_status IN ('auto_approved', 'approved'));

-- Oricine poate posta (anonim). Logged users primesc user_id atasat
-- (din POST handler, nu prin RLS).
DROP POLICY IF EXISTS "chat_insert_anyone" ON public.chat_messages;
CREATE POLICY "chat_insert_anyone"
  ON public.chat_messages FOR INSERT
  WITH CHECK (true);

-- Admin moderation: poate vedea tot + update.
DROP POLICY IF EXISTS "chat_admin_all" ON public.chat_messages;
CREATE POLICY "chat_admin_all"
  ON public.chat_messages FOR ALL
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 046 aplicata: chat_messages.' AS status;
