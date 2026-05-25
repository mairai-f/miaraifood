CREATE TABLE IF NOT EXISTS public.agenda_product_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_phone text,
  payment_method text NOT NULL DEFAULT 'local' CHECK (payment_method IN ('local', 'pix')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  order_status text NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  total_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agenda_product_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.agenda_product_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.agenda_products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL CHECK (unit_price >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total numeric(10,2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agenda_product_orders_store_created_idx
  ON public.agenda_product_orders(store_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agenda_product_orders_client_created_idx
  ON public.agenda_product_orders(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agenda_product_order_items_order_idx
  ON public.agenda_product_order_items(order_id);

ALTER TABLE public.agenda_product_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_product_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_product_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_product_order_items FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS update_agenda_product_orders_updated_at ON public.agenda_product_orders;
CREATE TRIGGER update_agenda_product_orders_updated_at
BEFORE UPDATE ON public.agenda_product_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "agenda product orders owner select" ON public.agenda_product_orders;
CREATE POLICY "agenda product orders owner select"
ON public.agenda_product_orders
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

DROP POLICY IF EXISTS "agenda product orders owner update" ON public.agenda_product_orders;
CREATE POLICY "agenda product orders owner update"
ON public.agenda_product_orders
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
  AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
);

DROP POLICY IF EXISTS "agenda product orders client select" ON public.agenda_product_orders;
CREATE POLICY "agenda product orders client select"
ON public.agenda_product_orders
FOR SELECT
TO authenticated
USING (client_id = auth.uid());

DROP POLICY IF EXISTS "agenda product order items owner select" ON public.agenda_product_order_items;
CREATE POLICY "agenda product order items owner select"
ON public.agenda_product_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agenda_product_orders AS order_record
    WHERE order_record.id = agenda_product_order_items.order_id
      AND order_record.owner_user_id = public.get_current_store_owner_id()
      AND order_record.store_account_id = public.get_current_store_account_id_for_context('happycashagenda')
      AND public.current_store_has_feature_for_context('happycashagenda', 'agenda.use')
  )
);

DROP POLICY IF EXISTS "agenda product order items client select" ON public.agenda_product_order_items;
CREATE POLICY "agenda product order items client select"
ON public.agenda_product_order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agenda_product_orders AS order_record
    WHERE order_record.id = agenda_product_order_items.order_id
      AND order_record.client_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.create_agenda_product_order(
  p_store_account_id uuid,
  p_items jsonb,
  p_client_name text,
  p_client_phone text DEFAULT NULL,
  p_payment_method text DEFAULT 'local',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_owner_user_id uuid;
  new_order_id uuid;
  item_record jsonb;
  product_record record;
  requested_product_id uuid;
  requested_quantity integer;
  order_total numeric(10,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_payment_method NOT IN ('local', 'pix') THEN
    RAISE EXCEPTION 'Metodo de pagamento invalido.';
  END IF;

  IF NULLIF(BTRIM(p_client_name), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do cliente.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio.';
  END IF;

  SELECT account.owner_user_id
  INTO resolved_owner_user_id
  FROM public.store_accounts AS account
  JOIN public.agenda_business_settings AS settings
    ON settings.store_account_id = account.id
  WHERE account.id = p_store_account_id
    AND account.product_context = 'happycashagenda'
    AND settings.public_booking_enabled = true
  LIMIT 1;

  IF resolved_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Empresa HappyCash Agenda nao encontrada ou indisponivel.';
  END IF;

  INSERT INTO public.agenda_product_orders (
    store_account_id,
    owner_user_id,
    client_id,
    client_name,
    client_phone,
    payment_method,
    payment_status,
    order_status,
    total_amount,
    notes
  )
  VALUES (
    p_store_account_id,
    resolved_owner_user_id,
    auth.uid(),
    BTRIM(p_client_name),
    NULLIF(BTRIM(COALESCE(p_client_phone, '')), ''),
    p_payment_method,
    'pending',
    'pending',
    0,
    NULLIF(BTRIM(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO new_order_id;

  FOR item_record IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    requested_product_id := NULLIF(item_record->>'product_id', '')::uuid;
    requested_quantity := COALESCE((item_record->>'quantity')::integer, 0);

    IF requested_product_id IS NULL OR requested_quantity < 1 THEN
      RAISE EXCEPTION 'Item do carrinho invalido.';
    END IF;

    SELECT product.id, product.name, product.price, product.stock_quantity
    INTO product_record
    FROM public.agenda_products AS product
    WHERE product.id = requested_product_id
      AND product.store_account_id = p_store_account_id
      AND product.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponivel.';
    END IF;

    IF product_record.stock_quantity < requested_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para %. Disponivel: %.',
        product_record.name,
        product_record.stock_quantity;
    END IF;

    UPDATE public.agenda_products
    SET stock_quantity = stock_quantity - requested_quantity
    WHERE id = requested_product_id;

    INSERT INTO public.agenda_product_order_items (
      order_id,
      product_id,
      product_name,
      unit_price,
      quantity,
      line_total
    )
    VALUES (
      new_order_id,
      requested_product_id,
      product_record.name,
      product_record.price,
      requested_quantity,
      ROUND(product_record.price * requested_quantity, 2)
    );

    order_total := order_total + ROUND(product_record.price * requested_quantity, 2);
  END LOOP;

  IF order_total <= 0 THEN
    RAISE EXCEPTION 'Total do pedido invalido.';
  END IF;

  UPDATE public.agenda_product_orders
  SET total_amount = order_total
  WHERE id = new_order_id;

  RETURN new_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_agenda_product_order(uuid, jsonb, text, text, text, text) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'agenda_product_orders'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.agenda_product_orders;
  END IF;
END;
$$;
