-- Hardening for HappyCash Agenda multi-company scale.
-- Keeps reads scoped by store, speeds up the busiest agenda queries, and records
-- lightweight backend audit events for critical Agenda records.

CREATE INDEX IF NOT EXISTS appointments_store_status_date_time_idx
  ON public.appointments(store_account_id, status, appointment_date, appointment_time);

CREATE INDEX IF NOT EXISTS appointments_barber_store_date_status_idx
  ON public.appointments(barber_id, store_account_id, appointment_date, status, appointment_time);

CREATE INDEX IF NOT EXISTS appointments_client_store_date_idx
  ON public.appointments(client_id, store_account_id, appointment_date DESC, appointment_time DESC)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS appointments_created_by_store_date_idx
  ON public.appointments(created_by, store_account_id, appointment_date DESC, appointment_time DESC)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS appointment_services_store_appointment_idx
  ON public.appointment_services(store_account_id, appointment_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.appointment_services
    GROUP BY store_account_id, appointment_id, service_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS appointment_services_store_appointment_service_key
      ON public.appointment_services(store_account_id, appointment_id, service_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.agenda_business_settings
    WHERE store_account_id IS NOT NULL
    GROUP BY store_account_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS agenda_business_settings_store_account_key
      ON public.agenda_business_settings(store_account_id)
      WHERE store_account_id IS NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS agenda_business_settings_public_slug_idx
  ON public.agenda_business_settings(public_booking_enabled, slug)
  WHERE public_booking_enabled = true;

CREATE INDEX IF NOT EXISTS agenda_products_store_category_active_name_idx
  ON public.agenda_products(store_account_id, category, is_active, name);

CREATE INDEX IF NOT EXISTS agenda_product_orders_store_status_created_idx
  ON public.agenda_product_orders(store_account_id, order_status, created_at DESC);

CREATE INDEX IF NOT EXISTS agenda_product_orders_store_payment_created_idx
  ON public.agenda_product_orders(store_account_id, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS agenda_product_order_items_product_idx
  ON public.agenda_product_order_items(product_id, order_id);

CREATE INDEX IF NOT EXISTS barbers_store_user_idx
  ON public.barbers(store_account_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS services_store_active_duration_idx
  ON public.services(store_account_id, is_active, duration_minutes);

CREATE INDEX IF NOT EXISTS business_locations_store_active_name_idx
  ON public.business_locations(store_account_id, is_active, name);

CREATE INDEX IF NOT EXISTS loyalty_progress_store_client_idx
  ON public.loyalty_progress(store_account_id, client_id);

DROP POLICY IF EXISTS "agenda settings owner manage" ON public.agenda_business_settings;
CREATE POLICY "agenda settings owner manage"
ON public.agenda_business_settings
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda settings public read enabled" ON public.agenda_business_settings;
CREATE POLICY "agenda settings public read enabled"
ON public.agenda_business_settings
FOR SELECT
USING (
  store_account_id IS NOT NULL
  AND public_booking_enabled = true
);

CREATE TABLE IF NOT EXISTS public.agenda_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_audit_events_store_created_idx
  ON public.agenda_audit_events(store_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agenda_audit_events_owner_created_idx
  ON public.agenda_audit_events(owner_user_id, created_at DESC);

ALTER TABLE public.agenda_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda audit owner read" ON public.agenda_audit_events;
CREATE POLICY "agenda audit owner read"
ON public.agenda_audit_events
FOR SELECT
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id));

CREATE OR REPLACE FUNCTION public.record_agenda_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
  resolved_store_account_id uuid;
  resolved_owner_user_id uuid;
  resolved_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    row_data := to_jsonb(OLD);
  ELSE
    row_data := to_jsonb(NEW);
  END IF;

  resolved_store_account_id := NULLIF(row_data->>'store_account_id', '')::uuid;
  resolved_owner_user_id := NULLIF(row_data->>'owner_user_id', '')::uuid;
  resolved_record_id := NULLIF(row_data->>'id', '')::uuid;

  IF resolved_store_account_id IS NULL OR resolved_owner_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

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
    resolved_store_account_id,
    resolved_owner_user_id,
    auth.uid(),
    TG_TABLE_NAME,
    resolved_record_id,
    TG_OP,
    jsonb_strip_nulls(jsonb_build_object(
      'status', COALESCE(row_data->>'status', row_data->>'order_status'),
      'payment_status', row_data->>'payment_status',
      'payment_method', row_data->>'payment_method',
      'is_active', row_data->>'is_active',
      'public_booking_enabled', row_data->>'public_booking_enabled'
    ))
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_agenda_business_settings ON public.agenda_business_settings;
CREATE TRIGGER audit_agenda_business_settings
AFTER INSERT OR UPDATE OR DELETE ON public.agenda_business_settings
FOR EACH ROW
EXECUTE FUNCTION public.record_agenda_audit_event();

DROP TRIGGER IF EXISTS audit_agenda_products ON public.agenda_products;
CREATE TRIGGER audit_agenda_products
AFTER INSERT OR UPDATE OR DELETE ON public.agenda_products
FOR EACH ROW
EXECUTE FUNCTION public.record_agenda_audit_event();

DROP TRIGGER IF EXISTS audit_agenda_product_orders ON public.agenda_product_orders;
CREATE TRIGGER audit_agenda_product_orders
AFTER INSERT OR UPDATE OR DELETE ON public.agenda_product_orders
FOR EACH ROW
EXECUTE FUNCTION public.record_agenda_audit_event();

DROP TRIGGER IF EXISTS audit_appointments ON public.appointments;
CREATE TRIGGER audit_appointments
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.record_agenda_audit_event();

UPDATE storage.buckets
SET file_size_limit = 10485760
WHERE id = 'agenda-branding';
