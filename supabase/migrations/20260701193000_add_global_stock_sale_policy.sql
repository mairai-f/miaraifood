ALTER TABLE public.store_accounts
  ADD COLUMN IF NOT EXISTS block_sale_without_stock boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.store_accounts.block_sale_without_stock IS
  'Quando true, produtos com controle de estoque travam venda e fiado sem saldo. Quando false, o saldo pode ficar negativo nessas operacoes.';

CREATE OR REPLACE FUNCTION public.current_store_blocks_sale_without_stock()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT account.block_sale_without_stock
      FROM public.store_accounts AS account
      WHERE account.id = public.get_current_store_account_id_for_context('happycash')
      LIMIT 1
    ),
    true
  )
$$;

CREATE OR REPLACE FUNCTION public.get_store_operational_settings()
RETURNS TABLE (block_sale_without_stock boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_store_blocks_sale_without_stock() AS block_sale_without_stock
$$;

CREATE OR REPLACE FUNCTION public.update_store_operational_settings(p_block_sale_without_stock boolean)
RETURNS TABLE (block_sale_without_stock boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  account_id uuid := public.get_current_store_account_id_for_context('happycash');
BEGIN
  IF auth.uid() IS NULL
    OR owner_id IS NULL
    OR account_id IS NULL
    OR NOT public.current_user_is_admin()
    OR NOT public.current_store_has_feature('settings.manage')
    OR NOT public.current_user_has_erp_permission('settings.manage')
  THEN
    RAISE EXCEPTION 'Sem permissao para atualizar configuracoes da loja.';
  END IF;

  UPDATE public.store_accounts
  SET block_sale_without_stock = COALESCE(p_block_sale_without_stock, true),
      updated_at = now()
  WHERE id = account_id;

  RETURN QUERY
  SELECT public.current_store_blocks_sale_without_stock() AS block_sale_without_stock;
END;
$$;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_financial_non_negative_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_financial_non_negative_check
  CHECK (
    price >= 0
    AND cost_price >= 0
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

CREATE OR REPLACE FUNCTION public.sync_location_inventory_from_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stock_delta numeric(12,3);
BEGIN
  IF NEW.location_id IS NULL OR NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.balance_before IS NOT NULL AND NEW.balance_after IS NOT NULL THEN
    INSERT INTO public.location_inventory (
      owner_user_id, location_id, product_id, stock, min_stock
    )
    SELECT NEW.user_id,
           NEW.location_id,
           NEW.product_id,
           NEW.balance_after,
           COALESCE(product.min_stock, 0)
    FROM public.products AS product
    WHERE product.id = NEW.product_id
      AND product.user_id = NEW.user_id
    ON CONFLICT (location_id, product_id) DO UPDATE SET
      stock = EXCLUDED.stock,
      min_stock = COALESCE(EXCLUDED.min_stock, public.location_inventory.min_stock),
      updated_at = now();

    RETURN NEW;
  END IF;

  IF NEW.type = 'entrada' THEN
    stock_delta := abs(NEW.quantity);
  ELSIF NEW.type = 'saida' THEN
    stock_delta := -abs(NEW.quantity);
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.location_inventory (
    owner_user_id, location_id, product_id, stock, min_stock
  )
  SELECT NEW.user_id,
         NEW.location_id,
         NEW.product_id,
         stock_delta,
         COALESCE(product.min_stock, 0)
  FROM public.products AS product
  WHERE product.id = NEW.product_id
    AND product.user_id = NEW.user_id
  ON CONFLICT (location_id, product_id) DO UPDATE SET
    stock = public.location_inventory.stock + EXCLUDED.stock,
    min_stock = COALESCE(EXCLUDED.min_stock, public.location_inventory.min_stock),
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_apply_product_stock(
  target_product_id uuid, target_location_id uuid, target_delta numeric,
  target_type text, target_reason text, target_source text, target_reference_id uuid
)
RETURNS public.stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  product_row public.products%ROWTYPE;
  location_row public.store_locations%ROWTYPE;
  inventory_row public.location_inventory%ROWTYPE;
  movement_row public.stock_movements%ROWTYPE;
  next_stock numeric(12,3);
  actor_name text;
  allow_negative_stock boolean := false;
BEGIN
  SELECT * INTO product_row FROM public.products
  WHERE id = target_product_id AND user_id = owner_id AND NOT deleted FOR UPDATE;
  IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto nao encontrado.'; END IF;
  IF NOT product_row.control_stock THEN RETURN NULL; END IF;

  location_row := public.erp_operational_location(target_location_id);

  INSERT INTO public.location_inventory (owner_user_id, location_id, product_id, stock, min_stock, max_stock)
  VALUES (
    owner_id,
    location_row.id,
    product_row.id,
    CASE WHEN location_row.is_headquarters THEN product_row.stock ELSE 0 END,
    product_row.min_stock,
    product_row.max_stock
  )
  ON CONFLICT (location_id, product_id) DO NOTHING;

  SELECT * INTO inventory_row FROM public.location_inventory
  WHERE location_id = location_row.id AND product_id = product_row.id FOR UPDATE;

  next_stock := round(COALESCE(inventory_row.stock, 0) + target_delta, 3);
  allow_negative_stock := next_stock < 0
    AND COALESCE(target_source, '') IN ('sale', 'debt')
    AND NOT public.current_store_blocks_sale_without_stock();

  IF next_stock < 0 AND NOT allow_negative_stock THEN
    RAISE EXCEPTION 'Estoque insuficiente para % (codigo %). Saldo: %.', product_row.name, product_row.code, inventory_row.stock;
  END IF;

  UPDATE public.location_inventory
  SET stock = next_stock,
      max_stock = product_row.max_stock,
      updated_at = now()
  WHERE location_id = inventory_row.location_id
    AND product_id = inventory_row.product_id;

  IF location_row.is_headquarters THEN
    UPDATE public.products
    SET stock = next_stock
    WHERE id = product_row.id;
  END IF;

  SELECT COALESCE(NULLIF(profile.username, ''), NULLIF(profile.email, ''), auth.uid()::text)
  INTO actor_name FROM public.profiles AS profile WHERE profile.user_id = auth.uid();

  INSERT INTO public.stock_movements (
    product_id, user_id, type, quantity, reason, source, reference_id,
    balance_before, balance_after, operator_user_id, actor_label, location_id
  ) VALUES (
    product_row.id, owner_id, target_type, abs(target_delta), trim(target_reason),
    target_source, target_reference_id, inventory_row.stock, next_stock,
    auth.uid(), actor_name, location_row.id
  ) RETURNING * INTO movement_row;

  RETURN movement_row;
END;
$$;

REVOKE ALL ON FUNCTION public.current_store_blocks_sale_without_stock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_store_operational_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_store_operational_settings(boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_store_blocks_sale_without_stock() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_operational_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_operational_settings(boolean) TO authenticated;
