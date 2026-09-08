-- HappyCash ERP - integridade operacional sem ampliar o menu.
-- Centraliza venda, fiado, cancelamento e fechamento em transacoes do banco.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS control_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_stock numeric(12,3);

ALTER TABLE public.location_inventory
  ADD COLUMN IF NOT EXISTS max_stock numeric(12,3);

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_code bigint;
ALTER TABLE public.debt_entries
  ADD COLUMN IF NOT EXISTS product_code bigint;
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS actor_label text;

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS expected_balance numeric(14,2),
  ADD COLUMN IF NOT EXISTS counted_balance numeric(14,2),
  ADD COLUMN IF NOT EXISTS closing_difference numeric(14,2),
  ADD COLUMN IF NOT EXISTS difference_reason text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_max_stock_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_max_stock_check
      CHECK (max_stock IS NULL OR max_stock >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'location_inventory_max_stock_check') THEN
    ALTER TABLE public.location_inventory ADD CONSTRAINT location_inventory_max_stock_check
      CHECK (max_stock IS NULL OR max_stock >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_product_required_check') THEN
    ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_product_required_check
      CHECK (product_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'debt_entries_product_required_check') THEN
    ALTER TABLE public.debt_entries ADD CONSTRAINT debt_entries_product_required_check
      CHECK (product_id IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cash_sessions_counted_balance_check') THEN
    ALTER TABLE public.cash_sessions ADD CONSTRAINT cash_sessions_counted_balance_check
      CHECK (counted_balance IS NULL OR counted_balance >= 0);
  END IF;
END $$;

UPDATE public.sale_items item SET product_code = product.code
FROM public.products product
WHERE item.product_id = product.id AND item.product_code IS NULL;
UPDATE public.debt_entries entry SET product_code = product.code
FROM public.products product
WHERE entry.product_id = product.id AND entry.product_code IS NULL;
UPDATE public.location_inventory inventory SET max_stock = product.max_stock
FROM public.products product
WHERE inventory.product_id = product.id AND inventory.max_stock IS NULL;

CREATE INDEX IF NOT EXISTS sale_items_product_code_idx ON public.sale_items(product_code);
CREATE INDEX IF NOT EXISTS debt_entries_product_code_idx ON public.debt_entries(product_code);
CREATE INDEX IF NOT EXISTS stock_movements_reference_idx ON public.stock_movements(source, reference_id);

CREATE OR REPLACE FUNCTION public.erp_operational_location(target_location_id uuid)
RETURNS public.store_locations
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE location_row public.store_locations%ROWTYPE;
DECLARE owner_id uuid := public.get_current_store_owner_id();
BEGIN
  SELECT * INTO location_row FROM public.store_locations
  WHERE owner_user_id = owner_id AND active
    AND (id = target_location_id OR (target_location_id IS NULL AND is_headquarters))
  ORDER BY is_headquarters DESC LIMIT 1;
  IF location_row.id IS NULL THEN RAISE EXCEPTION 'Filial operacional invalida.'; END IF;
  RETURN location_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_apply_product_stock(
  target_product_id uuid,
  target_location_id uuid,
  target_delta numeric,
  target_type text,
  target_reason text,
  target_source text,
  target_reference_id uuid
)
RETURNS public.stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE product_row public.products%ROWTYPE;
DECLARE location_row public.store_locations%ROWTYPE;
DECLARE inventory_row public.location_inventory%ROWTYPE;
DECLARE movement_row public.stock_movements%ROWTYPE;
DECLARE next_stock numeric(12,3);
DECLARE actor_name text;
BEGIN
  SELECT * INTO product_row FROM public.products
  WHERE id = target_product_id AND user_id = owner_id AND NOT deleted FOR UPDATE;
  IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto nao encontrado.'; END IF;
  IF NOT product_row.control_stock THEN RETURN NULL; END IF;
  location_row := public.erp_operational_location(target_location_id);

  INSERT INTO public.location_inventory (owner_user_id, location_id, product_id, stock, min_stock, max_stock)
  VALUES (owner_id, location_row.id, product_row.id,
    CASE WHEN location_row.is_headquarters THEN product_row.stock ELSE 0 END,
    product_row.min_stock, product_row.max_stock)
  ON CONFLICT (location_id, product_id) DO NOTHING;

  SELECT * INTO inventory_row FROM public.location_inventory
  WHERE location_id = location_row.id AND product_id = product_row.id FOR UPDATE;
  next_stock := round(COALESCE(inventory_row.stock, 0) + target_delta, 3);
  IF next_stock < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente para % (codigo %). Saldo: %.', product_row.name, product_row.code, inventory_row.stock;
  END IF;

  UPDATE public.location_inventory SET stock = next_stock, max_stock = product_row.max_stock, updated_at = now()
  WHERE location_id = inventory_row.location_id AND product_id = inventory_row.product_id;
  IF location_row.is_headquarters THEN UPDATE public.products SET stock = next_stock WHERE id = product_row.id; END IF;

  SELECT COALESCE(NULLIF(profile.username, ''), NULLIF(profile.email, ''), auth.uid()::text)
  INTO actor_name FROM public.profiles profile WHERE profile.user_id = auth.uid();
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

REVOKE ALL ON FUNCTION public.erp_operational_location(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.erp_apply_product_stock(uuid, uuid, numeric, text, text, text, uuid) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION public.erp_create_sale_atomic(p_sale jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE v_sale_id uuid := COALESCE(NULLIF(p_sale->>'id', '')::uuid, gen_random_uuid());
DECLARE location_row public.store_locations%ROWTYPE;
DECLARE sale_row public.sales%ROWTYPE;
DECLARE product_row public.products%ROWTYPE;
DECLARE item jsonb;
DECLARE item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL
     OR NOT public.current_store_has_feature('pdv.use')
     OR NOT public.current_user_has_erp_permission('pdv.use') THEN
    RAISE EXCEPTION 'Sem permissao para registrar venda.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Itens da venda invalidos.';
  END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = v_sale_id AND user_id = owner_id;
  IF sale_row.id IS NOT NULL THEN
    RETURN jsonb_build_object('sale', to_jsonb(sale_row), 'items', (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.sale_items i WHERE i.sale_id = v_sale_id));
  END IF;
  location_row := public.erp_operational_location(NULLIF(p_sale->>'location_id', '')::uuid);

  INSERT INTO public.sales (
    id, user_id, client_id, operator_user_id, cash_session_id, location_id, terminal_id,
    seller_name, is_delivery, service_ticket_number, status, total, discount,
    payment_method, cash_received, change_amount, fiscal_customer_document, fiscal_customer_name
  ) VALUES (
    v_sale_id, owner_id, NULLIF(p_sale->>'client_id', '')::uuid,
    COALESCE(NULLIF(p_sale->>'operator_user_id', '')::uuid, auth.uid()),
    NULLIF(p_sale->>'cash_session_id', '')::uuid, location_row.id,
    NULLIF(p_sale->>'terminal_id', '')::uuid, NULLIF(p_sale->>'seller_name', ''),
    COALESCE((p_sale->>'is_delivery')::boolean, false), NULLIF(p_sale->>'service_ticket_number', '')::integer,
    COALESCE(NULLIF(p_sale->>'status', ''), 'completed'),
    COALESCE((p_sale->>'total')::numeric, 0), COALESCE((p_sale->>'discount')::numeric, 0),
    COALESCE(NULLIF(p_sale->>'payment_method', ''), 'cash'),
    COALESCE((p_sale->>'cash_received')::numeric, 0), COALESCE((p_sale->>'change_amount')::numeric, 0),
    NULLIF(p_sale->>'fiscal_customer_document', ''), NULLIF(p_sale->>'fiscal_customer_name', '')
  ) RETURNING * INTO sale_row;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(item->>'product_id', '') IS NULL THEN RAISE EXCEPTION 'Todo item deve possuir product_id.'; END IF;
    SELECT * INTO product_row FROM public.products
    WHERE id = (item->>'product_id')::uuid AND user_id = owner_id AND NOT deleted;
    IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto da venda nao encontrado.'; END IF;
    item_id := COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid());
    INSERT INTO public.sale_items (
      id, sale_id, product_id, product_code, product_name, quantity, unit_price, cost_price,
      total, discount_amount, net_total, unit_profit, total_profit, markup_pct, margin_pct
    ) VALUES (
      item_id, v_sale_id, product_row.id, product_row.code, product_row.name,
      (item->>'quantity')::numeric, (item->>'unit_price')::numeric, COALESCE((item->>'cost_price')::numeric, product_row.cost_price, 0),
      (item->>'total')::numeric, COALESCE((item->>'discount_amount')::numeric, 0), COALESCE((item->>'net_total')::numeric, (item->>'total')::numeric),
      COALESCE((item->>'unit_profit')::numeric, 0), COALESCE((item->>'total_profit')::numeric, 0),
      COALESCE((item->>'markup_pct')::numeric, 0), COALESCE((item->>'margin_pct')::numeric, 0)
    );
    PERFORM public.erp_apply_product_stock(product_row.id, location_row.id, -(item->>'quantity')::numeric,
      'saida', 'Venda PDV', 'sale', v_sale_id);
  END LOOP;

  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, actor_label, action, entity_type, entity_id, details)
  VALUES (owner_id, auth.uid(), NULLIF(p_sale->>'seller_name', ''), 'sale.create', 'sale', v_sale_id::text,
    jsonb_build_object('total', sale_row.total, 'payment_method', sale_row.payment_method, 'location_id', location_row.id));
  RETURN jsonb_build_object('sale', to_jsonb(sale_row), 'items', (SELECT jsonb_agg(to_jsonb(i)) FROM public.sale_items i WHERE i.sale_id = v_sale_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_add_debt_entries_atomic(p_entries jsonb, p_location_id uuid DEFAULT NULL, p_adjust_stock boolean DEFAULT true, p_reason text DEFAULT 'Fiado')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE location_row public.store_locations%ROWTYPE;
DECLARE product_row public.products%ROWTYPE;
DECLARE client_row public.clients%ROWTYPE;
DECLARE item jsonb;
DECLARE entry_row public.debt_entries%ROWTYPE;
DECLARE created jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR NOT public.current_store_has_feature('fiado.manage')
     OR NOT public.current_user_has_erp_permission('clients.manage') THEN RAISE EXCEPTION 'Sem permissao para registrar fiado.'; END IF;
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 OR jsonb_array_length(p_entries) > 500 THEN RAISE EXCEPTION 'Itens do fiado invalidos.'; END IF;
  location_row := public.erp_operational_location(p_location_id);
  FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    SELECT * INTO client_row FROM public.clients WHERE id = (item->>'client_id')::uuid AND user_id = owner_id AND NOT deleted;
    IF client_row.id IS NULL THEN RAISE EXCEPTION 'Cliente do fiado nao encontrado.'; END IF;
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid AND user_id = owner_id AND NOT deleted;
    IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto do fiado nao encontrado.'; END IF;
    INSERT INTO public.debt_entries (
      id, location_id, client_id, product_id, product_code, product_name,
      quantity, unit_price, total, date_added, registered_by
    ) VALUES (
      COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid()), location_row.id, client_row.id,
      product_row.id, product_row.code, product_row.name, (item->>'quantity')::numeric,
      (item->>'unit_price')::numeric, (item->>'quantity')::numeric * (item->>'unit_price')::numeric,
      COALESCE(NULLIF(item->>'date_added', '')::timestamptz, now()), NULLIF(item->>'registered_by', '')
    ) RETURNING * INTO entry_row;
    created := created || jsonb_build_array(to_jsonb(entry_row));
    IF p_adjust_stock THEN PERFORM public.erp_apply_product_stock(product_row.id, location_row.id,
      -(item->>'quantity')::numeric, 'saida', p_reason, 'debt', entry_row.id); END IF;
  END LOOP;
  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, action, entity_type, details)
  VALUES (owner_id, auth.uid(), 'debt_entries.create', 'debt_entry', jsonb_build_object('count', jsonb_array_length(created), 'location_id', location_row.id));
  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_cancel_sale_atomic(p_sale_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE sale_row public.sales%ROWTYPE;
DECLARE item_row public.sale_items%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR NOT public.current_user_has_erp_permission('pdv.cancel_sale') THEN RAISE EXCEPTION 'Sem permissao para cancelar venda.'; END IF;
  IF trim(COALESCE(p_reason, '')) = '' THEN RAISE EXCEPTION 'Motivo do cancelamento obrigatorio.'; END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = p_sale_id AND user_id = owner_id FOR UPDATE;
  IF sale_row.id IS NULL THEN RAISE EXCEPTION 'Venda nao encontrada.'; END IF;
  IF sale_row.status = 'cancelled' THEN RETURN to_jsonb(sale_row); END IF;
  UPDATE public.sales SET status = 'cancelled', cancel_reason = trim(p_reason), cancelled_at = now()
  WHERE id = sale_row.id RETURNING * INTO sale_row;
  FOR item_row IN SELECT * FROM public.sale_items WHERE sale_id = sale_row.id LOOP
    IF item_row.product_id IS NULL THEN RAISE EXCEPTION 'Item sem product_id impede cancelamento seguro.'; END IF;
    PERFORM public.erp_apply_product_stock(item_row.product_id, sale_row.location_id, item_row.quantity,
      'entrada', 'Cancelamento venda: ' || trim(p_reason), 'sale_cancel', sale_row.id);
  END LOOP;
  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES (owner_id, auth.uid(), 'sale.cancel', 'sale', sale_row.id::text,
    jsonb_build_object('reason', trim(p_reason), 'location_id', sale_row.location_id));
  RETURN to_jsonb(sale_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_close_cash_session_atomic(p_session_id uuid, p_expected numeric, p_counted numeric, p_reason text DEFAULT NULL)
RETURNS public.cash_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE session_row public.cash_sessions%ROWTYPE;
DECLARE difference numeric(14,2) := round(p_counted - p_expected, 2);
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR NOT public.current_user_has_erp_permission('pdv.close_cash') THEN RAISE EXCEPTION 'Sem permissao para fechar caixa.'; END IF;
  IF p_expected < 0 OR p_counted < 0 THEN RAISE EXCEPTION 'Valores de fechamento invalidos.'; END IF;
  IF abs(difference) >= 0.01 AND trim(COALESCE(p_reason, '')) = '' THEN RAISE EXCEPTION 'Justificativa obrigatoria quando houver diferenca.'; END IF;
  UPDATE public.cash_sessions SET status = 'closed', closed_at = now(), closed_by_user_id = auth.uid(),
    closed_by_name = COALESCE((SELECT username FROM public.profiles WHERE user_id = auth.uid()), auth.uid()::text),
    closing_balance = p_counted, expected_balance = p_expected, counted_balance = p_counted,
    closing_difference = difference, difference_reason = NULLIF(trim(p_reason), '')
  WHERE id = p_session_id AND owner_user_id = owner_id AND status = 'open'
  RETURNING * INTO session_row;
  IF session_row.id IS NULL THEN RAISE EXCEPTION 'Caixa aberto nao encontrado.'; END IF;
  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES (owner_id, auth.uid(), 'cash_session.close', 'cash_session', session_row.id::text,
    jsonb_build_object('expected', p_expected, 'counted', p_counted, 'difference', difference, 'reason', p_reason));
  RETURN session_row;
END;
$$;

REVOKE ALL ON FUNCTION public.erp_create_sale_atomic(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erp_add_debt_entries_atomic(jsonb, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erp_cancel_sale_atomic(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erp_close_cash_session_atomic(uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.erp_create_sale_atomic(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_add_debt_entries_atomic(jsonb, uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_cancel_sale_atomic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_close_cash_session_atomic(uuid, numeric, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_product_change_detailed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (to_jsonb(OLD) - 'stock' - 'updated_at' - 'sync_status' - 'sync_error')
     IS NOT DISTINCT FROM
     (to_jsonb(NEW) - 'stock' - 'updated_at' - 'sync_status' - 'sync_error') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES (NEW.user_id, auth.uid(), 'product.update.detailed', 'product', NEW.id::text,
    jsonb_build_object('before', to_jsonb(OLD) - 'sync_error', 'after', to_jsonb(NEW) - 'sync_error'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_product_change_detailed_trigger ON public.products;
CREATE TRIGGER audit_product_change_detailed_trigger AFTER UPDATE ON public.products
FOR EACH ROW WHEN (OLD IS DISTINCT FROM NEW) EXECUTE FUNCTION public.audit_product_change_detailed();

COMMENT ON COLUMN public.products.control_stock IS 'Quando falso, o produto pode ser vendido sem saldo e nao gera baixa de estoque.';
COMMENT ON COLUMN public.products.max_stock IS 'Capacidade ou estoque alvo usado na previsao e sugestao de compras.';
