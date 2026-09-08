-- Correcao detectada pelo plpgsql_check remoto apos a Fase operacional.

CREATE OR REPLACE FUNCTION public.erp_apply_product_stock(
  target_product_id uuid, target_location_id uuid, target_delta numeric,
  target_type text, target_reason text, target_source text, target_reference_id uuid
)
RETURNS public.stock_movements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
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

CREATE OR REPLACE FUNCTION public.erp_create_sale_atomic(p_sale jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE v_sale_id uuid := COALESCE(NULLIF(p_sale->>'id', '')::uuid, gen_random_uuid());
DECLARE location_row public.store_locations%ROWTYPE;
DECLARE sale_row public.sales%ROWTYPE;
DECLARE product_row public.products%ROWTYPE;
DECLARE item jsonb;
DECLARE item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR NOT public.current_store_has_feature('pdv.use')
     OR NOT public.current_user_has_erp_permission('pdv.use') THEN RAISE EXCEPTION 'Sem permissao para registrar venda.'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Itens da venda invalidos.';
  END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = v_sale_id AND user_id = owner_id;
  IF sale_row.id IS NOT NULL THEN
    RETURN jsonb_build_object('sale', to_jsonb(sale_row), 'items',
      (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.sale_items i WHERE i.sale_id = v_sale_id));
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
      (item->>'quantity')::numeric, (item->>'unit_price')::numeric,
      COALESCE((item->>'cost_price')::numeric, product_row.cost_price, 0),
      (item->>'total')::numeric, COALESCE((item->>'discount_amount')::numeric, 0),
      COALESCE((item->>'net_total')::numeric, (item->>'total')::numeric),
      COALESCE((item->>'unit_profit')::numeric, 0), COALESCE((item->>'total_profit')::numeric, 0),
      COALESCE((item->>'markup_pct')::numeric, 0), COALESCE((item->>'margin_pct')::numeric, 0)
    );
    PERFORM public.erp_apply_product_stock(product_row.id, location_row.id, -(item->>'quantity')::numeric,
      'saida', 'Venda PDV', 'sale', v_sale_id);
  END LOOP;
  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, actor_label, action, entity_type, entity_id, details)
  VALUES (owner_id, auth.uid(), NULLIF(p_sale->>'seller_name', ''), 'sale.create', 'sale', v_sale_id::text,
    jsonb_build_object('total', sale_row.total, 'payment_method', sale_row.payment_method, 'location_id', location_row.id));
  RETURN jsonb_build_object('sale', to_jsonb(sale_row), 'items',
    (SELECT jsonb_agg(to_jsonb(i)) FROM public.sale_items i WHERE i.sale_id = v_sale_id));
END;
$$;
