CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  whatsapp text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_owner_name_unique_idx
  ON public.suppliers (owner_user_id, lower(name));

CREATE INDEX IF NOT EXISTS suppliers_owner_active_idx
  ON public.suppliers (owner_user_id, active, name);

DROP TRIGGER IF EXISTS touch_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER touch_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "suppliers_owner_all" ON public.suppliers;
CREATE POLICY "suppliers_owner_all"
ON public.suppliers
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

INSERT INTO public.suppliers (owner_user_id, name)
SELECT product.user_id, min(trim(product.supplier_name))
FROM public.products AS product
WHERE trim(coalesce(product.supplier_name, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.suppliers AS supplier
    WHERE supplier.owner_user_id = product.user_id
      AND lower(supplier.name) = lower(trim(product.supplier_name))
  )
GROUP BY product.user_id, lower(trim(product.supplier_name));

INSERT INTO public.suppliers (owner_user_id, name)
SELECT purchase.owner_user_id, min(trim(purchase.supplier_name))
FROM public.purchase_orders AS purchase
WHERE trim(coalesce(purchase.supplier_name, '')) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.suppliers AS supplier
    WHERE supplier.owner_user_id = purchase.owner_user_id
      AND lower(supplier.name) = lower(trim(purchase.supplier_name))
  )
GROUP BY purchase.owner_user_id, lower(trim(purchase.supplier_name));

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx
  ON public.purchase_orders (supplier_id, purchase_date DESC);
