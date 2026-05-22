-- Keep HappyCash, HappyCashFood and HappyCash Agenda data separated by product context
-- and by company/store account. The legacy public.products table is reserved for
-- the HappyCash PDV/fiado product catalog only.

CREATE OR REPLACE FUNCTION public.get_current_store_account_id_for_context(target_context text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account.id
  FROM public.store_accounts AS account
  WHERE account.owner_user_id = public.get_current_store_owner_id()
    AND account.product_context = target_context
  ORDER BY account.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_current_store_plan_id_for_context(target_context text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subscription.plan_id
  FROM public.store_subscriptions AS subscription
  WHERE subscription.owner_user_id = public.get_current_store_owner_id()
    AND subscription.product_context = target_context
    AND (
      (
        subscription.status = 'trialing'
        AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now()
      )
      OR (
        subscription.status IN ('active', 'past_due')
        AND (
          subscription.current_period_ends_at IS NULL
          OR subscription.current_period_ends_at > now()
        )
      )
    )
  ORDER BY
    CASE
      WHEN subscription.status = 'active' THEN 0
      WHEN subscription.status = 'past_due' THEN 1
      ELSE 2
    END,
    COALESCE(subscription.current_period_ends_at, subscription.trial_ends_at, subscription.created_at) DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_store_has_feature_for_context(
  target_context text,
  target_feature text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscription_plan_features AS feature
    WHERE feature.plan_id = public.get_current_store_plan_id_for_context(target_context)
      AND feature.feature_key = target_feature
      AND feature.enabled
  )
$$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_context text NOT NULL DEFAULT 'happycash';

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_product_context_check;

UPDATE public.clients
SET product_context = 'happycash'
WHERE product_context IS NULL
   OR product_context NOT IN ('happycash', 'happycashfood');

ALTER TABLE public.clients
  ADD CONSTRAINT clients_product_context_check
  CHECK (product_context IN ('happycash', 'happycashfood'));

UPDATE public.clients AS client
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE client.store_account_id IS NULL
  AND account.owner_user_id = client.user_id
  AND account.product_context = client.product_context;

CREATE INDEX IF NOT EXISTS clients_store_context_idx
  ON public.clients(store_account_id, product_context, deleted, name);

CREATE OR REPLACE FUNCTION public.assign_client_store_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_store_account_id uuid;
  resolved_owner_user_id uuid;
BEGIN
  IF NEW.product_context IS NULL OR NEW.product_context = '' THEN
    NEW.product_context := 'happycash';
  END IF;

  IF NEW.product_context NOT IN ('happycash', 'happycashfood') THEN
    RAISE EXCEPTION 'Contexto de cliente invalido.';
  END IF;

  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.get_current_store_owner_id();
  END IF;

  IF NEW.store_account_id IS NOT NULL THEN
    SELECT account.owner_user_id
    INTO resolved_owner_user_id
    FROM public.store_accounts AS account
    WHERE account.id = NEW.store_account_id
      AND account.product_context = NEW.product_context;

    IF resolved_owner_user_id IS NULL THEN
      RAISE EXCEPTION 'Empresa nao encontrada para o cliente.';
    END IF;

    IF NEW.user_id <> resolved_owner_user_id THEN
      RAISE EXCEPTION 'Cliente nao pertence a empresa informada.';
    END IF;

    RETURN NEW;
  END IF;

  SELECT account.id
  INTO resolved_store_account_id
  FROM public.store_accounts AS account
  WHERE account.owner_user_id = NEW.user_id
    AND account.product_context = NEW.product_context
  ORDER BY account.created_at DESC
  LIMIT 1;

  IF resolved_store_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa encontrada para cadastrar cliente.';
  END IF;

  NEW.store_account_id := resolved_store_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_client_store_scope ON public.clients;
CREATE TRIGGER assign_client_store_scope
BEFORE INSERT OR UPDATE OF store_account_id, user_id, product_context
ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.assign_client_store_scope();

DROP POLICY IF EXISTS "clients_select_store" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_store" ON public.clients;
DROP POLICY IF EXISTS "clients_update_store" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_store" ON public.clients;
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_own" ON public.clients;
DROP POLICY IF EXISTS "clients_update_own" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_own" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;

CREATE POLICY "clients_select_store"
ON public.clients
FOR SELECT
TO authenticated
USING (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'clients.manage')
);

CREATE POLICY "clients_insert_store"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'clients.manage')
);

CREATE POLICY "clients_update_store"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'clients.manage')
)
WITH CHECK (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'clients.manage')
);

CREATE POLICY "clients_delete_store"
ON public.clients
FOR DELETE
TO authenticated
USING (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'clients.manage')
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS product_context text NOT NULL DEFAULT 'happycash';

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_context_check;

UPDATE public.products
SET product_context = 'happycash'
WHERE product_context IS NULL
   OR product_context <> 'happycash';

ALTER TABLE public.products
  ADD CONSTRAINT products_product_context_check
  CHECK (product_context IN ('happycash'));

UPDATE public.products AS product
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE product.store_account_id IS NULL
  AND account.owner_user_id = product.user_id
  AND account.product_context = 'happycash';

CREATE INDEX IF NOT EXISTS products_store_context_idx
  ON public.products(store_account_id, product_context, deleted, name);

CREATE OR REPLACE FUNCTION public.assign_happycash_product_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_store_account_id uuid;
  resolved_owner_user_id uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.get_current_store_owner_id();
  END IF;

  NEW.product_context := 'happycash';

  IF NEW.store_account_id IS NOT NULL THEN
    SELECT account.owner_user_id
    INTO resolved_owner_user_id
    FROM public.store_accounts AS account
    WHERE account.id = NEW.store_account_id
      AND account.product_context = 'happycash';

    IF resolved_owner_user_id IS NULL THEN
      RAISE EXCEPTION 'Empresa HappyCash nao encontrada para o produto.';
    END IF;

    IF NEW.user_id <> resolved_owner_user_id THEN
      RAISE EXCEPTION 'Produto nao pertence a empresa HappyCash informada.';
    END IF;

    RETURN NEW;
  END IF;

  SELECT account.id
  INTO resolved_store_account_id
  FROM public.store_accounts AS account
  WHERE account.owner_user_id = NEW.user_id
    AND account.product_context = 'happycash'
  ORDER BY account.created_at DESC
  LIMIT 1;

  IF resolved_store_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa HappyCash encontrada para cadastrar produtos de PDV.';
  END IF;

  NEW.store_account_id := resolved_store_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_happycash_product_scope ON public.products;
CREATE TRIGGER assign_happycash_product_scope
BEFORE INSERT OR UPDATE OF store_account_id, user_id, product_context
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.assign_happycash_product_scope();

DROP POLICY IF EXISTS "products_select_store" ON public.products;
DROP POLICY IF EXISTS "products_insert_store" ON public.products;
DROP POLICY IF EXISTS "products_update_store" ON public.products;
DROP POLICY IF EXISTS "products_delete_store" ON public.products;
DROP POLICY IF EXISTS "products_select_own" ON public.products;
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
DROP POLICY IF EXISTS "products_update_own" ON public.products;
DROP POLICY IF EXISTS "products_delete_own" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

CREATE POLICY "products_select_store"
ON public.products
FOR SELECT
TO authenticated
USING (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'products.manage')
);

CREATE POLICY "products_insert_store"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'products.manage')
);

CREATE POLICY "products_update_store"
ON public.products
FOR UPDATE
TO authenticated
USING (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'products.manage')
)
WITH CHECK (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'products.manage')
);

CREATE POLICY "products_delete_store"
ON public.products
FOR DELETE
TO authenticated
USING (
  product_context = 'happycash'
  AND user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_store_has_feature_for_context('happycash', 'products.manage')
);

CREATE TABLE IF NOT EXISTS public.agenda_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  category text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_products_store_active_idx
  ON public.agenda_products(store_account_id, is_active, name);

ALTER TABLE public.agenda_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_products FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.assign_agenda_store_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_store_account_id uuid;
  resolved_owner_user_id uuid;
BEGIN
  IF NEW.owner_user_id IS NULL AND NEW.store_account_id IS NOT NULL THEN
    SELECT account.owner_user_id
    INTO resolved_owner_user_id
    FROM public.store_accounts AS account
    WHERE account.id = NEW.store_account_id
      AND account.product_context = 'happycashagenda';

    IF resolved_owner_user_id IS NULL THEN
      RAISE EXCEPTION 'Empresa HappyCash Agenda nao encontrada.';
    END IF;

    NEW.owner_user_id := resolved_owner_user_id;
  END IF;

  IF NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := public.get_current_store_owner_id();
  END IF;

  IF NEW.store_account_id IS NULL THEN
    SELECT account.id
    INTO resolved_store_account_id
    FROM public.store_accounts AS account
    WHERE account.owner_user_id = NEW.owner_user_id
      AND account.product_context = 'happycashagenda'
    ORDER BY account.created_at DESC
    LIMIT 1;

    IF resolved_store_account_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma empresa HappyCash Agenda encontrada.';
    END IF;

    NEW.store_account_id := resolved_store_account_id;
  ELSE
    SELECT account.owner_user_id
    INTO resolved_owner_user_id
    FROM public.store_accounts AS account
    WHERE account.id = NEW.store_account_id
      AND account.product_context = 'happycashagenda';

    IF resolved_owner_user_id IS NULL THEN
      RAISE EXCEPTION 'Empresa HappyCash Agenda nao encontrada.';
    END IF;

    IF resolved_owner_user_id <> NEW.owner_user_id THEN
      RAISE EXCEPTION 'Registro nao pertence a empresa HappyCash Agenda informada.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_agenda_products_scope ON public.agenda_products;
CREATE TRIGGER assign_agenda_products_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.agenda_products
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

DROP TRIGGER IF EXISTS update_agenda_products_updated_at ON public.agenda_products;
CREATE TRIGGER update_agenda_products_updated_at
BEFORE UPDATE ON public.agenda_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "agenda products owner select"
ON public.agenda_products
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

CREATE POLICY "agenda products public active select"
ON public.agenda_products
FOR SELECT
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.agenda_business_settings AS settings
    WHERE settings.store_account_id = agenda_products.store_account_id
      AND settings.public_booking_enabled = true
  )
);

CREATE POLICY "agenda products owner insert"
ON public.agenda_products
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

CREATE POLICY "agenda products owner update"
ON public.agenda_products
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

CREATE POLICY "agenda products owner delete"
ON public.agenda_products
FOR DELETE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

CREATE TABLE IF NOT EXISTS public.agenda_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_clients_store_name_idx
  ON public.agenda_clients(store_account_id, name);

ALTER TABLE public.agenda_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_clients FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS assign_agenda_clients_scope ON public.agenda_clients;
CREATE TRIGGER assign_agenda_clients_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.agenda_clients
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

DROP TRIGGER IF EXISTS update_agenda_clients_updated_at ON public.agenda_clients;
CREATE TRIGGER update_agenda_clients_updated_at
BEFORE UPDATE ON public.agenda_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "agenda clients owner select"
ON public.agenda_clients
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

CREATE POLICY "agenda clients owner insert"
ON public.agenda_clients
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

CREATE POLICY "agenda clients owner update"
ON public.agenda_clients
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

CREATE POLICY "agenda clients owner delete"
ON public.agenda_clients
FOR DELETE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

ALTER TABLE public.agenda_business_settings
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE SET NULL;

UPDATE public.agenda_business_settings AS settings
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE settings.store_account_id IS NULL
  AND account.owner_user_id = settings.owner_user_id
  AND account.product_context = 'happycashagenda';

DROP TRIGGER IF EXISTS assign_agenda_business_settings_scope ON public.agenda_business_settings;
CREATE TRIGGER assign_agenda_business_settings_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.agenda_business_settings
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

ALTER TABLE public.barbers
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.appointment_services
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.business_hours
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.business_locations
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_progress
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS agenda_client_id uuid REFERENCES public.agenda_clients(id) ON DELETE SET NULL;

WITH agenda_accounts AS (
  SELECT id AS store_account_id, owner_user_id
  FROM public.store_accounts
  WHERE product_context = 'happycashagenda'
),
single_agenda_account AS (
  SELECT store_account_id, owner_user_id
  FROM agenda_accounts
  WHERE (SELECT count(*) FROM agenda_accounts) = 1
  LIMIT 1
)
UPDATE public.barbers AS record
SET
  store_account_id = account.store_account_id,
  owner_user_id = COALESCE(record.owner_user_id, account.owner_user_id)
FROM single_agenda_account AS account
WHERE record.store_account_id IS NULL;

WITH agenda_accounts AS (
  SELECT id AS store_account_id, owner_user_id
  FROM public.store_accounts
  WHERE product_context = 'happycashagenda'
),
single_agenda_account AS (
  SELECT store_account_id, owner_user_id
  FROM agenda_accounts
  WHERE (SELECT count(*) FROM agenda_accounts) = 1
  LIMIT 1
)
UPDATE public.services AS record
SET
  store_account_id = account.store_account_id,
  owner_user_id = COALESCE(record.owner_user_id, account.owner_user_id)
FROM single_agenda_account AS account
WHERE record.store_account_id IS NULL;

WITH agenda_accounts AS (
  SELECT id AS store_account_id, owner_user_id
  FROM public.store_accounts
  WHERE product_context = 'happycashagenda'
),
single_agenda_account AS (
  SELECT store_account_id, owner_user_id
  FROM agenda_accounts
  WHERE (SELECT count(*) FROM agenda_accounts) = 1
  LIMIT 1
)
UPDATE public.business_hours AS record
SET
  store_account_id = account.store_account_id,
  owner_user_id = COALESCE(record.owner_user_id, account.owner_user_id)
FROM single_agenda_account AS account
WHERE record.store_account_id IS NULL;

WITH agenda_accounts AS (
  SELECT id AS store_account_id, owner_user_id
  FROM public.store_accounts
  WHERE product_context = 'happycashagenda'
),
single_agenda_account AS (
  SELECT store_account_id, owner_user_id
  FROM agenda_accounts
  WHERE (SELECT count(*) FROM agenda_accounts) = 1
  LIMIT 1
)
UPDATE public.business_locations AS record
SET
  store_account_id = account.store_account_id,
  owner_user_id = COALESCE(record.owner_user_id, account.owner_user_id)
FROM single_agenda_account AS account
WHERE record.store_account_id IS NULL;

WITH agenda_accounts AS (
  SELECT id AS store_account_id, owner_user_id
  FROM public.store_accounts
  WHERE product_context = 'happycashagenda'
),
single_agenda_account AS (
  SELECT store_account_id, owner_user_id
  FROM agenda_accounts
  WHERE (SELECT count(*) FROM agenda_accounts) = 1
  LIMIT 1
)
UPDATE public.loyalty_programs AS record
SET
  store_account_id = account.store_account_id,
  owner_user_id = COALESCE(record.owner_user_id, account.owner_user_id)
FROM single_agenda_account AS account
WHERE record.store_account_id IS NULL;

UPDATE public.appointments AS appointment
SET
  store_account_id = barber.store_account_id,
  owner_user_id = barber.owner_user_id
FROM public.barbers AS barber
WHERE appointment.barber_id = barber.id
  AND appointment.store_account_id IS NULL
  AND barber.store_account_id IS NOT NULL;

UPDATE public.appointment_services AS appointment_service
SET
  store_account_id = appointment.store_account_id,
  owner_user_id = appointment.owner_user_id
FROM public.appointments AS appointment
WHERE appointment_service.appointment_id = appointment.id
  AND appointment_service.store_account_id IS NULL
  AND appointment.store_account_id IS NOT NULL;

UPDATE public.loyalty_progress AS progress
SET
  store_account_id = program.store_account_id,
  owner_user_id = program.owner_user_id
FROM public.loyalty_programs AS program
WHERE progress.program_id = program.id
  AND progress.store_account_id IS NULL
  AND program.store_account_id IS NOT NULL;

ALTER TABLE public.business_hours
  DROP CONSTRAINT IF EXISTS business_hours_day_of_week_key;

CREATE UNIQUE INDEX IF NOT EXISTS business_hours_store_day_key
  ON public.business_hours(store_account_id, day_of_week)
  WHERE store_account_id IS NOT NULL;

INSERT INTO public.agenda_business_settings (
  owner_user_id,
  store_account_id,
  slug,
  display_name,
  business_type,
  professional_label,
  service_label,
  tagline,
  public_booking_enabled
)
SELECT
  account.owner_user_id,
  account.id,
  LEFT('agenda-' || replace(account.id::text, '-', ''), 63) AS slug,
  account.nome_estabelecimento,
  account.tipo_estabelecimento,
  'Profissional',
  'Servico',
  'Agendamentos online com clientes, profissionais e pagamentos em um so lugar.',
  true
FROM public.store_accounts AS account
WHERE account.product_context = 'happycashagenda'
ON CONFLICT (owner_user_id) DO UPDATE
SET
  store_account_id = EXCLUDED.store_account_id,
  display_name = COALESCE(NULLIF(public.agenda_business_settings.display_name, ''), EXCLUDED.display_name),
  business_type = COALESCE(NULLIF(public.agenda_business_settings.business_type, ''), EXCLUDED.business_type),
  updated_at = now();

INSERT INTO public.business_hours (
  store_account_id,
  owner_user_id,
  day_of_week,
  open_time,
  close_time,
  is_open
)
SELECT
  account.id,
  account.owner_user_id,
  day_config.day_of_week,
  day_config.open_time,
  day_config.close_time,
  day_config.is_open
FROM public.store_accounts AS account
CROSS JOIN (
  VALUES
    (0, '09:00'::time, '19:30'::time, false),
    (1, '09:00'::time, '19:30'::time, true),
    (2, '09:00'::time, '19:30'::time, true),
    (3, '09:00'::time, '19:30'::time, true),
    (4, '09:00'::time, '19:30'::time, true),
    (5, '09:00'::time, '19:30'::time, true),
    (6, '09:00'::time, '19:30'::time, true)
) AS day_config(day_of_week, open_time, close_time, is_open)
WHERE account.product_context = 'happycashagenda'
  AND NOT EXISTS (
    SELECT 1
    FROM public.business_hours AS existing
    WHERE existing.store_account_id = account.id
      AND existing.day_of_week = day_config.day_of_week
  );

CREATE INDEX IF NOT EXISTS barbers_store_active_idx
  ON public.barbers(store_account_id, is_active, name);
CREATE INDEX IF NOT EXISTS services_store_active_idx
  ON public.services(store_account_id, is_active, name);
CREATE INDEX IF NOT EXISTS appointments_store_date_idx
  ON public.appointments(store_account_id, appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS business_hours_store_idx
  ON public.business_hours(store_account_id, day_of_week);
CREATE INDEX IF NOT EXISTS business_locations_store_idx
  ON public.business_locations(store_account_id, is_active);

DROP TRIGGER IF EXISTS assign_agenda_barbers_scope ON public.barbers;
CREATE TRIGGER assign_agenda_barbers_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.barbers
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

DROP TRIGGER IF EXISTS assign_agenda_services_scope ON public.services;
CREATE TRIGGER assign_agenda_services_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

DROP TRIGGER IF EXISTS assign_agenda_business_hours_scope ON public.business_hours;
CREATE TRIGGER assign_agenda_business_hours_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.business_hours
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

DROP TRIGGER IF EXISTS assign_agenda_business_locations_scope ON public.business_locations;
CREATE TRIGGER assign_agenda_business_locations_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.business_locations
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

DROP TRIGGER IF EXISTS assign_agenda_loyalty_programs_scope ON public.loyalty_programs;
CREATE TRIGGER assign_agenda_loyalty_programs_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.loyalty_programs
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

DROP TRIGGER IF EXISTS assign_agenda_loyalty_progress_scope ON public.loyalty_progress;
CREATE TRIGGER assign_agenda_loyalty_progress_scope
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id
ON public.loyalty_progress
FOR EACH ROW
EXECUTE FUNCTION public.assign_agenda_store_scope();

CREATE OR REPLACE FUNCTION public.agenda_owner_can_manage(target_store_account_id uuid, target_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND target_owner_user_id = public.get_current_store_owner_id()
    AND target_store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
    AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
$$;

CREATE OR REPLACE FUNCTION public.agenda_store_is_public(target_store_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agenda_business_settings AS settings
    WHERE settings.store_account_id = target_store_account_id
      AND settings.public_booking_enabled = true
  )
$$;

DROP POLICY IF EXISTS "agenda public active barbers" ON public.barbers;
DROP POLICY IF EXISTS "agenda admins manage barbers" ON public.barbers;
CREATE POLICY "agenda scoped barbers read"
ON public.barbers
FOR SELECT
USING (
  (is_active = true AND public.agenda_store_is_public(store_account_id))
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
  OR user_id = auth.uid()
);
CREATE POLICY "agenda scoped barbers manage"
ON public.barbers
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda public active services" ON public.services;
DROP POLICY IF EXISTS "agenda admins manage services" ON public.services;
CREATE POLICY "agenda scoped services read"
ON public.services
FOR SELECT
USING (
  (is_active = true AND public.agenda_store_is_public(store_account_id))
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
);
CREATE POLICY "agenda scoped services manage"
ON public.services
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda users view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "agenda users create appointments" ON public.appointments;
DROP POLICY IF EXISTS "agenda users update own appointments" ON public.appointments;
DROP POLICY IF EXISTS "agenda admins delete appointments" ON public.appointments;
CREATE POLICY "agenda scoped appointments read"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  auth.uid() = client_id
  OR auth.uid() = created_by
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
  OR EXISTS (
    SELECT 1
    FROM public.barbers AS barber
    WHERE barber.id = appointments.barber_id
      AND barber.user_id = auth.uid()
      AND barber.store_account_id = appointments.store_account_id
  )
);
CREATE POLICY "agenda scoped appointments update"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = client_id
  OR auth.uid() = created_by
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
  OR EXISTS (
    SELECT 1
    FROM public.barbers AS barber
    WHERE barber.id = appointments.barber_id
      AND barber.user_id = auth.uid()
      AND barber.store_account_id = appointments.store_account_id
  )
)
WITH CHECK (
  auth.uid() = client_id
  OR auth.uid() = created_by
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
  OR EXISTS (
    SELECT 1
    FROM public.barbers AS barber
    WHERE barber.id = appointments.barber_id
      AND barber.user_id = auth.uid()
      AND barber.store_account_id = appointments.store_account_id
  )
);
CREATE POLICY "agenda scoped appointments delete"
ON public.appointments
FOR DELETE
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda appointment services readable" ON public.appointment_services;
DROP POLICY IF EXISTS "agenda appointment services admins manage" ON public.appointment_services;
CREATE POLICY "agenda scoped appointment services read"
ON public.appointment_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.appointments AS appointment
    WHERE appointment.id = appointment_services.appointment_id
      AND appointment.store_account_id = appointment_services.store_account_id
      AND (
        appointment.client_id = auth.uid()
        OR appointment.created_by = auth.uid()
        OR public.agenda_owner_can_manage(appointment.store_account_id, appointment.owner_user_id)
        OR EXISTS (
          SELECT 1
          FROM public.barbers AS barber
          WHERE barber.id = appointment.barber_id
            AND barber.user_id = auth.uid()
            AND barber.store_account_id = appointment.store_account_id
        )
      )
  )
);
CREATE POLICY "agenda scoped appointment services manage"
ON public.appointment_services
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda public business hours" ON public.business_hours;
DROP POLICY IF EXISTS "agenda admins manage business hours" ON public.business_hours;
CREATE POLICY "agenda scoped business hours read"
ON public.business_hours
FOR SELECT
USING (
  public.agenda_store_is_public(store_account_id)
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
);
CREATE POLICY "agenda scoped business hours manage"
ON public.business_hours
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda public active locations" ON public.business_locations;
DROP POLICY IF EXISTS "agenda admins manage locations" ON public.business_locations;
CREATE POLICY "agenda scoped locations read"
ON public.business_locations
FOR SELECT
USING (
  (is_active = true AND public.agenda_store_is_public(store_account_id))
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
);
CREATE POLICY "agenda scoped locations manage"
ON public.business_locations
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda public active loyalty programs" ON public.loyalty_programs;
DROP POLICY IF EXISTS "agenda admins manage loyalty programs" ON public.loyalty_programs;
CREATE POLICY "agenda scoped loyalty programs read"
ON public.loyalty_programs
FOR SELECT
USING (
  (is_active = true AND public.agenda_store_is_public(store_account_id))
  OR public.agenda_owner_can_manage(store_account_id, owner_user_id)
);
CREATE POLICY "agenda scoped loyalty programs manage"
ON public.loyalty_programs
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

DROP POLICY IF EXISTS "agenda authenticated loyalty progress read" ON public.loyalty_progress;
DROP POLICY IF EXISTS "agenda admins manage loyalty progress" ON public.loyalty_progress;
CREATE POLICY "agenda scoped loyalty progress read"
ON public.loyalty_progress
FOR SELECT
TO authenticated
USING (
  public.agenda_owner_can_manage(store_account_id, owner_user_id)
  OR client_id = auth.uid()
);
CREATE POLICY "agenda scoped loyalty progress manage"
ON public.loyalty_progress
FOR ALL
TO authenticated
USING (public.agenda_owner_can_manage(store_account_id, owner_user_id))
WITH CHECK (public.agenda_owner_can_manage(store_account_id, owner_user_id));

CREATE OR REPLACE FUNCTION public.appointment_total_duration_minutes(p_appointment_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    COALESCE(service.duration_minutes, 0)
    + COALESCE((
      SELECT SUM(extra_service.duration_minutes)
      FROM public.appointment_services AS appointment_service
      JOIN public.services AS extra_service
        ON extra_service.id = appointment_service.service_id
       AND extra_service.store_account_id = appointment_service.store_account_id
      WHERE appointment_service.appointment_id = p_appointment_id
    ), 0)
  FROM public.appointments AS appointment
  JOIN public.services AS service
    ON service.id = appointment.service_id
   AND service.store_account_id = appointment.store_account_id
  WHERE appointment.id = p_appointment_id
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
  target_store_account_id uuid;
BEGIN
  IF p_barber_id IS NULL OR p_appointment_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Dados insuficientes para validar horario.';
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'Duracao invalida para validar horario.';
  END IF;

  SELECT barber.store_account_id
  INTO target_store_account_id
  FROM public.barbers AS barber
  WHERE barber.id = p_barber_id;

  IF target_store_account_id IS NULL THEN
    RAISE EXCEPTION 'Profissional sem empresa vinculada.';
  END IF;

  new_start_min := FLOOR(EXTRACT(EPOCH FROM p_start_time) / 60);
  new_end_min := new_start_min + p_duration_minutes;

  SELECT appointment.id
  INTO conflict_id
  FROM public.appointments AS appointment
  WHERE appointment.store_account_id = target_store_account_id
    AND appointment.barber_id = p_barber_id
    AND appointment.appointment_date = p_appointment_date
    AND appointment.status = 'scheduled'
    AND (p_ignore_appointment_id IS NULL OR appointment.id <> p_ignore_appointment_id)
    AND (
      new_start_min < (FLOOR(EXTRACT(EPOCH FROM appointment.appointment_time) / 60) + public.appointment_total_duration_minutes(appointment.id))
      AND new_end_min > FLOOR(EXTRACT(EPOCH FROM appointment.appointment_time) / 60)
    )
  LIMIT 1;

  IF conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Horario indisponivel: ja existe outro agendamento neste intervalo.';
  END IF;
END;
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
  target_store_account_id uuid;
  target_owner_user_id uuid;
  invalid_service_count integer;
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

  SELECT COALESCE(SUM(service.duration_minutes), 0)
  INTO total_duration
  FROM public.services AS service
  WHERE service.id = ANY(p_service_ids)
    AND service.store_account_id = target_store_account_id;

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
    store_account_id,
    owner_user_id,
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
    target_store_account_id,
    target_owner_user_id,
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

CREATE OR REPLACE FUNCTION public.get_barber_booked_slots(p_barber_id uuid, p_appointment_date date)
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
    AND barber.user_id = auth.uid()
  ORDER BY appointment.appointment_date DESC, appointment.appointment_time DESC
$$;

DROP FUNCTION IF EXISTS public.get_appointment_extra_services(uuid[]);
CREATE OR REPLACE FUNCTION public.get_appointment_extra_services(p_appointment_ids uuid[])
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
    service.id AS service_id,
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
  WHERE appointment_service.appointment_id = ANY(p_appointment_ids)
    AND (
      appointment.client_id = auth.uid()
      OR appointment.created_by = auth.uid()
      OR public.agenda_owner_can_manage(appointment.store_account_id, appointment.owner_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.barbers AS barber
        WHERE barber.id = appointment.barber_id
          AND barber.user_id = auth.uid()
          AND barber.store_account_id = appointment.store_account_id
      )
    )
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
    AND barber.user_id = auth.uid()
  ORDER BY appointment_service.added_at
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
  appointment_row record;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbers AS barber
    WHERE barber.id = p_barber_id
      AND barber.user_id = auth.uid()
      AND barber.store_account_id = appointment_row.store_account_id
  ) THEN
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
  appointment_row record;
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.barbers AS barber
    WHERE barber.id = p_barber_id
      AND barber.user_id = auth.uid()
      AND barber.store_account_id = appointment_row.store_account_id
  ) THEN
    RAISE EXCEPTION 'Voce nao tem permissao para cancelar este agendamento.';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_appointment_id
    AND store_account_id = appointment_row.store_account_id;

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
  program_row record;
  progress_row record;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  FOR program_row IN
    SELECT id, goal_count, service_id
    FROM public.loyalty_programs
    WHERE store_account_id = NEW.store_account_id
      AND is_active = true
      AND (service_id IS NULL OR service_id = NEW.service_id)
  LOOP
    FOR progress_row IN
      SELECT progress.id, progress.current_count
      FROM public.loyalty_progress AS progress
      WHERE progress.store_account_id = NEW.store_account_id
        AND progress.program_id = program_row.id
        AND lower(trim(progress.client_name)) = lower(trim(NEW.client_name))
        AND progress.reward_claimed = false
    LOOP
      UPDATE public.loyalty_progress
      SET
        current_count = progress_row.current_count + 1,
        completed = (progress_row.current_count + 1) >= program_row.goal_count,
        updated_at = now()
      WHERE id = progress_row.id
        AND store_account_id = NEW.store_account_id;
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;
