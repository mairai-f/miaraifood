WITH owner_candidates AS (
  SELECT DISTINCT
    COALESCE(profile.owner_user_id, profile.user_id) AS owner_user_id
  FROM public.profiles AS profile
  WHERE COALESCE(profile.owner_user_id, profile.user_id) IS NOT NULL
),
owner_data AS (
  SELECT
    candidate.owner_user_id,
    COALESCE(NULLIF(owner_profile.username, ''), split_part(COALESCE(owner_profile.email, auth_user.email, 'lojista@happycash.local'), '@', 1)) AS owner_name,
    COALESCE(NULLIF(owner_profile.email, ''), auth_user.email, format('lojista+%s@happycash.local', candidate.owner_user_id::text)) AS owner_email,
    COALESCE(NULLIF(fiscal.issuer_trade_name, ''), NULLIF(fiscal.issuer_legal_name, ''), format('Loja %s', left(candidate.owner_user_id::text, 8))) AS store_name,
    COALESCE(NULLIF(fiscal.address_zip_code, ''), '00000000') AS zip_code,
    COALESCE(NULLIF(fiscal.address_street, ''), 'Endereco nao informado') AS street,
    NULLIF(fiscal.address_number, '') AS address_number,
    NULLIF(fiscal.address_complement, '') AS address_complement,
    NULLIF(fiscal.address_district, '') AS district,
    COALESCE(NULLIF(fiscal.address_city, ''), 'Cidade nao informada') AS city,
    COALESCE(NULLIF(fiscal.issuer_state, ''), 'SP') AS state,
    COALESCE(NULLIF(digits_phone.phone, ''), '00000000000') AS phone,
    NULLIF(COALESCE(fiscal.issuer_cnpj, ''), '') AS cpf_cnpj
  FROM owner_candidates AS candidate
  JOIN auth.users AS auth_user
    ON auth_user.id = candidate.owner_user_id
  LEFT JOIN public.profiles AS owner_profile
    ON owner_profile.user_id = candidate.owner_user_id
  LEFT JOIN public.store_fiscal_settings AS fiscal
    ON fiscal.owner_user_id = candidate.owner_user_id
  LEFT JOIN LATERAL (
    SELECT regexp_replace(COALESCE(owner_profile.username, ''), '\D', '', 'g') AS phone
  ) AS digits_phone ON true
)
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
SELECT
  owner.owner_user_id,
  owner.owner_name,
  owner.owner_email,
  owner.phone,
  owner.cpf_cnpj,
  owner.store_name,
  'Outro',
  owner.zip_code,
  format('%s, %s, %s - %s', owner.street, COALESCE(owner.district, 'Bairro nao informado'), owner.city, owner.state),
  owner.street,
  owner.address_number,
  owner.address_complement,
  owner.district,
  owner.city,
  owner.state
FROM owner_data AS owner
WHERE NOT EXISTS (
  SELECT 1
  FROM public.store_accounts AS account
  WHERE account.owner_user_id = owner.owner_user_id
);
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
  external_reference,
  metadata
)
SELECT
  account.id,
  account.owner_user_id,
  'pro',
  'manual',
  'active',
  'PIX',
  0,
  'BRL',
  now(),
  NULL,
  account.owner_user_id::text,
  jsonb_build_object(
    'source', 'legacy_backfill',
    'notes', 'Assinatura manual criada para preservar acesso dos usuarios existentes antes da camada de billing.'
  )
FROM public.store_accounts AS account
WHERE NOT EXISTS (
  SELECT 1
  FROM public.store_subscriptions AS subscription
  WHERE subscription.owner_user_id = account.owner_user_id
    AND subscription.status IN ('trialing', 'active', 'past_due')
);
