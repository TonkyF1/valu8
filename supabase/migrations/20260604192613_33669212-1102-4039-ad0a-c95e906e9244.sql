-- Drop any existing public/legacy policies on the vehicle-photos bucket
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (policyname ILIKE '%vehicle-photos%' OR policyname ILIKE '%vehicle photos%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Owner-scoped policies: users can only access their own folder (<userId>/...)
CREATE POLICY "vehicle-photos owner select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "vehicle-photos owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "vehicle-photos owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "vehicle-photos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]);