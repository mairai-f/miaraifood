CREATE OR REPLACE FUNCTION public.submit_food_order_for_guest(
  p_guest_session_id uuid,
  p_items jsonb,
  p_customer_name text DEFAULT '',
  p_customer_phone text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE table_session_id uuid; result_id uuid;
BEGIN
  SELECT guest.table_session_id INTO table_session_id
  FROM public.food_guest_sessions guest
  WHERE guest.id = p_guest_session_id AND guest.revoked_at IS NULL;
  IF table_session_id IS NULL THEN RAISE EXCEPTION 'Sessão de visitante inválida'; END IF;
  -- A função principal executa toda a validação e gravação em transação.
  SELECT public.submit_food_order(table_session_id, p_items, p_customer_name, p_customer_phone) INTO result_id;
  UPDATE public.food_orders SET guest_session_id = p_guest_session_id WHERE id = result_id;
  RETURN result_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_food_order_for_guest(uuid, jsonb, text, text) TO anon, authenticated;
