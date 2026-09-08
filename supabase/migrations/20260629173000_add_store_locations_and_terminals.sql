-- HappyCash ERP - Fase 2: filiais, depositos, terminais e estoque por local.
--
-- A migracao e aditiva: store_accounts continua representando a empresa e sua
-- assinatura. Os dados existentes recebem uma filial Matriz e um terminal
-- legado, sem alterar IDs, totais ou o funcionamento atual do PDV.

CREATE TABLE IF NOT EXISTS public.store_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  location_type text NOT NULL DEFAULT 'branch'
    CHECK (location_type IN ('headquarters', 'branch', 'warehouse')),
  is_headquarters boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  document text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  street_number text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS store_locations_one_headquarters_idx
  ON public.store_locations(store_account_id)
  WHERE is_headquarters;
CREATE INDEX IF NOT EXISTS store_locations_owner_active_idx
  ON public.store_locations(owner_user_id, active, name);

COMMENT ON TABLE public.store_locations IS
  'Filiais, matriz e depositos de uma empresa HappyCash. A assinatura permanece em store_accounts.';
COMMENT ON COLUMN public.store_locations.is_headquarters IS
  'Somente um local por empresa pode ser a matriz; a restricao e garantida por indice parcial.';

CREATE TABLE IF NOT EXISTS public.pos_terminals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  terminal_type text NOT NULL DEFAULT 'desktop'
    CHECK (terminal_type IN ('desktop', 'web', 'mobile', 'totem')),
  installation_id text,
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, code)
);

CREATE UNIQUE INDEX IF NOT EXISTS pos_terminals_installation_unique_idx
  ON public.pos_terminals(store_account_id, installation_id)
  WHERE installation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pos_terminals_location_active_idx
  ON public.pos_terminals(location_id, active, name);

COMMENT ON TABLE public.pos_terminals IS
  'Identifica cada PDV Web, Desktop, Mobile ou Totem e a filial onde ele opera.';
COMMENT ON COLUMN public.pos_terminals.installation_id IS
  'Identificador local da instalacao Electron. Preenchido automaticamente na ativacao Desktop.';

DROP TRIGGER IF EXISTS touch_store_locations_updated_at ON public.store_locations;
CREATE TRIGGER touch_store_locations_updated_at
BEFORE UPDATE ON public.store_locations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_pos_terminals_updated_at ON public.pos_terminals;
CREATE TRIGGER touch_pos_terminals_updated_at
BEFORE UPDATE ON public.pos_terminals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_erp_location_scope()
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
    RAISE EXCEPTION 'A filial nao pertence a empresa HappyCash informada.';
  END IF;

  IF NEW.is_headquarters THEN
    NEW.location_type := 'headquarters';
  ELSIF NEW.location_type = 'headquarters' THEN
    NEW.location_type := 'branch';
  END IF;

  NEW.code := upper(trim(NEW.code));
  NEW.name := trim(NEW.name);
  IF NEW.code = '' OR NEW.name = '' THEN
    RAISE EXCEPTION 'Codigo e nome da filial sao obrigatorios.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_erp_terminal_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.store_locations location
    WHERE location.id = NEW.location_id
      AND location.store_account_id = NEW.store_account_id
      AND location.owner_user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'O terminal e a filial devem pertencer a mesma empresa.';
  END IF;

  NEW.code := upper(trim(NEW.code));
  NEW.name := trim(NEW.name);
  NEW.installation_id := NULLIF(trim(NEW.installation_id), '');
  IF NEW.code = '' OR NEW.name = '' THEN
    RAISE EXCEPTION 'Codigo e nome do terminal sao obrigatorios.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_erp_location_scope_trigger ON public.store_locations;
CREATE TRIGGER validate_erp_location_scope_trigger
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id, code, name, location_type, is_headquarters
ON public.store_locations
FOR EACH ROW EXECUTE FUNCTION public.validate_erp_location_scope();

DROP TRIGGER IF EXISTS validate_erp_terminal_scope_trigger ON public.pos_terminals;
CREATE TRIGGER validate_erp_terminal_scope_trigger
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id, location_id, code, name, installation_id
ON public.pos_terminals
FOR EACH ROW EXECUTE FUNCTION public.validate_erp_terminal_scope();

-- Toda empresa atual recebe uma Matriz usando os dados cadastrais ja existentes.
INSERT INTO public.store_locations (
  store_account_id, owner_user_id, code, name, location_type, is_headquarters,
  document, phone, email, postal_code, street, street_number, complement,
  district, city, state
)
SELECT account.id,
       account.owner_user_id,
       'MATRIZ',
       COALESCE(NULLIF(trim(account.nome_estabelecimento), ''), 'Matriz'),
       'headquarters',
       true,
       COALESCE(account.cnpj, ''),
       COALESCE(account.telefone, ''),
       COALESCE(account.email, ''),
       COALESCE(account.cep, ''),
       COALESCE(NULLIF(account.nome_rua, ''), account.endereco, ''),
       COALESCE(account.numero, ''),
       COALESCE(account.complemento, ''),
       COALESCE(account.bairro, ''),
       COALESCE(account.cidade, ''),
       COALESCE(account.estado, '')
FROM public.store_accounts account
WHERE account.product_context = 'happycash'
ON CONFLICT (store_account_id, code) DO NOTHING;

-- Terminal de compatibilidade para operacoes Web e registros que ainda nao
-- enviam explicitamente o identificador da maquina.
INSERT INTO public.pos_terminals (
  store_account_id, owner_user_id, location_id, code, name, terminal_type
)
SELECT location.store_account_id,
       location.owner_user_id,
       location.id,
       'LEGACY',
       'Terminal padrao',
       'web'
FROM public.store_locations location
WHERE location.is_headquarters
ON CONFLICT (store_account_id, code) DO NOTHING;

ALTER TABLE public.desktop_machine_activations
  ADD COLUMN IF NOT EXISTS terminal_id uuid REFERENCES public.pos_terminals(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.assign_desktop_activation_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_location_id uuid;
  resolved_terminal_id uuid;
  generated_code text;
BEGIN
  IF NEW.app_context <> 'happycash' THEN
    RETURN NEW;
  END IF;

  IF NEW.terminal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pos_terminals terminal
      WHERE terminal.id = NEW.terminal_id
        AND terminal.store_account_id = NEW.store_account_id
    ) THEN
      RAISE EXCEPTION 'Terminal nao pertence a empresa ativada.';
    END IF;
    RETURN NEW;
  END IF;

  SELECT terminal.id INTO resolved_terminal_id
  FROM public.pos_terminals terminal
  WHERE terminal.store_account_id = NEW.store_account_id
    AND terminal.installation_id = NEW.installation_id
  LIMIT 1;

  IF resolved_terminal_id IS NULL THEN
    SELECT location.id INTO resolved_location_id
    FROM public.store_locations location
    WHERE location.store_account_id = NEW.store_account_id
      AND location.is_headquarters
    LIMIT 1;

    generated_code := 'DESK-' || upper(substr(md5(NEW.installation_id), 1, 10));
    INSERT INTO public.pos_terminals (
      store_account_id, owner_user_id, location_id, code, name, terminal_type,
      installation_id, last_seen_at
    ) VALUES (
      NEW.store_account_id, NEW.owner_user_id, resolved_location_id,
      generated_code, COALESCE(NULLIF(trim(NEW.company_name), ''), generated_code),
      'desktop', NEW.installation_id, COALESCE(NEW.last_seen_at, now())
    )
    ON CONFLICT (store_account_id, installation_id) WHERE installation_id IS NOT NULL
    DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
    RETURNING id INTO resolved_terminal_id;
  ELSE
    UPDATE public.pos_terminals
    SET last_seen_at = COALESCE(NEW.last_seen_at, now()), active = true
    WHERE id = resolved_terminal_id;
  END IF;

  NEW.terminal_id := resolved_terminal_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_desktop_activation_terminal_trigger ON public.desktop_machine_activations;
CREATE TRIGGER assign_desktop_activation_terminal_trigger
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id, installation_id, app_context, terminal_id, last_seen_at
ON public.desktop_machine_activations
FOR EACH ROW EXECUTE FUNCTION public.assign_desktop_activation_terminal();

-- Executa o novo trigger para ativacoes HappyCash ja existentes.
UPDATE public.desktop_machine_activations
SET terminal_id = NULL
WHERE app_context = 'happycash' AND terminal_id IS NULL;

CREATE TABLE IF NOT EXISTS public.location_inventory (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock numeric(12,3) NOT NULL DEFAULT 0,
  min_stock numeric(12,3) NOT NULL DEFAULT 0,
  reserved_stock numeric(12,3) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, product_id),
  CHECK (reserved_stock >= 0)
);

COMMENT ON TABLE public.location_inventory IS
  'Saldo fisico por produto e filial. products.stock permanece como compatibilidade durante a transicao.';

CREATE INDEX IF NOT EXISTS location_inventory_product_idx
  ON public.location_inventory(product_id, location_id);

CREATE OR REPLACE FUNCTION public.validate_location_inventory_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.store_locations location
    JOIN public.products product ON product.id = NEW.product_id
    WHERE location.id = NEW.location_id
      AND location.owner_user_id = NEW.owner_user_id
      AND product.user_id = NEW.owner_user_id
  ) THEN
    RAISE EXCEPTION 'Produto e filial devem pertencer a mesma empresa.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_location_inventory_scope_trigger ON public.location_inventory;
CREATE TRIGGER validate_location_inventory_scope_trigger
BEFORE INSERT OR UPDATE ON public.location_inventory
FOR EACH ROW EXECUTE FUNCTION public.validate_location_inventory_scope();

-- O estoque legado passa a ser o saldo inicial da Matriz.
INSERT INTO public.location_inventory (owner_user_id, location_id, product_id, stock, min_stock)
SELECT product.user_id,
       location.id,
       product.id,
       COALESCE(product.stock, 0),
       COALESCE(product.min_stock, 0)
FROM public.products product
JOIN public.store_locations location
  ON location.owner_user_id = product.user_id
 AND location.is_headquarters
ON CONFLICT (location_id, product_id) DO NOTHING;

-- Escopo operacional nas tabelas existentes. As colunas ficam nullable nesta
-- fase para que lojas inconsistentes sejam corrigidas sem bloquear a migracao.
ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS terminal_id uuid REFERENCES public.pos_terminals(id) ON DELETE SET NULL;
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS terminal_id uuid REFERENCES public.pos_terminals(id) ON DELETE SET NULL;
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.debt_entries
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.store_locations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS cash_sessions_location_opened_idx
  ON public.cash_sessions(location_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS cash_sessions_terminal_opened_idx
  ON public.cash_sessions(terminal_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS sales_location_date_idx
  ON public.sales(location_id, date DESC);
CREATE INDEX IF NOT EXISTS sales_terminal_date_idx
  ON public.sales(terminal_id, date DESC);
CREATE INDEX IF NOT EXISTS expenses_location_date_idx
  ON public.expenses(location_id, date DESC);
CREATE INDEX IF NOT EXISTS stock_movements_location_date_idx
  ON public.stock_movements(location_id, date DESC);
CREATE INDEX IF NOT EXISTS purchase_orders_location_date_idx
  ON public.purchase_orders(location_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS financial_accounts_location_due_idx
  ON public.financial_accounts(location_id, status, due_date);
CREATE INDEX IF NOT EXISTS service_tickets_location_number_idx
  ON public.service_tickets(location_id, number);
CREATE INDEX IF NOT EXISTS fiscal_documents_location_created_idx
  ON public.fiscal_documents(location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS debt_entries_location_date_idx
  ON public.debt_entries(location_id, date_added DESC);
CREATE INDEX IF NOT EXISTS payments_location_date_idx
  ON public.payments(location_id, date DESC);

-- Preenche registros anteriores com a Matriz e, quando aplicavel, o terminal legado.
UPDATE public.cash_sessions record
SET location_id = location.id, terminal_id = terminal.id
FROM public.store_locations location
LEFT JOIN public.pos_terminals terminal
  ON terminal.store_account_id = location.store_account_id AND terminal.code = 'LEGACY'
WHERE record.owner_user_id = location.owner_user_id
  AND location.is_headquarters
  AND record.location_id IS NULL;

UPDATE public.sales record
SET location_id = location.id, terminal_id = terminal.id
FROM public.store_locations location
LEFT JOIN public.pos_terminals terminal
  ON terminal.store_account_id = location.store_account_id AND terminal.code = 'LEGACY'
WHERE record.user_id = location.owner_user_id
  AND location.is_headquarters
  AND record.location_id IS NULL;

UPDATE public.expenses record SET location_id = location.id
FROM public.store_locations location
WHERE record.user_id = location.owner_user_id AND location.is_headquarters AND record.location_id IS NULL;

UPDATE public.stock_movements record SET location_id = location.id
FROM public.store_locations location
WHERE record.user_id = location.owner_user_id AND location.is_headquarters AND record.location_id IS NULL;

UPDATE public.purchase_orders record SET location_id = location.id
FROM public.store_locations location
WHERE record.owner_user_id = location.owner_user_id AND location.is_headquarters AND record.location_id IS NULL;

UPDATE public.financial_accounts record SET location_id = location.id
FROM public.store_locations location
WHERE record.owner_user_id = location.owner_user_id AND location.is_headquarters AND record.location_id IS NULL;

UPDATE public.service_tickets record SET location_id = location.id
FROM public.store_locations location
WHERE record.owner_user_id = location.owner_user_id AND location.is_headquarters AND record.location_id IS NULL;

UPDATE public.fiscal_documents record SET location_id = location.id
FROM public.store_locations location
WHERE record.owner_user_id = location.owner_user_id AND location.is_headquarters AND record.location_id IS NULL;

UPDATE public.debt_entries record SET location_id = location.id
FROM public.clients client
JOIN public.store_locations location
  ON location.owner_user_id = client.user_id AND location.is_headquarters
WHERE record.client_id = client.id AND record.location_id IS NULL;

UPDATE public.payments record SET location_id = location.id
FROM public.clients client
JOIN public.store_locations location
  ON location.owner_user_id = client.user_id AND location.is_headquarters
WHERE record.client_id = client.id AND record.location_id IS NULL;

-- Trigger generico: enquanto cada tela ainda nao envia seu escopo, novos dados
-- continuam indo para Matriz/LEGACY. TG_ARGV[0] informa o nome da coluna owner.
CREATE OR REPLACE FUNCTION public.assign_default_erp_operational_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  record_owner_id uuid;
  resolved_store_account_id uuid;
  resolved_location_id uuid;
  resolved_terminal_id uuid;
BEGIN
  record_owner_id := NULLIF(to_jsonb(NEW)->>TG_ARGV[0], '')::uuid;
  IF record_owner_id IS NULL THEN RETURN NEW; END IF;

  SELECT account.id INTO resolved_store_account_id
  FROM public.store_accounts account
  WHERE account.owner_user_id = record_owner_id
    AND account.product_context = 'happycash'
  ORDER BY account.created_at DESC
  LIMIT 1;

  IF NEW.location_id IS NULL THEN
    SELECT location.id INTO resolved_location_id
    FROM public.store_locations location
    WHERE location.store_account_id = resolved_store_account_id
      AND location.is_headquarters
    LIMIT 1;
    NEW.location_id := resolved_location_id;
  ELSE
    resolved_location_id := NEW.location_id;
  END IF;

  IF resolved_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.store_locations location
    WHERE location.id = resolved_location_id
      AND location.store_account_id = resolved_store_account_id
  ) THEN
    RAISE EXCEPTION 'Filial nao pertence a empresa do registro.';
  END IF;

  IF TG_NARGS > 1 AND TG_ARGV[1] = 'terminal' THEN
    IF NEW.terminal_id IS NULL THEN
      SELECT terminal.id INTO resolved_terminal_id
      FROM public.pos_terminals terminal
      WHERE terminal.store_account_id = resolved_store_account_id
        AND terminal.location_id = resolved_location_id
        AND terminal.code = 'LEGACY'
      LIMIT 1;
      NEW.terminal_id := resolved_terminal_id;
    ELSE
      resolved_terminal_id := NEW.terminal_id;
    END IF;

    IF resolved_terminal_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.pos_terminals terminal
      WHERE terminal.id = resolved_terminal_id
        AND terminal.store_account_id = resolved_store_account_id
        AND terminal.location_id = resolved_location_id
    ) THEN
      RAISE EXCEPTION 'Terminal nao pertence a filial do registro.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_scope_cash_sessions ON public.cash_sessions;
CREATE TRIGGER assign_scope_cash_sessions
BEFORE INSERT OR UPDATE OF owner_user_id, location_id, terminal_id ON public.cash_sessions
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('owner_user_id', 'terminal');

DROP TRIGGER IF EXISTS assign_scope_sales ON public.sales;
CREATE TRIGGER assign_scope_sales
BEFORE INSERT OR UPDATE OF user_id, location_id, terminal_id ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('user_id', 'terminal');

DROP TRIGGER IF EXISTS assign_scope_expenses ON public.expenses;
CREATE TRIGGER assign_scope_expenses
BEFORE INSERT OR UPDATE OF user_id, location_id ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('user_id');

DROP TRIGGER IF EXISTS assign_scope_stock_movements ON public.stock_movements;
CREATE TRIGGER assign_scope_stock_movements
BEFORE INSERT OR UPDATE OF user_id, location_id ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('user_id');

DROP TRIGGER IF EXISTS assign_scope_purchase_orders ON public.purchase_orders;
CREATE TRIGGER assign_scope_purchase_orders
BEFORE INSERT OR UPDATE OF owner_user_id, location_id ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('owner_user_id');

DROP TRIGGER IF EXISTS assign_scope_financial_accounts ON public.financial_accounts;
CREATE TRIGGER assign_scope_financial_accounts
BEFORE INSERT OR UPDATE OF owner_user_id, location_id ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('owner_user_id');

DROP TRIGGER IF EXISTS assign_scope_service_tickets ON public.service_tickets;
CREATE TRIGGER assign_scope_service_tickets
BEFORE INSERT OR UPDATE OF owner_user_id, location_id ON public.service_tickets
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('owner_user_id');

DROP TRIGGER IF EXISTS assign_scope_fiscal_documents ON public.fiscal_documents;
CREATE TRIGGER assign_scope_fiscal_documents
BEFORE INSERT OR UPDATE OF owner_user_id, location_id ON public.fiscal_documents
FOR EACH ROW EXECUTE FUNCTION public.assign_default_erp_operational_scope('owner_user_id');

CREATE OR REPLACE FUNCTION public.assign_client_erp_operational_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_owner_id uuid;
  client_store_account_id uuid;
BEGIN
  SELECT client.user_id INTO client_owner_id
  FROM public.clients client WHERE client.id = NEW.client_id;
  IF client_owner_id IS NULL THEN RAISE EXCEPTION 'Cliente nao encontrado para definir filial.'; END IF;

  SELECT account.id INTO client_store_account_id
  FROM public.store_accounts account
  WHERE account.owner_user_id = client_owner_id AND account.product_context = 'happycash'
  ORDER BY account.created_at DESC LIMIT 1;

  IF NEW.location_id IS NULL THEN
    SELECT location.id INTO NEW.location_id
    FROM public.store_locations location
    WHERE location.store_account_id = client_store_account_id AND location.is_headquarters
    LIMIT 1;
  END IF;

  IF NEW.location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.store_locations location
    WHERE location.id = NEW.location_id
      AND location.store_account_id = client_store_account_id
  ) THEN
    RAISE EXCEPTION 'Filial nao pertence a empresa do cliente.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_scope_debt_entries ON public.debt_entries;
CREATE TRIGGER assign_scope_debt_entries
BEFORE INSERT OR UPDATE OF client_id, location_id ON public.debt_entries
FOR EACH ROW EXECUTE FUNCTION public.assign_client_erp_operational_scope();

DROP TRIGGER IF EXISTS assign_scope_payments ON public.payments;
CREATE TRIGGER assign_scope_payments
BEFORE INSERT OR UPDATE OF client_id, location_id ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.assign_client_erp_operational_scope();

-- Recebimentos e contas gerados pela RPC de compras herdam a filial do pedido
-- antes do trigger generico aplicar o fallback da Matriz.
CREATE OR REPLACE FUNCTION public.inherit_purchase_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.location_id IS NULL AND NEW.reference_id IS NOT NULL AND NEW.source = 'purchase' THEN
    SELECT purchase.location_id INTO NEW.location_id
    FROM public.purchase_orders purchase
    WHERE purchase.id = NEW.reference_id
      AND purchase.owner_user_id = COALESCE(
        NULLIF(to_jsonb(NEW)->>'owner_user_id', '')::uuid,
        NULLIF(to_jsonb(NEW)->>'user_id', '')::uuid
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_inherit_purchase_location_stock ON public.stock_movements;
CREATE TRIGGER aa_inherit_purchase_location_stock
BEFORE INSERT OR UPDATE OF source, reference_id, location_id ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.inherit_purchase_location();

DROP TRIGGER IF EXISTS aa_inherit_purchase_location_financial ON public.financial_accounts;
CREATE TRIGGER aa_inherit_purchase_location_financial
BEFORE INSERT OR UPDATE OF source, reference_id, location_id ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.inherit_purchase_location();

CREATE OR REPLACE FUNCTION public.inherit_sale_location_for_fiscal_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.location_id IS NULL AND NEW.sale_id IS NOT NULL THEN
    SELECT sale.location_id INTO NEW.location_id
    FROM public.sales sale
    WHERE sale.id = NEW.sale_id AND sale.user_id = NEW.owner_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aa_inherit_sale_location_fiscal ON public.fiscal_documents;
CREATE TRIGGER aa_inherit_sale_location_fiscal
BEFORE INSERT OR UPDATE OF sale_id, location_id ON public.fiscal_documents
FOR EACH ROW EXECUTE FUNCTION public.inherit_sale_location_for_fiscal_document();

-- Cada movimentacao passa a atualizar o saldo da filial na mesma transacao.
-- O saldo legado em products.stock continua sendo atualizado pelo codigo atual
-- apenas para a Matriz durante o periodo de transicao.
CREATE OR REPLACE FUNCTION public.sync_location_inventory_from_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stock_delta numeric(12,3);
BEGIN
  IF NEW.location_id IS NULL OR NEW.product_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.balance_before IS NOT NULL AND NEW.balance_after IS NOT NULL THEN
    stock_delta := NEW.balance_after - NEW.balance_before;
  ELSIF NEW.type = 'entrada' THEN
    stock_delta := abs(NEW.quantity);
  ELSIF NEW.type = 'saida' THEN
    stock_delta := -abs(NEW.quantity);
  ELSE
    -- Ajuste sem saldos anterior/posterior e ambiguo e nao deve alterar saldo.
    RETURN NEW;
  END IF;

  INSERT INTO public.location_inventory (
    owner_user_id, location_id, product_id, stock, min_stock
  )
  SELECT NEW.user_id,
         NEW.location_id,
         NEW.product_id,
         greatest(0, stock_delta),
         COALESCE(product.min_stock, 0)
  FROM public.products product
  WHERE product.id = NEW.product_id AND product.user_id = NEW.user_id
  ON CONFLICT (location_id, product_id) DO UPDATE SET
    stock = greatest(0, public.location_inventory.stock + stock_delta),
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_location_inventory_from_movement_trigger ON public.stock_movements;
CREATE TRIGGER sync_location_inventory_from_movement_trigger
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.sync_location_inventory_from_movement();

-- Produto novo nasce no estoque da Matriz. Outras filiais iniciam com saldo zero
-- e recebem mercadoria por compra, transferencia ou ajuste.
CREATE OR REPLACE FUNCTION public.create_headquarters_inventory_for_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.location_inventory (owner_user_id, location_id, product_id, stock, min_stock)
  SELECT NEW.user_id, location.id, NEW.id, COALESCE(NEW.stock, 0), COALESCE(NEW.min_stock, 0)
  FROM public.store_locations location
  WHERE location.owner_user_id = NEW.user_id AND location.is_headquarters
  ON CONFLICT (location_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_headquarters_inventory_for_product_trigger ON public.products;
CREATE TRIGGER create_headquarters_inventory_for_product_trigger
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.create_headquarters_inventory_for_product();

CREATE OR REPLACE FUNCTION public.apply_location_stock_delta(
  p_movement_id uuid,
  p_product_id uuid,
  p_location_id uuid,
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
  owner_id uuid := public.get_current_store_owner_id();
  location_row public.store_locations%ROWTYPE;
  product_row public.products%ROWTYPE;
  inventory_row public.location_inventory%ROWTYPE;
  movement_row public.stock_movements%ROWTYPE;
  next_stock numeric(12,3);
BEGIN
  IF owner_id IS NULL
    OR NOT public.current_store_has_feature('stock.manage')
    OR NOT public.current_user_has_erp_permission('stock.manage')
  THEN
    RAISE EXCEPTION 'Acesso negado para movimentar estoque.';
  END IF;
  IF p_delta = 0 OR p_movement_type NOT IN ('entrada', 'saida', 'ajuste') THEN
    RAISE EXCEPTION 'Movimentacao de estoque invalida.';
  END IF;

  SELECT * INTO movement_row FROM public.stock_movements WHERE id = p_movement_id;
  IF FOUND THEN RETURN movement_row; END IF;

  SELECT * INTO location_row
  FROM public.store_locations
  WHERE id = p_location_id AND owner_user_id = owner_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Filial nao encontrada ou inativa.'; END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = p_product_id AND user_id = owner_id AND NOT deleted;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto nao encontrado.'; END IF;

  INSERT INTO public.location_inventory (owner_user_id, location_id, product_id, stock, min_stock)
  VALUES (
    owner_id,
    location_row.id,
    product_row.id,
    CASE WHEN location_row.is_headquarters THEN COALESCE(product_row.stock, 0) ELSE 0 END,
    COALESCE(product_row.min_stock, 0)
  )
  ON CONFLICT (location_id, product_id) DO NOTHING;

  SELECT * INTO inventory_row
  FROM public.location_inventory
  WHERE location_id = location_row.id AND product_id = product_row.id
  FOR UPDATE;

  next_stock := round(COALESCE(inventory_row.stock, 0) + p_delta, 3);
  IF next_stock < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente na filial. Saldo atual: %.', inventory_row.stock;
  END IF;

  IF location_row.is_headquarters THEN
    UPDATE public.products SET stock = next_stock WHERE id = product_row.id;
  END IF;

  INSERT INTO public.stock_movements (
    id, product_id, user_id, type, quantity, reason, source, reference_id,
    balance_before, balance_after, operator_user_id, location_id
  ) VALUES (
    p_movement_id, product_row.id, owner_id, p_movement_type,
    abs(round(p_delta, 3)), trim(p_reason), coalesce(nullif(trim(p_source), ''), 'manual'),
    p_reference_id, inventory_row.stock, next_stock, auth.uid(), location_row.id
  ) RETURNING * INTO movement_row;

  RETURN movement_row;
END;
$$;

-- Substitui a RPC de recebimento por uma versao consciente da filial. Custos e
-- fornecedor continuam no cadastro global; quantidade muda somente no local do pedido.
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
  has_pending_items boolean;
  received_any boolean := false;
BEGIN
  IF auth.uid() IS NULL
    OR owner_id IS NULL
    OR NOT public.current_user_is_admin()
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

    UPDATE public.purchase_order_items
    SET received_quantity = received_quantity + receipt_quantity
    WHERE id = item_row.id;

    UPDATE public.products
    SET stock = CASE WHEN location_row.is_headquarters THEN balance_after ELSE stock END,
        purchase_cost = item_row.unit_cost,
        freight_cost = unit_freight,
        tax_cost = unit_tax,
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
      owner_user_id, location_id, account_type, description, party_name, amount,
      due_date, source, reference_id, notes
    ) VALUES (
      owner_id, location_row.id, 'payable', 'Compra ' || order_row.supplier_name,
      order_row.supplier_name, order_row.total_amount,
      coalesce(p_due_date, CURRENT_DATE), 'purchase', order_row.id,
      CASE WHEN order_row.invoice_number <> '' THEN 'NF ' || order_row.invoice_number ELSE order_row.notes END
    );
  END IF;

  RETURN order_row;
END;
$$;

ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_locations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pos_terminals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.location_inventory FORCE ROW LEVEL SECURITY;

CREATE POLICY store_locations_read_store ON public.store_locations
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
);
CREATE POLICY store_locations_admin_write ON public.store_locations
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
);

CREATE POLICY pos_terminals_read_store ON public.pos_terminals
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
);
CREATE POLICY pos_terminals_admin_write ON public.pos_terminals
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
);

CREATE POLICY location_inventory_read_store ON public.location_inventory
FOR SELECT TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());
CREATE POLICY location_inventory_manage_store ON public.location_inventory
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('stock.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_has_erp_permission('stock.manage')
);

CREATE OR REPLACE FUNCTION public.get_current_desktop_operational_scope(target_installation_id text)
RETURNS TABLE (
  location_id uuid,
  location_code text,
  location_name text,
  location_type text,
  is_headquarters boolean,
  terminal_id uuid,
  terminal_code text,
  terminal_name text,
  terminal_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT location.id,
         location.code,
         location.name,
         location.location_type,
         location.is_headquarters,
         terminal.id,
         terminal.code,
         terminal.name,
         terminal.terminal_type
  FROM public.pos_terminals terminal
  JOIN public.store_locations location ON location.id = terminal.location_id
  WHERE terminal.owner_user_id = public.get_current_store_owner_id()
    AND terminal.store_account_id = public.get_current_store_account_id_for_context('happycash')
    AND terminal.installation_id = target_installation_id
    AND terminal.active
    AND location.active
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.assign_desktop_activation_terminal() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.assign_default_erp_operational_scope() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.inherit_purchase_location() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.inherit_sale_location_for_fiscal_document() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.assign_client_erp_operational_scope() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.sync_location_inventory_from_movement() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.create_headquarters_inventory_for_product() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.apply_location_stock_delta(uuid, uuid, uuid, numeric, text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_desktop_operational_scope(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_location_stock_delta(uuid, uuid, uuid, numeric, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_desktop_operational_scope(text) TO authenticated;
