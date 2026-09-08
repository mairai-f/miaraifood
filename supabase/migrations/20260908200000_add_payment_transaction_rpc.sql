CREATE OR REPLACE FUNCTION public.create_store_payment_transaction(
  p_order_id uuid, p_provider text, p_amount numeric, p_method text DEFAULT 'pix'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid; v_provider uuid; v_id uuid;
BEGIN
  SELECT store_account_id INTO v_store FROM food_orders WHERE id=p_order_id;
  IF v_store IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM store_accounts WHERE id=v_store AND owner_user_id=auth.uid())
     AND NOT EXISTS (SELECT 1 FROM food_orders WHERE id=p_order_id AND customer_user_id=auth.uid())
     AND NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT id INTO v_provider FROM store_payment_providers WHERE store_account_id=v_store AND provider=p_provider AND enabled=true LIMIT 1;
  IF v_provider IS NULL THEN RAISE EXCEPTION 'provider_not_enabled'; END IF;
  INSERT INTO store_payment_transactions(store_account_id, provider_id, order_id, amount, method, status)
  VALUES (v_store, v_provider, p_order_id, p_amount, p_method, 'pending') RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_store_payment_transaction(uuid,text,numeric,text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.update_store_payment_transaction_status(
  p_transaction_id uuid, p_status text, p_provider_transaction_id text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid;
BEGIN
  SELECT store_account_id INTO v_store FROM store_payment_transactions WHERE id=p_transaction_id;
  IF v_store IS NULL OR (NOT public.current_user_is_admin() AND NOT EXISTS (SELECT 1 FROM store_accounts WHERE id=v_store AND owner_user_id=auth.uid())) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE store_payment_transactions SET status=p_status, provider_transaction_id=COALESCE(p_provider_transaction_id,provider_transaction_id), provider_payload=COALESCE(p_payload,'{}'), paid_at=CASE WHEN p_status='paid' THEN now() ELSE paid_at END, updated_at=now() WHERE id=p_transaction_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.update_store_payment_transaction_status(uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_payment_transaction_status(uuid,text,text,jsonb) TO service_role, authenticated;
