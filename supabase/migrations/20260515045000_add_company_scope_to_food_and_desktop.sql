CREATE OR REPLACE FUNCTION public.assign_store_account_id_from_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_store_account_id uuid;
  resolved_owner_user_id uuid;
BEGIN
  IF NEW.store_account_id IS NOT NULL THEN
    SELECT owner_user_id
    INTO resolved_owner_user_id
    FROM public.store_accounts
    WHERE id = NEW.store_account_id;

    IF resolved_owner_user_id IS NULL THEN
      RAISE EXCEPTION 'Store account % nao encontrado.', NEW.store_account_id;
    END IF;

    IF NEW.owner_user_id IS NULL THEN
      NEW.owner_user_id := resolved_owner_user_id;
    ELSIF NEW.owner_user_id <> resolved_owner_user_id THEN
      RAISE EXCEPTION 'owner_user_id % nao pertence ao store_account_id %.', NEW.owner_user_id, NEW.store_account_id;
    END IF;
  END IF;

  IF NEW.owner_user_id IS NOT NULL AND NEW.store_account_id IS NULL THEN
    SELECT id
    INTO resolved_store_account_id
    FROM public.store_accounts
    WHERE owner_user_id = NEW.owner_user_id
    LIMIT 1;

    IF resolved_store_account_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma empresa encontrada para o owner_user_id %.', NEW.owner_user_id;
    END IF;

    NEW.store_account_id := resolved_store_account_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.desktop_machine_activations
  ADD COLUMN IF NOT EXISTS app_context text NOT NULL DEFAULT 'happycash',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.desktop_machine_activations AS activation
SET
  store_account_id = account.id,
  app_context = COALESCE(NULLIF(trim(activation.app_context), ''), 'happycash'),
  updated_at = now()
FROM public.store_accounts AS account
WHERE account.owner_user_id = activation.owner_user_id
  AND activation.store_account_id IS NULL;

ALTER TABLE public.desktop_machine_activations
  ALTER COLUMN store_account_id SET NOT NULL,
  ALTER COLUMN app_context SET DEFAULT 'happycash';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'desktop_machine_activations_owner_user_id_installation_id_key'
  ) THEN
    ALTER TABLE public.desktop_machine_activations
      DROP CONSTRAINT desktop_machine_activations_owner_user_id_installation_id_key;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'desktop_machine_activations_store_app_installation_key'
  ) THEN
    ALTER TABLE public.desktop_machine_activations
      ADD CONSTRAINT desktop_machine_activations_store_app_installation_key
      UNIQUE (store_account_id, app_context, installation_id);
  END IF;
END
$$;

DROP INDEX IF EXISTS desktop_machine_activations_store_account_idx;
CREATE INDEX IF NOT EXISTS desktop_machine_activations_store_context_idx
  ON public.desktop_machine_activations (store_account_id, app_context, activated_at DESC);

CREATE INDEX IF NOT EXISTS desktop_machine_activations_owner_context_idx
  ON public.desktop_machine_activations (owner_user_id, app_context, activated_at DESC);

DROP TRIGGER IF EXISTS assign_store_account_id_desktop_machine_activations ON public.desktop_machine_activations;
CREATE TRIGGER assign_store_account_id_desktop_machine_activations
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.desktop_machine_activations
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

ALTER TABLE public.restaurant_tables
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_menu_categories
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_menu_item_options
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_menu_item_option_values
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_orders
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_order_items
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_order_payments
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_delivery_orders
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_recipe_items
  ADD COLUMN IF NOT EXISTS store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE CASCADE;

UPDATE public.restaurant_tables AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_menu_categories AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_menu_items AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_menu_item_options AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_menu_item_option_values AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_orders AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_order_items AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_order_payments AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_delivery_orders AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

UPDATE public.restaurant_recipe_items AS record
SET store_account_id = account.id
FROM public.store_accounts AS account
WHERE account.owner_user_id = record.owner_user_id
  AND record.store_account_id IS NULL;

ALTER TABLE public.restaurant_tables
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_menu_categories
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_menu_items
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_menu_item_options
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_menu_item_option_values
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_orders
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_order_items
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_order_payments
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_delivery_orders
  ALTER COLUMN store_account_id SET NOT NULL;
ALTER TABLE public.restaurant_recipe_items
  ALTER COLUMN store_account_id SET NOT NULL;

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_tables ON public.restaurant_tables;
CREATE TRIGGER assign_store_account_id_restaurant_tables
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_menu_categories ON public.restaurant_menu_categories;
CREATE TRIGGER assign_store_account_id_restaurant_menu_categories
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_menu_categories
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_menu_items ON public.restaurant_menu_items;
CREATE TRIGGER assign_store_account_id_restaurant_menu_items
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_menu_items
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_menu_item_options ON public.restaurant_menu_item_options;
CREATE TRIGGER assign_store_account_id_restaurant_menu_item_options
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_menu_item_options
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_menu_item_option_values ON public.restaurant_menu_item_option_values;
CREATE TRIGGER assign_store_account_id_restaurant_menu_item_option_values
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_menu_item_option_values
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_orders ON public.restaurant_orders;
CREATE TRIGGER assign_store_account_id_restaurant_orders
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_order_items ON public.restaurant_order_items;
CREATE TRIGGER assign_store_account_id_restaurant_order_items
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_order_items
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_order_payments ON public.restaurant_order_payments;
CREATE TRIGGER assign_store_account_id_restaurant_order_payments
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_order_payments
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_delivery_orders ON public.restaurant_delivery_orders;
CREATE TRIGGER assign_store_account_id_restaurant_delivery_orders
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_delivery_orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_recipe_items ON public.restaurant_recipe_items;
CREATE TRIGGER assign_store_account_id_restaurant_recipe_items
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_recipe_items
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

CREATE INDEX IF NOT EXISTS restaurant_tables_store_status_idx
  ON public.restaurant_tables (store_account_id, status, code);
CREATE INDEX IF NOT EXISTS restaurant_menu_categories_store_idx
  ON public.restaurant_menu_categories (store_account_id, active, sort_order);
CREATE INDEX IF NOT EXISTS restaurant_menu_items_store_category_idx
  ON public.restaurant_menu_items (store_account_id, category_id, active, qr_visible);
CREATE INDEX IF NOT EXISTS restaurant_menu_item_options_store_idx
  ON public.restaurant_menu_item_options (store_account_id, menu_item_id, active);
CREATE INDEX IF NOT EXISTS restaurant_menu_item_option_values_store_idx
  ON public.restaurant_menu_item_option_values (store_account_id, option_id, active);
CREATE INDEX IF NOT EXISTS restaurant_orders_store_status_idx
  ON public.restaurant_orders (store_account_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_order_items_store_status_idx
  ON public.restaurant_order_items (store_account_id, station, status, sent_at);
CREATE INDEX IF NOT EXISTS restaurant_order_payments_store_paid_idx
  ON public.restaurant_order_payments (store_account_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_delivery_orders_store_status_idx
  ON public.restaurant_delivery_orders (store_account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_recipe_items_store_product_idx
  ON public.restaurant_recipe_items (store_account_id, product_id);

DROP POLICY IF EXISTS "restaurant_tables_store_all" ON public.restaurant_tables;
CREATE POLICY "restaurant_tables_store_all"
ON public.restaurant_tables
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_menu_categories_store_all" ON public.restaurant_menu_categories;
CREATE POLICY "restaurant_menu_categories_store_all"
ON public.restaurant_menu_categories
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_menu_items_store_all" ON public.restaurant_menu_items;
CREATE POLICY "restaurant_menu_items_store_all"
ON public.restaurant_menu_items
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_menu_item_options_store_all" ON public.restaurant_menu_item_options;
CREATE POLICY "restaurant_menu_item_options_store_all"
ON public.restaurant_menu_item_options
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_menu_item_option_values_store_all" ON public.restaurant_menu_item_option_values;
CREATE POLICY "restaurant_menu_item_option_values_store_all"
ON public.restaurant_menu_item_option_values
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_orders_store_all" ON public.restaurant_orders;
CREATE POLICY "restaurant_orders_store_all"
ON public.restaurant_orders
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_order_items_store_all" ON public.restaurant_order_items;
CREATE POLICY "restaurant_order_items_store_all"
ON public.restaurant_order_items
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_order_payments_store_all" ON public.restaurant_order_payments;
CREATE POLICY "restaurant_order_payments_store_all"
ON public.restaurant_order_payments
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_delivery_orders_store_all" ON public.restaurant_delivery_orders;
CREATE POLICY "restaurant_delivery_orders_store_all"
ON public.restaurant_delivery_orders
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);

DROP POLICY IF EXISTS "restaurant_recipe_items_store_all" ON public.restaurant_recipe_items;
CREATE POLICY "restaurant_recipe_items_store_all"
ON public.restaurant_recipe_items
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
);
