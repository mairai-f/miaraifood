DELETE FROM public.subscription_plan_features
WHERE feature_key = 'restaurant.qr_menu'
  AND plan_id IN ('food', 'food_offline', 'pro');

UPDATE public.subscription_plans
SET
  description = CASE id
    WHEN 'food' THEN 'Sistema restaurante web com mesas, comandas em modal, garcom, cozinha, delivery, caixa, estoque e relatorios.'
    WHEN 'food_offline' THEN 'HappyCashFood com sistema offline, executavel Windows, Linux, pacote .deb, AppImage e Android APK.'
    ELSE description
  END,
  updated_at = now()
WHERE id IN ('food', 'food_offline');

DO $$
DECLARE
  target_email CONSTANT text := 'celioantonio.dev@gmail.com';
  target_user_id uuid;
  target_store_account_id uuid;
  current_subscription_id uuid;
BEGIN
  SELECT user_auth.id
  INTO target_user_id
  FROM auth.users AS user_auth
  WHERE lower(user_auth.email) = lower(target_email)
  ORDER BY user_auth.created_at
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'Usuario % nao encontrado em auth.users. Migration ignorada.', target_email;
    RETURN;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    username,
    email,
    role,
    owner_user_id,
    created_by_user_id
  )
  VALUES (
    target_user_id,
    split_part(target_email, '@', 1),
    target_email,
    'admin',
    target_user_id,
    target_user_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
    email = EXCLUDED.email,
    role = 'admin',
    owner_user_id = target_user_id,
    created_by_user_id = COALESCE(public.profiles.created_by_user_id, EXCLUDED.created_by_user_id);

  INSERT INTO public.store_accounts (
    owner_user_id,
    nome_cliente,
    email,
    telefone,
    cnpj,
    nome_estabelecimento,
    tipo_estabelecimento,
    cep,
    endereco,
    nome_rua,
    numero,
    complemento,
    bairro,
    cidade,
    estado
  )
  VALUES (
    target_user_id,
    split_part(target_email, '@', 1),
    target_email,
    '00000000000',
    NULL,
    'HappyCash Premium',
    'Outro',
    '00000000',
    'Endereco nao informado',
    'Endereco nao informado',
    NULL,
    NULL,
    'Bairro nao informado',
    'Cidade nao informada',
    'SP'
  )
  ON CONFLICT (owner_user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    nome_cliente = COALESCE(NULLIF(public.store_accounts.nome_cliente, ''), EXCLUDED.nome_cliente),
    nome_estabelecimento = CASE
      WHEN public.store_accounts.nome_estabelecimento = 'HappyCashFood Testes' THEN 'HappyCash Premium'
      ELSE COALESCE(NULLIF(public.store_accounts.nome_estabelecimento, ''), EXCLUDED.nome_estabelecimento)
    END,
    tipo_estabelecimento = CASE
      WHEN public.store_accounts.tipo_estabelecimento = 'Restaurante' THEN 'Outro'
      ELSE COALESCE(NULLIF(public.store_accounts.tipo_estabelecimento, ''), EXCLUDED.tipo_estabelecimento)
    END,
    updated_at = now()
  RETURNING id INTO target_store_account_id;

  IF target_store_account_id IS NULL THEN
    SELECT account.id
    INTO target_store_account_id
    FROM public.store_accounts AS account
    WHERE account.owner_user_id = target_user_id
    LIMIT 1;
  END IF;

  SELECT subscription.id
  INTO current_subscription_id
  FROM public.store_subscriptions AS subscription
  WHERE subscription.owner_user_id = target_user_id
    AND subscription.status IN ('trialing', 'active', 'past_due', 'pending')
  ORDER BY
    CASE
      WHEN subscription.provider = 'manual' THEN 0
      WHEN subscription.status = 'active' THEN 1
      WHEN subscription.status = 'past_due' THEN 2
      WHEN subscription.status = 'trialing' THEN 3
      ELSE 4
    END,
    COALESCE(subscription.current_period_ends_at, subscription.trial_ends_at, subscription.created_at) DESC,
    subscription.created_at DESC
  LIMIT 1;

  IF current_subscription_id IS NULL THEN
    INSERT INTO public.store_subscriptions (
      store_account_id,
      owner_user_id,
      plan_id,
      provider,
      status,
      billing_type,
      price,
      currency,
      current_period_starts_at,
      current_period_ends_at,
      cancel_at_period_end,
      external_reference,
      metadata
    )
    VALUES (
      target_store_account_id,
      target_user_id,
      'pro',
      'manual',
      'active',
      'PIX',
      0,
      'BRL',
      now(),
      NULL,
      false,
      target_user_id::text,
      jsonb_build_object(
        'source', 'restore_happycash_default_test_access',
        'test_account_email', target_email,
        'notes', 'Conta padrao de testes do HappyCash principal.'
      )
    );
  ELSE
    UPDATE public.store_subscriptions
    SET
      store_account_id = target_store_account_id,
      owner_user_id = target_user_id,
      plan_id = 'pro',
      provider = 'manual',
      provider_subscription_id = NULL,
      provider_payment_id = NULL,
      status = 'active',
      billing_type = 'PIX',
      price = 0,
      currency = 'BRL',
      trial_started_at = NULL,
      trial_ends_at = NULL,
      current_period_starts_at = COALESCE(current_period_starts_at, now()),
      current_period_ends_at = NULL,
      cancel_at_period_end = false,
      external_reference = target_user_id::text,
      metadata = (
        COALESCE(metadata, '{}'::jsonb)
        - 'source'
        - 'notes'
      ) || jsonb_build_object(
        'source', 'restore_happycash_default_test_access',
        'test_account_email', target_email,
        'notes', 'Conta padrao de testes do HappyCash principal.'
      ),
      updated_at = now()
    WHERE id = current_subscription_id;

    UPDATE public.store_subscriptions
    SET
      status = 'expired',
      current_period_ends_at = COALESCE(current_period_ends_at, now()),
      trial_ends_at = COALESCE(trial_ends_at, now()),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'replaced_at', now(),
        'reason', 'restore_happycash_default_test_access_cleanup'
      ),
      updated_at = now()
    WHERE owner_user_id = target_user_id
      AND status IN ('trialing', 'active', 'past_due', 'pending')
      AND id <> current_subscription_id;
  END IF;
END $$;
