ALTER TABLE public.delivery_driver_applications
  ADD COLUMN IF NOT EXISTS establishment_invite_code text;
