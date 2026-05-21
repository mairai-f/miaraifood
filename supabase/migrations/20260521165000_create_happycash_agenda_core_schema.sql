-- Bring the operational HappyCash Agenda schema into the canonical HappyCash Supabase project.
-- This migration is intentionally additive for shared HappyCash tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'client', 'barber');
  END IF;
END $$;

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'barber';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
    CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'completed', 'cancelled');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.profiles
SET full_name = COALESCE(NULLIF(full_name, ''), NULLIF(username, ''), email)
WHERE full_name IS NULL OR full_name = '';

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metadata_role text;
  metadata_owner_user_id uuid;
  metadata_created_by_user_id uuid;
  metadata_full_name text;
  metadata_phone text;
BEGIN
  metadata_role := CASE
    WHEN lower(COALESCE(NEW.raw_user_meta_data->>'role', 'admin')) = 'operator' THEN 'operator'
    ELSE 'admin'
  END;

  metadata_owner_user_id := NULLIF(NEW.raw_user_meta_data->>'owner_user_id', '')::uuid;
  metadata_created_by_user_id := NULLIF(NEW.raw_user_meta_data->>'created_by_user_id', '')::uuid;
  metadata_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email);
  metadata_phone := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '');

  INSERT INTO public.profiles (
    user_id,
    username,
    email,
    role,
    owner_user_id,
    created_by_user_id,
    full_name,
    phone
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email),
    NEW.email,
    metadata_role,
    COALESCE(metadata_owner_user_id, NEW.id),
    metadata_created_by_user_id,
    metadata_full_name,
    metadata_phone
  );

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
    OR (
      _role = 'admin'::public.app_role
      AND EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = _user_id
          AND role = 'admin'
      )
    )
$$;

DROP POLICY IF EXISTS "agenda user roles own read" ON public.user_roles;
CREATE POLICY "agenda user roles own read"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda user roles admin manage" ON public.user_roles;
CREATE POLICY "agenda user roles admin manage"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  photo_url text,
  bio text,
  commission numeric NOT NULL DEFAULT 0,
  username text UNIQUE,
  password_hash text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30,
  price numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text,
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  appointment_date date NOT NULL,
  appointment_time time NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  payment_method text DEFAULT 'local' CHECK (payment_method IN ('local', 'pix') OR payment_method IS NULL),
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid') OR payment_status IS NULL),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  added_by_barber boolean NOT NULL DEFAULT false,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '19:30',
  is_open boolean NOT NULL DEFAULT true,
  UNIQUE(day_of_week)
);

INSERT INTO public.business_hours (day_of_week, open_time, close_time, is_open)
VALUES
  (0, '09:00', '19:30', false),
  (1, '09:00', '19:30', true),
  (2, '09:00', '19:30', true),
  (3, '09:00', '19:30', true),
  (4, '09:00', '19:30', true),
  (5, '09:00', '19:30', true),
  (6, '09:00', '19:30', true)
ON CONFLICT (day_of_week) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.business_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision,
  longitude double precision,
  google_maps_embed_url text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  goal_count integer NOT NULL DEFAULT 10,
  reward_description text NOT NULL DEFAULT 'Servico gratis',
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loyalty_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text,
  current_count integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  reward_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.clients
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN phone SET DEFAULT '';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.products ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointment_services_appointment
  ON public.appointment_services(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointment_services_service
  ON public.appointment_services(service_id);

ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.barbers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_progress FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda public active barbers" ON public.barbers;
CREATE POLICY "agenda public active barbers"
ON public.barbers
FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role) OR user_id = auth.uid());

DROP POLICY IF EXISTS "agenda admins manage barbers" ON public.barbers;
CREATE POLICY "agenda admins manage barbers"
ON public.barbers
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda public active services" ON public.services;
CREATE POLICY "agenda public active services"
ON public.services
FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda admins manage services" ON public.services;
CREATE POLICY "agenda admins manage services"
ON public.services
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda users view own appointments" ON public.appointments;
CREATE POLICY "agenda users view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  auth.uid() = client_id
  OR auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.barbers
    WHERE barbers.id = appointments.barber_id
      AND barbers.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "agenda users create appointments" ON public.appointments;
CREATE POLICY "agenda users create appointments"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "agenda users update own appointments" ON public.appointments;
CREATE POLICY "agenda users update own appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = client_id
  OR auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.barbers
    WHERE barbers.id = appointments.barber_id
      AND barbers.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = client_id
  OR auth.uid() = created_by
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.barbers
    WHERE barbers.id = appointments.barber_id
      AND barbers.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "agenda admins delete appointments" ON public.appointments;
CREATE POLICY "agenda admins delete appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda appointment services readable" ON public.appointment_services;
CREATE POLICY "agenda appointment services readable"
ON public.appointment_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND (
        a.client_id = auth.uid()
        OR a.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR EXISTS (
          SELECT 1
          FROM public.barbers b
          WHERE b.id = a.barber_id
            AND b.user_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS "agenda appointment services admins manage" ON public.appointment_services;
CREATE POLICY "agenda appointment services admins manage"
ON public.appointment_services
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda public business hours" ON public.business_hours;
CREATE POLICY "agenda public business hours"
ON public.business_hours
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "agenda admins manage business hours" ON public.business_hours;
CREATE POLICY "agenda admins manage business hours"
ON public.business_hours
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda public active locations" ON public.business_locations;
CREATE POLICY "agenda public active locations"
ON public.business_locations
FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda admins manage locations" ON public.business_locations;
CREATE POLICY "agenda admins manage locations"
ON public.business_locations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda public active loyalty programs" ON public.loyalty_programs;
CREATE POLICY "agenda public active loyalty programs"
ON public.loyalty_programs
FOR SELECT
USING (is_active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda admins manage loyalty programs" ON public.loyalty_programs;
CREATE POLICY "agenda admins manage loyalty programs"
ON public.loyalty_programs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda authenticated loyalty progress read" ON public.loyalty_progress;
CREATE POLICY "agenda authenticated loyalty progress read"
ON public.loyalty_progress
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "agenda admins manage loyalty progress" ON public.loyalty_progress;
CREATE POLICY "agenda admins manage loyalty progress"
ON public.loyalty_progress
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_barbers_updated_at ON public.barbers;
CREATE TRIGGER update_barbers_updated_at
BEFORE UPDATE ON public.barbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_updated_at ON public.services;
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_locations_updated_at ON public.business_locations;
CREATE TRIGGER update_business_locations_updated_at
BEFORE UPDATE ON public.business_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_programs_updated_at ON public.loyalty_programs;
CREATE TRIGGER update_loyalty_programs_updated_at
BEFORE UPDATE ON public.loyalty_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_loyalty_progress_updated_at ON public.loyalty_progress;
CREATE TRIGGER update_loyalty_progress_updated_at
BEFORE UPDATE ON public.loyalty_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.authenticate_barber(p_username text, p_password text)
RETURNS TABLE(barber_id uuid, barber_name text, user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.name, b.user_id
  FROM public.barbers b
  WHERE b.username = p_username
    AND b.password_hash = crypt(p_password, b.password_hash)
    AND b.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_barber_password(p_barber_id uuid, p_username text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.barbers
  SET
    username = p_username,
    password_hash = crypt(p_password, gen_salt('bf'))
  WHERE id = p_barber_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.appointment_total_duration_minutes(p_appointment_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(s.duration_minutes, 0)
    + COALESCE((
      SELECT SUM(s2.duration_minutes)
      FROM public.appointment_services aps
      JOIN public.services s2 ON s2.id = aps.service_id
      WHERE aps.appointment_id = p_appointment_id
    ), 0)
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE a.id = p_appointment_id
$$;

CREATE OR REPLACE FUNCTION public.assert_no_appointment_overlap(
  p_barber_id uuid,
  p_appointment_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_ignore_appointment_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  new_start_min integer;
  new_end_min integer;
  conflict_id uuid;
BEGIN
  IF p_barber_id IS NULL OR p_appointment_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Dados insuficientes para validar horario.';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'Duracao invalida para validar horario.';
  END IF;

  new_start_min := FLOOR(EXTRACT(EPOCH FROM p_start_time) / 60);
  new_end_min := new_start_min + p_duration_minutes;

  SELECT a.id
  INTO conflict_id
  FROM public.appointments a
  WHERE a.barber_id = p_barber_id
    AND a.appointment_date = p_appointment_date
    AND a.status = 'scheduled'
    AND (p_ignore_appointment_id IS NULL OR a.id <> p_ignore_appointment_id)
    AND (
      new_start_min < (FLOOR(EXTRACT(EPOCH FROM a.appointment_time) / 60) + public.appointment_total_duration_minutes(a.id))
      AND new_end_min > FLOOR(EXTRACT(EPOCH FROM a.appointment_time) / 60)
    )
  LIMIT 1;

  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Horario indisponivel: ja existe outro agendamento neste intervalo.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_appointments_prevent_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  duration_min integer;
  extras_min integer;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(duration_minutes, 0)
  INTO duration_min
  FROM public.services
  WHERE id = NEW.service_id;

  SELECT COALESCE(SUM(s2.duration_minutes), 0)
  INTO extras_min
  FROM public.appointment_services aps
  JOIN public.services s2 ON s2.id = aps.service_id
  WHERE aps.appointment_id = NEW.id;

  duration_min := COALESCE(duration_min, 0) + COALESCE(extras_min, 0);

  PERFORM public.assert_no_appointment_overlap(
    NEW.barber_id,
    NEW.appointment_date,
    NEW.appointment_time,
    duration_min,
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_overlap_on_appointments ON public.appointments;
CREATE TRIGGER prevent_overlap_on_appointments
BEFORE INSERT OR UPDATE OF barber_id, appointment_date, appointment_time, service_id, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trg_appointments_prevent_overlap();

CREATE OR REPLACE FUNCTION public.trg_appointment_services_prevent_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  apt_id uuid;
  a record;
  duration_min integer;
BEGIN
  apt_id := COALESCE(NEW.appointment_id, OLD.appointment_id);

  SELECT id, barber_id, appointment_date, appointment_time, status
  INTO a
  FROM public.appointments
  WHERE id = apt_id;

  IF a.id IS NULL OR a.status = 'cancelled' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  duration_min := public.appointment_total_duration_minutes(apt_id);

  PERFORM public.assert_no_appointment_overlap(
    a.barber_id,
    a.appointment_date,
    a.appointment_time,
    duration_min,
    apt_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS prevent_overlap_on_appointment_services ON public.appointment_services;
CREATE TRIGGER prevent_overlap_on_appointment_services
AFTER INSERT OR UPDATE OR DELETE
ON public.appointment_services
FOR EACH ROW
EXECUTE FUNCTION public.trg_appointment_services_prevent_overlap();

CREATE OR REPLACE FUNCTION public.get_barber_booked_slots(p_barber_id uuid, p_appointment_date date)
RETURNS TABLE(appointment_time time, duration_minutes integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    a.appointment_time,
    public.appointment_total_duration_minutes(a.id) AS duration_minutes
  FROM public.appointments a
  WHERE a.barber_id = p_barber_id
    AND a.appointment_date = p_appointment_date
    AND a.status = 'scheduled'
$$;

CREATE OR REPLACE FUNCTION public.create_appointment_with_services(
  p_barber_id uuid,
  p_appointment_date date,
  p_appointment_time time,
  p_service_ids uuid[],
  p_client_name text,
  p_client_phone text DEFAULT NULL,
  p_payment_method text DEFAULT 'local',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  first_service uuid;
  total_duration integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL OR array_length(p_service_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos 1 servico.';
  END IF;

  first_service := p_service_ids[1];

  SELECT COALESCE(SUM(s.duration_minutes), 0)
  INTO total_duration
  FROM public.services s
  WHERE s.id = ANY(p_service_ids);

  IF total_duration <= 0 THEN
    RAISE EXCEPTION 'Servico(s) invalido(s).';
  END IF;

  PERFORM public.assert_no_appointment_overlap(
    p_barber_id,
    p_appointment_date,
    p_appointment_time,
    total_duration,
    NULL
  );

  INSERT INTO public.appointments (
    client_id,
    client_name,
    client_phone,
    barber_id,
    service_id,
    appointment_date,
    appointment_time,
    created_by,
    notes,
    payment_method,
    payment_status,
    status
  )
  VALUES (
    auth.uid(),
    p_client_name,
    NULLIF(p_client_phone, ''),
    p_barber_id,
    first_service,
    p_appointment_date,
    p_appointment_time,
    auth.uid(),
    p_notes,
    p_payment_method,
    'pending',
    'scheduled'
  )
  RETURNING id INTO new_id;

  IF array_length(p_service_ids, 1) > 1 THEN
    INSERT INTO public.appointment_services (appointment_id, service_id, added_by_barber)
    SELECT new_id, unnest(p_service_ids[2:array_length(p_service_ids, 1)]), false;
  END IF;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_barber_appointments(p_barber_id uuid)
RETURNS TABLE (
  id uuid,
  client_name text,
  client_phone text,
  appointment_date date,
  appointment_time time,
  status public.appointment_status,
  payment_method text,
  payment_status text,
  service_id uuid,
  service_name text,
  service_price numeric,
  service_duration integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.client_name,
    a.client_phone,
    a.appointment_date,
    a.appointment_time,
    a.status,
    a.payment_method,
    a.payment_status,
    s.id AS service_id,
    s.name AS service_name,
    s.price AS service_price,
    s.duration_minutes AS service_duration
  FROM public.appointments a
  JOIN public.services s ON s.id = a.service_id
  WHERE a.barber_id = p_barber_id
  ORDER BY a.appointment_date DESC, a.appointment_time DESC
$$;

CREATE OR REPLACE FUNCTION public.get_appointment_extra_services(p_appointment_ids uuid[])
RETURNS TABLE (
  appointment_id uuid,
  service_id uuid,
  service_name text,
  service_price numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    aps.appointment_id,
    s.id AS service_id,
    s.name AS service_name,
    s.price AS service_price
  FROM public.appointment_services aps
  JOIN public.services s ON s.id = aps.service_id
  WHERE aps.appointment_id = ANY(p_appointment_ids)
$$;

CREATE OR REPLACE FUNCTION public.get_barber_appointment_extra_services(
  p_barber_id uuid,
  p_appointment_ids uuid[]
)
RETURNS TABLE(
  appointment_id uuid,
  service_id uuid,
  service_name text,
  service_price numeric,
  service_duration integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    aps.appointment_id,
    aps.service_id,
    s.name AS service_name,
    s.price AS service_price,
    s.duration_minutes AS service_duration
  FROM public.appointment_services aps
  JOIN public.appointments a ON a.id = aps.appointment_id
  JOIN public.services s ON s.id = aps.service_id
  WHERE a.barber_id = p_barber_id
    AND aps.appointment_id = ANY(p_appointment_ids)
  ORDER BY aps.added_at
$$;

CREATE OR REPLACE FUNCTION public.add_service_to_appointment(
  p_barber_id uuid,
  p_appointment_id uuid,
  p_service_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  apt_barber_id uuid;
BEGIN
  SELECT barber_id
  INTO apt_barber_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF apt_barber_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  IF apt_barber_id <> p_barber_id THEN
    RAISE EXCEPTION 'Voce nao tem permissao para modificar este agendamento.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointment_services
    WHERE appointment_id = p_appointment_id
      AND service_id = p_service_id
  ) THEN
    RAISE EXCEPTION 'Este servico ja foi adicionado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.services
    WHERE id = p_service_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Servico nao encontrado ou inativo.';
  END IF;

  INSERT INTO public.appointment_services (appointment_id, service_id, added_by_barber)
  VALUES (p_appointment_id, p_service_id, true);

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.barber_cancel_appointment(
  p_barber_id uuid,
  p_appointment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  apt_barber_id uuid;
BEGIN
  SELECT barber_id
  INTO apt_barber_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF apt_barber_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  IF apt_barber_id <> p_barber_id THEN
    RAISE EXCEPTION 'Voce nao tem permissao para cancelar este agendamento.';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_increment_loyalty_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prog record;
  progress_row record;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  FOR prog IN
    SELECT id, goal_count, service_id
    FROM public.loyalty_programs
    WHERE is_active = true
      AND (service_id IS NULL OR service_id = NEW.service_id)
  LOOP
    FOR progress_row IN
      SELECT lp.id, lp.current_count
      FROM public.loyalty_progress lp
      WHERE lp.program_id = prog.id
        AND lower(trim(lp.client_name)) = lower(trim(NEW.client_name))
        AND lp.reward_claimed = false
    LOOP
      UPDATE public.loyalty_progress
      SET
        current_count = progress_row.current_count + 1,
        completed = (progress_row.current_count + 1) >= prog.goal_count,
        updated_at = now()
      WHERE id = progress_row.id;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_increment_loyalty ON public.appointments;
CREATE TRIGGER trg_auto_increment_loyalty
AFTER UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_increment_loyalty_progress();

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('barber-photos', 'barber-photos', true),
  ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "agenda public barber photos" ON storage.objects;
CREATE POLICY "agenda public barber photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'barber-photos');

DROP POLICY IF EXISTS "agenda admins manage barber photos" ON storage.objects;
CREATE POLICY "agenda admins manage barber photos"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'barber-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'barber-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "agenda public product images" ON storage.objects;
CREATE POLICY "agenda public product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "agenda admins manage product images" ON storage.objects;
CREATE POLICY "agenda admins manage product images"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
