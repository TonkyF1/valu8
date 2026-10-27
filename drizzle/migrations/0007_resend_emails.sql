CREATE TABLE public.email_log (
  template text NOT NULL,
  item_id uuid NOT NULL,
  recipient text NOT NULL,
  provider_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template, item_id)
);
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_suppressions (
  email text PRIMARY KEY,
  reason text NOT NULL DEFAULT 'unsubscribe',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_suppressions TO service_role;
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_followups ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.email_followups ADD COLUMN IF NOT EXISTS recipient text;

ALTER TABLE public.guest_marketing_consents ADD COLUMN IF NOT EXISTS guest_token_hash text;
ALTER TABLE public.guest_marketing_consents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.guest_marketing_consents SET email = lower(trim(email));
DELETE FROM public.guest_marketing_consents a USING public.guest_marketing_consents b
  WHERE a.email = b.email AND (a.consented_at < b.consented_at OR (a.consented_at = b.consented_at AND a.id < b.id));
CREATE UNIQUE INDEX IF NOT EXISTS guest_marketing_consents_email_key ON public.guest_marketing_consents (email);
DROP POLICY IF EXISTS "Anyone can record their own consent" ON public.guest_marketing_consents;
REVOKE INSERT ON public.guest_marketing_consents FROM anon, authenticated;