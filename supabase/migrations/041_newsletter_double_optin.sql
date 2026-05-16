-- Newsletter double opt-in: confirmed_at + confirm_token.
-- Existing rows = grandfathered (treat them as already-confirmed by setting
-- confirmed_at = created_at). New signups must click the confirm link to
-- become "confirmed".

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirm_token TEXT,
  ADD COLUMN IF NOT EXISTS confirm_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Grandfather existing subscribers — they signed up before double opt-in
-- existed, so don't kick them out. Per Romanian-GDPR best practice we
-- include an Unsubscribe link in every email regardless.
UPDATE newsletter_subscribers
  SET confirmed_at = COALESCE(confirmed_at, created_at)
  WHERE confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_confirm_token
  ON newsletter_subscribers (confirm_token)
  WHERE confirm_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_newsletter_confirmed_at
  ON newsletter_subscribers (confirmed_at)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 041 aplicata: newsletter double opt-in.' AS status;
