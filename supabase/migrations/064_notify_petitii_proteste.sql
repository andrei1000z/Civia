-- 064_notify_petitii_proteste.sql
-- Granular opt-ins pentru notificări: 3 surse × 2 canale = 6 toggle-uri.
--   Newsletter (săptămânal):    newsletter_email_optin (deja există migr 022)
--                                newsletter_sms_optin   (deja există migr 022)
--   Petiții (când apar):        notify_petitii_email, notify_petitii_sms
--   Proteste (când apar):       notify_proteste_email, notify_proteste_sms
-- Default: false. User-ul opt-in explicit din /cont.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_petitii_email BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_petitii_sms BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_proteste_email BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notify_proteste_sms BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.notify_petitii_email IS
  'Explicit GDPR consent — email când apare o petiție nouă pe Civia. Default false.';
COMMENT ON COLUMN public.profiles.notify_petitii_sms IS
  'Explicit GDPR consent — SMS când apare o petiție nouă. Default false; cere phone non-null.';
COMMENT ON COLUMN public.profiles.notify_proteste_email IS
  'Explicit GDPR consent — email când e aprobat un protest nou. Default false.';
COMMENT ON COLUMN public.profiles.notify_proteste_sms IS
  'Explicit GDPR consent — SMS când e aprobat un protest nou. Default false; cere phone non-null.';

CREATE INDEX IF NOT EXISTS idx_profiles_notify_petitii_email ON public.profiles(notify_petitii_email) WHERE notify_petitii_email = true;
CREATE INDEX IF NOT EXISTS idx_profiles_notify_petitii_sms ON public.profiles(notify_petitii_sms) WHERE notify_petitii_sms = true;
CREATE INDEX IF NOT EXISTS idx_profiles_notify_proteste_email ON public.profiles(notify_proteste_email) WHERE notify_proteste_email = true;
CREATE INDEX IF NOT EXISTS idx_profiles_notify_proteste_sms ON public.profiles(notify_proteste_sms) WHERE notify_proteste_sms = true;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 064 aplicata: granular notify opt-ins.' AS status;
