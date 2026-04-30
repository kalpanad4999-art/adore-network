-- Add background image and payments PIN to studio settings
ALTER TABLE public.studio_settings
  ADD COLUMN IF NOT EXISTS background_url TEXT,
  ADD COLUMN IF NOT EXISTS payments_pin_hash TEXT;

-- Public storage bucket for app backgrounds
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-backgrounds', 'studio-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for studio-backgrounds bucket
CREATE POLICY "Public can view studio backgrounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'studio-backgrounds');

CREATE POLICY "Owners upload their own backgrounds"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'studio-backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners update their own backgrounds"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'studio-backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Owners delete their own backgrounds"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'studio-backgrounds'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );