CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.barber_login_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS barber_login_sessions_barber_expires_idx
  ON public.barber_login_sessions(barber_id, expires_at DESC);

ALTER TABLE public.barber_login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barber_login_sessions FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.hash_barber_session_token(p_session_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(COALESCE(p_session_token, ''), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.verify_barber_session(
  p_barber_id uuid,
  p_session_token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  session_row public.barber_login_sessions%ROWTYPE;
BEGIN
  IF p_barber_id IS NULL OR NULLIF(trim(COALESCE(p_session_token, '')), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO session_row
  FROM public.barber_login_sessions
  WHERE barber_id = p_barber_id
    AND token_hash = public.hash_barber_session_token(p_session_token)
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.barber_login_sessions
  SET last_used_at = now()
  WHERE id = session_row.id;

  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.authenticate_barber(text, text);
CREATE OR REPLACE FUNCTION public.authenticate_barber(p_username text, p_password text)
RETURNS TABLE(barber_id uuid, barber_name text, user_id uuid, session_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  barber_row public.barbers%ROWTYPE;
  raw_token text;
BEGIN
  DELETE FROM public.barber_login_sessions
  WHERE expires_at <= now();

  SELECT *
  INTO barber_row
  FROM public.barbers AS barber
  WHERE barber.username = trim(p_username)
    AND barber.password_hash = extensions.crypt(p_password, barber.password_hash)
    AND barber.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');

  DELETE FROM public.barber_login_sessions
  WHERE barber_login_sessions.barber_id = barber_row.id
    AND barber_login_sessions.created_at < now() - interval '7 days';

  INSERT INTO public.barber_login_sessions (barber_id, token_hash, expires_at)
  VALUES (
    barber_row.id,
    public.hash_barber_session_token(raw_token),
    now() + interval '12 hours'
  );

  barber_id := barber_row.id;
  barber_name := barber_row.name;
  user_id := barber_row.user_id;
  session_token := raw_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_barber_password(p_barber_id uuid, p_username text, p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  barber_row record;
BEGIN
  SELECT id, store_account_id, owner_user_id
  INTO barber_row
  FROM public.barbers
  WHERE id = p_barber_id;

  IF barber_row.id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.agenda_owner_can_manage(barber_row.store_account_id, barber_row.owner_user_id) THEN
    RAISE EXCEPTION 'Sem permissao para definir credenciais do profissional.';
  END IF;

  UPDATE public.barbers
  SET
    username = trim(p_username),
    password_hash = extensions.crypt(p_password, extensions.gen_salt('bf'))
  WHERE id = p_barber_id;

  DELETE FROM public.barber_login_sessions
  WHERE barber_id = p_barber_id;

  RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.get_barber_appointments(uuid);
CREATE OR REPLACE FUNCTION public.get_barber_appointments(
  p_barber_id uuid,
  p_session_token text DEFAULT NULL
)
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
    appointment.id,
    appointment.client_name,
    appointment.client_phone,
    appointment.appointment_date,
    appointment.appointment_time,
    appointment.status,
    appointment.payment_method,
    appointment.payment_status,
    service.id AS service_id,
    service.name AS service_name,
    service.price AS service_price,
    service.duration_minutes AS service_duration
  FROM public.appointments AS appointment
  JOIN public.services AS service
    ON service.id = appointment.service_id
   AND service.store_account_id = appointment.store_account_id
  JOIN public.barbers AS barber
    ON barber.id = appointment.barber_id
   AND barber.store_account_id = appointment.store_account_id
  WHERE appointment.barber_id = p_barber_id
    AND (
      barber.user_id = auth.uid()
      OR public.verify_barber_session(p_barber_id, p_session_token)
    )
  ORDER BY appointment.appointment_date DESC, appointment.appointment_time DESC
$$;

DROP FUNCTION IF EXISTS public.get_barber_appointment_extra_services(uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.get_barber_appointment_extra_services(
  p_barber_id uuid,
  p_appointment_ids uuid[],
  p_session_token text DEFAULT NULL
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
    appointment_service.appointment_id,
    appointment_service.service_id,
    service.name AS service_name,
    service.price AS service_price,
    service.duration_minutes AS service_duration
  FROM public.appointment_services AS appointment_service
  JOIN public.appointments AS appointment
    ON appointment.id = appointment_service.appointment_id
   AND appointment.store_account_id = appointment_service.store_account_id
  JOIN public.services AS service
    ON service.id = appointment_service.service_id
   AND service.store_account_id = appointment_service.store_account_id
  JOIN public.barbers AS barber
    ON barber.id = appointment.barber_id
   AND barber.store_account_id = appointment.store_account_id
  WHERE appointment.barber_id = p_barber_id
    AND appointment_service.appointment_id = ANY(p_appointment_ids)
    AND (
      barber.user_id = auth.uid()
      OR public.verify_barber_session(p_barber_id, p_session_token)
    )
  ORDER BY appointment_service.added_at
$$;

DROP FUNCTION IF EXISTS public.add_service_to_appointment(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.add_service_to_appointment(
  p_barber_id uuid,
  p_appointment_id uuid,
  p_service_id uuid,
  p_session_token text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_row record;
  has_access boolean;
BEGIN
  SELECT id, barber_id, store_account_id, owner_user_id
  INTO appointment_row
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF appointment_row.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  IF appointment_row.barber_id <> p_barber_id THEN
    RAISE EXCEPTION 'Voce nao tem permissao para modificar este agendamento.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.barbers AS barber
    WHERE barber.id = p_barber_id
      AND barber.store_account_id = appointment_row.store_account_id
      AND (
        barber.user_id = auth.uid()
        OR public.verify_barber_session(p_barber_id, p_session_token)
      )
  )
  INTO has_access;

  IF NOT has_access THEN
    RAISE EXCEPTION 'Voce nao tem permissao para modificar este agendamento.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointment_services
    WHERE appointment_id = p_appointment_id
      AND service_id = p_service_id
      AND store_account_id = appointment_row.store_account_id
  ) THEN
    RAISE EXCEPTION 'Este servico ja foi adicionado.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.services AS service
    WHERE service.id = p_service_id
      AND service.store_account_id = appointment_row.store_account_id
      AND service.is_active = true
  ) THEN
    RAISE EXCEPTION 'Servico nao encontrado ou inativo.';
  END IF;

  INSERT INTO public.appointment_services (
    store_account_id,
    owner_user_id,
    appointment_id,
    service_id,
    added_by_barber
  )
  VALUES (
    appointment_row.store_account_id,
    appointment_row.owner_user_id,
    p_appointment_id,
    p_service_id,
    true
  );

  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.barber_cancel_appointment(uuid, uuid);
CREATE OR REPLACE FUNCTION public.barber_cancel_appointment(
  p_barber_id uuid,
  p_appointment_id uuid,
  p_session_token text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_row record;
  has_access boolean;
BEGIN
  SELECT id, barber_id, store_account_id
  INTO appointment_row
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF appointment_row.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado.';
  END IF;

  IF appointment_row.barber_id <> p_barber_id THEN
    RAISE EXCEPTION 'Voce nao tem permissao para cancelar este agendamento.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.barbers AS barber
    WHERE barber.id = p_barber_id
      AND barber.store_account_id = appointment_row.store_account_id
      AND (
        barber.user_id = auth.uid()
        OR public.verify_barber_session(p_barber_id, p_session_token)
      )
  )
  INTO has_access;

  IF NOT has_access THEN
    RAISE EXCEPTION 'Voce nao tem permissao para cancelar este agendamento.';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_appointment_id
    AND store_account_id = appointment_row.store_account_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_barber_appointment(
  p_barber_id uuid,
  p_session_token text,
  p_service_id uuid,
  p_client_name text,
  p_client_phone text,
  p_appointment_date date,
  p_appointment_time time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  barber_row record;
  service_row record;
  appointment_id uuid;
BEGIN
  SELECT id, store_account_id, owner_user_id, user_id
  INTO barber_row
  FROM public.barbers
  WHERE id = p_barber_id
    AND is_active = true;

  IF barber_row.id IS NULL THEN
    RAISE EXCEPTION 'Profissional nao encontrado ou inativo.';
  END IF;

  IF NOT (
    barber_row.user_id = auth.uid()
    OR public.verify_barber_session(p_barber_id, p_session_token)
  ) THEN
    RAISE EXCEPTION 'Voce nao tem permissao para criar agendamento.';
  END IF;

  SELECT id, store_account_id
  INTO service_row
  FROM public.services
  WHERE id = p_service_id
    AND store_account_id = barber_row.store_account_id
    AND is_active = true;

  IF service_row.id IS NULL THEN
    RAISE EXCEPTION 'Servico nao encontrado ou inativo.';
  END IF;

  INSERT INTO public.appointments (
    store_account_id,
    owner_user_id,
    client_name,
    client_phone,
    barber_id,
    service_id,
    appointment_date,
    appointment_time,
    status,
    payment_method,
    payment_status,
    appointment_type
  )
  VALUES (
    barber_row.store_account_id,
    barber_row.owner_user_id,
    NULLIF(trim(p_client_name), ''),
    NULLIF(trim(COALESCE(p_client_phone, '')), ''),
    p_barber_id,
    p_service_id,
    p_appointment_date,
    p_appointment_time,
    'scheduled',
    'local',
    'pending',
    'appointment'
  )
  RETURNING id INTO appointment_id;

  RETURN appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.authenticate_barber(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_barber_session(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_barber_appointments(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_barber_appointment_extra_services(uuid, uuid[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_service_to_appointment(uuid, uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.barber_cancel_appointment(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_barber_appointment(uuid, text, uuid, text, text, date, time) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.set_barber_password(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_barber_password(uuid, text, text) TO authenticated;
