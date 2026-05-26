CREATE OR REPLACE FUNCTION public.has_beta_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 7
    ) first_seven
    WHERE first_seven.id = auth.uid()
  );
$function$;