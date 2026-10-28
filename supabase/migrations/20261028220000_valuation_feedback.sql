-- "Does this sound right?" feedback under a valuation result.
-- A signal for the Valu8 team only: nothing here feeds pricing.
-- One row per valuation (the owner's answer is updated, never duplicated).
-- Writes only through submit_valuation_feedback (security definer): the caller must own
-- the valuation, either signed in (auth.uid()) or as the guest whose token hashes to
-- valuations.guest_token_hash (same model as analyse-vehicle / claim-guest-valuations).
-- No public select; admins read through RLS or admin_valuation_feedback().

CREATE TABLE IF NOT EXISTS public.valuation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_id uuid NOT NULL REFERENCES public.valuations(id) ON DELETE CASCADE,
  verdict text CHECK (verdict IN ('too_low', 'about_right', 'too_high')),
  user_estimate integer CHECK (user_estimate BETWEEN 100 AND 500000),
  valu8_value integer,
  followup_opt_in boolean NOT NULL DEFAULT false,
  user_id uuid,
  guest_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valuation_feedback_valuation_key UNIQUE (valuation_id),
  CONSTRAINT valuation_feedback_has_answer CHECK (verdict IS NOT NULL OR user_estimate IS NOT NULL OR followup_opt_in)
);
CREATE INDEX IF NOT EXISTS valuation_feedback_created_idx ON public.valuation_feedback (created_at DESC);

ALTER TABLE public.valuation_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.valuation_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.valuation_feedback TO authenticated;
DROP POLICY IF EXISTS "Admins can read valuation feedback" ON public.valuation_feedback;
CREATE POLICY "Admins can read valuation feedback" ON public.valuation_feedback
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Returns the owner kind ('user' | 'guest') or raises when the caller does not own the valuation.
CREATE OR REPLACE FUNCTION public.valuation_feedback_owner(p_valuation_id uuid, p_guest_token text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v record;
BEGIN
  SELECT user_id, guest_token_hash INTO v FROM valuations WHERE id = p_valuation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF auth.uid() IS NOT NULL AND v.user_id = auth.uid() THEN RETURN 'user'; END IF;
  IF v.user_id IS NULL AND v.guest_token_hash IS NOT NULL
     AND p_guest_token ~ '^[a-f0-9]{64}$'
     AND v.guest_token_hash = encode(sha256(convert_to(p_guest_token, 'UTF8')), 'hex') THEN
    RETURN 'guest';
  END IF;
  RAISE EXCEPTION 'Not allowed';
END;
$function$;

-- Save (or update) the owner's feedback. NULL arguments keep the existing value.
CREATE OR REPLACE FUNCTION public.submit_valuation_feedback(
  p_valuation_id uuid,
  p_verdict text DEFAULT NULL,
  p_user_estimate integer DEFAULT NULL,
  p_followup_opt_in boolean DEFAULT NULL,
  p_guest_token text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner text := public.valuation_feedback_owner(p_valuation_id, p_guest_token);
  v record;
  f record;
BEGIN
  IF p_verdict IS NOT NULL AND p_verdict NOT IN ('too_low', 'about_right', 'too_high') THEN
    RAISE EXCEPTION 'Invalid verdict';
  END IF;
  IF p_user_estimate IS NOT NULL AND (p_user_estimate < 100 OR p_user_estimate > 500000) THEN
    RAISE EXCEPTION 'Enter a value between £100 and £500,000';
  END IF;
  SELECT user_id, guest_token_hash, private_value INTO v FROM valuations WHERE id = p_valuation_id;
  INSERT INTO valuation_feedback AS t (valuation_id, verdict, user_estimate, valu8_value, followup_opt_in, user_id, guest_token_hash)
  VALUES (p_valuation_id, p_verdict, p_user_estimate, v.private_value, coalesce(p_followup_opt_in, false),
          CASE WHEN owner = 'user' THEN auth.uid() END,
          CASE WHEN owner = 'guest' THEN v.guest_token_hash END)
  ON CONFLICT (valuation_id) DO UPDATE SET
    verdict = coalesce(EXCLUDED.verdict, t.verdict),
    user_estimate = coalesce(p_user_estimate, t.user_estimate),
    followup_opt_in = coalesce(p_followup_opt_in, t.followup_opt_in),
    user_id = coalesce(EXCLUDED.user_id, t.user_id),
    guest_token_hash = coalesce(EXCLUDED.guest_token_hash, t.guest_token_hash),
    updated_at = now()
  RETURNING verdict, user_estimate, followup_opt_in INTO f;
  RETURN json_build_object('verdict', f.verdict, 'user_estimate', f.user_estimate, 'followup_opt_in', f.followup_opt_in);
END;
$function$;

-- The owner's saved answer (or null), plus whether a guest already gave us an email for follow-ups.
CREATE OR REPLACE FUNCTION public.get_valuation_feedback(p_valuation_id uuid, p_guest_token text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner text := public.valuation_feedback_owner(p_valuation_id, p_guest_token);
  f record;
  has_email boolean := owner = 'user';
BEGIN
  IF owner = 'guest' THEN
    SELECT EXISTS (SELECT 1 FROM guest_marketing_consents c JOIN valuations v ON v.guest_token_hash = c.guest_token_hash
                   WHERE v.id = p_valuation_id AND c.marketing_opt_in) INTO has_email;
  END IF;
  SELECT verdict, user_estimate, followup_opt_in INTO f FROM valuation_feedback WHERE valuation_id = p_valuation_id;
  RETURN json_build_object(
    'feedback', CASE WHEN FOUND THEN json_build_object('verdict', f.verdict, 'user_estimate', f.user_estimate, 'followup_opt_in', f.followup_opt_in) END,
    'has_email', has_email);
END;
$function$;

-- Admin readiness dashboard: counts by verdict + recent answers.
CREATE OR REPLACE FUNCTION public.admin_valuation_feedback()
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN json_build_object(
    'total', (SELECT count(*) FROM valuation_feedback),
    'by_verdict', (SELECT coalesce(json_object_agg(k, n), '{}'::json) FROM (
        SELECT coalesce(verdict, 'none') AS k, count(*) AS n FROM valuation_feedback GROUP BY 1) t),
    'with_estimate', (SELECT count(*) FROM valuation_feedback WHERE user_estimate IS NOT NULL),
    'followup_opt_in', (SELECT count(*) FROM valuation_feedback WHERE followup_opt_in),
    'recent', (SELECT coalesce(json_agg(r ORDER BY r.updated_at DESC), '[]'::json) FROM (
        SELECT f.valuation_id, f.verdict, f.user_estimate, f.followup_opt_in, f.updated_at,
               coalesce(f.valu8_value, v.private_value) AS valu8_value,
               concat_ws(' ', v.year::text, v.make, v.model) AS car, v.mileage,
               (f.user_id IS NULL) AS guest
        FROM valuation_feedback f JOIN valuations v ON v.id = f.valuation_id
        ORDER BY f.updated_at DESC LIMIT 200) r)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.valuation_feedback_owner(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_valuation_feedback(uuid, text, integer, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_valuation_feedback(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_valuation_feedback() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_valuation_feedback(uuid, text, integer, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_valuation_feedback(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_valuation_feedback() TO authenticated;
