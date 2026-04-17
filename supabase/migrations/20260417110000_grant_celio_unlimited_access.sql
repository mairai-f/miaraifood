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
    'Endereco nao informado, Bairro nao informado, Cidade nao informada - SP',
    'Endereco nao informado',
    NULL,
    NULL,
    'Bairro nao informado',
    'Cidade nao informada',
    'SP'
  )
  ON CONFLICT (owner_user_id) DO UPDATE
  SET
    nome_cliente = COALESCE(NULLIF(EXCLUDED.nome_cliente, ''), public.store_accounts.nome_cliente),
    email = EXCLUDED.email,
    cnpj = COALESCE(EXCLUDED.cnpj, public.store_accounts.cnpj),
    nome_estabelecimento = COALESCE(NULLIF(EXCLUDED.nome_estabelecimento, ''), public.store_accounts.nome_estabelecimento),
    cep = COALESCE(NULLIF(EXCLUDED.cep, ''), public.store_accounts.cep),
    endereco = COALESCE(NULLIF(EXCLUDED.endereco, ''), public.store_accounts.endereco),
    nome_rua = COALESCE(NULLIF(EXCLUDED.nome_rua, ''), public.store_accounts.nome_rua),
    numero = COALESCE(EXCLUDED.numero, public.store_accounts.numero),
    complemento = COALESCE(EXCLUDED.complemento, public.store_accounts.complemento),
    bairro = COALESCE(EXCLUDED.bairro, public.store_accounts.bairro),
    cidade = COALESCE(NULLIF(EXCLUDED.cidade, ''), public.store_accounts.cidade),
    estado = COALESCE(NULLIF(EXCLUDED.estado, ''), public.store_accounts.estado),
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
    AND subscription.status IN ('trialing', 'active', 'past_due')
  ORDER BY subscription.created_at DESC
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
        'source', 'manual_admin_override',
        'unlimited_access_email', target_email,
        'granted_at', now(),
        'notes', 'Acesso ilimitado concedido para todos os servicos.'
      )
    );
  ELSE
    UPDATE public.store_subscriptions
    SET
      plan_id = 'pro',
      provider = 'manual',
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
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'source', 'manual_admin_override',
        'unlimited_access_email', target_email,
        'granted_at', now(),
        'notes', 'Acesso ilimitado concedido para todos os servicos.'
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
        'reason', 'manual_admin_override_cleanup'
      ),
      updated_at = now()
    WHERE owner_user_id = target_user_id
      AND status IN ('trialing', 'active', 'past_due')
      AND id <> current_subscription_id;
  END IF;
END $$;
