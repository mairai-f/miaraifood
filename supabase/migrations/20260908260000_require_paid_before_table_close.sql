CREATE OR REPLACE FUNCTION public.close_food_table_session(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_store uuid; v_total numeric; v_paid numeric;
BEGIN
 SELECT store_account_id INTO v_store FROM food_table_sessions WHERE id=p_session_id;
 SELECT COALESCE(sum(total),0) INTO v_total FROM food_orders WHERE table_session_id=p_session_id AND status <> 'cancelled';
 SELECT COALESCE(sum(amount),0) INTO v_paid FROM store_payment_transactions t JOIN food_orders o ON o.id=t.order_id WHERE o.table_session_id=p_session_id AND t.status='paid';
 IF v_total > v_paid + 0.01 THEN RAISE EXCEPTION 'payment_pending'; END IF;
 IF v_store IS NULL OR (NOT public.current_user_is_admin() AND NOT EXISTS (SELECT 1 FROM store_accounts WHERE id=v_store AND owner_user_id=auth.uid()) AND NOT public.current_user_has_erp_permission('food.tables.close')) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 UPDATE food_table_sessions SET status='closed', closed_at=now() WHERE id=p_session_id AND status NOT IN ('closed','cancelled');
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.create_split_payment_group(p_order_id uuid, p_parts jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_group uuid:=gen_random_uuid(); v_store uuid; v_real_order uuid:=p_order_id; v_part jsonb; v_provider uuid;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM food_orders WHERE id=v_real_order) THEN SELECT id INTO v_real_order FROM food_orders WHERE table_session_id=p_order_id ORDER BY created_at DESC LIMIT 1; END IF;
 SELECT store_account_id INTO v_store FROM food_orders WHERE id=v_real_order;
 IF v_store IS NULL OR NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('food.payments.manage') OR EXISTS (SELECT 1 FROM store_accounts WHERE id=v_store AND owner_user_id=auth.uid())) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts) LOOP SELECT id INTO v_provider FROM store_payment_providers WHERE store_account_id=v_store AND provider=v_part->>'provider' AND enabled LIMIT 1; IF v_provider IS NULL THEN RAISE EXCEPTION 'provider_not_enabled'; END IF; INSERT INTO store_payment_transactions(payment_group_id,store_account_id,provider_id,order_id,amount,method,status,paid_at) VALUES(v_group,v_store,v_provider,v_real_order,(v_part->>'amount')::numeric,v_part->>'method','paid',now()); END LOOP; RETURN v_group;
END; $$;
