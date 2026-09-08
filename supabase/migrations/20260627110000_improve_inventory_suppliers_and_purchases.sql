ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS document text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_lead_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_order numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_payment_terms_days_check,
  DROP CONSTRAINT IF EXISTS suppliers_delivery_lead_days_check,
  DROP CONSTRAINT IF EXISTS suppliers_minimum_order_check;

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_payment_terms_days_check CHECK (payment_terms_days >= 0),
  ADD CONSTRAINT suppliers_delivery_lead_days_check CHECK (delivery_lead_days >= 0),
  ADD CONSTRAINT suppliers_minimum_order_check CHECK (minimum_order >= 0);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

UPDATE public.products AS product
SET supplier_id = supplier.id
FROM public.suppliers AS supplier
WHERE product.supplier_id IS NULL
  AND supplier.owner_user_id = product.user_id
  AND lower(trim(supplier.name)) = lower(trim(product.supplier_name))
  AND trim(coalesce(product.supplier_name, '')) <> '';

CREATE INDEX IF NOT EXISTS products_supplier_idx
  ON public.products (supplier_id)
  WHERE supplier_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_product_supplier_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE id = NEW.supplier_id AND owner_user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Fornecedor nao pertence a esta loja.';
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
    AND NOT public.current_user_is_admin()
  THEN
    RAISE EXCEPTION 'Somente o administrador pode alterar o fornecedor do produto.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_supplier_link_trigger ON public.products;
CREATE TRIGGER validate_product_supplier_link_trigger
BEFORE INSERT OR UPDATE OF supplier_id, user_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.validate_product_supplier_link();

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN ('open', 'partially_received', 'received', 'canceled'));

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS received_quantity numeric(10,3) NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_order_items
  DROP CONSTRAINT IF EXISTS purchase_order_items_received_quantity_check;

ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT purchase_order_items_received_quantity_check
  CHECK (received_quantity >= 0 AND received_quantity <= quantity);

ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS reference_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS financial_accounts_purchase_reference_unique_idx
  ON public.financial_accounts (owner_user_id, reference_id)
  WHERE source = 'purchase' AND reference_id IS NOT NULL AND account_type = 'payable';

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS balance_before numeric(12,3),
  ADD COLUMN IF NOT EXISTS balance_after numeric(12,3),
  ADD COLUMN IF NOT EXISTS operator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS stock_movements_reference_idx
  ON public.stock_movements (reference_id)
  WHERE reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_stock_delta(
  p_movement_id uuid,
  p_product_id uuid,
  p_delta numeric,
  p_movement_type text,
  p_reason text,
  p_source text DEFAULT 'manual',
  p_reference_id uuid DEFAULT NULL
)
RETURNS public.stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid;
  product_row public.products%ROWTYPE;
  movement_row public.stock_movements%ROWTYPE;
  balance_before numeric(12,3);
  balance_after numeric(12,3);
BEGIN
  owner_id := public.get_current_store_owner_id();
  IF auth.uid() IS NULL
    OR owner_id IS NULL
    OR NOT public.current_user_is_admin()
    OR NOT public.current_store_has_feature('stock.manage')
  THEN
    RAISE EXCEPTION 'Sem permissao para movimentar estoque.';
  END IF;
  IF p_delta = 0 OR p_movement_type NOT IN ('entrada', 'saida', 'ajuste') THEN
    RAISE EXCEPTION 'Movimentacao de estoque invalida.';
  END IF;

  SELECT * INTO movement_row FROM public.stock_movements WHERE id = p_movement_id;
  IF FOUND THEN
    IF movement_row.user_id <> owner_id THEN
      RAISE EXCEPTION 'Movimentacao pertence a outra loja.';
    END IF;
    RETURN movement_row;
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = p_product_id AND user_id = owner_id AND NOT deleted
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto nao encontrado.';
  END IF;

  balance_before := coalesce(product_row.stock, 0);
  balance_after := balance_before + round(p_delta, 3);
  IF balance_after < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente. Saldo atual: %.', balance_before;
  END IF;

  UPDATE public.products SET stock = balance_after WHERE id = product_row.id;

  INSERT INTO public.stock_movements (
    id, product_id, user_id, type, quantity, reason, source, reference_id,
    balance_before, balance_after, operator_user_id
  ) VALUES (
    p_movement_id, product_row.id, owner_id, p_movement_type,
    abs(round(p_delta, 3)), trim(p_reason), coalesce(nullif(trim(p_source), ''), 'manual'),
    p_reference_id, balance_before, balance_after, auth.uid()
  ) RETURNING * INTO movement_row;

  RETURN movement_row;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stock_delta(uuid, uuid, numeric, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_stock_delta(uuid, uuid, numeric, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_order_id uuid,
  p_receipts jsonb,
  p_create_payable boolean DEFAULT false,
  p_due_date date DEFAULT CURRENT_DATE
)
RETURNS public.purchase_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid;
  order_row public.purchase_orders%ROWTYPE;
  item_row public.purchase_order_items%ROWTYPE;
  product_row public.products%ROWTYPE;
  receipt jsonb;
  receipt_quantity numeric(10,3);
  remaining_quantity numeric(10,3);
  balance_before numeric(12,3);
  balance_after numeric(12,3);
  item_share numeric;
  unit_freight numeric(10,2);
  unit_tax numeric(10,2);
  has_pending_items boolean;
  received_any boolean := false;
BEGIN
  owner_id := public.get_current_store_owner_id();
  IF auth.uid() IS NULL
    OR owner_id IS NULL
    OR NOT public.current_user_is_admin()
    OR NOT public.current_store_has_feature('financial.manage')
    OR NOT public.current_store_has_feature('stock.manage')
  THEN
    RAISE EXCEPTION 'Sem permissao para receber compras.';
  END IF;

  SELECT * INTO order_row
  FROM public.purchase_orders
  WHERE id = p_order_id AND owner_user_id = owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido de compra nao encontrado.';
  END IF;
  IF order_row.status = 'canceled' THEN
    RAISE EXCEPTION 'Pedido cancelado nao pode ser recebido.';
  END IF;

  FOR receipt IN SELECT value FROM jsonb_array_elements(coalesce(p_receipts, '[]'::jsonb))
  LOOP
    receipt_quantity := round(coalesce((receipt ->> 'quantity')::numeric, 0), 3);
    IF receipt_quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO item_row
    FROM public.purchase_order_items
    WHERE id = (receipt ->> 'item_id')::uuid
      AND purchase_order_id = order_row.id
      AND owner_user_id = owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item do pedido nao encontrado.';
    END IF;

    remaining_quantity := item_row.quantity - item_row.received_quantity;
    IF receipt_quantity > remaining_quantity THEN
      RAISE EXCEPTION 'Quantidade recebida maior que o saldo do item %.', item_row.product_name;
    END IF;
    IF item_row.product_id IS NULL THEN
      RAISE EXCEPTION 'O produto % nao esta mais cadastrado.', item_row.product_name;
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = item_row.product_id AND user_id = owner_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto % nao encontrado.', item_row.product_name;
    END IF;

    balance_before := coalesce(product_row.stock, 0);
    balance_after := balance_before + receipt_quantity;
    item_share := CASE WHEN order_row.subtotal > 0 THEN item_row.total_cost / order_row.subtotal ELSE 0 END;
    unit_freight := CASE WHEN item_row.quantity > 0 THEN round((order_row.freight_amount * item_share) / item_row.quantity, 2) ELSE 0 END;
    unit_tax := CASE WHEN item_row.quantity > 0 THEN round((order_row.tax_amount * item_share) / item_row.quantity, 2) ELSE 0 END;

    UPDATE public.purchase_order_items
    SET received_quantity = received_quantity + receipt_quantity
    WHERE id = item_row.id;

    UPDATE public.products
    SET stock = balance_after,
        purchase_cost = item_row.unit_cost,
        freight_cost = unit_freight,
        tax_cost = unit_tax,
        supplier_id = order_row.supplier_id,
        supplier_name = order_row.supplier_name
    WHERE id = product_row.id;

    INSERT INTO public.stock_movements (
      product_id, user_id, type, quantity, reason, source, reference_id,
      balance_before, balance_after, operator_user_id
    ) VALUES (
      product_row.id, owner_id, 'entrada', receipt_quantity,
      'Recebimento de compra - ' || order_row.supplier_name,
      'purchase', order_row.id, balance_before, balance_after, auth.uid()
    );

    received_any := true;
  END LOOP;

  IF NOT received_any THEN
    RAISE EXCEPTION 'Informe ao menos uma quantidade para receber.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.purchase_order_items
    WHERE purchase_order_id = order_row.id
      AND received_quantity < quantity
  ) INTO has_pending_items;

  UPDATE public.purchase_orders
  SET status = CASE WHEN has_pending_items THEN 'partially_received' ELSE 'received' END,
      received_at = CASE WHEN has_pending_items THEN received_at ELSE now() END
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
      owner_user_id, account_type, description, party_name, amount,
      due_date, source, reference_id, notes
    ) VALUES (
      owner_id, 'payable', 'Compra ' || order_row.supplier_name,
      order_row.supplier_name, order_row.total_amount,
      coalesce(p_due_date, CURRENT_DATE), 'purchase', order_row.id,
      CASE WHEN order_row.invoice_number <> '' THEN 'NF ' || order_row.invoice_number ELSE order_row.notes END
    );
  END IF;

  RETURN order_row;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_purchase_order(uuid, jsonb, boolean, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid, jsonb, boolean, date) TO authenticated;
