-- Frontend uploads are normalized to WebP before reaching Storage.
-- Keep Storage restrictive while still accepting many source image formats in the UI.

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/webp']::text[]
WHERE id = 'agenda-branding';
