-- Align agenda appointments with queue mode used by the frontend.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_type text DEFAULT 'appointment';

UPDATE public.appointments
SET appointment_type = 'appointment'
WHERE appointment_type IS NULL
   OR appointment_type NOT IN ('appointment', 'queue');

ALTER TABLE public.appointments
  ALTER COLUMN appointment_type SET DEFAULT 'appointment',
  ALTER COLUMN appointment_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_appointment_type_check'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_appointment_type_check
      CHECK (appointment_type IN ('appointment', 'queue'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_appointments_prevent_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  duration_min integer;
  extras_min integer;
BEGIN
  IF NEW.status = 'cancelled' OR NEW.appointment_type = 'queue' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(duration_minutes, 0)
  INTO duration_min
  FROM public.services
  WHERE id = NEW.service_id
    AND store_account_id = NEW.store_account_id;

  SELECT COALESCE(SUM(service.duration_minutes), 0)
  INTO extras_min
  FROM public.appointment_services AS appointment_service
  JOIN public.services AS service
    ON service.id = appointment_service.service_id
   AND service.store_account_id = NEW.store_account_id
  WHERE appointment_service.appointment_id = NEW.id;

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
BEFORE INSERT OR UPDATE OF barber_id, appointment_date, appointment_time, appointment_type, service_id, status
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
  appointment record;
  duration_min integer;
BEGIN
  apt_id := COALESCE(NEW.appointment_id, OLD.appointment_id);

  SELECT id, barber_id, appointment_date, appointment_time, appointment_type, status
  INTO appointment
  FROM public.appointments
  WHERE id = apt_id;

  IF appointment.id IS NULL
    OR appointment.status = 'cancelled'
    OR appointment.appointment_type = 'queue' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  duration_min := public.appointment_total_duration_minutes(apt_id);

  PERFORM public.assert_no_appointment_overlap(
    appointment.barber_id,
    appointment.appointment_date,
    appointment.appointment_time,
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

CREATE OR REPLACE FUNCTION public.get_barber_booked_slots(
  p_barber_id uuid,
  p_appointment_date date
)
RETURNS TABLE(appointment_time time, duration_minutes integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    appointment.appointment_time,
    public.appointment_total_duration_minutes(appointment.id) AS duration_minutes
  FROM public.appointments AS appointment
  JOIN public.barbers AS barber
    ON barber.id = appointment.barber_id
   AND barber.store_account_id = appointment.store_account_id
  WHERE appointment.barber_id = p_barber_id
    AND appointment.appointment_date = p_appointment_date
    AND appointment.status = 'scheduled'
    AND appointment.appointment_type = 'appointment'
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
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  first_service uuid;
  target_store_account_id uuid;
  target_owner_user_id uuid;
  invalid_service_count integer;
  queue_timestamp timestamp;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_service_ids IS NULL OR array_length(p_service_ids, 1) IS NULL OR array_length(p_service_ids, 1) < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos 1 servico.';
  END IF;

  SELECT barber.store_account_id, barber.owner_user_id
  INTO target_store_account_id, target_owner_user_id
  FROM public.barbers AS barber
  WHERE barber.id = p_barber_id
    AND barber.is_active = true;

  IF target_store_account_id IS NULL OR target_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Profissional nao encontrado ou sem empresa vinculada.';
  END IF;

  SELECT count(*)
  INTO invalid_service_count
  FROM unnest(p_service_ids) AS selected_service(service_id)
  LEFT JOIN public.services AS service
    ON service.id = selected_service.service_id
   AND service.store_account_id = target_store_account_id
   AND service.is_active = true
  WHERE service.id IS NULL;

  IF invalid_service_count > 0 THEN
    RAISE EXCEPTION 'Servico(s) invalido(s) para esta empresa.';
  END IF;

  first_service := p_service_ids[1];
  queue_timestamp := now() AT TIME ZONE 'America/Sao_Paulo';

  INSERT INTO public.appointments (
    store_account_id,
    owner_user_id,
    client_id,
    client_name,
    client_phone,
    barber_id,
    service_id,
    appointment_date,
    appointment_time,
    appointment_type,
    created_by,
    notes,
    payment_method,
    payment_status,
    status
  )
  VALUES (
    target_store_account_id,
    target_owner_user_id,
    auth.uid(),
    p_client_name,
    NULLIF(p_client_phone, ''),
    p_barber_id,
    first_service,
    queue_timestamp::date,
    queue_timestamp::time(0),
    'queue',
    auth.uid(),
    COALESCE(p_notes, 'Ordem de chegada'),
    p_payment_method,
    'pending',
    'scheduled'
  )
  RETURNING id INTO new_id;

  IF array_length(p_service_ids, 1) > 1 THEN
    INSERT INTO public.appointment_services (
      store_account_id,
      owner_user_id,
      appointment_id,
      service_id,
      added_by_barber
    )
    SELECT
      target_store_account_id,
      target_owner_user_id,
      new_id,
      unnest(p_service_ids[2:array_length(p_service_ids, 1)]),
      false;
  END IF;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_waiting_queue(p_store_account_id uuid)
RETURNS TABLE (
  id uuid,
  "position" integer,
  client_name text,
  barber_name text,
  service_name text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    appointment.id,
    row_number() OVER (ORDER BY appointment.created_at, appointment.appointment_time)::integer AS "position",
    appointment.client_name,
    barber.name AS barber_name,
    service.name AS service_name,
    appointment.created_at
  FROM public.appointments AS appointment
  JOIN public.barbers AS barber
    ON barber.id = appointment.barber_id
   AND barber.store_account_id = appointment.store_account_id
  JOIN public.services AS service
    ON service.id = appointment.service_id
   AND service.store_account_id = appointment.store_account_id
  WHERE appointment.store_account_id = p_store_account_id
    AND appointment.appointment_type = 'queue'
    AND appointment.status = 'scheduled'
    AND appointment.appointment_date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY appointment.created_at, appointment.appointment_time
$$;

GRANT EXECUTE ON FUNCTION public.create_walk_in_queue_entry(uuid, uuid[], text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_waiting_queue(uuid) TO authenticated;
