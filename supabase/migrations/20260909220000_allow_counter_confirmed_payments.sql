-- Receber em dinheiro numa mesa era impossível: a tela enviava o provedor
-- 'cash', que o CHECK de store_payment_providers nem aceita, então a linha
-- não podia existir e create_split_payment_group sempre respondia
-- provider_not_enabled. Dinheiro não tem provedor -- exigir um era o erro.
--
-- E o Pix manual ficava 'pending' esperando uma confirmação que nunca chega:
-- não há webhook para uma chave Pix conferida no balcão, então a mesa jamais
-- fechava, porque close_food_table_session exige transação 'paid'.
ALTER TABLE public.store_payment_transactions
  ALTER COLUMN provider_id DROP NOT NULL;

COMMENT ON COLUMN public.store_payment_transactions.provider_id IS
  'Nulo quando o recebimento não passa por provedor, como dinheiro no balcão.';

CREATE OR REPLACE FUNCTION public.create_split_payment_group(p_order_id uuid, p_parts jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_group uuid := gen_random_uuid();
  v_store uuid;
  v_real_order uuid := p_order_id;
  v_part jsonb;
  v_provider uuid;
  v_provider_key text;
  v_method text;
  v_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM food_orders WHERE id = v_real_order) THEN
    SELECT id INTO v_real_order FROM food_orders WHERE table_session_id = p_order_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  SELECT store_account_id INTO v_store FROM food_orders WHERE id = v_real_order;
  IF v_store IS NULL OR NOT (
    public.current_user_is_admin()
    OR public.current_user_has_erp_permission('food.payments.manage')
    OR EXISTS (SELECT 1 FROM store_accounts WHERE id = v_store AND owner_user_id = auth.uid())
  ) THEN RAISE EXCEPTION 'unauthorized'; END IF;

  FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts) LOOP
    v_method := v_part->>'method';
    v_provider_key := NULLIF(btrim(COALESCE(v_part->>'provider', '')), '');
    v_provider := NULL;

    -- Dinheiro é recebido na mão: não existe provedor para habilitar.
    IF v_method = 'cash' THEN v_provider_key := NULL; END IF;

    IF v_provider_key IS NOT NULL THEN
      SELECT id INTO v_provider FROM store_payment_providers
      WHERE store_account_id = v_store AND provider = v_provider_key AND enabled
      LIMIT 1;
      IF v_provider IS NULL THEN RAISE EXCEPTION 'provider_not_enabled'; END IF;
    END IF;

    -- Dinheiro e Pix manual são conferidos por quem está no caixa. Provedor
    -- integrado continua pendente até o webhook confirmar.
    v_status := CASE
      WHEN v_method = 'cash' OR COALESCE(v_provider_key, '') = 'pix_manual' THEN 'paid'
      ELSE 'pending'
    END;

    INSERT INTO store_payment_transactions(
      payment_group_id, store_account_id, provider_id, order_id, amount, method, status, paid_at
    ) VALUES (
      v_group, v_store, v_provider, v_real_order,
      (v_part->>'amount')::numeric, v_method, v_status,
      CASE WHEN v_status = 'paid' THEN now() ELSE NULL END
    );
  END LOOP;

  RETURN v_group;
END; $$;
