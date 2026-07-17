-- Classificacao operacional do produto para preparar ficha tecnica e compras.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_kind text NOT NULL DEFAULT 'simple';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_product_kind_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_product_kind_check
      CHECK (product_kind IN ('simple', 'composite', 'raw_material'));
  END IF;
END $$;

UPDATE public.products
SET product_kind = 'simple'
WHERE product_kind IS NULL OR product_kind = '';

COMMENT ON COLUMN public.products.product_kind IS
  'Tipo operacional: simple para venda direta, composite para produto composto/ficha tecnica, raw_material para insumo.';
