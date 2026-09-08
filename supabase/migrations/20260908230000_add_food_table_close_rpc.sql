CREATE OR REPLACE FUNCTION public.close_food_table_session(p_session_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_store uuid;
BEGIN
 SELECT store_account_id INTO v_store FROM food_table_sessions WHERE id=p_session_id;
 IF v_store IS NULL OR (NOT public.current_user_is_admin() AND NOT EXISTS (SELECT 1 FROM store_accounts WHERE id=v_store AND owner_user_id=auth.uid()) AND NOT public.current_user_has_erp_permission('food.tables.close')) THEN RAISE EXCEPTION 'unauthorized'; END IF;
 UPDATE food_table_sessions SET status='closed', closed_at=now() WHERE id=p_session_id AND status IN ('open','awaiting_payment');
 RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.close_food_table_session(uuid) TO authenticated;
