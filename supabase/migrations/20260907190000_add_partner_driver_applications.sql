-- Pré-cadastros públicos: não criam contas ativas até aprovação administrativa.
CREATE TABLE IF NOT EXISTS public.representative_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 3 AND 160),
  email text NOT NULL CHECK (char_length(btrim(email)) <= 254),
  phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 8 AND 32),
  cpf text NOT NULL CHECK (char_length(regexp_replace(cpf, '\\D', '', 'g')) = 11),
  city text NOT NULL,
  state text NOT NULL CHECK (char_length(state) = 2),
  applicant_type text NOT NULL CHECK (applicant_type IN ('individual', 'company')),
  sales_experience boolean NOT NULL DEFAULT false,
  segments text[] NOT NULL DEFAULT '{}',
  experience text,
  terms_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','info_requested','approved','rejected','cancelled')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_driver_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 3 AND 160),
  email text NOT NULL CHECK (char_length(btrim(email)) <= 254),
  phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 8 AND 32),
  cpf text NOT NULL CHECK (char_length(regexp_replace(cpf, '\\D', '', 'g')) = 11),
  city text NOT NULL,
  state text NOT NULL CHECK (char_length(state) = 2),
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('motorcycle','car','bicycle','other')),
  establishment_id uuid REFERENCES public.store_accounts(id) ON DELETE SET NULL,
  terms_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','info_requested','approved','rejected','cancelled')),
  review_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS representative_applications_status_idx ON public.representative_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS delivery_driver_applications_status_idx ON public.delivery_driver_applications(status, created_at DESC);

ALTER TABLE public.representative_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_driver_applications ENABLE ROW LEVEL SECURITY;

-- Inserção pública limitada aos campos do formulário; leitura/revisão somente por admins.
DROP POLICY IF EXISTS representative_applications_public_insert ON public.representative_applications;
CREATE POLICY representative_applications_public_insert ON public.representative_applications FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
DROP POLICY IF EXISTS delivery_driver_applications_public_insert ON public.delivery_driver_applications;
CREATE POLICY delivery_driver_applications_public_insert ON public.delivery_driver_applications FOR INSERT TO anon, authenticated WITH CHECK (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);

DROP POLICY IF EXISTS representative_applications_admin_read ON public.representative_applications;
CREATE POLICY representative_applications_admin_read ON public.representative_applications FOR SELECT TO authenticated USING (public.current_user_is_admin());
DROP POLICY IF EXISTS delivery_driver_applications_admin_read ON public.delivery_driver_applications;
CREATE POLICY delivery_driver_applications_admin_read ON public.delivery_driver_applications FOR SELECT TO authenticated USING (public.current_user_is_admin());

DROP POLICY IF EXISTS representative_applications_admin_update ON public.representative_applications;
CREATE POLICY representative_applications_admin_update ON public.representative_applications FOR UPDATE TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());
DROP POLICY IF EXISTS delivery_driver_applications_admin_update ON public.delivery_driver_applications;
CREATE POLICY delivery_driver_applications_admin_update ON public.delivery_driver_applications FOR UPDATE TO authenticated USING (public.current_user_is_admin()) WITH CHECK (public.current_user_is_admin());
