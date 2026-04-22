CREATE OR REPLACE FUNCTION public.apply_pricing_rounding(raw_value numeric, rounding_rule text)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_value numeric(10,2) := ROUND(GREATEST(COALESCE(raw_value, 0), 0), 2);
  integer_part numeric(10,2);
  candidate numeric(10,2);
BEGIN
  CASE COALESCE(rounding_rule, 'none')
    WHEN '0.01' THEN
      RETURN normalized_value;
    WHEN '0.05' THEN
      RETURN ROUND(CEIL(normalized_value / 0.05) * 0.05, 2);
    WHEN '0.10' THEN
      RETURN ROUND(CEIL(normalized_value / 0.10) * 0.10, 2);
    WHEN '0.50' THEN
      RETURN ROUND(CEIL(normalized_value / 0.50) * 0.50, 2);
    WHEN '1.00' THEN
      RETURN ROUND(CEIL(normalized_value), 2);
    WHEN 'whole_90' THEN
      integer_part := FLOOR(normalized_value);
      candidate := integer_part + 0.90;
      RETURN ROUND(CASE WHEN candidate >= normalized_value THEN candidate ELSE integer_part + 1.90 END, 2);
    WHEN 'whole_99' THEN
      integer_part := FLOOR(normalized_value);
      candidate := integer_part + 0.99;
      RETURN ROUND(CASE WHEN candidate >= normalized_value THEN candidate ELSE integer_part + 1.99 END, 2);
    ELSE
      RETURN normalized_value;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_real_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  extra_total numeric(10,2);
  desired_price numeric(10,2);
  desired_markup numeric(10,2);
  detailed_costs_changed boolean;
  price_changed boolean;
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

  detailed_costs_changed := false;
  price_changed := false;

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
    price_changed := NEW.price IS DISTINCT FROM OLD.price;

    IF NOT detailed_costs_changed AND NEW.cost_price IS DISTINCT FROM OLD.cost_price THEN
      NEW.purchase_cost := GREATEST(COALESCE(NEW.cost_price, 0) - extra_total, 0);
    END IF;
  ELSIF NEW.purchase_cost = 0 AND COALESCE(NEW.cost_price, 0) > 0 THEN
    NEW.purchase_cost := GREATEST(COALESCE(NEW.cost_price, 0) - extra_total, 0);
  END IF;

  NEW.cost_price := ROUND(NEW.purchase_cost + extra_total, 2);

  IF TG_OP = 'UPDATE' AND detailed_costs_changed AND NOT price_changed THEN
    desired_markup := GREATEST(COALESCE(NEW.target_markup_pct, 0), COALESCE(NEW.minimum_markup_pct, 0));

    IF desired_markup > 0 THEN
      desired_price := ROUND(NEW.cost_price * (1 + desired_markup / 100), 2);
      desired_price := GREATEST(desired_price, COALESCE(NEW.minimum_price, 0));
      NEW.price := public.apply_pricing_rounding(desired_price, NEW.rounding_rule);
    END IF;
  END IF;

  IF COALESCE(NEW.price, 0) < NEW.cost_price THEN
    RAISE EXCEPTION 'O preço de venda não pode ficar abaixo do custo real.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  changed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  previous_price numeric(10,2) NOT NULL DEFAULT 0,
  new_price numeric(10,2) NOT NULL DEFAULT 0,
  previous_cost_price numeric(10,2) NOT NULL DEFAULT 0,
  new_cost_price numeric(10,2) NOT NULL DEFAULT 0,
  previous_markup_pct numeric(10,2) NOT NULL DEFAULT 0,
  new_markup_pct numeric(10,2) NOT NULL DEFAULT 0,
  previous_margin_pct numeric(10,2) NOT NULL DEFAULT 0,
  new_margin_pct numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_price_history_owner_created_idx
  ON public.product_price_history(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS product_price_history_product_created_idx
  ON public.product_price_history(product_id, created_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_price_history_select_store" ON public.product_price_history;
DROP POLICY IF EXISTS "product_price_history_insert_store" ON public.product_price_history;

CREATE POLICY "product_price_history_select_store"
ON public.product_price_history
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pricing.manage')
);

CREATE POLICY "product_price_history_insert_store"
ON public.product_price_history
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pricing.manage')
);

CREATE OR REPLACE FUNCTION public.log_product_price_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_markup numeric(10,2);
  new_markup numeric(10,2);
  old_margin numeric(10,2);
  new_margin numeric(10,2);
BEGIN
  IF NOT public.current_store_has_feature('pricing.manage') THEN
    RETURN NEW;
  END IF;

  IF NEW.price IS NOT DISTINCT FROM OLD.price
    AND NEW.cost_price IS NOT DISTINCT FROM OLD.cost_price
    AND NEW.target_markup_pct IS NOT DISTINCT FROM OLD.target_markup_pct
    AND NEW.minimum_markup_pct IS NOT DISTINCT FROM OLD.minimum_markup_pct
  THEN
    RETURN NEW;
  END IF;

  old_markup := CASE
    WHEN COALESCE(OLD.cost_price, 0) > 0 THEN ROUND(((COALESCE(OLD.price, 0) - OLD.cost_price) / OLD.cost_price) * 100, 2)
    ELSE 0
  END;

  new_markup := CASE
    WHEN COALESCE(NEW.cost_price, 0) > 0 THEN ROUND(((COALESCE(NEW.price, 0) - NEW.cost_price) / NEW.cost_price) * 100, 2)
    ELSE 0
  END;

  old_margin := CASE
    WHEN COALESCE(OLD.price, 0) > 0 THEN ROUND(((COALESCE(OLD.price, 0) - COALESCE(OLD.cost_price, 0)) / OLD.price) * 100, 2)
    ELSE 0
  END;

  new_margin := CASE
    WHEN COALESCE(NEW.price, 0) > 0 THEN ROUND(((COALESCE(NEW.price, 0) - COALESCE(NEW.cost_price, 0)) / NEW.price) * 100, 2)
    ELSE 0
  END;

  INSERT INTO public.product_price_history (
    owner_user_id,
    product_id,
    changed_by_user_id,
    product_name,
    previous_price,
    new_price,
    previous_cost_price,
    new_cost_price,
    previous_markup_pct,
    new_markup_pct,
    previous_margin_pct,
    new_margin_pct
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    auth.uid(),
    NEW.name,
    COALESCE(OLD.price, 0),
    COALESCE(NEW.price, 0),
    COALESCE(OLD.cost_price, 0),
    COALESCE(NEW.cost_price, 0),
    old_markup,
    new_markup,
    old_margin,
    new_margin
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_product_price_history ON public.products;
CREATE TRIGGER log_product_price_history
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.log_product_price_history();
