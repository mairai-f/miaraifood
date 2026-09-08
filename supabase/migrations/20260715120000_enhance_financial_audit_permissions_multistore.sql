-- HappyCash ERP: financeiro parcial, auditoria por permissao e transferencia entre filiais.

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.financial_accounts
SET paid_amount = amount
WHERE status = 'paid'
  AND paid_amount = 0;

UPDATE public.financial_accounts
SET paid_amount = 0
WHERE paid_amount < 0;

DO $$
BEGIN
  ALTER TABLE public.financial_accounts
    ADD CONSTRAINT financial_accounts_paid_amount_range_check
    CHECK (paid_amount >= 0 AND paid_amount <= amount);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS financial_accounts_open_balance_idx
  ON public.financial_accounts(owner_user_id, status, due_date)
  WHERE status = 'pending';

UPDATE public.erp_permission_catalog
SET description = CASE permission_key
  WHEN 'financial.view' THEN 'Consultar contas a pagar, contas a receber, despesas, saldos e fluxo financeiro.'
  WHEN 'financial.manage' THEN 'Criar, alterar, receber, pagar e cancelar lancamentos financeiros.'
  WHEN 'purchases.view' THEN 'Consultar fornecedores, pedidos de compra, recebimentos e sugestoes de reposicao.'
  WHEN 'purchases.manage' THEN 'Criar pedidos, enviar para fornecedor, receber mercadorias e gerar contas a pagar.'
  WHEN 'reports.view' THEN 'Consultar vendas, estoque, fiado, margem, custo e lucro fora do PDV.'
  WHEN 'audit.view' THEN 'Consultar trilha de alteracoes sensiveis da loja por permissao de cargo.'
  WHEN 'multi_store.manage' THEN 'Administrar filiais, depositos, terminais e transferencias entre locais.'
  ELSE description
END
WHERE permission_key IN (
  'financial.view',
  'financial.manage',
  'purchases.view',
  'purchases.manage',
  'reports.view',
  'audit.view',
  'multi_store.manage'
);

DROP POLICY IF EXISTS "audit_logs_select_store_admin" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_store_allowed" ON public.audit_logs;
CREATE POLICY "audit_logs_select_store_allowed"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('audit.view')
);

DROP POLICY IF EXISTS "suppliers_owner_all" ON public.suppliers;
DROP POLICY IF EXISTS suppliers_store_read ON public.suppliers;
DROP POLICY IF EXISTS suppliers_store_manage ON public.suppliers;
CREATE POLICY suppliers_store_read
ON public.suppliers
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.view')
);
CREATE POLICY suppliers_store_manage
ON public.suppliers
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.manage')
);

DROP POLICY IF EXISTS "purchase_orders_owner_all" ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_store_read ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_store_manage ON public.purchase_orders;
CREATE POLICY purchase_orders_store_read
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.view')
);
CREATE POLICY purchase_orders_store_manage
ON public.purchase_orders
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.manage')
);

DROP POLICY IF EXISTS "purchase_order_items_owner_all" ON public.purchase_order_items;
DROP POLICY IF EXISTS purchase_order_items_store_read ON public.purchase_order_items;
DROP POLICY IF EXISTS purchase_order_items_store_manage ON public.purchase_order_items;
CREATE POLICY purchase_order_items_store_read
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.view')
);
CREATE POLICY purchase_order_items_store_manage
ON public.purchase_order_items
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('purchases.manage')
);

DROP POLICY IF EXISTS "financial_accounts_owner_all" ON public.financial_accounts;
DROP POLICY IF EXISTS financial_accounts_store_read ON public.financial_accounts;
DROP POLICY IF EXISTS financial_accounts_store_manage ON public.financial_accounts;
CREATE POLICY financial_accounts_store_read
ON public.financial_accounts
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (
    public.current_user_has_erp_permission('financial.view')
    OR (
      public.current_user_has_erp_permission('purchases.view')
      AND source = 'purchase'
      AND account_type = 'payable'
    )
  )
);
CREATE POLICY financial_accounts_store_manage
ON public.financial_accounts
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (
    public.current_user_has_erp_permission('financial.manage')
    OR (
      public.current_user_has_erp_permission('purchases.manage')
      AND source = 'purchase'
      AND account_type = 'payable'
    )
  )
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND (
    public.current_user_has_erp_permission('financial.manage')
    OR (
      public.current_user_has_erp_permission('purchases.manage')
      AND source = 'purchase'
      AND account_type = 'payable'
    )
  )
);

DROP POLICY IF EXISTS "product_batches_owner_all" ON public.product_batches;
DROP POLICY IF EXISTS product_batches_store_read ON public.product_batches;
DROP POLICY IF EXISTS product_batches_store_manage ON public.product_batches;
CREATE POLICY product_batches_store_read
ON public.product_batches
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (
    public.current_user_has_erp_permission('products.view')
    OR public.current_user_has_erp_permission('stock.view')
    OR public.current_user_has_erp_permission('purchases.view')
  )
);
CREATE POLICY product_batches_store_manage
ON public.product_batches
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (
    public.current_user_has_erp_permission('products.manage')
    OR public.current_user_has_erp_permission('stock.manage')
    OR public.current_user_has_erp_permission('purchases.manage')
  )
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND (
    public.current_user_has_erp_permission('products.manage')
    OR public.current_user_has_erp_permission('stock.manage')
    OR public.current_user_has_erp_permission('purchases.manage')
  )
);

DROP POLICY IF EXISTS store_locations_admin_write ON public.store_locations;
DROP POLICY IF EXISTS store_locations_permission_write ON public.store_locations;
CREATE POLICY store_locations_permission_write
ON public.store_locations
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('multi_store.manage')
);

DROP POLICY IF EXISTS pos_terminals_admin_write ON public.pos_terminals;
DROP POLICY IF EXISTS pos_terminals_permission_write ON public.pos_terminals;
CREATE POLICY pos_terminals_permission_write
ON public.pos_terminals
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('multi_store.manage')
);

CREATE OR REPLACE FUNCTION public.transfer_location_stock(
  p_source_location_id uuid,
  p_target_location_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_reason text DEFAULT 'Transferencia entre filiais'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  transfer_id uuid := gen_random_uuid();
  product_row public.products%ROWTYPE;
  source_row public.store_locations%ROWTYPE;
  target_row public.store_locations%ROWTYPE;
  clean_reason text := coalesce(nullif(trim(p_reason), ''), 'Transferencia entre filiais');
BEGIN
  IF owner_id IS NULL
    OR NOT public.current_store_has_feature('stock.manage')
    OR NOT public.current_user_has_erp_permission('stock.manage')
    OR NOT public.current_user_has_erp_permission('multi_store.manage')
  THEN
    RAISE EXCEPTION 'Sem permissao para transferir estoque entre filiais.';
  END IF;
  IF p_source_location_id IS NULL OR p_target_location_id IS NULL OR p_source_location_id = p_target_location_id THEN
    RAISE EXCEPTION 'Informe filiais de origem e destino diferentes.';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantidade de transferencia invalida.';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = p_product_id AND user_id = owner_id AND NOT deleted;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto nao encontrado.'; END IF;

  SELECT * INTO source_row
  FROM public.store_locations
  WHERE id = p_source_location_id AND owner_user_id = owner_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filial de origem nao encontrada ou inativa.'; END IF;

  SELECT * INTO target_row
  FROM public.store_locations
  WHERE id = p_target_location_id AND owner_user_id = owner_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filial de destino nao encontrada ou inativa.'; END IF;

  PERFORM public.apply_location_stock_delta(
    gen_random_uuid(), product_row.id, source_row.id, -abs(round(p_quantity, 3)),
    'saida', clean_reason, 'transfer', transfer_id
  );
  PERFORM public.apply_location_stock_delta(
    gen_random_uuid(), product_row.id, target_row.id, abs(round(p_quantity, 3)),
    'entrada', clean_reason, 'transfer', transfer_id
  );

  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES (
    owner_id,
    auth.uid(),
    'stock.transfer',
    'stock_transfer',
    transfer_id::text,
    jsonb_build_object(
      'product_id', product_row.id,
      'product_name', product_row.name,
      'quantity', abs(round(p_quantity, 3)),
      'source_location_id', source_row.id,
      'source_location_name', source_row.name,
      'target_location_id', target_row.id,
      'target_location_name', target_row.name,
      'reason', clean_reason
    )
  );

  RETURN transfer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_location_stock(uuid, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_location_stock(uuid, uuid, uuid, numeric, text) TO authenticated;
