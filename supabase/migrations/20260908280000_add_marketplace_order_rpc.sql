-- Pedido do Marketplace sem API REST. A função usa o usuário autenticado,
-- localiza a filial ativa do estabelecimento e recalcula os preços a partir
-- do cardápio publicado; o navegador nunca determina o valor final.
CREATE OR REPLACE FUNCTION public.submit_marketplace_food_order(
  p_store_account_id uuid,
  p_items jsonb,
  p_source text DEFAULT 'delivery',
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_delivery_address text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  account_row public.store_accounts;
  location_row public.store_locations;
  order_id uuid;
  item jsonb;
  product_row record;
  item_quantity numeric(12,3);
  subtotal numeric(12,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF p_source NOT IN ('delivery', 'pickup') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 40 THEN
    RAISE EXCEPTION 'O pedido precisa conter de 1 a 40 itens';
  END IF;
  SELECT * INTO account_row FROM public.store_accounts WHERE id = p_store_account_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estabelecimento indisponível'; END IF;
  SELECT * INTO location_row FROM public.store_locations WHERE store_account_id = p_store_account_id AND active ORDER BY created_at, id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma filial disponível para receber este pedido'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    item_quantity := (item->>'quantity')::numeric;
    IF NULLIF(item->>'product_id','') IS NULL OR item_quantity IS NULL OR item_quantity <= 0 OR item_quantity > 99 THEN
      RAISE EXCEPTION 'Item inválido';
    END IF;
    SELECT product.id, product.name, product.price INTO product_row
    FROM public.food_menu_products menu
    JOIN public.products product ON product.id = menu.product_id
    WHERE menu.store_account_id = p_store_account_id
      AND menu.product_id = NULLIF(item->>'product_id','')::uuid
      AND menu.active AND product.deleted = false;
    IF NOT FOUND THEN RAISE EXCEPTION 'Um item não está mais disponível no cardápio'; END IF;
    subtotal := subtotal + round(item_quantity * product_row.price, 2);
  END LOOP;

  INSERT INTO public.food_orders (store_account_id, owner_user_id, location_id, source, status, customer_user_id, customer_name, customer_phone, subtotal, total, submitted_at)
  VALUES (p_store_account_id, account_row.owner_user_id, location_row.id, p_source, 'submitted', auth.uid(), coalesce(p_customer_name,''), coalesce(p_customer_phone,''), subtotal, subtotal, now())
  RETURNING id INTO order_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    item_quantity := (item->>'quantity')::numeric;
    SELECT product.id, product.name, product.price INTO product_row
    FROM public.food_menu_products menu JOIN public.products product ON product.id = menu.product_id
    WHERE menu.store_account_id = p_store_account_id AND menu.product_id = NULLIF(item->>'product_id','')::uuid AND menu.active AND product.deleted = false;
    INSERT INTO public.food_order_items (store_account_id, owner_user_id, location_id, order_id, product_id, product_name, quantity, unit_price, total, notes)
    VALUES (p_store_account_id, account_row.owner_user_id, location_row.id, order_id, product_row.id, product_row.name, item_quantity, product_row.price, round(item_quantity * product_row.price, 2), left(coalesce(item->>'notes',''), 300));
  END LOOP;
  INSERT INTO public.food_order_events (store_account_id, owner_user_id, location_id, order_id, actor_user_id, actor_type, event_type, details)
  VALUES (p_store_account_id, account_row.owner_user_id, location_row.id, order_id, auth.uid(), 'customer', 'submitted', jsonb_build_object('source', p_source, 'delivery_address', p_delivery_address));
  RETURN order_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_marketplace_food_order(uuid, jsonb, text, text, text, text) TO authenticated;
