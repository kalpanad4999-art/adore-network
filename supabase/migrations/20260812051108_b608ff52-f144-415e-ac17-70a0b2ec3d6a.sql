CREATE POLICY "Owner reads logo files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'studio-logos' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner reads background files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'studio-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);