
-- Drop the broad SELECT policy on avatars — public URLs work without it
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;

-- Revoke execute on the new trigger function
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM anon, authenticated, PUBLIC;
