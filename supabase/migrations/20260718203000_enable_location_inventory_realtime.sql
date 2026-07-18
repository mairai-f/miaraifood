DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.location_inventory;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
