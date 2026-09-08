INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('food-menu-images', 'food-menu-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY food_menu_images_public_read ON storage.objects FOR SELECT USING (bucket_id = 'food-menu-images');
CREATE POLICY food_menu_images_owner_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'food-menu-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY food_menu_images_owner_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'food-menu-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY food_menu_images_owner_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'food-menu-images' AND (storage.foldername(name))[1] = auth.uid()::text);
