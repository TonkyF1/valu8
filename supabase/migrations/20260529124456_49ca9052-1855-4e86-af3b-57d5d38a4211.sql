CREATE OR REPLACE FUNCTION public.has_beta_access()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT true;
$function$;