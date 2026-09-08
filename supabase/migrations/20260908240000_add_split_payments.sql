ALTER TABLE public.store_payment_transactions ADD COLUMN IF NOT EXISTS payment_group_id uuid;
CREATE INDEX IF NOT EXISTS store_payment_transactions_group_idx ON public.store_payment_transactions(payment_group_id);
CREATE OR REPLACE FUNCTION public.create_split_payment_group(p_order_id uuid, p_parts jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_group uuid:=gen_random_uuid(); v_store uuid; v_total numeric:=0; v_part jsonb; v_provider uuid;
BEGIN
 SELECT store_account_id INTO v_store FROM food_orders WHERE id=p_order_id;
 IF v_store IS NULL OR NOT (public.current_user_is_admin() OR public.current_user_has_erp_permission('food.payments.manage') OR EXISTS (SELECT 1 FROM store_accounts WHERE id=v_store AND owner_user_id=auth.uid())) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts) LOOP
   v_total:=v_total+COALESCE((v_part->>'amount')::numeric,0);
   SELECT id INTO v_provider FROM store_payment_providers WHERE store_account_id=v_store AND provider=v_part->>'provider' AND enabled LIMIT 1;
   IF v_provider IS NULL THEN RAISE EXCEPTION 'provider_not_enabled'; END IF;
   INSERT INTO store_payment_transactions(payment_group_id,store_account_id,provider_id,order_id,amount,method,status) VALUES(v_group,v_store,v_provider,p_order_id,(v_part->>'amount')::numeric,v_part->>'method','pending');
 END LOOP;
 IF v_total <= 0 THEN RAISE EXCEPTION 'invalid_total'; END IF;
 RETURN v_group;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_split_payment_group(uuid,jsonb) TO authenticated;
