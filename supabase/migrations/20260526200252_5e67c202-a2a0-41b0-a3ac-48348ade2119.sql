
CREATE OR REPLACE FUNCTION public.has_beta_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 5
    ) first_five
    WHERE first_five.id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.beta_signup_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM auth.users;
$$;

GRANT EXECUTE ON FUNCTION public.has_beta_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.beta_signup_count() TO authenticated, anon;
