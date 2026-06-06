
CREATE POLICY "team_images_authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "team_images_authenticated_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'team-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "team_images_authenticated_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'team-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "team_images_authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'team-images');
