CREATE OR REPLACE FUNCTION public.update_store_payment_transaction_status(
  p_transaction_id uuid, p_status text, p_provider_transaction_id text DEFAULT NULL, p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_store uuid;
BEGIN
  SELECT store_account_id INTO v_store FROM store_payment_transactions WHERE id=p_transaction_id;
  IF v_store IS NULL OR (auth.role() <> 'service_role' AND NOT public.current_user_is_admin() AND NOT EXISTS (SELECT 1 FROM store_accounts WHERE id=v_store AND owner_user_id=auth.uid())) THEN RAISE EXCEPTION 'unauthorized'; END IF;
  UPDATE store_payment_transactions SET status=p_status, provider_transaction_id=COALESCE(p_provider_transaction_id,provider_transaction_id), provider_payload=COALESCE(p_payload,'{}'), paid_at=CASE WHEN p_status='paid' THEN now() ELSE paid_at END, updated_at=now() WHERE id=p_transaction_id;
  RETURN true;
END; $$;
