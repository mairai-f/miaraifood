ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS custom_costs jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_custom_costs_array_check
    CHECK (jsonb_typeof(custom_costs) = 'array');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.sync_product_real_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  extra_total numeric(10,2);
  custom_cost_total numeric(10,2);
  desired_price numeric(10,2);
  desired_markup numeric(10,2);
  detailed_costs_changed boolean;
  price_changed boolean;
  has_custom_costs boolean;
  normalized_custom_costs jsonb;
BEGIN
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('name', name, 'amount', amount)
      ORDER BY ordinal
    ),
    '[]'::jsonb
  )
  INTO normalized_custom_costs
  FROM (
    SELECT
      item.ordinal,
      left(trim(COALESCE(item.value->>'name', '')), 80) AS name,
      ROUND(GREATEST(
        CASE
          WHEN COALESCE(item.value->>'amount', '') ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN (item.value->>'amount')::numeric
          ELSE 0
        END,
        0
      ), 2) AS amount
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(NEW.custom_costs, '[]'::jsonb)) = 'array'
          THEN COALESCE(NEW.custom_costs, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS item(value, ordinal)
  ) AS normalized
  WHERE name <> '' OR amount > 0;

  NEW.custom_costs := normalized_custom_costs;

  SELECT ROUND(COALESCE(SUM((cost.value->>'amount')::numeric), 0), 2)
  INTO custom_cost_total
  FROM jsonb_array_elements(NEW.custom_costs) AS cost(value);

  has_custom_costs := jsonb_array_length(NEW.custom_costs) > 0;

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
    + NEW.other_extra_cost
    + custom_cost_total,
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
      OR COALESCE(NEW.custom_costs, '[]'::jsonb) IS DISTINCT FROM COALESCE(OLD.custom_costs, '[]'::jsonb)
    );
    price_changed := NEW.price IS DISTINCT FROM OLD.price;

    IF NOT detailed_costs_changed AND NOT has_custom_costs AND NEW.cost_price IS DISTINCT FROM OLD.cost_price THEN
      NEW.purchase_cost := GREATEST(COALESCE(NEW.cost_price, 0) - extra_total, 0);
    END IF;
  ELSIF NOT has_custom_costs AND NEW.purchase_cost = 0 AND COALESCE(NEW.cost_price, 0) > 0 THEN
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

CREATE OR REPLACE FUNCTION public.enforce_operator_product_update_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.code IS DISTINCT FROM OLD.code
    OR NEW.name IS DISTINCT FROM OLD.name
    OR NEW.price IS DISTINCT FROM OLD.price
    OR NEW.cost_price IS DISTINCT FROM OLD.cost_price
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.barcode IS DISTINCT FROM OLD.barcode
    OR NEW.min_stock IS DISTINCT FROM OLD.min_stock
    OR NEW.deleted IS DISTINCT FROM OLD.deleted
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    OR COALESCE(NEW.purchase_cost, 0) IS DISTINCT FROM COALESCE(OLD.purchase_cost, 0)
    OR COALESCE(NEW.freight_cost, 0) IS DISTINCT FROM COALESCE(OLD.freight_cost, 0)
    OR COALESCE(NEW.tax_cost, 0) IS DISTINCT FROM COALESCE(OLD.tax_cost, 0)
    OR COALESCE(NEW.commission_cost, 0) IS DISTINCT FROM COALESCE(OLD.commission_cost, 0)
    OR COALESCE(NEW.card_fee_cost, 0) IS DISTINCT FROM COALESCE(OLD.card_fee_cost, 0)
    OR COALESCE(NEW.packaging_cost, 0) IS DISTINCT FROM COALESCE(OLD.packaging_cost, 0)
    OR COALESCE(NEW.operational_cost, 0) IS DISTINCT FROM COALESCE(OLD.operational_cost, 0)
    OR COALESCE(NEW.other_extra_cost, 0) IS DISTINCT FROM COALESCE(OLD.other_extra_cost, 0)
    OR COALESCE(NEW.custom_costs, '[]'::jsonb) IS DISTINCT FROM COALESCE(OLD.custom_costs, '[]'::jsonb)
    OR COALESCE(NEW.supplier_name, '') IS DISTINCT FROM COALESCE(OLD.supplier_name, '')
    OR COALESCE(NEW.target_markup_pct, 0) IS DISTINCT FROM COALESCE(OLD.target_markup_pct, 0)
    OR COALESCE(NEW.minimum_markup_pct, 0) IS DISTINCT FROM COALESCE(OLD.minimum_markup_pct, 0)
    OR COALESCE(NEW.minimum_price, 0) IS DISTINCT FROM COALESCE(OLD.minimum_price, 0)
    OR COALESCE(NEW.rounding_rule, '') IS DISTINCT FROM COALESCE(OLD.rounding_rule, '')
    OR COALESCE(NEW.pricing_notes, '') IS DISTINCT FROM COALESCE(OLD.pricing_notes, '')
  THEN
    RAISE EXCEPTION 'Operador só pode atualizar estoque de produto.';
  END IF;

  RETURN NEW;
END;
$$;
