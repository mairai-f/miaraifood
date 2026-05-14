CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT 'Salao',
  seats integer NOT NULL DEFAULT 4 CHECK (seats > 0),
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free', 'occupied', 'closing', 'inactive')),
  qr_slug text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, code),
  UNIQUE (owner_user_id, qr_slug)
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  qr_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.restaurant_menu_categories(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'counter')),
  prep_minutes integer NOT NULL DEFAULT 10 CHECK (prep_minutes >= 0),
  image_url text,
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  qr_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  option_type text NOT NULL DEFAULT 'single' CHECK (option_type IN ('single', 'multiple', 'quantity')),
  min_selected integer NOT NULL DEFAULT 0 CHECK (min_selected >= 0),
  max_selected integer CHECK (max_selected IS NULL OR max_selected >= min_selected),
  required boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_item_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.restaurant_menu_item_options(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT 'dine_in' CHECK (service_type IN ('dine_in', 'takeaway', 'delivery', 'qr_menu')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'sent', 'preparing', 'ready', 'served', 'closing', 'paid', 'cancelled')),
  opened_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  subtotal numeric(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  service_fee_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (service_fee_amount >= 0),
  discount_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  station text NOT NULL DEFAULT 'kitchen' CHECK (station IN ('kitchen', 'bar', 'counter')),
  quantity numeric(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text NOT NULL DEFAULT '',
  selected_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'preparing', 'ready', 'delivered', 'cancelled')),
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  cash_session_id uuid REFERENCES public.cash_sessions(id) ON DELETE SET NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('pix', 'card', 'cash', 'mixed', 'fiado')),
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  cash_received numeric(10,2) NOT NULL DEFAULT 0 CHECK (cash_received >= 0),
  change_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  tip_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (tip_amount >= 0),
  paid_by_name text NOT NULL DEFAULT '',
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.restaurant_orders(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  number text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  driver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'preparing', 'out', 'delivered', 'cancelled')),
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restaurant_recipe_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  ingredient_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'un',
  waste_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (waste_percent >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, product_id, ingredient_product_id)
);

CREATE INDEX IF NOT EXISTS restaurant_tables_owner_status_idx
  ON public.restaurant_tables(owner_user_id, status, code);
CREATE INDEX IF NOT EXISTS restaurant_orders_owner_status_idx
  ON public.restaurant_orders(owner_user_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_orders_table_status_idx
  ON public.restaurant_orders(table_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_order_items_owner_status_idx
  ON public.restaurant_order_items(owner_user_id, station, status, sent_at);
CREATE INDEX IF NOT EXISTS restaurant_order_items_order_idx
  ON public.restaurant_order_items(order_id);
CREATE INDEX IF NOT EXISTS restaurant_delivery_orders_owner_status_idx
  ON public.restaurant_delivery_orders(owner_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS restaurant_menu_items_owner_category_idx
  ON public.restaurant_menu_items(owner_user_id, category_id, active, qr_visible);
CREATE INDEX IF NOT EXISTS restaurant_recipe_items_product_idx
  ON public.restaurant_recipe_items(product_id);

DROP TRIGGER IF EXISTS touch_restaurant_tables_updated_at ON public.restaurant_tables;
CREATE TRIGGER touch_restaurant_tables_updated_at
BEFORE UPDATE ON public.restaurant_tables
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_menu_categories_updated_at ON public.restaurant_menu_categories;
CREATE TRIGGER touch_restaurant_menu_categories_updated_at
BEFORE UPDATE ON public.restaurant_menu_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_menu_items_updated_at ON public.restaurant_menu_items;
CREATE TRIGGER touch_restaurant_menu_items_updated_at
BEFORE UPDATE ON public.restaurant_menu_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_orders_updated_at ON public.restaurant_orders;
CREATE TRIGGER touch_restaurant_orders_updated_at
BEFORE UPDATE ON public.restaurant_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_order_items_updated_at ON public.restaurant_order_items;
CREATE TRIGGER touch_restaurant_order_items_updated_at
BEFORE UPDATE ON public.restaurant_order_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_delivery_orders_updated_at ON public.restaurant_delivery_orders;
CREATE TRIGGER touch_restaurant_delivery_orders_updated_at
BEFORE UPDATE ON public.restaurant_delivery_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_restaurant_recipe_items_updated_at ON public.restaurant_recipe_items;
CREATE TRIGGER touch_restaurant_recipe_items_updated_at
BEFORE UPDATE ON public.restaurant_recipe_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_item_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_recipe_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.restaurant_tables FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_item_options FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_item_option_values FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_order_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_delivery_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_recipe_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_tables_store_all" ON public.restaurant_tables;
CREATE POLICY "restaurant_tables_store_all"
ON public.restaurant_tables
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_menu_categories_store_all" ON public.restaurant_menu_categories;
CREATE POLICY "restaurant_menu_categories_store_all"
ON public.restaurant_menu_categories
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_menu_items_store_all" ON public.restaurant_menu_items;
CREATE POLICY "restaurant_menu_items_store_all"
ON public.restaurant_menu_items
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_menu_item_options_store_all" ON public.restaurant_menu_item_options;
CREATE POLICY "restaurant_menu_item_options_store_all"
ON public.restaurant_menu_item_options
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_menu_item_option_values_store_all" ON public.restaurant_menu_item_option_values;
CREATE POLICY "restaurant_menu_item_option_values_store_all"
ON public.restaurant_menu_item_option_values
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_orders_store_all" ON public.restaurant_orders;
CREATE POLICY "restaurant_orders_store_all"
ON public.restaurant_orders
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_order_items_store_all" ON public.restaurant_order_items;
CREATE POLICY "restaurant_order_items_store_all"
ON public.restaurant_order_items
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_order_payments_store_all" ON public.restaurant_order_payments;
CREATE POLICY "restaurant_order_payments_store_all"
ON public.restaurant_order_payments
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_delivery_orders_store_all" ON public.restaurant_delivery_orders;
CREATE POLICY "restaurant_delivery_orders_store_all"
ON public.restaurant_delivery_orders
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

DROP POLICY IF EXISTS "restaurant_recipe_items_store_all" ON public.restaurant_recipe_items;
CREATE POLICY "restaurant_recipe_items_store_all"
ON public.restaurant_recipe_items
FOR ALL
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id())
WITH CHECK (owner_user_id = public.get_current_store_owner_id());

ALTER TABLE public.subscription_plans
DROP CONSTRAINT IF EXISTS subscription_plans_id_check;

ALTER TABLE public.subscription_plans
ADD CONSTRAINT subscription_plans_id_check
CHECK (id IN ('demo', 'fiado', 'completo', 'pro', 'food', 'food_offline'));

INSERT INTO public.subscription_plans (
  id,
  name,
  description,
  price,
  annual_price,
  billing_cycle,
  duration_days,
  trial_hours,
  sort_order,
  is_active,
  is_public
)
VALUES
  (
    'food',
    'HappyCashFood',
    'Sistema restaurante web com mesas, comandas, cardapio QR, garcom, cozinha, delivery, caixa, estoque e relatorios.',
    250,
    2497,
    'monthly',
    30,
    0,
    4,
    true,
    true
  ),
  (
    'food_offline',
    'HappyCashFood Offline',
    'HappyCashFood com sistema offline, executavel Windows, Linux, pacote .deb e Android APK.',
    310,
    3097,
    'monthly',
    30,
    0,
    5,
    true,
    true
  )
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  annual_price = EXCLUDED.annual_price,
  billing_cycle = EXCLUDED.billing_cycle,
  duration_days = EXCLUDED.duration_days,
  trial_hours = EXCLUDED.trial_hours,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  is_public = true,
  updated_at = now();

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('food', 'dashboard.view', true),
  ('food', 'clients.manage', true),
  ('food', 'products.manage', true),
  ('food', 'deleted.view', true),
  ('food', 'fiado.manage', true),
  ('food', 'pdv.use', true),
  ('food', 'stock.manage', true),
  ('food', 'reports.view', true),
  ('food', 'financial.manage', true),
  ('food', 'notes.manage', true),
  ('food', 'rewards.manage', true),
  ('food', 'settings.manage', true),
  ('food', 'operators.manage', true),
  ('food', 'cash.manage', true),
  ('food', 'fiscal.manage', true),
  ('food', 'restaurant.manage', true),
  ('food', 'restaurant.kds', true),
  ('food', 'restaurant.qr_menu', true),
  ('food', 'restaurant.delivery', true),
  ('food_offline', 'dashboard.view', true),
  ('food_offline', 'clients.manage', true),
  ('food_offline', 'products.manage', true),
  ('food_offline', 'deleted.view', true),
  ('food_offline', 'fiado.manage', true),
  ('food_offline', 'pdv.use', true),
  ('food_offline', 'stock.manage', true),
  ('food_offline', 'reports.view', true),
  ('food_offline', 'financial.manage', true),
  ('food_offline', 'notes.manage', true),
  ('food_offline', 'rewards.manage', true),
  ('food_offline', 'settings.manage', true),
  ('food_offline', 'operators.manage', true),
  ('food_offline', 'cash.manage', true),
  ('food_offline', 'fiscal.manage', true),
  ('food_offline', 'restaurant.manage', true),
  ('food_offline', 'restaurant.kds', true),
  ('food_offline', 'restaurant.qr_menu', true),
  ('food_offline', 'restaurant.delivery', true),
  ('food_offline', 'desktop.app', true),
  ('food_offline', 'mobile.app', true),
  ('food_offline', 'offline.access', true),
  ('pro', 'restaurant.manage', true),
  ('pro', 'restaurant.kds', true),
  ('pro', 'restaurant.qr_menu', true),
  ('pro', 'restaurant.delivery', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;
