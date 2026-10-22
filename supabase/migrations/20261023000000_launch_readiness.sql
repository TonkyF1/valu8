-- Valu8 launch readiness: rate limits, admin roles, billing records.
-- Safe to re-run (idempotent where practical).

-- 1. Rate limiting (fixed window counters). Service-role only.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) can touch this table.

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key TEXT, p_window_seconds INTEGER, p_max INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits AS r (key, window_start, count)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO v_count;

  -- Opportunistic cleanup (~1% of calls).
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN v_count <= p_max;
END;
$$;
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- 2. Roles (admin). Grant with:
--    INSERT INTO public.user_roles (user_id, role) VALUES ('<auth user uuid>', 'admin');
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No insert/update/delete policies: roles are granted via SQL / service role only.

DROP POLICY IF EXISTS "Admins view all valuations" ON public.valuations;
CREATE POLICY "Admins view all valuations" ON public.valuations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Aggregate stats for the admin dashboard (admins only).
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN json_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'users_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'valuations', (SELECT count(*) FROM public.valuations),
    'valuations_24h', (SELECT count(*) FROM public.valuations WHERE created_at > now() - interval '24 hours'),
    'valuations_7d', (SELECT count(*) FROM public.valuations WHERE created_at > now() - interval '7 days'),
    'premium_users', (SELECT count(*) FROM public.profiles WHERE is_premium),
    'rate_limited_keys_24h', (SELECT count(DISTINCT key) FROM public.rate_limits rl
       WHERE rl.window_start > now() - interval '24 hours' AND rl.count > 20)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- 3. Billing (Stripe). Written only by the stripe-webhook function (service role).
CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  status TEXT,
  price_id TEXT,
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own billing" ON public.billing_customers;
CREATE POLICY "Users view own billing" ON public.billing_customers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all billing" ON public.billing_customers;
CREATE POLICY "Admins view all billing" ON public.billing_customers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
