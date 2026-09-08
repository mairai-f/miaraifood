-- HappyCash ERP - Fase 3: catalogo avancado, unidades, tabelas de preco e transportadoras.
--
-- A migracao preserva products.category e products.price como campos de
-- compatibilidade. O novo catalogo e global para a empresa; estoque continua
-- separado por filial em location_inventory.

CREATE TABLE IF NOT EXISTS public.product_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE TABLE IF NOT EXISTS public.product_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE TABLE IF NOT EXISTS public.product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE TABLE IF NOT EXISTS public.product_subgroups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_group_id uuid NOT NULL REFERENCES public.product_groups(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE TABLE IF NOT EXISTS public.measurement_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  symbol text NOT NULL,
  decimal_places smallint NOT NULL DEFAULT 0 CHECK (decimal_places BETWEEN 0 AND 6),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE TABLE IF NOT EXISTS public.measurement_unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_unit_id uuid NOT NULL REFERENCES public.measurement_units(id) ON DELETE RESTRICT,
  to_unit_id uuid NOT NULL REFERENCES public.measurement_units(id) ON DELETE RESTRICT,
  factor numeric(18,6) NOT NULL CHECK (factor > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_unit_id <> to_unit_id),
  UNIQUE (store_account_id, from_unit_id, to_unit_id)
);

CREATE TABLE IF NOT EXISTS public.product_price_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_price_tables_one_default_idx
  ON public.product_price_tables(store_account_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS public.product_price_table_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_table_id uuid NOT NULL REFERENCES public.product_price_tables(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity numeric(14,3) NOT NULL DEFAULT 1 CHECK (min_quantity > 0),
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  max_discount_pct numeric(7,4) NOT NULL DEFAULT 0 CHECK (max_discount_pct BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (price_table_id, product_id, min_quantity)
);

CREATE TABLE IF NOT EXISTS public.transport_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  document text NOT NULL DEFAULT '',
  state_registration text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  street_number text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.product_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.product_brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_group_id uuid REFERENCES public.product_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_subgroup_id uuid REFERENCES public.product_subgroups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS measurement_unit_id uuid REFERENCES public.measurement_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reference text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_discount_pct numeric(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS commission_value numeric(14,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS primary_transport_company_id uuid REFERENCES public.transport_companies(id) ON DELETE SET NULL;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS preferred_transport_company_id uuid REFERENCES public.transport_companies(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS transport_company_id uuid REFERENCES public.transport_companies(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_max_discount_pct_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_max_discount_pct_check
      CHECK (max_discount_pct BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_commission_type_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_commission_type_check
      CHECK (commission_type IN ('none', 'percent', 'amount'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_commission_value_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_commission_value_check
      CHECK (
        commission_value >= 0
        AND (commission_type <> 'percent' OR commission_value <= 100)
        AND (commission_type <> 'none' OR commission_value = 0)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_catalog_filter_idx
  ON public.products(user_id, department_id, brand_id, product_group_id, product_subgroup_id);
CREATE INDEX IF NOT EXISTS product_price_table_items_product_idx
  ON public.product_price_table_items(product_id, active, min_quantity);
CREATE INDEX IF NOT EXISTS transport_companies_owner_active_idx
  ON public.transport_companies(owner_user_id, active, name);

-- Normaliza codigo/nome e garante que todo cadastro pertence a empresa atual.
CREATE OR REPLACE FUNCTION public.validate_product_catalog_entity_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.store_accounts account
    WHERE account.id = NEW.store_account_id
      AND account.owner_user_id = NEW.owner_user_id
      AND account.product_context = 'happycash'
  ) THEN
    RAISE EXCEPTION 'O cadastro de catalogo nao pertence a empresa HappyCash informada.';
  END IF;
  NEW.code := upper(trim(NEW.code));
  NEW.name := trim(NEW.name);
  IF NEW.code = '' OR NEW.name = '' THEN
    RAISE EXCEPTION 'Codigo e nome sao obrigatorios.';
  END IF;
  IF TG_TABLE_NAME = 'product_price_tables' THEN
    IF NEW.code = 'VAREJO' THEN
      NEW.is_default := true;
      NEW.active := true;
    ELSIF NEW.is_default THEN
      RAISE EXCEPTION 'VAREJO e a tabela padrao fixa enquanto o PDV offline usa products.price.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'product_departments', 'product_brands', 'product_groups',
    'product_subgroups', 'measurement_units', 'product_price_tables',
    'transport_companies'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS validate_catalog_scope_trigger ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER validate_catalog_scope_trigger BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.validate_product_catalog_entity_scope()',
      table_name
    );
    EXECUTE format('DROP TRIGGER IF EXISTS touch_catalog_updated_at ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER touch_catalog_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      table_name
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.validate_advanced_product_catalog_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE account_id uuid;
BEGIN
  SELECT id INTO account_id FROM public.store_accounts
  WHERE owner_user_id = NEW.user_id AND product_context = 'happycash' LIMIT 1;
  IF account_id IS NULL THEN RAISE EXCEPTION 'Empresa HappyCash do produto nao encontrada.'; END IF;

  IF NEW.department_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_departments WHERE id = NEW.department_id AND store_account_id = account_id) THEN
    RAISE EXCEPTION 'Setor nao pertence a empresa do produto.';
  END IF;
  IF NEW.brand_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_brands WHERE id = NEW.brand_id AND store_account_id = account_id) THEN
    RAISE EXCEPTION 'Marca nao pertence a empresa do produto.';
  END IF;
  IF NEW.product_group_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.product_groups WHERE id = NEW.product_group_id AND store_account_id = account_id) THEN
    RAISE EXCEPTION 'Grupo nao pertence a empresa do produto.';
  END IF;
  IF NEW.product_subgroup_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_subgroups WHERE id = NEW.product_subgroup_id
      AND store_account_id = account_id AND product_group_id = NEW.product_group_id
  ) THEN RAISE EXCEPTION 'Subgrupo nao pertence ao grupo selecionado.'; END IF;
  IF NEW.measurement_unit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.measurement_units WHERE id = NEW.measurement_unit_id AND store_account_id = account_id) THEN
    RAISE EXCEPTION 'Unidade nao pertence a empresa do produto.';
  END IF;
  IF NEW.primary_transport_company_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transport_companies WHERE id = NEW.primary_transport_company_id AND store_account_id = account_id) THEN
    RAISE EXCEPTION 'Transportadora nao pertence a empresa do produto.';
  END IF;
  NEW.reference := upper(trim(NEW.reference));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_advanced_product_catalog_links_trigger ON public.products;
CREATE TRIGGER validate_advanced_product_catalog_links_trigger
BEFORE INSERT OR UPDATE OF user_id, department_id, brand_id, product_group_id,
  product_subgroup_id, measurement_unit_id, primary_transport_company_id, reference
ON public.products FOR EACH ROW EXECUTE FUNCTION public.validate_advanced_product_catalog_links();

CREATE OR REPLACE FUNCTION public.validate_transport_company_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE transport_id uuid;
DECLARE expected_owner_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'suppliers' THEN
    transport_id := NEW.preferred_transport_company_id;
    expected_owner_id := NEW.owner_user_id;
  ELSE
    transport_id := NEW.transport_company_id;
    expected_owner_id := NEW.owner_user_id;
  END IF;
  IF transport_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.transport_companies
    WHERE id = transport_id AND owner_user_id = expected_owner_id
  ) THEN RAISE EXCEPTION 'Transportadora e registro devem pertencer a mesma empresa.'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_supplier_transport_company_trigger ON public.suppliers;
CREATE TRIGGER validate_supplier_transport_company_trigger
BEFORE INSERT OR UPDATE OF owner_user_id, preferred_transport_company_id ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.validate_transport_company_link();
DROP TRIGGER IF EXISTS validate_purchase_transport_company_trigger ON public.purchase_orders;
CREATE TRIGGER validate_purchase_transport_company_trigger
BEFORE INSERT OR UPDATE OF owner_user_id, transport_company_id ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.validate_transport_company_link();

CREATE OR REPLACE FUNCTION public.validate_catalog_relationship_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Blocos separados sao obrigatorios: NEW e um record dinamico e uma
  -- expressao AND ainda tenta resolver colunas inexistentes da outra tabela.
  IF TG_TABLE_NAME = 'product_subgroups' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.product_groups WHERE id = NEW.product_group_id
        AND store_account_id = NEW.store_account_id AND owner_user_id = NEW.owner_user_id
    ) THEN RAISE EXCEPTION 'Subgrupo e grupo devem pertencer a mesma empresa.'; END IF;
  ELSIF TG_TABLE_NAME = 'measurement_unit_conversions' THEN
    IF NOT EXISTS (SELECT 1 FROM public.measurement_units WHERE id = NEW.from_unit_id AND store_account_id = NEW.store_account_id AND owner_user_id = NEW.owner_user_id)
       OR NOT EXISTS (SELECT 1 FROM public.measurement_units WHERE id = NEW.to_unit_id AND store_account_id = NEW.store_account_id AND owner_user_id = NEW.owner_user_id)
    THEN RAISE EXCEPTION 'As unidades da conversao devem pertencer a mesma empresa.'; END IF;
  ELSIF TG_TABLE_NAME = 'product_price_table_items' THEN
    IF NOT EXISTS (SELECT 1 FROM public.product_price_tables WHERE id = NEW.price_table_id AND store_account_id = NEW.store_account_id AND owner_user_id = NEW.owner_user_id)
       OR NOT EXISTS (
         SELECT 1 FROM public.products product
         JOIN public.store_accounts account ON account.owner_user_id = product.user_id AND account.product_context = 'happycash'
         WHERE product.id = NEW.product_id AND account.id = NEW.store_account_id
           AND account.owner_user_id = NEW.owner_user_id
       )
    THEN RAISE EXCEPTION 'Tabela de preco e produto devem pertencer a mesma empresa.'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_subgroup_relationship_trigger ON public.product_subgroups;
CREATE TRIGGER validate_subgroup_relationship_trigger BEFORE INSERT OR UPDATE ON public.product_subgroups
FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_relationship_scope();
DROP TRIGGER IF EXISTS validate_unit_conversion_relationship_trigger ON public.measurement_unit_conversions;
CREATE TRIGGER validate_unit_conversion_relationship_trigger BEFORE INSERT OR UPDATE ON public.measurement_unit_conversions
FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_relationship_scope();
DROP TRIGGER IF EXISTS validate_price_item_relationship_trigger ON public.product_price_table_items;
CREATE TRIGGER validate_price_item_relationship_trigger BEFORE INSERT OR UPDATE ON public.product_price_table_items
FOR EACH ROW EXECUTE FUNCTION public.validate_catalog_relationship_scope();

DROP TRIGGER IF EXISTS touch_measurement_unit_conversions_updated_at ON public.measurement_unit_conversions;
CREATE TRIGGER touch_measurement_unit_conversions_updated_at BEFORE UPDATE ON public.measurement_unit_conversions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS touch_product_price_table_items_updated_at ON public.product_price_table_items;
CREATE TRIGGER touch_product_price_table_items_updated_at BEFORE UPDATE ON public.product_price_table_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Converte a categoria textual existente em grupo e cria os padroes de unidade/preco.
INSERT INTO public.measurement_units (store_account_id, owner_user_id, code, name, symbol)
SELECT id, owner_user_id, 'UN', 'Unidade', 'UN' FROM public.store_accounts
WHERE product_context = 'happycash' ON CONFLICT (store_account_id, code) DO NOTHING;

INSERT INTO public.product_price_tables (store_account_id, owner_user_id, code, name, description, is_default)
SELECT id, owner_user_id, 'VAREJO', 'Varejo', 'Preco principal utilizado pelo PDV.', true
FROM public.store_accounts WHERE product_context = 'happycash'
ON CONFLICT (store_account_id, code) DO NOTHING;

UPDATE public.product_price_tables candidate SET is_default = true
WHERE candidate.code = 'VAREJO'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_price_tables current_default
    WHERE current_default.store_account_id = candidate.store_account_id
      AND current_default.is_default
  );

INSERT INTO public.product_groups (store_account_id, owner_user_id, code, name)
SELECT account.id, product.user_id,
       'CAT-' || upper(substr(md5(lower(trim(product.category))), 1, 8)),
       min(trim(product.category))
FROM public.products product
JOIN public.store_accounts account ON account.owner_user_id = product.user_id AND account.product_context = 'happycash'
WHERE trim(coalesce(product.category, '')) <> ''
GROUP BY account.id, product.user_id, lower(trim(product.category))
ON CONFLICT (store_account_id, code) DO NOTHING;

UPDATE public.products product SET
  measurement_unit_id = unit_row.id,
  product_group_id = COALESCE(product.product_group_id, (
    SELECT catalog_group.id FROM public.product_groups catalog_group
    WHERE catalog_group.store_account_id = account.id
      AND catalog_group.code = 'CAT-' || upper(substr(md5(lower(trim(product.category))), 1, 8))
    LIMIT 1
  ))
FROM public.store_accounts account
JOIN public.measurement_units unit_row ON unit_row.store_account_id = account.id AND unit_row.code = 'UN'
WHERE account.owner_user_id = product.user_id AND account.product_context = 'happycash'
  AND (product.measurement_unit_id IS NULL OR product.product_group_id IS NULL);

INSERT INTO public.product_price_table_items (
  store_account_id, owner_user_id, price_table_id, product_id, min_quantity, price, max_discount_pct
)
SELECT account.id, product.user_id, price_table.id, product.id, 1, product.price, product.max_discount_pct
FROM public.products product
JOIN public.store_accounts account ON account.owner_user_id = product.user_id AND account.product_context = 'happycash'
JOIN public.product_price_tables price_table ON price_table.store_account_id = account.id AND price_table.is_default
ON CONFLICT (price_table_id, product_id, min_quantity) DO NOTHING;

-- Mantem o preco principal compativel com PDV/offline mesmo quando quem edita
-- o produto nao possui acesso ao backoffice de precificacao.
CREATE OR REPLACE FUNCTION public.sync_default_product_price_table_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE account_row public.store_accounts%ROWTYPE;
DECLARE default_table_id uuid;
BEGIN
  SELECT * INTO account_row FROM public.store_accounts
  WHERE owner_user_id = NEW.user_id AND product_context = 'happycash' LIMIT 1;
  IF account_row.id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO default_table_id FROM public.product_price_tables
  WHERE store_account_id = account_row.id AND is_default LIMIT 1;
  IF default_table_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.product_price_table_items (
    store_account_id, owner_user_id, price_table_id, product_id,
    min_quantity, price, max_discount_pct, active
  ) VALUES (
    account_row.id, NEW.user_id, default_table_id, NEW.id,
    1, NEW.price, NEW.max_discount_pct, NOT COALESCE(NEW.deleted, false)
  )
  ON CONFLICT (price_table_id, product_id, min_quantity) DO UPDATE SET
    price = EXCLUDED.price,
    max_discount_pct = EXCLUDED.max_discount_pct,
    active = EXCLUDED.active,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_default_product_price_table_item_trigger ON public.products;
CREATE TRIGGER sync_default_product_price_table_item_trigger
AFTER INSERT OR UPDATE OF price, max_discount_pct, deleted ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_default_product_price_table_item();

-- Substitui todas as faixas em uma unica transacao. Assim, editar quantidade
-- minima nunca deixa metade da grade antiga gravada em caso de conflito.
CREATE OR REPLACE FUNCTION public.replace_product_price_table_items(
  target_product_id uuid,
  target_items jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE account_id uuid;
DECLARE owner_id uuid;
DECLARE product_row public.products%ROWTYPE;
DECLARE default_table_id uuid;
DECLARE item jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_has_erp_permission('pricing.manage') THEN
    RAISE EXCEPTION 'Permissao pricing.manage obrigatoria.';
  END IF;
  IF jsonb_typeof(COALESCE(target_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(target_items, '[]'::jsonb)) > 500 THEN
    RAISE EXCEPTION 'Lista de faixas de preco invalida.';
  END IF;

  owner_id := public.get_current_store_owner_id();
  account_id := public.get_current_store_account_id_for_context('happycash');
  SELECT * INTO product_row FROM public.products
  WHERE id = target_product_id AND user_id = owner_id AND NOT COALESCE(deleted, false);
  IF product_row.id IS NULL OR account_id IS NULL THEN
    RAISE EXCEPTION 'Produto ou empresa nao encontrado.';
  END IF;
  SELECT id INTO default_table_id FROM public.product_price_tables
  WHERE store_account_id = account_id AND code = 'VAREJO' AND is_default AND active;
  IF default_table_id IS NULL THEN RAISE EXCEPTION 'Tabela VAREJO ativa nao encontrada.'; END IF;

  DELETE FROM public.product_price_table_items WHERE product_id = target_product_id;
  INSERT INTO public.product_price_table_items (
    store_account_id, owner_user_id, price_table_id, product_id,
    min_quantity, price, max_discount_pct, active
  ) VALUES (
    account_id, owner_id, default_table_id, product_row.id,
    1, product_row.price, product_row.max_discount_pct, true
  );

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(target_items, '[]'::jsonb)) LOOP
    IF (item->>'price_table_id')::uuid = default_table_id
       AND COALESCE((item->>'min_quantity')::numeric, 1) = 1 THEN
      RAISE EXCEPTION 'A faixa VAREJO de uma unidade e controlada pelo preco principal.';
    END IF;
    INSERT INTO public.product_price_table_items (
      store_account_id, owner_user_id, price_table_id, product_id,
      min_quantity, price, max_discount_pct, active
    ) VALUES (
      account_id,
      owner_id,
      (item->>'price_table_id')::uuid,
      product_row.id,
      COALESCE((item->>'min_quantity')::numeric, 1),
      COALESCE((item->>'price')::numeric, 0),
      COALESCE((item->>'max_discount_pct')::numeric, 0),
      true
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_product_price_table_items(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_product_price_table_items(uuid, jsonb) TO authenticated;

-- RLS: leitura operacional; manutencao estrutural somente com permissao explicita.
DO $$
DECLARE table_name text;
DECLARE manage_permission text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'product_departments', 'product_brands', 'product_groups', 'product_subgroups',
    'measurement_units', 'measurement_unit_conversions', 'product_price_tables',
    'product_price_table_items', 'transport_companies'
  ] LOOP
    manage_permission := CASE
      WHEN table_name IN ('product_price_tables', 'product_price_table_items') THEN 'pricing.manage'
      WHEN table_name = 'transport_companies' THEN 'purchases.manage'
      ELSE 'products.manage'
    END;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS catalog_select_store ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS catalog_insert_store ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS catalog_update_store ON public.%I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS catalog_delete_store ON public.%I', table_name);
    EXECUTE format(
      'CREATE POLICY catalog_select_store ON public.%I FOR SELECT USING (owner_user_id = public.get_current_store_owner_id() AND store_account_id = public.get_current_store_account_id_for_context(''happycash''))',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY catalog_insert_store ON public.%I FOR INSERT WITH CHECK (owner_user_id = public.get_current_store_owner_id() AND store_account_id = public.get_current_store_account_id_for_context(''happycash'') AND public.current_user_has_erp_permission(%L))',
      table_name, manage_permission
    );
    EXECUTE format(
      'CREATE POLICY catalog_update_store ON public.%I FOR UPDATE USING (owner_user_id = public.get_current_store_owner_id() AND store_account_id = public.get_current_store_account_id_for_context(''happycash'') AND public.current_user_has_erp_permission(%L)) WITH CHECK (owner_user_id = public.get_current_store_owner_id() AND store_account_id = public.get_current_store_account_id_for_context(''happycash'') AND public.current_user_has_erp_permission(%L))',
      table_name, manage_permission, manage_permission
    );
    EXECUTE format(
      'CREATE POLICY catalog_delete_store ON public.%I FOR DELETE USING (owner_user_id = public.get_current_store_owner_id() AND store_account_id = public.get_current_store_account_id_for_context(''happycash'') AND public.current_user_has_erp_permission(%L))',
      table_name, manage_permission
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.product_price_tables IS 'Listas comerciais globais da empresa; o PDV usa VAREJO enquanto nenhuma tabela especifica for selecionada.';
COMMENT ON TABLE public.measurement_unit_conversions IS 'Conversoes administrativas entre unidades. O fator multiplica a unidade de origem para obter a unidade de destino.';
COMMENT ON COLUMN public.products.category IS 'Campo textual legado preservado para busca, PDV offline e compatibilidade durante a migracao para product_group_id.';
COMMENT ON COLUMN public.products.price IS 'Preco VAREJO legado e fallback offline; mantido sincronizado pela aplicacao ao salvar o produto.';
