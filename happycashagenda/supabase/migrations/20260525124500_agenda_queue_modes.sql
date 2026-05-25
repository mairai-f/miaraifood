-- Modo de atendimento por empresa: horario marcado, ordem de chegada ou ambos.

ALTER TABLE public.agenda_business_settings
  ADD COLUMN IF NOT EXISTS service_mode text NOT NULL DEFAULT 'appointment'
    CHECK (service_mode IN ('appointment', 'walk_in', 'both')),
  ADD COLUMN IF NOT EXISTS public_queue_visible boolean NOT NULL DEFAULT false;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type text NOT NULL DEFAULT 'appointment'
    CHECK (appointment_type IN ('appointment', 'queue'));

CREATE INDEX IF NOT EXISTS idx_appointments_store_queue_today
  ON public.appointments (store_account_id, appointment_date, status, appointment_type, created_at);

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
SET search_path TO public
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
    AND a.status <> 'cancelled'
    AND COALESCE(a.appointment_type, 'appointment') = 'appointment'
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
SET search_path TO public
AS $$
DECLARE
  duration_min integer;
  extras_min integer;
BEGIN
  IF NEW.status = 'cancelled' OR COALESCE(NEW.appointment_type, 'appointment') = 'queue' THEN
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

CREATE OR REPLACE FUNCTION public.get_barber_booked_slots(
  p_barber_id uuid,
  p_appointment_date date
)
RETURNS TABLE(
  appointment_time time,
  duration_minutes integer
)
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT
    a.appointment_time,
    public.appointment_total_duration_minutes(a.id) AS duration_minutes
  FROM public.appointments a
  WHERE a.barber_id = p_barber_id
    AND a.appointment_date = p_appointment_date
    AND a.status <> 'cancelled'
    AND COALESCE(a.appointment_type, 'appointment') = 'appointment';
$$;

CREATE OR REPLACE FUNCTION public.create_walk_in_queue_entry(
  p_barber_id uuid,
  p_service_ids uuid[],
  p_client_name text,
  p_client_phone text DEFAULT NULL,
  p_payment_method text DEFAULT 'local',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  new_id uuid;
  first_service uuid;
  target_store uuid;
  target_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL OR array_length(p_service_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos 1 servico.';
  END IF;

  first_service := p_service_ids[1];

  SELECT b.store_account_id, b.owner_user_id
    INTO target_store, target_owner
  FROM public.barbers b
  WHERE b.id = p_barber_id
    AND b.is_active = true;

  IF target_store IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = ANY(p_service_ids)
      AND (s.store_account_id IS DISTINCT FROM target_store OR s.is_active = false)
  ) THEN
    RAISE EXCEPTION 'Servico invalido para esta empresa.';
  END IF;

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
    status,
    appointment_type,
    store_account_id,
    owner_user_id
  )
  VALUES (
    auth.uid(),
    p_client_name,
    NULLIF(p_client_phone, ''),
    p_barber_id,
    first_service,
    CURRENT_DATE,
    CURRENT_TIME,
    auth.uid(),
    p_notes,
    p_payment_method,
    'pending',
    'scheduled',
    'queue',
    target_store,
    target_owner
  )
  RETURNING id INTO new_id;

  IF array_length(p_service_ids, 1) > 1 THEN
    INSERT INTO public.appointment_services (appointment_id, service_id, added_by_barber, store_account_id, owner_user_id)
    SELECT new_id, unnest(p_service_ids[2:array_length(p_service_ids, 1)]), false, target_store, target_owner;
  END IF;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_waiting_queue(p_store_account_id uuid)
RETURNS TABLE(
  id uuid,
  position bigint,
  client_name text,
  barber_name text,
  service_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    ROW_NUMBER() OVER (ORDER BY q.created_at ASC) AS position,
    q.client_name,
    b.name AS barber_name,
    s.name AS service_name,
    q.created_at
  FROM public.appointments q
  JOIN public.barbers b ON b.id = q.barber_id
  JOIN public.services s ON s.id = q.service_id
  WHERE q.store_account_id = p_store_account_id
    AND q.appointment_date = CURRENT_DATE
    AND q.status = 'scheduled'
    AND COALESCE(q.appointment_type, 'appointment') = 'queue'
  ORDER BY q.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_walk_in_queue_entry(uuid, uuid[], text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_waiting_queue(uuid) TO authenticated;
