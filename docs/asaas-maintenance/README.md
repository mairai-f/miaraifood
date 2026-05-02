  # Manutencao SQL do Asaas

Este README guarda comandos SQL para manutencao operacional da integracao com o Asaas no Supabase.

Use estes comandos quando precisar investigar ou limpar dados locais de cobranca, principalmente depois de fila de webhook pausada, troca de token, cobrancas pendentes antigas ou ressincronizacao de cliente.

Importante:

- Estes comandos mexem em tabelas de assinatura e cobranca. Rode primeiro em leitura, revise os resultados e mantenha backup quando estiver em producao.
- Os blocos destrutivos usam `BEGIN` e terminam com `ROLLBACK` por padrao. Troque `ROLLBACK` por `COMMIT` somente depois de conferir o preview.
- Estes comandos limpam o banco local do HappyCash. Eles nao apagam cobrancas dentro do Asaas. Para apagar/cancelar no Asaas, use o painel ou a API do Asaas.
- Rode no SQL Editor do Supabase com uma conta/admin que tenha permissao para manutencao.

## 1. Diagnosticar ultimos webhooks recebidos

Mostra os ultimos eventos recebidos do Asaas e ajuda a descobrir ate quando a fila estava entregando eventos.

```sql
SELECT
  id,
  provider_event_id,
  event_type,
  payload->'account'->>'id' AS asaas_account_id,
  payload->'payment'->>'id' AS asaas_payment_id,
  payload->'payment'->>'status' AS asaas_payment_status,
  payload->'payment'->>'billingType' AS billing_type,
  payload->'payment'->>'invoiceUrl' AS invoice_url,
  processed_at,
  created_at
FROM public.billing_webhook_events
WHERE provider = 'asaas'
ORDER BY created_at DESC
LIMIT 50;
```

## 2. Ver eventos de um pagamento especifico

Use quando o cliente pagou, mas o plano nao ativou. Substitua `pay_xxx`.

```sql
SELECT
  provider_event_id,
  event_type,
  payload->'payment'->>'id' AS asaas_payment_id,
  payload->'payment'->>'externalReference' AS subscription_id,
  payload->'payment'->>'status' AS asaas_payment_status,
  payload->'payment'->>'clientPaymentDate' AS client_payment_date,
  payload->'payment'->>'paymentDate' AS payment_date,
  processed_at
FROM public.billing_webhook_events
WHERE provider = 'asaas'
  AND payload->'payment'->>'id' = 'pay_xxx'
ORDER BY created_at ASC;
```

## 3. Encontrar assinaturas pendentes antigas

Lista assinaturas em `pending` que podem estar bloqueando nova cobranca para a mesma loja.

```sql
SELECT
  ss.id,
  ss.owner_user_id,
  sa.email,
  sa.nome_cliente,
  ss.plan_id,
  ss.status,
  ss.billing_type,
  ss.provider_payment_id,
  ss.metadata->>'asaas_payment_status' AS asaas_payment_status,
  ss.created_at,
  ss.updated_at
FROM public.store_subscriptions ss
JOIN public.store_accounts sa ON sa.id = ss.store_account_id
WHERE ss.provider = 'asaas'
  AND ss.status = 'pending'
ORDER BY ss.created_at ASC;
```

## 4. Cancelar cobrancas pendentes antigas

Use para limpar pendencias locais antigas depois de confirmar que a cobranca nao deve mais liberar plano.

Troque `7 days` se quiser outro periodo.

```sql
BEGIN;

CREATE TEMP TABLE _asaas_pending_candidates ON COMMIT DROP AS
  SELECT
    ss.id,
    ss.owner_user_id,
    ss.provider_payment_id,
    ss.status,
    ss.created_at
  FROM public.store_subscriptions ss
  WHERE ss.provider = 'asaas'
    AND ss.status = 'pending'
    AND ss.created_at < now() - interval '7 days';

SELECT * FROM _asaas_pending_candidates ORDER BY created_at ASC;

UPDATE public.store_subscriptions ss
SET
  status = 'canceled',
  metadata = COALESCE(ss.metadata, '{}'::jsonb) || jsonb_build_object(
    'maintenance_cancelled_at', now(),
    'maintenance_reason', 'pending_asaas_charge_older_than_7_days'
  ),
  updated_at = now()
WHERE ss.id IN (SELECT id FROM _asaas_pending_candidates);

SELECT
  id,
  status,
  provider_payment_id,
  metadata->>'maintenance_reason' AS maintenance_reason,
  updated_at
FROM public.store_subscriptions
WHERE id IN (SELECT id FROM _asaas_pending_candidates);

ROLLBACK;
-- Troque ROLLBACK por COMMIT depois de conferir.
```

## 5. Cancelar pendencia de um cliente especifico

Use quando um usuario esta preso em cobranca pendente. Substitua o email.

```sql
BEGIN;

CREATE TEMP TABLE _asaas_target_owner ON COMMIT DROP AS
  SELECT owner_user_id
  FROM public.store_accounts
  WHERE lower(email) = lower('cliente@email.com');

CREATE TEMP TABLE _asaas_pending_candidates ON COMMIT DROP AS
  SELECT ss.id
  FROM public.store_subscriptions ss
  JOIN _asaas_target_owner t ON t.owner_user_id = ss.owner_user_id
  WHERE ss.provider = 'asaas'
    AND ss.status = 'pending';

SELECT
  ss.id,
  ss.plan_id,
  ss.status,
  ss.billing_type,
  ss.provider_payment_id,
  ss.created_at
FROM public.store_subscriptions ss
WHERE ss.id IN (SELECT id FROM _asaas_pending_candidates);

UPDATE public.store_subscriptions ss
SET
  status = 'canceled',
  metadata = COALESCE(ss.metadata, '{}'::jsonb) || jsonb_build_object(
    'maintenance_cancelled_at', now(),
    'maintenance_reason', 'manual_pending_charge_reset_by_email'
  ),
  updated_at = now()
WHERE ss.id IN (SELECT id FROM _asaas_pending_candidates);

SELECT id, status, updated_at
FROM public.store_subscriptions
WHERE id IN (SELECT id FROM _asaas_pending_candidates);

ROLLBACK;
-- Troque ROLLBACK por COMMIT depois de conferir.
```

## 6. Ressincronizar cliente Asaas local

Use quando o `provider_customer_id` local aponta para cliente removido, ambiente errado ou cliente antigo do Asaas.

Este comando nao cria cliente no Asaas. Ele apenas marca o vinculo local como removido; na proxima cobranca, a Edge Function tenta localizar pelo `externalReference` ou criar um novo cliente.

```sql
BEGIN;

CREATE TEMP TABLE _asaas_target_owner ON COMMIT DROP AS
  SELECT owner_user_id
  FROM public.store_accounts
  WHERE lower(email) = lower('cliente@email.com');

SELECT
  bc.id,
  bc.owner_user_id,
  bc.provider_customer_id,
  bc.provider_customer_deleted,
  bc.email,
  bc.updated_at
FROM public.billing_customers bc
JOIN _asaas_target_owner t ON t.owner_user_id = bc.owner_user_id;

UPDATE public.billing_customers bc
SET
  provider_customer_deleted = true,
  metadata = COALESCE(bc.metadata, '{}'::jsonb) || jsonb_build_object(
    'maintenance_marked_deleted_at', now(),
    'maintenance_reason', 'force_asaas_customer_resync'
  ),
  updated_at = now()
WHERE bc.owner_user_id IN (SELECT owner_user_id FROM _asaas_target_owner);

SELECT
  id,
  provider_customer_id,
  provider_customer_deleted,
  metadata->>'maintenance_reason' AS maintenance_reason,
  updated_at
FROM public.billing_customers
WHERE owner_user_id IN (SELECT owner_user_id FROM _asaas_target_owner);

ROLLBACK;
-- Troque ROLLBACK por COMMIT depois de conferir.
```

## 7. Remover logs antigos de webhook

Use para reduzir volume da tabela `billing_webhook_events`.

Nao rode enquanto a fila do Asaas estiver pausada ou em reentrega ativa, porque esses logs ajudam a auditar eventos duplicados e pagamentos recentes.

```sql
BEGIN;

CREATE TEMP TABLE _asaas_webhook_log_candidates ON COMMIT DROP AS
  SELECT id, provider_event_id, event_type, created_at
  FROM public.billing_webhook_events
  WHERE provider = 'asaas'
    AND created_at < now() - interval '90 days';

SELECT
  count(*) AS total_to_delete,
  min(created_at) AS oldest_event,
  max(created_at) AS newest_event
FROM _asaas_webhook_log_candidates;

DELETE FROM public.billing_webhook_events
WHERE id IN (SELECT id FROM _asaas_webhook_log_candidates);

SELECT count(*) AS remaining_events
FROM public.billing_webhook_events
WHERE provider = 'asaas';

ROLLBACK;
-- Troque ROLLBACK por COMMIT depois de conferir.
```

## 8. Remover logs de um evento duplicado/problematico

Use somente se precisar permitir que um mesmo `provider_event_id` seja reprocessado pela function.

```sql
BEGIN;

SELECT
  id,
  provider_event_id,
  event_type,
  processed_at,
  created_at
FROM public.billing_webhook_events
WHERE provider = 'asaas'
  AND provider_event_id = 'evt_xxx';

DELETE FROM public.billing_webhook_events
WHERE provider = 'asaas'
  AND provider_event_id = 'evt_xxx';

ROLLBACK;
-- Troque ROLLBACK por COMMIT depois de conferir.
```

## 9. Conferir dados sensiveis expostos por RLS

Se a chave publica do frontend conseguir ler `billing_webhook_events`, revise as policies dessa tabela. Payloads de webhook podem conter invoice URL, cliente, status e dados de pagamento.

Este comando mostra policies existentes:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'billing_webhook_events';
```

Se nao houver motivo para leitura publica, ative RLS e remova policies abertas:

```sql
BEGIN;

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_webhook_events_public_read" ON public.billing_webhook_events;
DROP POLICY IF EXISTS "billing_webhook_events_authenticated_read" ON public.billing_webhook_events;

ROLLBACK;
-- Troque ROLLBACK por COMMIT depois de conferir.
```

## 10. Depois de corrigir o webhook no Asaas

Depois de alinhar URL e token:

1. Confirme que a URL no Asaas e `https://ymffclntmynwfdiarlaw.supabase.co/functions/v1/asaas-webhook`.
2. Confirme que o token do painel Asaas e igual ao secret `ASAAS_WEBHOOK_AUTH_TOKEN`.
3. Reative a fila no painel do Asaas.
4. Rode a consulta de diagnostico dos ultimos webhooks para confirmar novos eventos com `created_at` atual.

## 11. Apagar contas de teste por email

Use quando precisar liberar emails/documentos de teste para cadastrar novamente.

Este bloco remove dados locais ligados aos emails informados: usuario do Auth, loja, cadastro pendente, assinatura, cliente de cobranca local, clientes, produtos, vendas, fiado, pagamentos, caixa, fiscal, logs de acesso e logs de webhook relacionados.

Importante:

- Rode primeiro com `ROLLBACK`.
- Se o resultado final mostrar `rows_left = 0`, rode novamente trocando `ROLLBACK` por `COMMIT`.
- Isso limpa o Supabase/HappyCash. Nao remove clientes/cobrancas dentro do Asaas.
- Ajuste a lista `target_emails` antes de rodar.

```sql
BEGIN;

DO $$
DECLARE
  target_emails text[] := ARRAY[
    'celioantonio.dev1@gmail.com',
    'happycashsupport@gmail.com'
  ];

  target_owner_ids uuid[];
  target_operator_ids uuid[];
  target_all_user_ids uuid[];
  target_client_ids uuid[];
  target_product_ids uuid[];
  target_sale_ids uuid[];
BEGIN
  SELECT array_agg(DISTINCT owner_id)
  INTO target_owner_ids
  FROM (
    SELECT id AS owner_id
    FROM auth.users
    WHERE lower(email) = ANY(SELECT lower(unnest(target_emails)))

    UNION

    SELECT owner_user_id
    FROM public.store_accounts
    WHERE lower(email) = ANY(SELECT lower(unnest(target_emails)))

    UNION

    SELECT owner_user_id
    FROM public.site_pending_registrations
    WHERE lower(email) = ANY(SELECT lower(unnest(target_emails)))
  ) found;

  SELECT array_agg(DISTINCT user_id)
  INTO target_operator_ids
  FROM public.profiles
  WHERE owner_user_id = ANY(target_owner_ids)
    AND user_id <> ALL(target_owner_ids);

  SELECT array_agg(DISTINCT user_id)
  INTO target_all_user_ids
  FROM (
    SELECT unnest(coalesce(target_owner_ids, ARRAY[]::uuid[])) AS user_id
    UNION
    SELECT unnest(coalesce(target_operator_ids, ARRAY[]::uuid[])) AS user_id
  ) users_to_delete;

  SELECT array_agg(id)
  INTO target_client_ids
  FROM public.clients
  WHERE user_id = ANY(target_owner_ids);

  SELECT array_agg(id)
  INTO target_product_ids
  FROM public.products
  WHERE user_id = ANY(target_owner_ids);

  SELECT array_agg(id)
  INTO target_sale_ids
  FROM public.sales
  WHERE user_id = ANY(target_owner_ids);

  RAISE NOTICE 'Owners encontrados: %', coalesce(array_length(target_owner_ids, 1), 0);
  RAISE NOTICE 'Usuarios auth a apagar: %', coalesce(array_length(target_all_user_ids, 1), 0);

  DELETE FROM public.billing_webhook_events
  WHERE provider = 'asaas'
    AND (
      payload->'payment'->>'externalReference' IN (
        SELECT id::text FROM public.store_subscriptions
        WHERE owner_user_id = ANY(target_owner_ids)
      )
      OR payload->'payment'->>'customer' IN (
        SELECT provider_customer_id FROM public.billing_customers
        WHERE owner_user_id = ANY(target_owner_ids)
      )
    );

  DELETE FROM public.audit_logs
  WHERE owner_user_id = ANY(target_owner_ids)
     OR actor_user_id = ANY(target_all_user_ids);

  DELETE FROM public.access_logs
  WHERE owner_user_id = ANY(target_owner_ids)
     OR user_id = ANY(target_all_user_ids);

  DELETE FROM public.access_sessions
  WHERE owner_user_id = ANY(target_owner_ids)
     OR user_id = ANY(target_all_user_ids);

  DELETE FROM public.fiscal_documents
  WHERE owner_user_id = ANY(target_owner_ids);

  DELETE FROM public.sale_items
  WHERE sale_id = ANY(target_sale_ids);

  DELETE FROM public.sales
  WHERE id = ANY(target_sale_ids);

  DELETE FROM public.payments
  WHERE client_id = ANY(target_client_ids);

  DELETE FROM public.debt_entries
  WHERE client_id = ANY(target_client_ids);

  DELETE FROM public.product_price_history
  WHERE owner_user_id = ANY(target_owner_ids)
     OR product_id = ANY(target_product_ids);

  DELETE FROM public.stock_movements
  WHERE user_id = ANY(target_owner_ids)
     OR product_id = ANY(target_product_ids);

  DELETE FROM public.rewards
  WHERE user_id = ANY(target_owner_ids);

  DELETE FROM public.expenses
  WHERE user_id = ANY(target_owner_ids);

  DELETE FROM public.products
  WHERE id = ANY(target_product_ids);

  DELETE FROM public.clients
  WHERE id = ANY(target_client_ids);

  DELETE FROM public.cash_sessions
  WHERE owner_user_id = ANY(target_owner_ids)
     OR operator_user_id = ANY(target_all_user_ids);

  DELETE FROM public.product_category_pricing_rules
  WHERE owner_user_id = ANY(target_owner_ids);

  DELETE FROM public.store_fiscal_settings
  WHERE owner_user_id = ANY(target_owner_ids);

  DELETE FROM public.billing_customers
  WHERE owner_user_id = ANY(target_owner_ids);

  DELETE FROM public.store_subscriptions
  WHERE owner_user_id = ANY(target_owner_ids);

  DELETE FROM public.site_pending_registrations
  WHERE owner_user_id = ANY(target_owner_ids)
     OR lower(email) = ANY(SELECT lower(unnest(target_emails)));

  DELETE FROM public.store_accounts
  WHERE owner_user_id = ANY(target_owner_ids)
     OR lower(email) = ANY(SELECT lower(unnest(target_emails)));

  DELETE FROM public.profiles
  WHERE user_id = ANY(target_all_user_ids)
     OR owner_user_id = ANY(target_owner_ids)
     OR lower(email) = ANY(SELECT lower(unnest(target_emails)));

  DELETE FROM auth.users
  WHERE id = ANY(target_all_user_ids)
     OR lower(email) = ANY(SELECT lower(unnest(target_emails)));
END $$;

SELECT 'auth.users' AS table_name, count(*) AS rows_left
FROM auth.users
WHERE lower(email) IN ('celioantonio.dev1@gmail.com', 'happycashsupport@gmail.com')
UNION ALL
SELECT 'store_accounts', count(*)
FROM public.store_accounts
WHERE lower(email) IN ('celioantonio.dev1@gmail.com', 'happycashsupport@gmail.com')
UNION ALL
SELECT 'site_pending_registrations', count(*)
FROM public.site_pending_registrations
WHERE lower(email) IN ('celioantonio.dev1@gmail.com', 'happycashsupport@gmail.com');

ROLLBACK;
-- Se rows_left = 0, troque ROLLBACK por COMMIT e rode de novo.
```
