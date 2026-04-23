DO $$
DECLARE
  target_email CONSTANT text := 'celioantonio.dev@gmail.com';
  target_user_id uuid;
  target_username text := split_part(target_email, '@', 1);
  target_store_account_id uuid;
  current_subscription_id uuid;
  resolved_customer_name text;
  resolved_phone text;
  resolved_cpf_cnpj text;
  resolved_store_name text;
  resolved_store_type text;
  resolved_zip_code text;
  resolved_full_address text;
  resolved_street text;
  resolved_number text;
  resolved_complement text;
  resolved_district text;
  resolved_city text;
  resolved_state text;
BEGIN
  SELECT
    user_auth.id,
    COALESCE(NULLIF(profile.username, ''), split_part(COALESCE(profile.email, user_auth.email, target_email), '@', 1))
  INTO target_user_id, target_username
  FROM auth.users AS user_auth
  LEFT JOIN public.profiles AS profile
    ON profile.user_id = user_auth.id
  WHERE lower(user_auth.email) = lower(target_email)
  ORDER BY user_auth.created_at
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.profiles (user_id, username, email, role, owner_user_id)
  VALUES (
    target_user_id,
    COALESCE(NULLIF(target_username, ''), split_part(target_email, '@', 1)),
    target_email,
    'admin',
    target_user_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    username = COALESCE(NULLIF(profiles.username, ''), EXCLUDED.username),
    email = EXCLUDED.email,
    role = 'admin',
    owner_user_id = EXCLUDED.owner_user_id;

  SELECT account.id
  INTO target_store_account_id
  FROM public.store_accounts AS account
  WHERE account.owner_user_id = target_user_id
  LIMIT 1;

  IF target_store_account_id IS NULL THEN
    SELECT
      COALESCE(NULLIF(registration.nome_cliente, ''), COALESCE(NULLIF(target_username, ''), split_part(target_email, '@', 1))),
      COALESCE(NULLIF(registration.telefone, ''), NULLIF(regexp_replace(COALESCE(target_username, ''), '\D', '', 'g'), ''), '00000000000'),
      NULLIF(COALESCE(registration.cpf_cnpj, fiscal.issuer_cnpj, ''), ''),
      COALESCE(
        NULLIF(registration.nome_estabelecimento, ''),
        NULLIF(fiscal.issuer_trade_name, ''),
        NULLIF(fiscal.issuer_legal_name, ''),
        format('Loja %s', left(target_user_id::text, 8))
      ),
      COALESCE(NULLIF(registration.tipo_estabelecimento, ''), 'Outro'),
      COALESCE(NULLIF(registration.cep, ''), NULLIF(fiscal.address_zip_code, ''), '00000000'),
      COALESCE(
        NULLIF(registration.endereco, ''),
        CASE
          WHEN NULLIF(fiscal.address_street, '') IS NOT NULL THEN format(
            '%s, %s, %s - %s',
            fiscal.address_street,
            COALESCE(NULLIF(fiscal.address_district, ''), 'Bairro nao informado'),
            COALESCE(NULLIF(fiscal.address_city, ''), 'Cidade nao informada'),
            COALESCE(NULLIF(fiscal.issuer_state, ''), 'SP')
          )
          ELSE NULL
        END,
        'Endereco nao informado'
      ),
      COALESCE(NULLIF(registration.nome_rua, ''), NULLIF(fiscal.address_street, ''), 'Endereco nao informado'),
      NULLIF(COALESCE(registration.numero, fiscal.address_number, ''), ''),
      NULLIF(COALESCE(registration.complemento, fiscal.address_complement, ''), ''),
      NULLIF(COALESCE(registration.bairro, fiscal.address_district, ''), ''),
      COALESCE(NULLIF(registration.cidade, ''), NULLIF(fiscal.address_city, ''), 'Cidade nao informada'),
      COALESCE(NULLIF(registration.estado, ''), NULLIF(fiscal.issuer_state, ''), 'SP')
    INTO
      resolved_customer_name,
      resolved_phone,
      resolved_cpf_cnpj,
      resolved_store_name,
      resolved_store_type,
      resolved_zip_code,
      resolved_full_address,
      resolved_street,
      resolved_number,
      resolved_complement,
      resolved_district,
      resolved_city,
      resolved_state
    FROM public.profiles AS profile
    LEFT JOIN public.site_pending_registrations AS registration
      ON registration.owner_user_id = profile.user_id
    LEFT JOIN public.store_fiscal_settings AS fiscal
      ON fiscal.owner_user_id = profile.user_id
    WHERE profile.user_id = target_user_id
    LIMIT 1;

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
      COALESCE(NULLIF(resolved_customer_name, ''), COALESCE(NULLIF(target_username, ''), split_part(target_email, '@', 1))),
      target_email,
      COALESCE(NULLIF(resolved_phone, ''), '00000000000'),
      resolved_cpf_cnpj,
      COALESCE(NULLIF(resolved_store_name, ''), format('Loja %s', left(target_user_id::text, 8))),
      COALESCE(NULLIF(resolved_store_type, ''), 'Outro'),
      COALESCE(NULLIF(resolved_zip_code, ''), '00000000'),
      COALESCE(NULLIF(resolved_full_address, ''), 'Endereco nao informado'),
      COALESCE(NULLIF(resolved_street, ''), 'Endereco nao informado'),
      resolved_number,
      resolved_complement,
      resolved_district,
      COALESCE(NULLIF(resolved_city, ''), 'Cidade nao informada'),
      COALESCE(NULLIF(resolved_state, ''), 'SP')
    )
    RETURNING id INTO target_store_account_id;
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
        'source', 'production_test_override',
        'test_account_email', target_email,
        'notes', 'Temporary explicit production test access for owner validation after commercialization hardening.'
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
        - 'commercialization_cleanup_at'
        - 'commercialization_cleanup_reason'
        - 'unlimited_access_email'
      ) || jsonb_build_object(
        'source', 'production_test_override',
        'test_account_email', target_email,
        'notes', 'Temporary explicit production test access for owner validation after commercialization hardening.'
      ),
      updated_at = now()
    WHERE id = current_subscription_id;
  END IF;
END $$;
