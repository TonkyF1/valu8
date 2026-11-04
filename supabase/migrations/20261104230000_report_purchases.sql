-- Valu8 — one-off £2.99 Full Valuation Report purchases (Stripe Embedded Checkout).
-- Written ONLY by the stripe-webhook edge function (service role). No insert/update/delete
-- policies exist, so anon/authenticated clients can never mark a report as paid.
CREATE TABLE IF NOT EXISTS public.report_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_id uuid NOT NULL REFERENCES public.valuations(id) ON DELETE CASCADE,
  registration text,
  stripe_session_id text NOT NULL UNIQUE,          -- idempotency key (webhook retries)
  stripe_payment_intent_id text,
  price_id text,
  amount_total integer,
  currency text,
  customer_email text,
  status text NOT NULL DEFAULT 'paid',
  livemode boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_purchases_valuation_idx ON public.report_purchases (valuation_id);

ALTER TABLE public.report_purchases ENABLE ROW LEVEL SECURITY;

-- Signed-in owners may read purchases for their own valuations (guests read via the
-- report-entitlement edge function, which uses the service role).
DROP POLICY IF EXISTS "Owners read own report purchases" ON public.report_purchases;
CREATE POLICY "Owners read own report purchases" ON public.report_purchases
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.valuations v WHERE v.id = valuation_id AND v.user_id = auth.uid()));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.report_purchases FROM anon, authenticated;
REVOKE ALL ON public.report_purchases FROM anon;
GRANT ALL ON public.report_purchases TO service_role;
