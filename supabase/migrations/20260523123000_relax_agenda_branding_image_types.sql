-- The app validates and normalizes images in the browser, then stores optimized WebP files.
-- Keep the bucket flexible so new browser-supported image formats are not rejected upstream.

UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = NULL
WHERE id = 'agenda-branding';
