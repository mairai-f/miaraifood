-- HappyCash ERP: recorrencia financeira, comprovantes, aprovacao de compras,
-- divergencia de recebimento e custo medio.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cost_center text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_url text NOT NULL DEFAULT '';

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cost_center text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recurrence_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installment_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installment_total integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  ALTER TABLE public.financial_accounts
    ADD CONSTRAINT financial_accounts_recurrence_type_check
    CHECK (recurrence_type IN ('none', 'monthly', 'weekly', 'yearly', 'installment'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

DO $$
BEGIN
  ALTER TABLE public.financial_accounts
    ADD CONSTRAINT financial_accounts_installment_range_check
    CHECK (installment_number >= 1 AND installment_total >= installment_number);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS financial_accounts_recurrence_parent_idx
  ON public.financial_accounts(recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS financial_accounts_cost_center_due_idx
  ON public.financial_accounts(owner_user_id, cost_center, due_date)
  WHERE cost_center <> '';

UPDATE public.erp_permission_catalog
SET description = CASE permission_key
  WHEN 'financial.view' THEN 'Consultar fluxo previsto e realizado, recorrencias, centros de custo e comprovantes.'
  WHEN 'financial.manage' THEN 'Criar, alterar, pagar, cancelar e parcelar contas financeiras.'
  WHEN 'purchases.view' THEN 'Consultar fornecedores, aprovacao, recebimento, divergencias e custo medio de compras.'
  WHEN 'purchases.manage' THEN 'Criar, aprovar, receber compras, registrar divergencias e atualizar custos do produto.'
  ELSE description
END
WHERE permission_key IN ('financial.view', 'financial.manage', 'purchases.view', 'purchases.manage');

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS average_cost numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.products
SET average_cost = COALESCE(NULLIF(average_cost, 0), NULLIF(purchase_cost, 0), NULLIF(cost_price, 0), 0)
WHERE average_cost = 0;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('awaiting_approval', 'approved', 'open', 'partially_received', 'received', 'canceled'));

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_divergence_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS divergence_status text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_divergence_status_check
    CHECK (divergence_status IN ('none', 'reported', 'resolved'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS last_received_quantity numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_divergence_quantity numeric(10,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS received_unit_cost numeric(10,2),
  ADD COLUMN IF NOT EXISTS average_cost_after numeric(12,2);

CREATE OR REPLACE FUNCTION public.approve_purchase_order(
  p_order_id uuid,
  p_notes text DEFAULT ''
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  order_row public.purchase_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL
    OR owner_id IS NULL
    OR NOT public.current_store_has_feature('financial.manage')
    OR NOT public.current_user_has_erp_permission('purchases.manage')
  THEN
    RAISE EXCEPTION 'Sem permissao para aprovar compras.';
  END IF;

  SELECT * INTO order_row
  FROM public.purchase_orders
  WHERE id = p_order_id AND owner_user_id = owner_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra nao encontrado.'; END IF;
  IF order_row.status <> 'awaiting_approval' THEN
    RAISE EXCEPTION 'Somente pedidos aguardando aprovacao podem ser aprovados.';
  END IF;

  UPDATE public.purchase_orders
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      approval_notes = coalesce(nullif(trim(p_notes), ''), approval_notes)
  WHERE id = order_row.id
  RETURNING * INTO order_row;

  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES (
    owner_id,
    auth.uid(),
    'purchase_order.approve',
    'purchase_order',
    order_row.id::text,
    jsonb_build_object('supplier_name', order_row.supplier_name, 'total_amount', order_row.total_amount, 'notes', p_notes)
  );

  RETURN order_row;
END;
$$;

DROP FUNCTION IF EXISTS public.receive_purchase_order(uuid, jsonb, boolean, date);
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_order_id uuid,
  p_receipts jsonb,
  p_create_payable boolean DEFAULT false,
  p_due_date date DEFAULT CURRENT_DATE,
  p_divergence_note text DEFAULT ''
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  order_row public.purchase_orders%ROWTYPE;
  location_row public.store_locations%ROWTYPE;
  item_row public.purchase_order_items%ROWTYPE;
  product_row public.products%ROWTYPE;
  inventory_row public.location_inventory%ROWTYPE;
  receipt jsonb;
  receipt_quantity numeric(10,3);
  remaining_quantity numeric(10,3);
  balance_before numeric(12,3);
  balance_after numeric(12,3);
  item_share numeric;
  unit_freight numeric(10,2);
  unit_tax numeric(10,2);
  effective_unit_cost numeric(10,2);
  previous_average_cost numeric(12,2);
  next_average_cost numeric(12,2);
  divergence_quantity numeric(10,3);
  clean_divergence_note text := coalesce(nullif(trim(p_divergence_note), ''), '');
  has_pending_items boolean;
  received_any boolean := false;
  divergence_detected boolean := false;
BEGIN
  IF auth.uid() IS NULL
    OR owner_id IS NULL
    OR NOT public.current_store_has_feature('financial.manage')
    OR NOT public.current_store_has_feature('stock.manage')
    OR NOT public.current_user_has_erp_permission('purchases.manage')
  THEN
    RAISE EXCEPTION 'Sem permissao para receber compras.';
  END IF;

  SELECT * INTO order_row FROM public.purchase_orders
  WHERE id = p_order_id AND owner_user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido de compra nao encontrado.'; END IF;
  IF order_row.status = 'canceled' THEN RAISE EXCEPTION 'Pedido cancelado nao pode ser recebido.'; END IF;
  IF order_row.status = 'awaiting_approval' THEN RAISE EXCEPTION 'Aprove o pedido antes de receber.'; END IF;

  SELECT * INTO location_row FROM public.store_locations
  WHERE id = order_row.location_id AND owner_user_id = owner_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filial do pedido nao encontrada ou inativa.'; END IF;

  FOR receipt IN SELECT value FROM jsonb_array_elements(coalesce(p_receipts, '[]'::jsonb))
  LOOP
    receipt_quantity := round(coalesce((receipt ->> 'quantity')::numeric, 0), 3);
    IF receipt_quantity <= 0 THEN CONTINUE; END IF;

    SELECT * INTO item_row FROM public.purchase_order_items
    WHERE id = (receipt ->> 'item_id')::uuid
      AND purchase_order_id = order_row.id
      AND owner_user_id = owner_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item do pedido nao encontrado.'; END IF;

    remaining_quantity := item_row.quantity - item_row.received_quantity;
    IF receipt_quantity > remaining_quantity THEN
      RAISE EXCEPTION 'Quantidade recebida maior que o saldo do item %.', item_row.product_name;
    END IF;
    IF item_row.product_id IS NULL THEN
      RAISE EXCEPTION 'O produto % nao esta mais cadastrado.', item_row.product_name;
    END IF;

    SELECT * INTO product_row FROM public.products
    WHERE id = item_row.product_id AND user_id = owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto % nao encontrado.', item_row.product_name; END IF;

    INSERT INTO public.location_inventory (owner_user_id, location_id, product_id, stock, min_stock)
    VALUES (
      owner_id, location_row.id, product_row.id,
      CASE WHEN location_row.is_headquarters THEN COALESCE(product_row.stock, 0) ELSE 0 END,
      COALESCE(product_row.min_stock, 0)
    )
    ON CONFLICT (location_id, product_id) DO NOTHING;

    SELECT * INTO inventory_row FROM public.location_inventory
    WHERE location_id = location_row.id AND product_id = product_row.id FOR UPDATE;

    balance_before := COALESCE(inventory_row.stock, 0);
    balance_after := balance_before + receipt_quantity;
    item_share := CASE WHEN order_row.subtotal > 0 THEN item_row.total_cost / order_row.subtotal ELSE 0 END;
    unit_freight := CASE WHEN item_row.quantity > 0 THEN round((order_row.freight_amount * item_share) / item_row.quantity, 2) ELSE 0 END;
    unit_tax := CASE WHEN item_row.quantity > 0 THEN round((order_row.tax_amount * item_share) / item_row.quantity, 2) ELSE 0 END;
    effective_unit_cost := round(item_row.unit_cost + unit_freight + unit_tax, 2);
    previous_average_cost := COALESCE(NULLIF(product_row.average_cost, 0), NULLIF(product_row.purchase_cost, 0), NULLIF(product_row.cost_price, 0), effective_unit_cost);
    next_average_cost := CASE
      WHEN balance_after > 0 THEN round(((previous_average_cost * greatest(balance_before, 0)) + (effective_unit_cost * receipt_quantity)) / balance_after, 2)
      ELSE effective_unit_cost
    END;
    divergence_quantity := greatest(remaining_quantity - receipt_quantity, 0);
    IF divergence_quantity > 0 AND clean_divergence_note <> '' THEN
      divergence_detected := true;
    END IF;

    UPDATE public.purchase_order_items
    SET received_quantity = received_quantity + receipt_quantity,
        last_received_quantity = receipt_quantity,
        last_divergence_quantity = CASE WHEN clean_divergence_note <> '' THEN divergence_quantity ELSE 0 END,
        received_unit_cost = effective_unit_cost,
        average_cost_after = next_average_cost
    WHERE id = item_row.id;

    UPDATE public.products
    SET stock = CASE WHEN location_row.is_headquarters THEN balance_after ELSE stock END,
        purchase_cost = item_row.unit_cost,
        freight_cost = unit_freight,
        tax_cost = unit_tax,
        average_cost = next_average_cost,
        supplier_id = order_row.supplier_id,
        supplier_name = order_row.supplier_name
    WHERE id = product_row.id;

    INSERT INTO public.stock_movements (
      product_id, user_id, type, quantity, reason, source, reference_id,
      balance_before, balance_after, operator_user_id, location_id
    ) VALUES (
      product_row.id, owner_id, 'entrada', receipt_quantity,
      'Recebimento de compra - ' || order_row.supplier_name,
      'purchase', order_row.id, balance_before, balance_after, auth.uid(), location_row.id
    );
    received_any := true;
  END LOOP;

  IF NOT received_any THEN RAISE EXCEPTION 'Informe ao menos uma quantidade para receber.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.purchase_order_items
    WHERE purchase_order_id = order_row.id AND received_quantity < quantity
  ) INTO has_pending_items;

  UPDATE public.purchase_orders
  SET status = CASE WHEN has_pending_items THEN 'partially_received' ELSE 'received' END,
      received_at = CASE WHEN has_pending_items THEN received_at ELSE now() END,
      last_divergence_note = CASE WHEN clean_divergence_note <> '' THEN clean_divergence_note ELSE last_divergence_note END,
      divergence_status = CASE WHEN divergence_detected THEN 'reported' WHEN NOT has_pending_items THEN 'resolved' ELSE divergence_status END
  WHERE id = order_row.id
  RETURNING * INTO order_row;

  IF p_create_payable AND NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE owner_user_id = owner_id
      AND source = 'purchase'
      AND reference_id = order_row.id
      AND account_type = 'payable'
  ) THEN
    INSERT INTO public.financial_accounts (
      owner_user_id, location_id, account_type, description, party_name, amount,
      due_date, source, reference_id, notes, cost_center
    ) VALUES (
      owner_id, location_row.id, 'payable', 'Compra ' || order_row.supplier_name,
      order_row.supplier_name, order_row.total_amount,
      coalesce(p_due_date, CURRENT_DATE), 'purchase', order_row.id,
      CASE WHEN order_row.invoice_number <> '' THEN 'NF ' || order_row.invoice_number ELSE order_row.notes END,
      'Compras'
    );
  END IF;

  RETURN order_row;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_purchase_order(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid, jsonb, boolean, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_purchase_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, jsonb, boolean, date, text) TO authenticated;
