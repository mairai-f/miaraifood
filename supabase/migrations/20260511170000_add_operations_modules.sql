CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name text NOT NULL DEFAULT '',
  invoice_number text NOT NULL DEFAULT '',
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'received', 'canceled')),
  subtotal numeric(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  freight_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (freight_amount >= 0),
  tax_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  quantity numeric(10,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type text NOT NULL CHECK (account_type IN ('payable', 'receivable')),
  description text NOT NULL DEFAULT '',
  party_name text NOT NULL DEFAULT '',
  amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  due_date date NOT NULL DEFAULT CURRENT_DATE,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'canceled')),
  source text NOT NULL DEFAULT 'manual',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  discount_type text NOT NULL DEFAULT 'amount' CHECK (discount_type IN ('amount', 'percent', 'fixed_price')),
  discount_value numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  product_name text NOT NULL DEFAULT '',
  batch_code text NOT NULL DEFAULT '',
  quantity numeric(10,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  expiration_date date NOT NULL,
  alert_days integer NOT NULL DEFAULT 30 CHECK (alert_days >= 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_orders_owner_date_idx
  ON public.purchase_orders(owner_user_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS purchase_order_items_order_idx
  ON public.purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS financial_accounts_owner_due_idx
  ON public.financial_accounts(owner_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS product_promotions_owner_active_idx
  ON public.product_promotions(owner_user_id, active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS product_batches_owner_expiration_idx
  ON public.product_batches(owner_user_id, expiration_date);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER touch_purchase_orders_updated_at
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_financial_accounts_updated_at ON public.financial_accounts;
CREATE TRIGGER touch_financial_accounts_updated_at
BEFORE UPDATE ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_product_promotions_updated_at ON public.product_promotions;
CREATE TRIGGER touch_product_promotions_updated_at
BEFORE UPDATE ON public.product_promotions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_product_batches_updated_at ON public.product_batches;
CREATE TRIGGER touch_product_batches_updated_at
BEFORE UPDATE ON public.product_batches
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.purchase_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_promotions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_batches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_orders_owner_all" ON public.purchase_orders;
CREATE POLICY "purchase_orders_owner_all"
ON public.purchase_orders
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "purchase_order_items_owner_all" ON public.purchase_order_items;
CREATE POLICY "purchase_order_items_owner_all"
ON public.purchase_order_items
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "financial_accounts_owner_all" ON public.financial_accounts;
CREATE POLICY "financial_accounts_owner_all"
ON public.financial_accounts
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "product_promotions_owner_all" ON public.product_promotions;
CREATE POLICY "product_promotions_owner_all"
ON public.product_promotions
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "product_batches_owner_all" ON public.product_batches;
CREATE POLICY "product_batches_owner_all"
ON public.product_batches
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());
