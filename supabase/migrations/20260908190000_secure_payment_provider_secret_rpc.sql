CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION public.upsert_store_payment_provider_secret(
  p_store_account_id uuid, p_provider text, p_display_name text, p_environment text,
  p_enabled boolean, p_public_config jsonb, p_secret_config text, p_encryption_key text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM store_accounts WHERE id=p_store_account_id AND owner_user_id=auth.uid())
     AND NOT public.current_user_is_admin() THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO store_payment_providers(store_account_id,provider,display_name,environment,enabled,public_config,secret_config_encrypted,created_by)
  VALUES (p_store_account_id,p_provider,p_display_name,p_environment,p_enabled,COALESCE(p_public_config,'{}'),pgp_sym_encrypt(COALESCE(p_secret_config,'{}'),p_encryption_key),auth.uid())
  ON CONFLICT (store_account_id,provider) DO UPDATE SET display_name=excluded.display_name,environment=excluded.environment,enabled=excluded.enabled,public_config=excluded.public_config,secret_config_encrypted=excluded.secret_config_encrypted,updated_at=now()
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.upsert_store_payment_provider_secret(uuid,text,text,text,boolean,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_store_payment_provider_secret(uuid,text,text,text,boolean,jsonb,text,text) TO authenticated, service_role;
