CREATE OR REPLACE FUNCTION public.agenda_store_has_current_access(
  target_store_account_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_accounts AS account
    JOIN public.store_subscriptions AS subscription
      ON subscription.store_account_id = account.id
     AND subscription.owner_user_id = account.owner_user_id
     AND subscription.product_context = 'happycashagenda'
    JOIN public.subscription_plan_features AS feature
      ON feature.plan_id = subscription.plan_id
     AND feature.feature_key = 'agenda.use'
     AND feature.enabled = true
    WHERE account.id = target_store_account_id
      AND account.product_context = 'happycashagenda'
      AND (
        (
          subscription.status = 'trialing'
          AND COALESCE(
            subscription.trial_ends_at,
            subscription.current_period_ends_at
          ) > now()
        )
        OR (
          subscription.status IN ('active', 'past_due')
          AND (
            subscription.current_period_ends_at IS NULL
            OR subscription.current_period_ends_at > now()
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.agenda_store_is_public(
  target_store_account_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.agenda_store_has_current_access(target_store_account_id)
    AND EXISTS (
      SELECT 1
      FROM public.agenda_business_settings AS settings
      WHERE settings.store_account_id = target_store_account_id
        AND settings.public_booking_enabled = true
  );
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
  IF p_barber_id IS NULL
     OR NULLIF(trim(COALESCE(p_session_token, '')), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT login_session.*
  INTO session_row
  FROM public.barber_login_sessions AS login_session
  JOIN public.barbers AS barber
    ON barber.id = login_session.barber_id
  WHERE login_session.barber_id = p_barber_id
    AND login_session.token_hash =
      public.hash_barber_session_token(p_session_token)
    AND login_session.expires_at > now()
    AND public.agenda_store_has_current_access(barber.store_account_id)
  ORDER BY login_session.created_at DESC
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

CREATE OR REPLACE FUNCTION public.authenticate_barber(
  p_username text,
  p_password text
)
RETURNS TABLE (
  barber_id uuid,
  barber_name text,
  user_id uuid,
  session_token text
)
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
    AND barber.password_hash =
      extensions.crypt(p_password, barber.password_hash)
    AND barber.is_active = true
    AND public.agenda_store_has_current_access(barber.store_account_id)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  raw_token := encode(extensions.gen_random_bytes(32), 'hex');

  DELETE FROM public.barber_login_sessions
  WHERE barber_login_sessions.barber_id = barber_row.id
    AND barber_login_sessions.created_at < now() - interval '7 days';

  INSERT INTO public.barber_login_sessions (
    barber_id,
    token_hash,
    expires_at
  )
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
  WHERE public.agenda_store_has_current_access(appointment.store_account_id)
    AND appointment.barber_id = p_barber_id
    AND (
      barber.user_id = auth.uid()
      OR public.verify_barber_session(p_barber_id, p_session_token)
    )
  ORDER BY appointment.appointment_date DESC, appointment.appointment_time DESC
$$;

CREATE OR REPLACE FUNCTION public.get_barber_appointment_extra_services(
  p_barber_id uuid,
  p_appointment_ids uuid[],
  p_session_token text DEFAULT NULL
)
RETURNS TABLE (
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
  WHERE public.agenda_store_has_current_access(appointment.store_account_id)
    AND appointment.barber_id = p_barber_id
    AND appointment_service.appointment_id = ANY(p_appointment_ids)
    AND (
      barber.user_id = auth.uid()
      OR public.verify_barber_session(p_barber_id, p_session_token)
    )
  ORDER BY appointment_service.added_at
$$;

DROP POLICY IF EXISTS "agenda settings public read enabled"
  ON public.agenda_business_settings;

CREATE POLICY "agenda settings public read enabled"
  ON public.agenda_business_settings
  FOR SELECT
  USING (
    store_account_id IS NOT NULL
    AND public_booking_enabled = true
    AND public.agenda_store_has_current_access(store_account_id)
  );

DROP POLICY IF EXISTS "agenda products public active select"
  ON public.agenda_products;

CREATE POLICY "agenda products public active select"
  ON public.agenda_products
  FOR SELECT
  USING (
    is_active = true
    AND public.agenda_store_is_public(store_account_id)
  );

CREATE OR REPLACE FUNCTION public.enforce_agenda_store_current_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.store_account_id IS NULL
     OR NOT public.agenda_store_has_current_access(NEW.store_account_id) THEN
    RAISE EXCEPTION
      'A assinatura do HappyCash Agenda nao esta ativa para esta empresa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_agenda_appointments_current_access
  ON public.appointments;

CREATE TRIGGER enforce_agenda_appointments_current_access
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_agenda_store_current_access();

DROP TRIGGER IF EXISTS enforce_agenda_appointment_services_current_access
  ON public.appointment_services;

CREATE TRIGGER enforce_agenda_appointment_services_current_access
  BEFORE INSERT ON public.appointment_services
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_agenda_store_current_access();

DROP TRIGGER IF EXISTS enforce_agenda_product_orders_current_access
  ON public.agenda_product_orders;

CREATE TRIGGER enforce_agenda_product_orders_current_access
  BEFORE INSERT ON public.agenda_product_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_agenda_store_current_access();

CREATE OR REPLACE FUNCTION public.get_barber_booked_slots(
  p_barber_id uuid,
  p_appointment_date date
)
RETURNS TABLE (
  appointment_time time,
  duration_minutes integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    appointment.appointment_time,
    public.appointment_total_duration_minutes(appointment.id)
      AS duration_minutes
  FROM public.appointments AS appointment
  JOIN public.barbers AS barber
    ON barber.id = appointment.barber_id
   AND barber.store_account_id = appointment.store_account_id
  WHERE public.agenda_store_is_public(barber.store_account_id)
    AND appointment.barber_id = p_barber_id
    AND appointment.appointment_date = p_appointment_date
    AND appointment.status = 'scheduled'
    AND appointment.appointment_type = 'appointment'
$$;

CREATE OR REPLACE FUNCTION public.get_public_waiting_queue(
  p_store_account_id uuid
)
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
    row_number() OVER (
      ORDER BY appointment.created_at, appointment.appointment_time
    )::integer AS "position",
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
  WHERE public.agenda_store_is_public(p_store_account_id)
    AND appointment.store_account_id = p_store_account_id
    AND appointment.appointment_type = 'queue'
    AND appointment.status = 'scheduled'
    AND appointment.appointment_date = (
      now() AT TIME ZONE 'America/Sao_Paulo'
    )::date
  ORDER BY appointment.created_at, appointment.appointment_time
$$;
