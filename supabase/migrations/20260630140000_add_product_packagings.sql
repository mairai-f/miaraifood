-- Embalagens comerciais por produto: fardo, caixa, pacote etc.
-- O estoque permanece na unidade-base; a embalagem apenas converte quantidade e preco.
CREATE TABLE IF NOT EXISTS public.product_packagings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_quantity numeric(14,3) NOT NULL CHECK (base_quantity > 1),
  barcode text NOT NULL DEFAULT '',
  purchase_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  sale_price numeric(14,2) NOT NULL CHECK (sale_price >= 0),
  auto_apply boolean NOT NULL DEFAULT true,
  closed_only boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_packagings_barcode_unique_idx
  ON public.product_packagings(store_account_id, upper(barcode))
  WHERE btrim(barcode) <> '';
CREATE INDEX IF NOT EXISTS product_packagings_product_active_idx
  ON public.product_packagings(product_id, active, base_quantity DESC);

CREATE OR REPLACE FUNCTION public.validate_product_packaging_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.products product
    JOIN public.store_accounts account
      ON account.owner_user_id = product.user_id
     AND account.product_context = 'happycash'
    WHERE product.id = NEW.product_id
      AND product.user_id = NEW.owner_user_id
      AND account.id = NEW.store_account_id
  ) THEN
    RAISE EXCEPTION 'A embalagem deve pertencer ao produto e a empresa informados.';
  END IF;
  NEW.name := btrim(NEW.name);
  NEW.barcode := upper(btrim(NEW.barcode));
  IF NEW.name = '' THEN RAISE EXCEPTION 'O nome da embalagem e obrigatorio.'; END IF;
  IF NEW.barcode <> '' AND EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.user_id = NEW.owner_user_id
      AND NOT product.deleted
      AND upper(btrim(COALESCE(product.barcode, ''))) = NEW.barcode
  ) THEN
    RAISE EXCEPTION 'O codigo de barras da embalagem ja pertence a um produto avulso.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_packaging_scope_trigger ON public.product_packagings;
CREATE TRIGGER validate_product_packaging_scope_trigger
BEFORE INSERT OR UPDATE ON public.product_packagings
FOR EACH ROW EXECUTE FUNCTION public.validate_product_packaging_scope();
DROP TRIGGER IF EXISTS touch_product_packagings_updated_at ON public.product_packagings;
CREATE TRIGGER touch_product_packagings_updated_at
BEFORE UPDATE ON public.product_packagings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_product_barcode_against_packagings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF btrim(COALESCE(NEW.barcode, '')) <> '' AND EXISTS (
    SELECT 1 FROM public.product_packagings packaging
    WHERE packaging.owner_user_id = NEW.user_id
      AND packaging.active
      AND upper(packaging.barcode) = upper(btrim(NEW.barcode))
  ) THEN
    RAISE EXCEPTION 'O codigo de barras do produto ja pertence a uma embalagem.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_product_barcode_against_packagings_trigger ON public.products;
CREATE TRIGGER validate_product_barcode_against_packagings_trigger
BEFORE INSERT OR UPDATE OF barcode ON public.products
FOR EACH ROW EXECUTE FUNCTION public.validate_product_barcode_against_packagings();

ALTER TABLE public.product_packagings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_packagings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS product_packagings_select_store ON public.product_packagings;
CREATE POLICY product_packagings_select_store ON public.product_packagings
FOR SELECT USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
);
DROP POLICY IF EXISTS product_packagings_insert_store ON public.product_packagings;
CREATE POLICY product_packagings_insert_store ON public.product_packagings
FOR INSERT WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('products.manage')
);
DROP POLICY IF EXISTS product_packagings_update_store ON public.product_packagings;
CREATE POLICY product_packagings_update_store ON public.product_packagings
FOR UPDATE USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('products.manage')
) WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('products.manage')
);
DROP POLICY IF EXISTS product_packagings_delete_store ON public.product_packagings;
CREATE POLICY product_packagings_delete_store ON public.product_packagings
FOR DELETE USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('products.manage')
);

CREATE OR REPLACE FUNCTION public.replace_product_packagings(target_product_id uuid, target_items jsonb)
RETURNS SETOF public.product_packagings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE account_id uuid := public.get_current_store_account_id_for_context('happycash');
DECLARE item jsonb;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR account_id IS NULL
     OR NOT public.current_user_has_erp_permission('products.manage') THEN
    RAISE EXCEPTION 'Sem permissao para alterar embalagens.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = target_product_id AND user_id = owner_id AND NOT deleted) THEN
    RAISE EXCEPTION 'Produto nao encontrado para cadastrar embalagens.';
  END IF;
  IF target_items IS NULL OR jsonb_typeof(target_items) <> 'array' OR jsonb_array_length(target_items) > 50 THEN
    RAISE EXCEPTION 'Lista de embalagens invalida.';
  END IF;

  DELETE FROM public.product_packagings WHERE product_id = target_product_id;
  FOR item IN SELECT value FROM jsonb_array_elements(target_items) LOOP
    INSERT INTO public.product_packagings (
      store_account_id, owner_user_id, product_id, name, base_quantity, barcode,
      purchase_cost, sale_price, auto_apply, closed_only, active
    ) VALUES (
      account_id, owner_id, target_product_id, btrim(item->>'name'),
      (item->>'base_quantity')::numeric, COALESCE(item->>'barcode', ''),
      COALESCE((item->>'purchase_cost')::numeric, 0), (item->>'sale_price')::numeric,
      COALESCE((item->>'auto_apply')::boolean, true),
      COALESCE((item->>'closed_only')::boolean, false), true
    );
  END LOOP;
  RETURN QUERY SELECT * FROM public.product_packagings
    WHERE product_id = target_product_id ORDER BY base_quantity DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_product_packagings(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_product_packagings(uuid, jsonb) TO authenticated;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS packaging_id uuid REFERENCES public.product_packagings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS packaging_name text,
  ADD COLUMN IF NOT EXISTS packaging_quantity numeric(14,3),
  ADD COLUMN IF NOT EXISTS packaging_price numeric(14,2);
ALTER TABLE public.debt_entries
  ADD COLUMN IF NOT EXISTS packaging_id uuid REFERENCES public.product_packagings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS packaging_name text,
  ADD COLUMN IF NOT EXISTS packaging_quantity numeric(14,3),
  ADD COLUMN IF NOT EXISTS packaging_price numeric(14,2),
  ALTER COLUMN unit_price TYPE numeric(14,6);

-- Autoriza o preco medio fracionado somente quando ele for derivado de uma
-- embalagem valida do proprio produto. O total continua exato em centavos.
CREATE OR REPLACE FUNCTION public.normalize_sale_item_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE product_row public.products%ROWTYPE;
DECLARE packaging_row public.product_packagings%ROWTYPE;
DECLARE product_price numeric(14,2);
DECLARE package_count numeric;
DECLARE remainder_quantity numeric;
DECLARE packaged_total numeric(14,2);
DECLARE packaged_cost numeric;
BEGIN
  NEW.quantity := GREATEST(COALESCE(NEW.quantity, 0), 0);
  NEW.cost_price := ROUND(GREATEST(COALESCE(NEW.cost_price, 0), 0), 2);
  IF NEW.quantity <= 0 THEN RAISE EXCEPTION 'A quantidade do item da venda deve ser maior que zero.'; END IF;

  IF NEW.product_id IS NOT NULL THEN
    SELECT * INTO product_row FROM public.products WHERE id = NEW.product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto da venda nao encontrado.'; END IF;
    IF product_row.user_id <> public.get_current_store_owner_id() THEN RAISE EXCEPTION 'Produto da venda nao pertence a esta loja.'; END IF;
    product_price := ROUND(GREATEST(COALESCE(product_row.price, 0), 0), 2);
    NEW.product_name := product_row.name;
    NEW.cost_price := ROUND(GREATEST(COALESCE(product_row.cost_price, NEW.cost_price), 0), 2);

    IF NEW.packaging_id IS NOT NULL THEN
      SELECT * INTO packaging_row FROM public.product_packagings
      WHERE id = NEW.packaging_id AND product_id = product_row.id AND owner_user_id = product_row.user_id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Embalagem da venda nao encontrada para este produto.'; END IF;
      package_count := floor(NEW.quantity / packaging_row.base_quantity);
      remainder_quantity := NEW.quantity - package_count * packaging_row.base_quantity;
      IF package_count <= 0 THEN RAISE EXCEPTION 'A quantidade nao completa a embalagem selecionada.'; END IF;
      packaged_total := ROUND(package_count * packaging_row.sale_price + remainder_quantity * product_price, 2);
      packaged_cost := package_count * CASE
        WHEN packaging_row.purchase_cost > 0 THEN packaging_row.purchase_cost
        ELSE NEW.cost_price * packaging_row.base_quantity
      END + remainder_quantity * NEW.cost_price;
      NEW.unit_price := ROUND(packaged_total / NEW.quantity, 6);
      NEW.cost_price := ROUND(packaged_cost / NEW.quantity, 6);
      NEW.total := packaged_total;
      NEW.packaging_name := packaging_row.name;
      NEW.packaging_quantity := packaging_row.base_quantity;
      NEW.packaging_price := packaging_row.sale_price;
    ELSE
      NEW.unit_price := ROUND(GREATEST(COALESCE(NEW.unit_price, 0), 0), 2);
      NEW.total := ROUND(NEW.unit_price * NEW.quantity, 2);
      IF ABS(NEW.unit_price - product_price) > 0.009 AND NOT public.current_user_is_admin() THEN
        RAISE EXCEPTION 'Somente administrador pode vender produto com preco alterado.';
      END IF;
      NEW.packaging_name := NULL; NEW.packaging_quantity := NULL; NEW.packaging_price := NULL;
    END IF;
  END IF;

  NEW.discount_amount := ROUND(GREATEST(COALESCE(NEW.discount_amount, 0), 0), 2);
  NEW.net_total := ROUND(GREATEST(NEW.total - NEW.discount_amount, 0), 2);
  NEW.unit_profit := ROUND((NEW.net_total - NEW.cost_price * NEW.quantity) / NEW.quantity, 2);
  NEW.total_profit := ROUND(NEW.net_total - NEW.cost_price * NEW.quantity, 2);
  NEW.markup_pct := CASE WHEN NEW.cost_price > 0 THEN ROUND(((NEW.unit_price - NEW.cost_price) / NEW.cost_price) * 100, 2) ELSE 0 END;
  NEW.margin_pct := CASE WHEN NEW.unit_price > 0 THEN ROUND(((NEW.unit_price - NEW.cost_price) / NEW.unit_price) * 100, 2) ELSE 0 END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_debt_entry_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE product_row public.products%ROWTYPE;
DECLARE packaging_row public.product_packagings%ROWTYPE;
DECLARE product_price numeric(14,2);
DECLARE package_count numeric;
DECLARE remainder_quantity numeric;
DECLARE packaged_total numeric(14,2);
BEGIN
  NEW.quantity := GREATEST(COALESCE(NEW.quantity, 0), 0);
  IF NEW.quantity <= 0 THEN RAISE EXCEPTION 'A quantidade da divida deve ser maior que zero.'; END IF;
  SELECT * INTO product_row FROM public.products WHERE id = NEW.product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto da divida nao encontrado.'; END IF;
  IF product_row.user_id <> public.get_current_store_owner_id() THEN RAISE EXCEPTION 'Produto da divida nao pertence a esta loja.'; END IF;
  product_price := ROUND(GREATEST(COALESCE(product_row.price, 0), 0), 2);
  NEW.product_name := product_row.name;

  IF NEW.packaging_id IS NOT NULL THEN
    SELECT * INTO packaging_row FROM public.product_packagings
    WHERE id = NEW.packaging_id AND product_id = product_row.id AND owner_user_id = product_row.user_id AND active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Embalagem do fiado nao encontrada para este produto.'; END IF;
    package_count := floor(NEW.quantity / packaging_row.base_quantity);
    remainder_quantity := NEW.quantity - package_count * packaging_row.base_quantity;
    IF package_count <= 0 THEN RAISE EXCEPTION 'A quantidade nao completa a embalagem selecionada.'; END IF;
    packaged_total := ROUND(package_count * packaging_row.sale_price + remainder_quantity * product_price, 2);
    NEW.unit_price := ROUND(packaged_total / NEW.quantity, 6);
    NEW.total := packaged_total;
    NEW.packaging_name := packaging_row.name;
    NEW.packaging_quantity := packaging_row.base_quantity;
    NEW.packaging_price := packaging_row.sale_price;
  ELSE
    NEW.unit_price := ROUND(GREATEST(COALESCE(NEW.unit_price, 0), 0), 2);
    NEW.total := ROUND(NEW.unit_price * NEW.quantity, 2);
    IF ABS(NEW.unit_price - product_price) > 0.009 AND NOT public.current_user_is_admin() THEN
      RAISE EXCEPTION 'Somente administrador pode lancar divida com preco alterado.';
    END IF;
    NEW.packaging_name := NULL; NEW.packaging_quantity := NULL; NEW.packaging_price := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_create_sale_atomic(p_sale jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE v_sale_id uuid := COALESCE(NULLIF(p_sale->>'id', '')::uuid, gen_random_uuid());
DECLARE location_row public.store_locations%ROWTYPE;
DECLARE sale_row public.sales%ROWTYPE;
DECLARE product_row public.products%ROWTYPE;
DECLARE item jsonb;
DECLARE item_id uuid;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR NOT public.current_store_has_feature('pdv.use')
     OR NOT public.current_user_has_erp_permission('pdv.use') THEN RAISE EXCEPTION 'Sem permissao para registrar venda.'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 500 THEN RAISE EXCEPTION 'Itens da venda invalidos.'; END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = v_sale_id AND user_id = owner_id;
  IF sale_row.id IS NOT NULL THEN RETURN jsonb_build_object('sale', to_jsonb(sale_row), 'items', (SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.sale_items i WHERE i.sale_id = v_sale_id)); END IF;
  location_row := public.erp_operational_location(NULLIF(p_sale->>'location_id', '')::uuid);
  INSERT INTO public.sales (id, user_id, client_id, operator_user_id, cash_session_id, location_id, terminal_id, seller_name, is_delivery, service_ticket_number, status, total, discount, payment_method, cash_received, change_amount, fiscal_customer_document, fiscal_customer_name)
  VALUES (v_sale_id, owner_id, NULLIF(p_sale->>'client_id', '')::uuid, COALESCE(NULLIF(p_sale->>'operator_user_id', '')::uuid, auth.uid()), NULLIF(p_sale->>'cash_session_id', '')::uuid, location_row.id, NULLIF(p_sale->>'terminal_id', '')::uuid, NULLIF(p_sale->>'seller_name', ''), COALESCE((p_sale->>'is_delivery')::boolean, false), NULLIF(p_sale->>'service_ticket_number', '')::integer, COALESCE(NULLIF(p_sale->>'status', ''), 'completed'), COALESCE((p_sale->>'total')::numeric, 0), COALESCE((p_sale->>'discount')::numeric, 0), COALESCE(NULLIF(p_sale->>'payment_method', ''), 'cash'), COALESCE((p_sale->>'cash_received')::numeric, 0), COALESCE((p_sale->>'change_amount')::numeric, 0), NULLIF(p_sale->>'fiscal_customer_document', ''), NULLIF(p_sale->>'fiscal_customer_name', '')) RETURNING * INTO sale_row;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(item->>'product_id', '') IS NULL THEN RAISE EXCEPTION 'Todo item deve possuir product_id.'; END IF;
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid AND user_id = owner_id AND NOT deleted;
    IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto da venda nao encontrado.'; END IF;
    item_id := COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid());
    INSERT INTO public.sale_items (id, sale_id, product_id, product_code, product_name, quantity, unit_price, cost_price, total, discount_amount, net_total, unit_profit, total_profit, markup_pct, margin_pct, packaging_id)
    VALUES (item_id, v_sale_id, product_row.id, product_row.code, product_row.name, (item->>'quantity')::numeric, (item->>'unit_price')::numeric, COALESCE((item->>'cost_price')::numeric, product_row.cost_price, 0), (item->>'total')::numeric, COALESCE((item->>'discount_amount')::numeric, 0), COALESCE((item->>'net_total')::numeric, (item->>'total')::numeric), COALESCE((item->>'unit_profit')::numeric, 0), COALESCE((item->>'total_profit')::numeric, 0), COALESCE((item->>'markup_pct')::numeric, 0), COALESCE((item->>'margin_pct')::numeric, 0), NULLIF(item->>'packaging_id', '')::uuid);
    PERFORM public.erp_apply_product_stock(product_row.id, location_row.id, -(item->>'quantity')::numeric, 'saida', 'Venda PDV', 'sale', v_sale_id);
  END LOOP;
  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, actor_label, action, entity_type, entity_id, details)
  VALUES (owner_id, auth.uid(), NULLIF(p_sale->>'seller_name', ''), 'sale.create', 'sale', v_sale_id::text, jsonb_build_object('total', sale_row.total, 'payment_method', sale_row.payment_method, 'location_id', location_row.id));
  RETURN jsonb_build_object('sale', to_jsonb(sale_row), 'items', (SELECT jsonb_agg(to_jsonb(i)) FROM public.sale_items i WHERE i.sale_id = v_sale_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_add_debt_entries_atomic(p_entries jsonb, p_location_id uuid DEFAULT NULL, p_adjust_stock boolean DEFAULT true, p_reason text DEFAULT 'Fiado')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE owner_id uuid := public.get_current_store_owner_id();
DECLARE location_row public.store_locations%ROWTYPE;
DECLARE product_row public.products%ROWTYPE;
DECLARE client_row public.clients%ROWTYPE;
DECLARE item jsonb;
DECLARE entry_row public.debt_entries%ROWTYPE;
DECLARE created jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR NOT public.current_store_has_feature('fiado.manage') OR NOT public.current_user_has_erp_permission('clients.manage') THEN RAISE EXCEPTION 'Sem permissao para registrar fiado.'; END IF;
  IF jsonb_typeof(p_entries) <> 'array' OR jsonb_array_length(p_entries) = 0 OR jsonb_array_length(p_entries) > 500 THEN RAISE EXCEPTION 'Itens do fiado invalidos.'; END IF;
  location_row := public.erp_operational_location(p_location_id);
  FOR item IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
    SELECT * INTO client_row FROM public.clients WHERE id = (item->>'client_id')::uuid AND user_id = owner_id AND NOT deleted;
    IF client_row.id IS NULL THEN RAISE EXCEPTION 'Cliente do fiado nao encontrado.'; END IF;
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::uuid AND user_id = owner_id AND NOT deleted;
    IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto do fiado nao encontrado.'; END IF;
    INSERT INTO public.debt_entries (id, location_id, client_id, product_id, product_code, product_name, quantity, unit_price, total, date_added, registered_by, packaging_id)
    VALUES (COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid()), location_row.id, client_row.id, product_row.id, product_row.code, product_row.name, (item->>'quantity')::numeric, (item->>'unit_price')::numeric, COALESCE((item->>'total')::numeric, (item->>'quantity')::numeric * (item->>'unit_price')::numeric), COALESCE(NULLIF(item->>'date_added', '')::timestamptz, now()), NULLIF(item->>'registered_by', ''), NULLIF(item->>'packaging_id', '')::uuid) RETURNING * INTO entry_row;
    created := created || jsonb_build_array(to_jsonb(entry_row));
    IF p_adjust_stock THEN PERFORM public.erp_apply_product_stock(product_row.id, location_row.id, -(item->>'quantity')::numeric, 'saida', p_reason, 'debt', entry_row.id); END IF;
  END LOOP;
  INSERT INTO public.audit_logs (owner_user_id, actor_user_id, action, entity_type, details)
  VALUES (owner_id, auth.uid(), 'debt_entries.create', 'debt_entry', jsonb_build_object('count', jsonb_array_length(created), 'location_id', location_row.id));
  RETURN created;
END;
$$;

COMMENT ON TABLE public.product_packagings IS 'Embalagens comerciais vinculadas ao mesmo produto e convertidas para a unidade-base no estoque.';
