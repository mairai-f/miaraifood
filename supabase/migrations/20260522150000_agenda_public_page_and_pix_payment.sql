-- Public page branding fields, Pix manual payment confirmation, branding storage.

ALTER TABLE public.agenda_business_settings
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS about_image_url text,
  ADD COLUMN IF NOT EXISTS team_image_url text,
  ADD COLUMN IF NOT EXISTS location_image_url text,
  ADD COLUMN IF NOT EXISTS hero_title text,
  ADD COLUMN IF NOT EXISTS hero_subtitle text,
  ADD COLUMN IF NOT EXISTS closed_message text NOT NULL DEFAULT 'Estamos fechados no momento. Volte em breve!',
  ADD COLUMN IF NOT EXISTS about_title text,
  ADD COLUMN IF NOT EXISTS about_text text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS admin_whatsapp text,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_merchant_name text;

CREATE OR REPLACE FUNCTION public.confirm_agenda_appointment_payment(p_appointment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.appointments%ROWTYPE;
BEGIN
  SELECT *
  INTO target
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado';
  END IF;

  IF NOT public.agenda_owner_can_manage(target.store_account_id, target.owner_user_id) THEN
    RAISE EXCEPTION 'Sem permissao para confirmar pagamento';
  END IF;

  UPDATE public.appointments
  SET
    payment_status = 'paid',
    updated_at = now()
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_agenda_appointment_payment(uuid) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agenda-branding',
  'agenda-branding',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "agenda branding public read" ON storage.objects;
CREATE POLICY "agenda branding public read"
ON storage.objects
FOR SELECT
USING (bucket_id = 'agenda-branding');

DROP POLICY IF EXISTS "agenda branding owner upload" ON storage.objects;
CREATE POLICY "agenda branding owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'agenda-branding'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "agenda branding owner update" ON storage.objects;
CREATE POLICY "agenda branding owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'agenda-branding'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'agenda-branding'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "agenda branding owner delete" ON storage.objects;
CREATE POLICY "agenda branding owner delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'agenda-branding'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
