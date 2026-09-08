ALTER TABLE public.delivery_driver_applications
  ADD COLUMN IF NOT EXISTS cnh_number text,
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS vehicle_model text,
  ADD COLUMN IF NOT EXISTS document_status text NOT NULL DEFAULT 'pending'
    CHECK (document_status IN ('pending','under_review','verified','rejected'));

CREATE TABLE IF NOT EXISTS public.delivery_driver_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.delivery_driver_applications(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('cnh_front','cnh_back','vehicle_document')),
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, document_type)
);

ALTER TABLE public.delivery_driver_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_driver_documents_admin_read ON public.delivery_driver_documents FOR SELECT TO authenticated USING (public.current_user_is_admin());
CREATE POLICY delivery_driver_documents_admin_update ON public.delivery_driver_documents FOR UPDATE TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());

INSERT INTO storage.buckets (id, name, public) VALUES ('driver-application-documents', 'driver-application-documents', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY driver_documents_admin_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'driver-application-documents' AND public.current_user_is_admin());
CREATE POLICY driver_documents_service_insert ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'driver-application-documents');
