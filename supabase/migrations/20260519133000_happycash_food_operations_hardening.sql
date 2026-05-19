ALTER TABLE public.restaurant_order_payments
  DROP CONSTRAINT IF EXISTS restaurant_order_payments_payment_method_check;

ALTER TABLE public.restaurant_order_payments
  ADD CONSTRAINT restaurant_order_payments_payment_method_check
  CHECK (payment_method IN ('pix', 'debit', 'credit', 'voucher', 'card', 'cash', 'mixed', 'fiado'));

ALTER TABLE public.restaurant_delivery_orders
  ADD COLUMN IF NOT EXISTS courier_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tracking_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS coupon_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS estimated_minutes integer NOT NULL DEFAULT 45 CHECK (estimated_minutes > 0);

ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS removable_ingredients text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.restaurant_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unidade' CHECK (unit IN ('kg', 'litro', 'unidade', 'caixa')),
  current_stock numeric(12,3) NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  minimum_stock numeric(12,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  average_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
  supplier text NOT NULL DEFAULT '',
  expiration_date date,
  production_area text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  last_movement_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, name)
);

CREATE TABLE IF NOT EXISTS public.restaurant_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.restaurant_inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('entrada', 'venda', 'perda', 'producao', 'inventario')),
  quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit text NOT NULL DEFAULT 'unidade' CHECK (unit IN ('kg', 'litro', 'unidade', 'caixa')),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_product_technical_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE CASCADE,
  yield_quantity numeric(10,3) NOT NULL DEFAULT 1 CHECK (yield_quantity > 0),
  packaging_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (packaging_cost >= 0),
  waste_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (waste_percent >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, menu_item_id)
);

CREATE TABLE IF NOT EXISTS public.restaurant_product_technical_sheet_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  technical_sheet_id uuid NOT NULL REFERENCES public.restaurant_product_technical_sheets(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.restaurant_inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'unidade' CHECK (unit IN ('kg', 'litro', 'unidade', 'caixa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (technical_sheet_id, inventory_item_id)
);

CREATE TABLE IF NOT EXISTS public.restaurant_table_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('call_waiter', 'request_bill', 'talk_to_staff')),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'done', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS touch_restaurant_inventory_items_updated_at ON public.restaurant_inventory_items;
CREATE TRIGGER touch_restaurant_inventory_items_updated_at
BEFORE UPDATE ON public.restaurant_inventory_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_product_technical_sheets_updated_at ON public.restaurant_product_technical_sheets;
CREATE TRIGGER touch_restaurant_product_technical_sheets_updated_at
BEFORE UPDATE ON public.restaurant_product_technical_sheets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_table_service_requests_updated_at ON public.restaurant_table_service_requests;
CREATE TRIGGER touch_restaurant_table_service_requests_updated_at
BEFORE UPDATE ON public.restaurant_table_service_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_inventory_items ON public.restaurant_inventory_items;
CREATE TRIGGER assign_store_account_id_restaurant_inventory_items
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_stock_movements ON public.restaurant_stock_movements;
CREATE TRIGGER assign_store_account_id_restaurant_stock_movements
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_product_technical_sheets ON public.restaurant_product_technical_sheets;
CREATE TRIGGER assign_store_account_id_restaurant_product_technical_sheets
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_product_technical_sheets
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_product_technical_sheet_ingredients ON public.restaurant_product_technical_sheet_ingredients;
CREATE TRIGGER assign_store_account_id_restaurant_product_technical_sheet_ingredients
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_product_technical_sheet_ingredients
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_table_service_requests ON public.restaurant_table_service_requests;
CREATE TRIGGER assign_store_account_id_restaurant_table_service_requests
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_table_service_requests
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

CREATE INDEX IF NOT EXISTS restaurant_inventory_items_store_active_idx
  ON public.restaurant_inventory_items (store_account_id, active, name);
CREATE INDEX IF NOT EXISTS restaurant_inventory_items_store_alert_idx
  ON public.restaurant_inventory_items (store_account_id, current_stock, minimum_stock, expiration_date);
CREATE INDEX IF NOT EXISTS restaurant_stock_movements_store_created_idx
  ON public.restaurant_stock_movements (store_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_product_technical_sheets_store_item_idx
  ON public.restaurant_product_technical_sheets (store_account_id, menu_item_id);
CREATE INDEX IF NOT EXISTS restaurant_product_technical_sheet_ingredients_sheet_idx
  ON public.restaurant_product_technical_sheet_ingredients (technical_sheet_id);
CREATE INDEX IF NOT EXISTS restaurant_table_service_requests_store_status_idx
  ON public.restaurant_table_service_requests (store_account_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_table_service_requests_table_status_idx
  ON public.restaurant_table_service_requests (table_id, status, requested_at DESC);

ALTER TABLE public.restaurant_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_product_technical_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_product_technical_sheet_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_table_service_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.restaurant_inventory_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_stock_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_product_technical_sheets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_product_technical_sheet_ingredients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_table_service_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_inventory_items_store_all" ON public.restaurant_inventory_items;
CREATE POLICY "restaurant_inventory_items_store_all"
ON public.restaurant_inventory_items
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

DROP POLICY IF EXISTS "restaurant_stock_movements_store_all" ON public.restaurant_stock_movements;
CREATE POLICY "restaurant_stock_movements_store_all"
ON public.restaurant_stock_movements
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

DROP POLICY IF EXISTS "restaurant_product_technical_sheets_store_all" ON public.restaurant_product_technical_sheets;
CREATE POLICY "restaurant_product_technical_sheets_store_all"
ON public.restaurant_product_technical_sheets
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

DROP POLICY IF EXISTS "restaurant_product_technical_sheet_ingredients_store_all" ON public.restaurant_product_technical_sheet_ingredients;
CREATE POLICY "restaurant_product_technical_sheet_ingredients_store_all"
ON public.restaurant_product_technical_sheet_ingredients
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

DROP POLICY IF EXISTS "restaurant_table_service_requests_store_all" ON public.restaurant_table_service_requests;
CREATE POLICY "restaurant_table_service_requests_store_all"
ON public.restaurant_table_service_requests
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
