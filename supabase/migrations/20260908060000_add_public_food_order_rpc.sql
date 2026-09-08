CREATE OR REPLACE FUNCTION public.submit_food_order(
  p_table_session_id uuid,
  p_items jsonb,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  session_row public.food_table_sessions;
  order_id uuid;
  item jsonb;
  subtotal numeric(12,2) := 0;
  qty numeric(12,3);
  unit_price numeric(12,2);
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'O pedido precisa conter itens';
  END IF;
  SELECT * INTO session_row FROM public.food_table_sessions
  WHERE id = p_table_session_id AND status IN ('open','awaiting_payment');
  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão de mesa inválida ou encerrada'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    qty := (item->>'quantity')::numeric;
    unit_price := (item->>'unit_price')::numeric;
    IF qty IS NULL OR qty <= 0 OR unit_price IS NULL OR unit_price < 0 THEN
      RAISE EXCEPTION 'Item inválido';
    END IF;
    subtotal := subtotal + round(qty * unit_price, 2);
  END LOOP;

  INSERT INTO public.food_orders (store_account_id, owner_user_id, location_id, table_session_id, source, status, customer_name, customer_phone, subtotal, total, submitted_at)
  VALUES (session_row.store_account_id, session_row.owner_user_id, session_row.location_id, session_row.id, 'qrmenu', 'submitted', coalesce(p_customer_name,''), coalesce(p_customer_phone,''), subtotal, subtotal, now())
  RETURNING id INTO order_id;

  INSERT INTO public.food_order_items (store_account_id, owner_user_id, location_id, order_id, product_id, product_name, quantity, unit_price, total, notes)
  SELECT session_row.store_account_id, session_row.owner_user_id, session_row.location_id, order_id,
    NULLIF(item->>'product_id','')::uuid, coalesce(item->>'product_name','Item'), (item->>'quantity')::numeric,
    (item->>'unit_price')::numeric, round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2), coalesce(item->>'notes','')
  FROM jsonb_array_elements(p_items) item;

  INSERT INTO public.food_order_events (store_account_id, owner_user_id, location_id, order_id, actor_type, event_type, details)
  VALUES (session_row.store_account_id, session_row.owner_user_id, session_row.location_id, order_id, 'customer', 'submitted', jsonb_build_object('source','qrmenu'));
  RETURN order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_food_order(uuid, jsonb, text, text) TO anon, authenticated;
