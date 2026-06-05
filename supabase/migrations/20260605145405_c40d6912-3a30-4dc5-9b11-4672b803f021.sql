
CREATE OR REPLACE FUNCTION public.enforce_signup_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap int := 13;
  current_count int;
BEGIN
  SELECT count(*) INTO current_count FROM auth.users;
  IF current_count >= cap THEN
    RAISE EXCEPTION 'Beta signups are full. All test spaces have been filled — thanks for your interest!'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_signup_cap_trigger ON auth.users;
CREATE TRIGGER enforce_signup_cap_trigger
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_signup_cap();
