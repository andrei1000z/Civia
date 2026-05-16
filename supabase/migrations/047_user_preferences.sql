-- Cross-device preferences: theme, cookie consent, dismissed prompts.
-- Inainte: tot in localStorage → schimba browser/device, repornesti zero.
-- Acum: persistat in DB, hydrate la login, sync write debounced.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT,
  ADD COLUMN IF NOT EXISTS cookie_consent JSONB,
  ADD COLUMN IF NOT EXISTS dismissed_prompts JSONB,
  ADD COLUMN IF NOT EXISTS preferences_updated_at TIMESTAMPTZ;

-- Theme constraint: doar 'light', 'dark', 'system' permise (sau NULL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_theme_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_valid
      CHECK (theme IS NULL OR theme IN ('light', 'dark', 'system'));
  END IF;
END $$;

-- cookie_consent shape:
--   {
--     "essential": true,
--     "preferences": false,
--     "analytics": true,
--     "marketing": false,
--     "acceptedAt": "2026-05-16T20:00:00Z"
--   }
--
-- dismissed_prompts shape:
--   {
--     "newsletter_nudge": "2026-05-16T20:00:00Z",
--     "install_prompt": "2026-05-16T20:00:00Z",
--     ...
--   }

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 047 aplicata: user preferences columns.' AS status;
