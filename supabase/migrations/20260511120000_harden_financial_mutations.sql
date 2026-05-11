-- Defense-in-depth for financial mutations shared by web, site, desktop, and
-- offline sync. UI checks are useful, but these rules must live in the database.

DROP POLICY IF EXISTS "products_insert_store" ON public.products;
DROP POLICY IF EXISTS "products_update_store" ON public.products;
DROP POLICY IF EXISTS "products_delete_store" ON public.products;

CREATE POLICY "products_insert_store"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
  AND public.current_user_is_admin()
);

CREATE POLICY "products_update_store"
ON public.products
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
);

CREATE POLICY "products_delete_store"
ON public.products
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
  AND public.current_user_is_admin()
);

DO $$
BEGIN
  ALTER TABLE public.products
    ADD CONSTRAINT products_financial_non_negative_check
    CHECK (
      price >= 0
      AND cost_price >= 0
      AND stock >= 0
      AND min_stock >= 0
      AND COALESCE(purchase_cost, 0) >= 0
      AND COALESCE(freight_cost, 0) >= 0
      AND COALESCE(tax_cost, 0) >= 0
      AND COALESCE(commission_cost, 0) >= 0
      AND COALESCE(card_fee_cost, 0) >= 0
      AND COALESCE(packaging_cost, 0) >= 0
      AND COALESCE(operational_cost, 0) >= 0
      AND COALESCE(other_extra_cost, 0) >= 0
      AND COALESCE(target_markup_pct, 0) >= 0
      AND COALESCE(minimum_markup_pct, 0) >= 0
      AND COALESCE(minimum_price, 0) >= 0
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_operator_product_update_scope()
RETURNS trigger
LANGUAGE plpgsql
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

DO $$
BEGIN
  ALTER TABLE public.debt_entries
    ADD CONSTRAINT debt_entries_financial_positive_check
    CHECK (
      quantity > 0
      AND unit_price >= 0
      AND total >= 0
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.payments
    ADD CONSTRAINT payments_amount_positive_check
    CHECK (amount > 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.sales
    ADD CONSTRAINT sales_financial_non_negative_check
    CHECK (
      total >= 0
      AND discount >= 0
      AND cash_received >= 0
      AND change_amount >= 0
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.sale_items
    ADD CONSTRAINT sale_items_financial_positive_check
    CHECK (
      quantity > 0
      AND unit_price >= 0
      AND cost_price >= 0
      AND total >= 0
      AND COALESCE(discount_amount, 0) >= 0
      AND COALESCE(net_total, 0) >= 0
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_quantity_positive_check
    CHECK (quantity > 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.expenses
    ADD CONSTRAINT expenses_amount_positive_check
    CHECK (amount > 0) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.cash_sessions
    ADD CONSTRAINT cash_sessions_financial_non_negative_check
    CHECK (
      opening_amount >= 0
      AND (closing_balance IS NULL OR closing_balance >= 0)
    ) NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.normalize_sale_item_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  product_price numeric(10,2);
BEGIN
  NEW.quantity := GREATEST(COALESCE(NEW.quantity, 0), 0);
  NEW.unit_price := ROUND(GREATEST(COALESCE(NEW.unit_price, 0), 0), 2);
  NEW.cost_price := ROUND(GREATEST(COALESCE(NEW.cost_price, 0), 0), 2);
  NEW.total := ROUND(NEW.unit_price * NEW.quantity, 2);
  NEW.discount_amount := ROUND(GREATEST(COALESCE(NEW.discount_amount, 0), 0), 2);
  NEW.net_total := ROUND(GREATEST(NEW.total - NEW.discount_amount, 0), 2);

  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade do item da venda deve ser maior que zero.';
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT *
    INTO product_row
    FROM public.products
    WHERE id = NEW.product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto da venda não encontrado.';
    END IF;

    IF product_row.user_id <> public.get_current_store_owner_id() THEN
      RAISE EXCEPTION 'Produto da venda não pertence a esta loja.';
    END IF;

    product_price := ROUND(GREATEST(COALESCE(product_row.price, 0), 0), 2);

    IF ABS(NEW.unit_price - product_price) > 0.009 AND NOT public.current_user_is_admin() THEN
      RAISE EXCEPTION 'Somente administrador pode vender produto com preço alterado.';
    END IF;

    NEW.product_name := product_row.name;
    NEW.cost_price := ROUND(GREATEST(COALESCE(product_row.cost_price, NEW.cost_price), 0), 2);
  END IF;

  NEW.unit_profit := CASE
    WHEN NEW.quantity > 0 THEN ROUND((NEW.net_total - NEW.cost_price * NEW.quantity) / NEW.quantity, 2)
    ELSE 0
  END;
  NEW.total_profit := ROUND(NEW.net_total - NEW.cost_price * NEW.quantity, 2);
  NEW.markup_pct := CASE
    WHEN NEW.cost_price > 0 THEN ROUND(((NEW.unit_price - NEW.cost_price) / NEW.cost_price) * 100, 2)
    ELSE 0
  END;
  NEW.margin_pct := CASE
    WHEN NEW.unit_price > 0 THEN ROUND(((NEW.unit_price - NEW.cost_price) / NEW.unit_price) * 100, 2)
    ELSE 0
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_debt_entry_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  product_price numeric(10,2);
BEGIN
  NEW.quantity := GREATEST(COALESCE(NEW.quantity, 0), 0);
  NEW.unit_price := ROUND(GREATEST(COALESCE(NEW.unit_price, 0), 0), 2);
  NEW.total := ROUND(NEW.unit_price * NEW.quantity, 2);

  IF NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade da dívida deve ser maior que zero.';
  END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT *
    INTO product_row
    FROM public.products
    WHERE id = NEW.product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto da dívida não encontrado.';
    END IF;

    IF product_row.user_id <> public.get_current_store_owner_id() THEN
      RAISE EXCEPTION 'Produto da dívida não pertence a esta loja.';
    END IF;

    product_price := ROUND(GREATEST(COALESCE(product_row.price, 0), 0), 2);

    IF ABS(NEW.unit_price - product_price) > 0.009 AND NOT public.current_user_is_admin() THEN
      RAISE EXCEPTION 'Somente administrador pode lançar dívida com preço alterado.';
    END IF;

    NEW.product_name := product_row.name;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_payment_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.amount := ROUND(COALESCE(NEW.amount, 0), 2);

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'O valor do pagamento deve ser maior que zero.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_sale_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item_total numeric(10,2);
BEGIN
  NEW.discount := ROUND(GREATEST(COALESCE(NEW.discount, 0), 0), 2);
  NEW.cash_received := ROUND(GREATEST(COALESCE(NEW.cash_received, 0), 0), 2);
  NEW.total := ROUND(GREATEST(COALESCE(NEW.total, 0), 0), 2);
  NEW.change_amount := ROUND(GREATEST(COALESCE(NEW.change_amount, 0), 0), 2);

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(SUM(total), 0)
    INTO item_total
    FROM public.sale_items
    WHERE sale_id = NEW.id;

    IF item_total > 0 THEN
      NEW.discount := LEAST(NEW.discount, ROUND(item_total, 2));
      NEW.total := ROUND(GREATEST(item_total - NEW.discount, 0), 2);
    END IF;
  END IF;

  IF NEW.payment_method = 'dinheiro' AND NEW.cash_received > 0 THEN
    NEW.change_amount := ROUND(GREATEST(NEW.cash_received - NEW.total, 0), 2);
  ELSIF NEW.payment_method <> 'dinheiro' THEN
    NEW.change_amount := 0;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_sale_financials(target_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  item_total numeric(10,2);
  sale_discount numeric(10,2);
  sale_payment_method text;
  sale_cash_received numeric(10,2);
  next_total numeric(10,2);
BEGIN
  SELECT
    COALESCE(SUM(total), 0)
  INTO item_total
  FROM public.sale_items
  WHERE sale_id = target_sale_id;

  SELECT
    ROUND(GREATEST(COALESCE(discount, 0), 0), 2),
    payment_method,
    ROUND(GREATEST(COALESCE(cash_received, 0), 0), 2)
  INTO sale_discount, sale_payment_method, sale_cash_received
  FROM public.sales
  WHERE id = target_sale_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  sale_discount := LEAST(sale_discount, ROUND(item_total, 2));
  next_total := ROUND(GREATEST(item_total - sale_discount, 0), 2);

  UPDATE public.sales
  SET
    discount = sale_discount,
    total = next_total,
    change_amount = CASE
      WHEN sale_payment_method = 'dinheiro' THEN ROUND(GREATEST(sale_cash_received - next_total, 0), 2)
      ELSE 0
    END
  WHERE id = target_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_sale_financials_from_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.recalculate_sale_financials(NEW.sale_id);
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND (TG_OP = 'DELETE' OR OLD.sale_id IS DISTINCT FROM NEW.sale_id) THEN
    PERFORM public.recalculate_sale_financials(OLD.sale_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS normalize_sale_item_financials ON public.sale_items;
CREATE TRIGGER normalize_sale_item_financials
BEFORE INSERT OR UPDATE ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.normalize_sale_item_financials();

DROP TRIGGER IF EXISTS enforce_operator_product_update_scope ON public.products;
CREATE TRIGGER enforce_operator_product_update_scope
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_operator_product_update_scope();

DROP TRIGGER IF EXISTS refresh_sale_financials_from_items ON public.sale_items;
CREATE TRIGGER refresh_sale_financials_from_items
AFTER INSERT OR UPDATE OR DELETE ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.refresh_sale_financials_from_items();

DROP TRIGGER IF EXISTS normalize_debt_entry_financials ON public.debt_entries;
CREATE TRIGGER normalize_debt_entry_financials
BEFORE INSERT OR UPDATE ON public.debt_entries
FOR EACH ROW
EXECUTE FUNCTION public.normalize_debt_entry_financials();

DROP TRIGGER IF EXISTS normalize_payment_financials ON public.payments;
CREATE TRIGGER normalize_payment_financials
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.normalize_payment_financials();

DROP TRIGGER IF EXISTS normalize_sale_financials ON public.sales;
CREATE TRIGGER normalize_sale_financials
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.normalize_sale_financials();
