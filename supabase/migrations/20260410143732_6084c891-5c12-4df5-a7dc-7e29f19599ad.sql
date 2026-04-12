
-- 1. nova coluna para produtos 
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS code integer;

CREATE SEQUENCE IF NOT EXISTS public.products_code_seq;

WITH next_codes AS (
  SELECT
    id,
    row_number() OVER (ORDER BY created_at, name, id) + COALESCE((SELECT max(code) FROM public.products WHERE code IS NOT NULL), 0) AS next_code
  FROM public.products
  WHERE code IS NULL
)
UPDATE public.products AS products
SET code = next_codes.next_code
FROM next_codes
WHERE products.id = next_codes.id;

DO $$
DECLARE
  max_product_code integer;
BEGIN
  SELECT COALESCE(max(code), 0) INTO max_product_code FROM public.products;
  PERFORM setval('public.products_code_seq', GREATEST(max_product_code, 1), max_product_code > 0);
END $$;

ALTER TABLE public.products ALTER COLUMN code SET DEFAULT nextval('public.products_code_seq');
ALTER TABLE public.products ALTER COLUMN code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_code_key ON public.products(code);

-- 2. Create sales table
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'dinheiro',
  cash_received numeric NOT NULL DEFAULT 0,
  change_amount numeric NOT NULL DEFAULT 0,
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_name text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_delivery boolean NOT NULL DEFAULT false;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;

DROP POLICY IF EXISTS "Auth users can view sales" ON public.sales;
DROP POLICY IF EXISTS "Auth users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Auth users can update sales" ON public.sales;
DROP POLICY IF EXISTS "Auth users can delete sales" ON public.sales;

CREATE POLICY "Auth users can view sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth users can update sales" ON public.sales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete sales" ON public.sales FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS update_sales_updated_at ON public.sales;
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create sale_items table
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  cost_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can view sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Auth users can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Auth users can update sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Auth users can delete sale_items" ON public.sale_items;

CREATE POLICY "Auth users can view sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update sale_items" ON public.sale_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete sale_items" ON public.sale_items FOR DELETE TO authenticated USING (true);

-- 4. Create stock_movements table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'entrada',
  quantity integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can view stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Auth users can insert stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Auth users can update stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Auth users can delete stock_movements" ON public.stock_movements;

CREATE POLICY "Auth users can view stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can insert stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth users can update stock_movements" ON public.stock_movements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth users can delete stock_movements" ON public.stock_movements FOR DELETE TO authenticated USING (true);

-- 5. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL,
  category text NOT NULL DEFAULT '',
  date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Auth users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Auth users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Auth users can delete expenses" ON public.expenses;

CREATE POLICY "Auth users can view expenses" ON public.expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Auth users can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth users can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Auth users can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Enable realtime for sales
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
