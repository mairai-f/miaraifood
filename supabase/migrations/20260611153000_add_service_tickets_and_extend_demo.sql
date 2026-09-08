ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'operator', 'waiter'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  metadata_role text;
  metadata_owner_user_id uuid;
  metadata_created_by_user_id uuid;
BEGIN
  metadata_role := CASE lower(COALESCE(NEW.raw_user_meta_data->>'role', 'admin'))
    WHEN 'operator' THEN 'operator'
    WHEN 'waiter' THEN 'waiter'
    ELSE 'admin'
  END;

  metadata_owner_user_id := NULLIF(NEW.raw_user_meta_data->>'owner_user_id', '')::uuid;
  metadata_created_by_user_id := NULLIF(NEW.raw_user_meta_data->>'created_by_user_id', '')::uuid;

  INSERT INTO public.profiles (user_id, username, email, role, owner_user_id, created_by_user_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email),
    NEW.email,
    metadata_role,
    COALESCE(metadata_owner_user_id, NEW.id),
    metadata_created_by_user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.access_sessions
  DROP CONSTRAINT IF EXISTS access_sessions_role_check;

ALTER TABLE public.access_sessions
  ADD CONSTRAINT access_sessions_role_check
  CHECK (role IN ('admin', 'operator', 'waiter'));

ALTER TABLE public.access_logs
  DROP CONSTRAINT IF EXISTS access_logs_role_check;

ALTER TABLE public.access_logs
  ADD CONSTRAINT access_logs_role_check
  CHECK (role IN ('admin', 'operator', 'waiter'));

UPDATE public.subscription_plans
SET
  name = 'Demo 3 Dias',
  description = 'Acesso inicial liberado por 3 dias.',
  trial_hours = 72
WHERE id = 'demo';

UPDATE public.store_subscriptions
SET
  trial_ends_at = trial_started_at + interval '72 hours',
  current_period_ends_at = trial_started_at + interval '72 hours'
WHERE plan_id = 'demo'
  AND status = 'trialing'
  AND trial_started_at IS NOT NULL
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < trial_started_at + interval '72 hours';

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('demo', 'service_tickets.use', true),
  ('pro', 'service_tickets.use', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;

CREATE TABLE IF NOT EXISTS public.service_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number integer NOT NULL,
  barcode text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'open', 'awaiting_payment', 'closed', 'cancelled')),
  opened_at timestamptz,
  closed_at timestamptz,
  opened_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_by_name text,
  closed_by_name text,
  closed_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, number),
  UNIQUE (owner_user_id, barcode)
);

CREATE TABLE IF NOT EXISTS public.service_ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  notes text,
  added_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_by_name text,
  cancelled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_by_name text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_ticket_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_tickets_select_store" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_insert_store" ON public.service_tickets;
DROP POLICY IF EXISTS "service_tickets_update_store" ON public.service_tickets;
DROP POLICY IF EXISTS "service_ticket_items_select_store" ON public.service_ticket_items;
DROP POLICY IF EXISTS "service_ticket_items_insert_store" ON public.service_ticket_items;
DROP POLICY IF EXISTS "service_ticket_items_update_store" ON public.service_ticket_items;

CREATE POLICY "service_tickets_select_store"
ON public.service_tickets
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
);

CREATE POLICY "service_tickets_insert_store"
ON public.service_tickets
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
  AND public.get_current_user_role() IN ('admin', 'operator')
);

CREATE POLICY "service_tickets_update_store"
ON public.service_tickets
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
  AND public.get_current_user_role() IN ('admin', 'operator', 'waiter')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
  AND public.get_current_user_role() IN ('admin', 'operator', 'waiter')
);

CREATE POLICY "service_ticket_items_select_store"
ON public.service_ticket_items
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
);

CREATE POLICY "service_ticket_items_insert_store"
ON public.service_ticket_items
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
  AND public.get_current_user_role() IN ('admin', 'operator', 'waiter')
);

CREATE POLICY "service_ticket_items_update_store"
ON public.service_ticket_items
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
  AND public.get_current_user_role() IN ('admin', 'operator')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
  AND public.get_current_user_role() IN ('admin', 'operator')
);

CREATE INDEX IF NOT EXISTS service_tickets_owner_status_idx
  ON public.service_tickets(owner_user_id, status, number);
CREATE INDEX IF NOT EXISTS service_tickets_owner_barcode_idx
  ON public.service_tickets(owner_user_id, barcode);
CREATE INDEX IF NOT EXISTS service_ticket_items_ticket_status_idx
  ON public.service_ticket_items(ticket_id, status, created_at);
CREATE INDEX IF NOT EXISTS service_ticket_items_owner_created_idx
  ON public.service_ticket_items(owner_user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_service_tickets_updated_at ON public.service_tickets;
CREATE TRIGGER update_service_tickets_updated_at
BEFORE UPDATE ON public.service_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_ticket_items_updated_at ON public.service_ticket_items;
CREATE TRIGGER update_service_ticket_items_updated_at
BEFORE UPDATE ON public.service_ticket_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
