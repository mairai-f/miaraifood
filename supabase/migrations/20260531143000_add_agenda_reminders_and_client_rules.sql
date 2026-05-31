ALTER TABLE public.agenda_business_settings
  ADD COLUMN IF NOT EXISTS reschedule_notice_hours integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS cancellation_notice_hours integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_24h_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_2h_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_30m_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sound_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_new_appointment_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_reschedule_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_cancellation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_completion_enabled boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_business_settings_reschedule_notice_range'
      AND conrelid = 'public.agenda_business_settings'::regclass
  ) THEN
    ALTER TABLE public.agenda_business_settings
      ADD CONSTRAINT agenda_business_settings_reschedule_notice_range
      CHECK (reschedule_notice_hours BETWEEN 0 AND 72) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agenda_business_settings_cancellation_notice_range'
      AND conrelid = 'public.agenda_business_settings'::regclass
  ) THEN
    ALTER TABLE public.agenda_business_settings
      ADD CONSTRAINT agenda_business_settings_cancellation_notice_range
      CHECK (cancellation_notice_hours BETWEEN 0 AND 72) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.agenda_appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('24h', '2h', '30m')),
  appointment_starts_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  last_error text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS agenda_appointment_reminders_status_due_idx
  ON public.agenda_appointment_reminders(status, due_at);

CREATE INDEX IF NOT EXISTS agenda_appointment_reminders_store_status_due_idx
  ON public.agenda_appointment_reminders(store_account_id, status, due_at);

ALTER TABLE public.agenda_appointment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_appointment_reminders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda reminders owner read" ON public.agenda_appointment_reminders;
CREATE POLICY "agenda reminders owner read"
ON public.agenda_appointment_reminders
FOR SELECT
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda reminders owner manage" ON public.agenda_appointment_reminders;
CREATE POLICY "agenda reminders owner manage"
ON public.agenda_appointment_reminders
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP TRIGGER IF EXISTS update_agenda_appointment_reminders_updated_at ON public.agenda_appointment_reminders;
CREATE TRIGGER update_agenda_appointment_reminders_updated_at
BEFORE UPDATE ON public.agenda_appointment_reminders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.agenda_appointment_starts_at(
  p_appointment_date date,
  p_appointment_time time
)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (p_appointment_date::timestamp + p_appointment_time) AT TIME ZONE 'America/Sao_Paulo'
$$;

CREATE OR REPLACE FUNCTION public.sync_agenda_appointment_reminders(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_row RECORD;
  settings_row RECORD;
  appointment_starts_at timestamptz;
BEGIN
  SELECT
    appointment.id,
    appointment.store_account_id,
    appointment.owner_user_id,
    appointment.client_phone,
    appointment.appointment_date,
    appointment.appointment_time,
    appointment.status,
    COALESCE(appointment.appointment_type, 'appointment') AS appointment_type
  INTO appointment_row
  FROM public.appointments AS appointment
  WHERE appointment.id = p_appointment_id;

  IF appointment_row.id IS NULL THEN
    DELETE FROM public.agenda_appointment_reminders
    WHERE appointment_id = p_appointment_id;
    RETURN;
  END IF;

  SELECT
    settings.store_account_id,
    settings.reminder_enabled,
    settings.reminder_24h_enabled,
    settings.reminder_2h_enabled,
    settings.reminder_30m_enabled
  INTO settings_row
  FROM public.agenda_business_settings AS settings
  WHERE settings.store_account_id = appointment_row.store_account_id;

  appointment_starts_at := public.agenda_appointment_starts_at(
    appointment_row.appointment_date,
    appointment_row.appointment_time
  );

  IF settings_row.store_account_id IS NULL
    OR appointment_row.status <> 'scheduled'
    OR appointment_row.appointment_type <> 'appointment'
    OR NULLIF(COALESCE(appointment_row.client_phone, ''), '') IS NULL
    OR settings_row.reminder_enabled IS NOT TRUE
    OR appointment_starts_at <= now() THEN
    UPDATE public.agenda_appointment_reminders
    SET
      status = CASE WHEN status = 'sent' THEN status ELSE 'cancelled' END,
      updated_at = now()
    WHERE appointment_id = p_appointment_id;
    RETURN;
  END IF;

  UPDATE public.agenda_appointment_reminders
  SET
    status = CASE WHEN status = 'sent' THEN status ELSE 'cancelled' END,
    updated_at = now()
  WHERE appointment_id = p_appointment_id
    AND reminder_type NOT IN (
      SELECT reminder_type
      FROM (
        VALUES
          ('24h'::text, settings_row.reminder_24h_enabled),
          ('2h'::text, settings_row.reminder_2h_enabled),
          ('30m'::text, settings_row.reminder_30m_enabled)
      ) AS active(reminder_type, enabled)
      WHERE enabled IS TRUE
    );

  IF settings_row.reminder_24h_enabled IS TRUE THEN
    INSERT INTO public.agenda_appointment_reminders (
      appointment_id,
      store_account_id,
      owner_user_id,
      reminder_type,
      appointment_starts_at,
      due_at
    )
    VALUES (
      appointment_row.id,
      appointment_row.store_account_id,
      appointment_row.owner_user_id,
      '24h',
      appointment_starts_at,
      appointment_starts_at - interval '24 hours'
    )
    ON CONFLICT (appointment_id, reminder_type) DO UPDATE
    SET
      store_account_id = EXCLUDED.store_account_id,
      owner_user_id = EXCLUDED.owner_user_id,
      appointment_starts_at = EXCLUDED.appointment_starts_at,
      due_at = EXCLUDED.due_at,
      status = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN 'pending'
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN 'sent'
        ELSE 'pending'
      END,
      sent_at = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN NULL
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN public.agenda_appointment_reminders.sent_at
        ELSE NULL
      END,
      attempts = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN 0
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN public.agenda_appointment_reminders.attempts
        ELSE 0
      END,
      last_error = NULL,
      provider_payload = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN '{}'::jsonb
        ELSE public.agenda_appointment_reminders.provider_payload
      END,
      updated_at = now();
  END IF;

  IF settings_row.reminder_2h_enabled IS TRUE THEN
    INSERT INTO public.agenda_appointment_reminders (
      appointment_id,
      store_account_id,
      owner_user_id,
      reminder_type,
      appointment_starts_at,
      due_at
    )
    VALUES (
      appointment_row.id,
      appointment_row.store_account_id,
      appointment_row.owner_user_id,
      '2h',
      appointment_starts_at,
      appointment_starts_at - interval '2 hours'
    )
    ON CONFLICT (appointment_id, reminder_type) DO UPDATE
    SET
      store_account_id = EXCLUDED.store_account_id,
      owner_user_id = EXCLUDED.owner_user_id,
      appointment_starts_at = EXCLUDED.appointment_starts_at,
      due_at = EXCLUDED.due_at,
      status = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN 'pending'
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN 'sent'
        ELSE 'pending'
      END,
      sent_at = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN NULL
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN public.agenda_appointment_reminders.sent_at
        ELSE NULL
      END,
      attempts = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN 0
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN public.agenda_appointment_reminders.attempts
        ELSE 0
      END,
      last_error = NULL,
      provider_payload = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN '{}'::jsonb
        ELSE public.agenda_appointment_reminders.provider_payload
      END,
      updated_at = now();
  END IF;

  IF settings_row.reminder_30m_enabled IS TRUE THEN
    INSERT INTO public.agenda_appointment_reminders (
      appointment_id,
      store_account_id,
      owner_user_id,
      reminder_type,
      appointment_starts_at,
      due_at
    )
    VALUES (
      appointment_row.id,
      appointment_row.store_account_id,
      appointment_row.owner_user_id,
      '30m',
      appointment_starts_at,
      appointment_starts_at - interval '30 minutes'
    )
    ON CONFLICT (appointment_id, reminder_type) DO UPDATE
    SET
      store_account_id = EXCLUDED.store_account_id,
      owner_user_id = EXCLUDED.owner_user_id,
      appointment_starts_at = EXCLUDED.appointment_starts_at,
      due_at = EXCLUDED.due_at,
      status = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN 'pending'
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN 'sent'
        ELSE 'pending'
      END,
      sent_at = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN NULL
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN public.agenda_appointment_reminders.sent_at
        ELSE NULL
      END,
      attempts = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN 0
        WHEN public.agenda_appointment_reminders.status = 'sent' THEN public.agenda_appointment_reminders.attempts
        ELSE 0
      END,
      last_error = NULL,
      provider_payload = CASE
        WHEN public.agenda_appointment_reminders.appointment_starts_at IS DISTINCT FROM EXCLUDED.appointment_starts_at THEN '{}'::jsonb
        ELSE public.agenda_appointment_reminders.provider_payload
      END,
      updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_agenda_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_agenda_appointment_reminders(COALESCE(NEW.id, OLD.id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_agenda_appointment_reminders ON public.appointments;
CREATE TRIGGER sync_agenda_appointment_reminders
AFTER INSERT OR UPDATE OF appointment_date, appointment_time, status, appointment_type, client_phone
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_agenda_appointment_reminders();

CREATE OR REPLACE FUNCTION public.resync_store_agenda_reminders(p_store_account_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_row RECORD;
  synced_count integer := 0;
BEGIN
  IF p_store_account_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR appointment_row IN
    SELECT appointment.id
    FROM public.appointments AS appointment
    WHERE appointment.store_account_id = p_store_account_id
      AND appointment.status = 'scheduled'
      AND COALESCE(appointment.appointment_type, 'appointment') = 'appointment'
  LOOP
    PERFORM public.sync_agenda_appointment_reminders(appointment_row.id);
    synced_count := synced_count + 1;
  END LOOP;

  RETURN synced_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_resync_store_agenda_reminders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM public.resync_store_agenda_reminders(NEW.store_account_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resync_store_agenda_reminders ON public.agenda_business_settings;
CREATE TRIGGER resync_store_agenda_reminders
AFTER INSERT OR UPDATE OF reminder_enabled, reminder_24h_enabled, reminder_2h_enabled, reminder_30m_enabled
ON public.agenda_business_settings
FOR EACH ROW
EXECUTE FUNCTION public.trg_resync_store_agenda_reminders();

CREATE OR REPLACE FUNCTION public.claim_due_agenda_appointment_reminders(
  p_limit integer DEFAULT 25,
  p_store_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  reminder_id uuid,
  reminder_type text,
  due_at timestamptz,
  appointment_id uuid,
  store_account_id uuid,
  owner_user_id uuid,
  business_name text,
  client_name text,
  client_phone text,
  professional_name text,
  service_names text[],
  appointment_date date,
  appointment_time time,
  admin_whatsapp text,
  public_whatsapp text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due_rows AS (
    SELECT reminder.id
    FROM public.agenda_appointment_reminders AS reminder
    JOIN public.appointments AS appointment
      ON appointment.id = reminder.appointment_id
    WHERE reminder.status IN ('pending', 'failed')
      AND reminder.due_at <= now()
      AND appointment.status = 'scheduled'
      AND COALESCE(appointment.appointment_type, 'appointment') = 'appointment'
      AND (p_store_account_id IS NULL OR reminder.store_account_id = p_store_account_id)
    ORDER BY reminder.due_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
  ),
  claimed AS (
    UPDATE public.agenda_appointment_reminders AS reminder
    SET
      status = 'processing',
      attempts = reminder.attempts + 1,
      last_error = NULL,
      updated_at = now()
    FROM due_rows
    WHERE reminder.id = due_rows.id
    RETURNING reminder.*
  )
  SELECT
    claimed.id,
    claimed.reminder_type,
    claimed.due_at,
    claimed.appointment_id,
    claimed.store_account_id,
    claimed.owner_user_id,
    settings.display_name,
    appointment.client_name,
    appointment.client_phone,
    barber.name,
    ARRAY_REMOVE(
      ARRAY[service.name] ||
      COALESCE((
        SELECT array_agg(extra_service.name ORDER BY extra_service.name)
        FROM public.appointment_services AS appointment_service
        JOIN public.services AS extra_service
          ON extra_service.id = appointment_service.service_id
         AND extra_service.store_account_id = appointment_service.store_account_id
        WHERE appointment_service.appointment_id = appointment.id
      ), ARRAY[]::text[]),
      NULL
    ),
    appointment.appointment_date,
    appointment.appointment_time,
    settings.admin_whatsapp,
    settings.whatsapp
  FROM claimed
  JOIN public.appointments AS appointment
    ON appointment.id = claimed.appointment_id
  JOIN public.barbers AS barber
    ON barber.id = appointment.barber_id
   AND barber.store_account_id = appointment.store_account_id
  JOIN public.services AS service
    ON service.id = appointment.service_id
   AND service.store_account_id = appointment.store_account_id
  JOIN public.agenda_business_settings AS settings
    ON settings.store_account_id = claimed.store_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_agenda_appointment_reminder(
  p_reminder_id uuid,
  p_status text,
  p_last_error text DEFAULT NULL,
  p_provider_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'Status de lembrete invalido.';
  END IF;

  UPDATE public.agenda_appointment_reminders
  SET
    status = p_status,
    sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE sent_at END,
    last_error = NULLIF(p_last_error, ''),
    provider_payload = COALESCE(p_provider_payload, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_reminder_id;

  RETURN FOUND;
END;
$$;

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
  reschedule_notice integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT appointment.*
  INTO appointment_row
  FROM public.appointments AS appointment
  WHERE appointment.id = p_appointment_id
    AND appointment.client_id = auth.uid();

  IF appointment_row.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado para este cliente.';
  END IF;

  IF appointment_row.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Somente agendamentos marcados podem ser remarcados.';
  END IF;

  IF COALESCE(appointment_row.appointment_type, 'appointment') <> 'appointment' THEN
    RAISE EXCEPTION 'Entradas por ordem de chegada nao podem ser remarcadas.';
  END IF;

  SELECT COALESCE(settings.reschedule_notice_hours, 2)
  INTO reschedule_notice
  FROM public.agenda_business_settings AS settings
  WHERE settings.store_account_id = appointment_row.store_account_id;

  current_local_timestamp := now() AT TIME ZONE 'America/Sao_Paulo';

  IF (appointment_row.appointment_date + appointment_row.appointment_time) <= (current_local_timestamp + make_interval(hours => GREATEST(COALESCE(reschedule_notice, 0), 0))) THEN
    RAISE EXCEPTION 'Remarcacao permitida apenas com pelo menos % hora(s) de antecedencia.', GREATEST(COALESCE(reschedule_notice, 0), 0);
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

  INSERT INTO public.agenda_audit_events (
    store_account_id,
    owner_user_id,
    actor_user_id,
    table_name,
    record_id,
    operation,
    metadata
  )
  VALUES (
    appointment_row.store_account_id,
    appointment_row.owner_user_id,
    auth.uid(),
    'appointments',
    appointment_row.id,
    'UPDATE',
    jsonb_build_object(
      'action', 'client_reschedule',
      'previous_date', appointment_row.appointment_date,
      'previous_time', appointment_row.appointment_time,
      'new_date', p_appointment_date,
      'new_time', p_appointment_time
    )
  );

  RETURN p_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_appointment(p_appointment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appointment_row public.appointments%ROWTYPE;
  current_local_timestamp timestamp;
  cancellation_notice integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT appointment.*
  INTO appointment_row
  FROM public.appointments AS appointment
  WHERE appointment.id = p_appointment_id
    AND appointment.client_id = auth.uid();

  IF appointment_row.id IS NULL THEN
    RAISE EXCEPTION 'Agendamento nao encontrado para este cliente.';
  END IF;

  IF appointment_row.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Somente agendamentos marcados podem ser cancelados.';
  END IF;

  SELECT COALESCE(settings.cancellation_notice_hours, 0)
  INTO cancellation_notice
  FROM public.agenda_business_settings AS settings
  WHERE settings.store_account_id = appointment_row.store_account_id;

  current_local_timestamp := now() AT TIME ZONE 'America/Sao_Paulo';

  IF (appointment_row.appointment_date + appointment_row.appointment_time) <= (current_local_timestamp + make_interval(hours => GREATEST(COALESCE(cancellation_notice, 0), 0))) THEN
    RAISE EXCEPTION 'Cancelamento permitido apenas com pelo menos % hora(s) de antecedencia.', GREATEST(COALESCE(cancellation_notice, 0), 0);
  END IF;

  UPDATE public.appointments
  SET
    status = 'cancelled',
    updated_at = now()
  WHERE id = p_appointment_id;

  INSERT INTO public.agenda_audit_events (
    store_account_id,
    owner_user_id,
    actor_user_id,
    table_name,
    record_id,
    operation,
    metadata
  )
  VALUES (
    appointment_row.store_account_id,
    appointment_row.owner_user_id,
    auth.uid(),
    'appointments',
    appointment_row.id,
    'UPDATE',
    jsonb_build_object(
      'action', 'client_cancel',
      'appointment_date', appointment_row.appointment_date,
      'appointment_time', appointment_row.appointment_time
    )
  );

  RETURN p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_due_agenda_appointment_reminders(integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_agenda_appointment_reminder(uuid, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_client_appointment(uuid, date, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_client_appointment(uuid) TO authenticated;
