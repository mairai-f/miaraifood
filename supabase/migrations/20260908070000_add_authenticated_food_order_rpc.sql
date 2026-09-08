ALTER TABLE public.food_orders
  ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.submit_authenticated_food_order(
  p_store_account_id uuid,
  p_location_id uuid,
  p_items jsonb,
  p_source text DEFAULT 'delivery',
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT '',
  p_delivery_address text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE account_row public.store_accounts; order_id uuid; item jsonb; subtotal numeric(12,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF p_source NOT IN ('delivery','pickup') THEN RAISE EXCEPTION 'Origem inválida'; END IF;
  SELECT * INTO account_row FROM public.store_accounts WHERE id = p_store_account_id;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.store_locations WHERE id=p_location_id AND store_account_id=p_store_account_id AND active) THEN
    RAISE EXCEPTION 'Estabelecimento inválido';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'O pedido precisa conter itens'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (item->>'quantity')::numeric <= 0 OR (item->>'unit_price')::numeric < 0 THEN RAISE EXCEPTION 'Item inválido'; END IF;
    subtotal := subtotal + round((item->>'quantity')::numeric * (item->>'unit_price')::numeric, 2);
  END LOOP;
  INSERT INTO public.food_orders (store_account_id, owner_user_id, location_id, source, status, customer_user_id, customer_name, customer_phone, subtotal, total, submitted_at)
  VALUES (p_store_account_id, account_row.owner_user_id, p_location_id, p_source, 'submitted', auth.uid(), coalesce(p_customer_name,''), coalesce(p_customer_phone,''), subtotal, subtotal, now())
  RETURNING id INTO order_id;
  INSERT INTO public.food_order_items (store_account_id, owner_user_id, location_id, order_id, product_id, product_name, quantity, unit_price, total, notes)
  SELECT p_store_account_id, account_row.owner_user_id, p_location_id, order_id, NULLIF(item->>'product_id','')::uuid, coalesce(item->>'product_name','Item'), (item->>'quantity')::numeric, (item->>'unit_price')::numeric, round((item->>'quantity')::numeric*(item->>'unit_price')::numeric,2), coalesce(item->>'notes','') FROM jsonb_array_elements(p_items) item;
  INSERT INTO public.food_order_events (store_account_id, owner_user_id, location_id, order_id, actor_user_id, actor_type, event_type, details)
  VALUES (p_store_account_id, account_row.owner_user_id, p_location_id, order_id, auth.uid(), 'customer', 'submitted', jsonb_build_object('source',p_source,'delivery_address',p_delivery_address));
  RETURN order_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_authenticated_food_order(uuid,uuid,jsonb,text,text,text,text) TO authenticated;
