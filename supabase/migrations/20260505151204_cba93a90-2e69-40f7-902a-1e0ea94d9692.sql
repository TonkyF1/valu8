
-- Valuations table
CREATE TABLE public.valuations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  registration TEXT,
  mot_expiry DATE,
  service_notes TEXT,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  condition_score NUMERIC(3,1),
  private_value INTEGER,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own valuations" ON public.valuations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own valuations" ON public.valuations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own valuations" ON public.valuations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own valuations" ON public.valuations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX valuations_user_id_created_at_idx ON public.valuations (user_id, created_at DESC);

-- Storage bucket for vehicle photos
INSERT INTO storage.buckets (id, name, public) VALUES ('vehicle-photos', 'vehicle-photos', true);

CREATE POLICY "Public can view vehicle photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'vehicle-photos');
CREATE POLICY "Users upload own vehicle photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users update own vehicle photos" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "Users delete own vehicle photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'vehicle-photos' AND auth.uid()::text = (storage.foldername(name))[1]
  );
