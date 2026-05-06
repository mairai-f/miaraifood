ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS purchase_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS freight_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS card_fee_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS packaging_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS operational_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_extra_cost numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_name text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS target_markup_pct numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_markup_pct numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS minimum_price numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS rounding_rule text NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS pricing_notes text NOT NULL DEFAULT '';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_rounding_rule_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
    ADD CONSTRAINT products_rounding_rule_check
    CHECK (rounding_rule IN ('none', '0.01', '0.05', '0.10', '0.50', '1.00', 'whole_90', 'whole_99'));
  END IF;
END $$;
UPDATE public.products
SET purchase_cost = cost_price
WHERE purchase_cost = 0
  AND cost_price > 0
  AND freight_cost = 0
  AND tax_cost = 0
  AND commission_cost = 0
  AND card_fee_cost = 0
  AND packaging_cost = 0
  AND operational_cost = 0
  AND other_extra_cost = 0;
CREATE OR REPLACE FUNCTION public.sync_product_real_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  extra_total numeric(10,2);
  detailed_costs_changed boolean;
BEGIN
  NEW.purchase_cost := GREATEST(COALESCE(NEW.purchase_cost, 0), 0);
  NEW.freight_cost := GREATEST(COALESCE(NEW.freight_cost, 0), 0);
  NEW.tax_cost := GREATEST(COALESCE(NEW.tax_cost, 0), 0);
  NEW.commission_cost := GREATEST(COALESCE(NEW.commission_cost, 0), 0);
  NEW.card_fee_cost := GREATEST(COALESCE(NEW.card_fee_cost, 0), 0);
  NEW.packaging_cost := GREATEST(COALESCE(NEW.packaging_cost, 0), 0);
  NEW.operational_cost := GREATEST(COALESCE(NEW.operational_cost, 0), 0);
  NEW.other_extra_cost := GREATEST(COALESCE(NEW.other_extra_cost, 0), 0);
  NEW.target_markup_pct := GREATEST(COALESCE(NEW.target_markup_pct, 0), 0);
  NEW.minimum_markup_pct := GREATEST(COALESCE(NEW.minimum_markup_pct, 0), 0);
  NEW.minimum_price := GREATEST(COALESCE(NEW.minimum_price, 0), 0);
  NEW.rounding_rule := COALESCE(NULLIF(NEW.rounding_rule, ''), 'none');

  IF NEW.rounding_rule NOT IN ('none', '0.01', '0.05', '0.10', '0.50', '1.00', 'whole_90', 'whole_99') THEN
    NEW.rounding_rule := 'none';
  END IF;

  extra_total := ROUND(
    NEW.freight_cost
    + NEW.tax_cost
    + NEW.commission_cost
    + NEW.card_fee_cost
    + NEW.packaging_cost
    + NEW.operational_cost
    + NEW.other_extra_cost,
    2
  );

  IF TG_OP = 'UPDATE' THEN
    detailed_costs_changed := (
      NEW.purchase_cost IS DISTINCT FROM OLD.purchase_cost
      OR NEW.freight_cost IS DISTINCT FROM OLD.freight_cost
      OR NEW.tax_cost IS DISTINCT FROM OLD.tax_cost
      OR NEW.commission_cost IS DISTINCT FROM OLD.commission_cost
      OR NEW.card_fee_cost IS DISTINCT FROM OLD.card_fee_cost
      OR NEW.packaging_cost IS DISTINCT FROM OLD.packaging_cost
      OR NEW.operational_cost IS DISTINCT FROM OLD.operational_cost
      OR NEW.other_extra_cost IS DISTINCT FROM OLD.other_extra_cost
    );

    IF NOT detailed_costs_changed AND NEW.cost_price IS DISTINCT FROM OLD.cost_price THEN
      NEW.purchase_cost := GREATEST(COALESCE(NEW.cost_price, 0) - extra_total, 0);
    END IF;
  ELSIF NEW.purchase_cost = 0 AND COALESCE(NEW.cost_price, 0) > 0 THEN
    NEW.purchase_cost := GREATEST(COALESCE(NEW.cost_price, 0) - extra_total, 0);
  END IF;

  NEW.cost_price := ROUND(NEW.purchase_cost + extra_total, 2);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_product_real_cost ON public.products;
CREATE TRIGGER sync_product_real_cost
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_real_cost();
UPDATE public.products
SET purchase_cost = purchase_cost;
ALTER TABLE public.sale_items
ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_total numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_profit numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_profit numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS markup_pct numeric(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS margin_pct numeric(10,2) NOT NULL DEFAULT 0;
UPDATE public.sale_items
SET
  discount_amount = COALESCE(discount_amount, 0),
  net_total = ROUND(GREATEST(COALESCE(total, 0) - COALESCE(discount_amount, 0), 0), 2),
  unit_profit = ROUND(
    CASE
      WHEN COALESCE(quantity, 0) > 0
        THEN (GREATEST(COALESCE(total, 0) - COALESCE(discount_amount, 0), 0) - (COALESCE(cost_price, 0) * COALESCE(quantity, 0))) / quantity
      ELSE 0
    END,
    2
  ),
  total_profit = ROUND(
    GREATEST(COALESCE(total, 0) - COALESCE(discount_amount, 0), 0) - (COALESCE(cost_price, 0) * COALESCE(quantity, 0)),
    2
  ),
  markup_pct = ROUND(
    CASE
      WHEN COALESCE(cost_price, 0) > 0
        THEN ((COALESCE(unit_price, 0) - COALESCE(cost_price, 0)) / cost_price) * 100
      ELSE 0
    END,
    2
  ),
  margin_pct = ROUND(
    CASE
      WHEN COALESCE(unit_price, 0) > 0
        THEN ((COALESCE(unit_price, 0) - COALESCE(cost_price, 0)) / unit_price) * 100
      ELSE 0
    END,
    2
  );
CREATE TABLE IF NOT EXISTS public.product_category_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  default_markup_pct numeric(10,2) NOT NULL DEFAULT 0,
  minimum_markup_pct numeric(10,2) NOT NULL DEFAULT 0,
  minimum_price numeric(10,2) NOT NULL DEFAULT 0,
  rounding_rule text NOT NULL DEFAULT 'none',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, category)
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_category_pricing_rules_rounding_rule_check'
      AND conrelid = 'public.product_category_pricing_rules'::regclass
  ) THEN
    ALTER TABLE public.product_category_pricing_rules
    ADD CONSTRAINT product_category_pricing_rules_rounding_rule_check
    CHECK (rounding_rule IN ('none', '0.01', '0.05', '0.10', '0.50', '1.00', 'whole_90', 'whole_99'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS product_category_pricing_rules_owner_idx
  ON public.product_category_pricing_rules(owner_user_id);
CREATE INDEX IF NOT EXISTS product_category_pricing_rules_category_idx
  ON public.product_category_pricing_rules(category);
ALTER TABLE public.product_category_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_category_pricing_rules FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_category_pricing_rules_select_store" ON public.product_category_pricing_rules;
DROP POLICY IF EXISTS "product_category_pricing_rules_insert_store" ON public.product_category_pricing_rules;
DROP POLICY IF EXISTS "product_category_pricing_rules_update_store" ON public.product_category_pricing_rules;
DROP POLICY IF EXISTS "product_category_pricing_rules_delete_store" ON public.product_category_pricing_rules;
CREATE POLICY "product_category_pricing_rules_select_store"
ON public.product_category_pricing_rules
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pricing.manage')
);
CREATE POLICY "product_category_pricing_rules_insert_store"
ON public.product_category_pricing_rules
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pricing.manage')
);
CREATE POLICY "product_category_pricing_rules_update_store"
ON public.product_category_pricing_rules
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pricing.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pricing.manage')
);
CREATE POLICY "product_category_pricing_rules_delete_store"
ON public.product_category_pricing_rules
FOR DELETE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pricing.manage')
);
DROP TRIGGER IF EXISTS update_product_category_pricing_rules_updated_at ON public.product_category_pricing_rules;
CREATE TRIGGER update_product_category_pricing_rules_updated_at
BEFORE UPDATE ON public.product_category_pricing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
DELETE FROM public.subscription_plan_features
WHERE feature_key = 'pricing.manage'
  AND plan_id NOT IN ('completo', 'pro');
INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('completo', 'pricing.manage', true),
  ('pro', 'pricing.manage', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;
