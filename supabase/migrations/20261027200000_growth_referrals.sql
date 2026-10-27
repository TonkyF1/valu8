-- Growth: referral links, sign-up attribution and an admin-only growth/outcome counter.
-- Free only: no rewards, no charging. Nothing here is readable by anon; users only
-- see their own code and a count of friends who joined.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS signup_attribution jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx
  ON public.profiles (referred_by) WHERE referred_by IS NOT NULL;

-- Users cannot set referral fields directly; only the RPCs below (which set
-- valu8.trusted for their own transaction) or service_role can.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role (edge functions, admin) to change anything
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_premium IS DISTINCT FROM OLD.is_premium THEN
    RAISE EXCEPTION 'Field is_premium cannot be modified by the user';
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'Field plan cannot be modified by the user';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Field user_id cannot be modified';
  END IF;
  IF coalesce(current_setting('valu8.trusted', true), '') <> '1' AND (
       NEW.referral_code IS DISTINCT FROM OLD.referral_code
    OR NEW.referred_by IS DISTINCT FROM OLD.referred_by
    OR NEW.signup_attribution IS DISTINCT FROM OLD.signup_attribution) THEN
    RAISE EXCEPTION 'Referral fields cannot be modified by the user';
  END IF;
  RETURN NEW;
END;
$function$;

-- The signed-in user's referral code (created on first call) and how many friends joined with it.
CREATE OR REPLACE FUNCTION public.my_referral()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  code text;
  tries int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT referral_code INTO code FROM profiles WHERE user_id = uid;
  IF code IS NULL THEN
    PERFORM set_config('valu8.trusted', '1', true);
    LOOP
      tries := tries + 1;
      BEGIN
        UPDATE profiles SET referral_code = substr(md5(gen_random_uuid()::text), 1, 8)
          WHERE user_id = uid AND referral_code IS NULL;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        IF tries > 5 THEN RAISE; END IF;
      END;
    END LOOP;
    PERFORM set_config('valu8.trusted', '', true);
    SELECT referral_code INTO code FROM profiles WHERE user_id = uid;
  END IF;
  RETURN json_build_object(
    'code', code,
    'joined', (SELECT count(*) FROM profiles WHERE referred_by = uid)
  );
END;
$function$;

-- Called once by the client after sign-in. Records who referred a NEW account and its
-- first-touch UTM source. Only fills empty fields, only for accounts < 3 days old.
CREATE OR REPLACE FUNCTION public.record_signup_source(p_ref text, p_first_touch jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  referrer uuid;
  ft jsonb;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  IF p_ref IS NOT NULL AND p_ref ~ '^[a-z0-9]{6,16}$' THEN
    SELECT user_id INTO referrer FROM profiles WHERE referral_code = p_ref AND user_id <> uid;
  END IF;
  IF p_first_touch IS NOT NULL AND jsonb_typeof(p_first_touch) = 'object' THEN
    SELECT jsonb_object_agg(key, left(value #>> '{}', 100)) INTO ft
      FROM jsonb_each(p_first_touch)
      WHERE key IN ('utm_source','utm_medium','utm_campaign','referrer','landing_path','first_seen','ref')
        AND jsonb_typeof(value) = 'string';
  END IF;
  IF referrer IS NULL AND ft IS NULL THEN RETURN; END IF;
  PERFORM set_config('valu8.trusted', '1', true);
  UPDATE profiles SET
      referred_by = coalesce(referred_by, referrer),
      signup_attribution = coalesce(signup_attribution, ft)
    WHERE user_id = uid AND created_at > now() - interval '3 days';
  PERFORM set_config('valu8.trusted', '', true);
END;
$function$;

-- Internal growth + outcome counter for the admin readiness dashboard.
CREATE OR REPLACE FUNCTION public.admin_growth_stats()
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN json_build_object(
    'outcomes_total', (SELECT count(*) FROM check_outcomes),
    'outcomes_priced', (SELECT count(*) FROM check_outcomes WHERE outcome_price IS NOT NULL),
    'outcomes_7d', (SELECT count(*) FROM check_outcomes WHERE recorded_at > now() - interval '7 days'),
    'outcomes_30d', (SELECT count(*) FROM check_outcomes WHERE recorded_at > now() - interval '30 days'),
    'outcomes_by_type', (SELECT coalesce(json_object_agg(k, n), '{}'::json) FROM (
        SELECT coalesce(kind, '?') || ' / ' || coalesce(outcome_type, '?') AS k, count(*) AS n
        FROM check_outcomes GROUP BY 1) t),
    'readiness_outcomes', (SELECT count(*) FROM readiness_outcomes),
    'signups_7d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '7 days'),
    'signups_30d', (SELECT count(*) FROM profiles WHERE created_at > now() - interval '30 days'),
    'referred_signups', (SELECT count(*) FROM profiles WHERE referred_by IS NOT NULL),
    'referrers_with_code', (SELECT count(*) FROM profiles WHERE referral_code IS NOT NULL),
    'signups_by_source_30d', (SELECT coalesce(json_agg(json_build_object('source', src, 'n', n) ORDER BY n DESC), '[]'::json) FROM (
        SELECT coalesce(nullif(signup_attribution->>'utm_source', ''),
                        CASE WHEN referred_by IS NOT NULL THEN 'referral' END,
                        nullif(signup_attribution->>'referrer', ''),
                        CASE WHEN signup_attribution IS NULL THEN 'unknown' ELSE 'direct' END) AS src,
               count(*) AS n
        FROM profiles WHERE created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 15) t)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.my_referral() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_signup_source(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_growth_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_signup_source(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_growth_stats() TO authenticated;
