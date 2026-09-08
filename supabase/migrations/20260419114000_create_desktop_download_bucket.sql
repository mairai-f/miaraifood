INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('desktop-downloads', 'desktop-downloads', false, 1073741824)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;
