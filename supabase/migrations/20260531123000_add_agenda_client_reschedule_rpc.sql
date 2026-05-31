CREATE OR REPLACE FUNCTION public.reschedule_client_appointment(
  p_appointment_id uuid,
  p_appointment_date date,
  p_appointment_time time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_row public.appointments%ROWTYPE;
  duration_min integer;
  current_local_timestamp timestamp;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO appointment_row
  FROM public.appointments
  WHERE id = p_appointment_id
    AND client_id = auth.uid();

  IF appointment_row.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado para este cliente.';
  END IF;

  IF appointment_row.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Somente agendamentos marcados podem ser remarcados.';
  END IF;

  IF appointment_row.appointment_type <> 'appointment' THEN
    RAISE EXCEPTION 'Entradas por ordem de chegada nao podem ser remarcadas.';
  END IF;

  current_local_timestamp := now() AT TIME ZONE 'America/Sao_Paulo';

  IF (appointment_row.appointment_date + appointment_row.appointment_time) <= (current_local_timestamp + interval '2 hours') THEN
    RAISE EXCEPTION 'Remarcacao permitida apenas com pelo menos 2 horas de antecedencia.';
  END IF;

  IF (p_appointment_date + p_appointment_time) <= current_local_timestamp THEN
    RAISE EXCEPTION 'Escolha um novo horario no futuro.';
  END IF;

  duration_min := public.appointment_total_duration_minutes(p_appointment_id);

  IF duration_min IS NULL OR duration_min <= 0 THEN
    RAISE EXCEPTION 'Nao foi possivel validar a duracao do agendamento.';
  END IF;

  PERFORM public.assert_no_appointment_overlap(
    appointment_row.barber_id,
    p_appointment_date,
    p_appointment_time,
    duration_min,
    p_appointment_id
  );

  UPDATE public.appointments
  SET
    appointment_date = p_appointment_date,
    appointment_time = p_appointment_time,
    updated_at = now()
  WHERE id = p_appointment_id;

  RETURN p_appointment_id;
END;
$$;
