-- Miaifood Food: fundacao aditiva para salao, mesas, QR Menu e pedidos.
-- Nao altera sales, sale_items, stock_movements ou service_tickets existentes.

INSERT INTO public.erp_permission_catalog (
  permission_key, module_key, name, description, runtime_scope, default_operator, default_waiter
) VALUES
  ('food.tables.view', 'food', 'Visualizar mesas', 'Consultar salao, mesas e sessoes abertas.', 'both', true, true),
  ('food.tables.manage', 'food', 'Gerenciar mesas', 'Criar areas, mesas e QR Codes.', 'web', false, false),
  ('food.orders.manage', 'food', 'Operar pedidos Food', 'Abrir pedidos e adicionar itens de mesa.', 'both', true, true),
  ('food.orders.cancel', 'food', 'Cancelar pedidos Food', 'Cancelar pedidos ou itens com justificativa.', 'both', false, false),
  ('food.qrmenu.manage', 'food', 'Gerenciar QR Menu', 'Publicar e configurar o QR Menu.', 'web', false, false),
  ('food.kds.use', 'food', 'Operar KDS', 'Visualizar e atualizar a fila da cozinha.', 'both', false, false),
  ('food.kds.manage', 'food', 'Gerenciar KDS', 'Configurar estacoes e roteamento da cozinha.', 'web', false, false),
  ('food.delivery.manage', 'food', 'Gerenciar delivery Food', 'Despachar entregas e entregadores.', 'both', false, false)
ON CONFLICT (permission_key) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  runtime_scope = EXCLUDED.runtime_scope,
  default_operator = EXCLUDED.default_operator,
  default_waiter = EXCLUDED.default_waiter;

-- O modulo nasce liberado somente no plano Pro; os demais planos serao definidos
-- junto com a grade comercial Miaifood, antes de qualquer tela ser publicada.
INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('pro', 'food.tables', true),
  ('pro', 'food.qrmenu', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;

CREATE TABLE IF NOT EXISTS public.food_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, name)
);

CREATE TABLE IF NOT EXISTS public.food_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  area_id uuid REFERENCES public.food_areas(id) ON DELETE SET NULL,
  code text NOT NULL CHECK (char_length(btrim(code)) BETWEEN 1 AND 32),
  name text NOT NULL DEFAULT '',
  seats smallint NOT NULL DEFAULT 4 CHECK (seats BETWEEN 1 AND 100),
  -- Duas UUIDs geradas pelo Postgres formam um token opaco de 256 bits sem
  -- depender de gen_random_bytes(), indisponivel em alguns projetos antigos.
  qr_token text NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  qr_token_rotated_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, code),
  UNIQUE (qr_token)
);

CREATE TABLE IF NOT EXISTS public.food_table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.food_tables(id) ON DELETE RESTRICT,
  service_ticket_id uuid REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'awaiting_payment', 'closed', 'cancelled')),
  guest_count smallint CHECK (guest_count IS NULL OR guest_count BETWEEN 1 AND 100),
  opened_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS food_table_sessions_one_open_idx
  ON public.food_table_sessions(table_id) WHERE status IN ('open', 'awaiting_payment');

CREATE TABLE IF NOT EXISTS public.food_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  table_session_id uuid REFERENCES public.food_table_sessions(id) ON DELETE RESTRICT,
  service_ticket_id uuid REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'table' CHECK (source IN ('table', 'qrmenu', 'counter', 'pickup', 'delivery')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'preparing', 'ready', 'delivered', 'awaiting_payment', 'closed', 'cancelled')),
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  closed_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount <= subtotal),
  CHECK (total = subtotal - discount)
);

CREATE TABLE IF NOT EXISTS public.food_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.food_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  added_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total = round(quantity * unit_price, 2))
);

CREATE TABLE IF NOT EXISTS public.food_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.food_orders(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('staff', 'customer', 'system')),
  event_type text NOT NULL CHECK (char_length(btrim(event_type)) BETWEEN 1 AND 80),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tokens publicos sao armazenados somente em hash. O QR Menu sera servido por
-- Edge Function/RPC posterior; nao ha politica anon direta nas tabelas Food.
CREATE TABLE IF NOT EXISTS public.food_public_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id uuid NOT NULL REFERENCES public.food_table_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS food_areas_scope_idx ON public.food_areas(store_account_id, location_id, active, sort_order);
CREATE INDEX IF NOT EXISTS food_tables_scope_idx ON public.food_tables(store_account_id, location_id, active, code);
CREATE INDEX IF NOT EXISTS food_orders_board_idx ON public.food_orders(store_account_id, location_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS food_order_items_order_idx ON public.food_order_items(order_id, status, created_at);
CREATE INDEX IF NOT EXISTS food_order_events_order_idx ON public.food_order_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS food_public_sessions_valid_idx ON public.food_public_sessions(table_session_id, expires_at) WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.validate_food_location_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.store_locations location
    WHERE location.id = NEW.location_id
      AND location.store_account_id = NEW.store_account_id
      AND location.owner_user_id = NEW.owner_user_id
      AND location.active
  ) THEN RAISE EXCEPTION 'O registro Food deve pertencer a uma filial ativa da mesma empresa.'; END IF;
  RETURN NEW;
END;
$$;

-- Nunca confiar em owner/account enviados pelo browser. Os dois campos sao
-- determinados da sessao autenticada antes de a politica RLS ser avaliada.
CREATE OR REPLACE FUNCTION public.assign_food_current_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  current_owner uuid := public.get_current_store_owner_id();
  current_account uuid := public.get_current_store_account_id_for_context('MIAR Ai FOOD');
BEGIN
  -- Chamadas administrativas com service_role (seed/teste) nao possuem auth.uid;
  -- nesse caso exigimos que owner/account sejam informados e a RLS continua
  -- protegendo qualquer chamada comum do navegador.
  IF auth.uid() IS NULL THEN
    IF NEW.owner_user_id IS NULL OR NEW.store_account_id IS NULL THEN
      RAISE EXCEPTION 'Seed administrativo Food exige empresa e proprietario.';
    END IF;
    RETURN NEW;
  END IF;
  IF current_owner IS NULL OR current_account IS NULL THEN
    RAISE EXCEPTION 'Sessao sem empresa operacional para o modulo Food.';
  END IF;
  NEW.owner_user_id := current_owner;
  NEW.store_account_id := current_account;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_food_table_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.area_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.food_areas area WHERE area.id = NEW.area_id
      AND area.store_account_id = NEW.store_account_id AND area.owner_user_id = NEW.owner_user_id AND area.location_id = NEW.location_id
  ) THEN RAISE EXCEPTION 'A area deve pertencer a mesma filial da mesa.'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_food_order_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.table_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.food_table_sessions session WHERE session.id = NEW.table_session_id
      AND session.store_account_id = NEW.store_account_id AND session.owner_user_id = NEW.owner_user_id AND session.location_id = NEW.location_id
  ) THEN RAISE EXCEPTION 'A sessao da mesa deve pertencer ao mesmo pedido Food.'; END IF;
  IF NEW.service_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_tickets ticket WHERE ticket.id = NEW.service_ticket_id AND ticket.owner_user_id = NEW.owner_user_id
  ) THEN RAISE EXCEPTION 'A comanda deve pertencer a mesma empresa.'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_food_child_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.food_orders food_order WHERE food_order.id = NEW.order_id
      AND food_order.store_account_id = NEW.store_account_id AND food_order.owner_user_id = NEW.owner_user_id AND food_order.location_id = NEW.location_id
  ) THEN RAISE EXCEPTION 'O item ou evento deve pertencer ao mesmo pedido, empresa e filial.'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_food_table_session_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.food_tables food_table WHERE food_table.id = NEW.table_id
      AND food_table.store_account_id = NEW.store_account_id AND food_table.owner_user_id = NEW.owner_user_id AND food_table.location_id = NEW.location_id
  ) THEN RAISE EXCEPTION 'A sessao deve pertencer a uma mesa da mesma filial.'; END IF;
  IF NEW.service_ticket_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.service_tickets ticket WHERE ticket.id = NEW.service_ticket_id AND ticket.owner_user_id = NEW.owner_user_id
  ) THEN RAISE EXCEPTION 'A comanda deve pertencer a mesma empresa.'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_food_public_session_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.food_table_sessions WHERE id = NEW.table_session_id) THEN
    RAISE EXCEPTION 'Sessao de mesa invalida.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.food_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS validate_food_areas_scope ON public.food_areas;
DROP TRIGGER IF EXISTS assign_food_areas_scope ON public.food_areas;
CREATE TRIGGER assign_food_areas_scope BEFORE INSERT ON public.food_areas FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();
CREATE TRIGGER validate_food_areas_scope BEFORE INSERT OR UPDATE ON public.food_areas FOR EACH ROW EXECUTE FUNCTION public.validate_food_location_scope();
DROP TRIGGER IF EXISTS validate_food_tables_scope ON public.food_tables;
DROP TRIGGER IF EXISTS assign_food_tables_scope ON public.food_tables;
CREATE TRIGGER assign_food_tables_scope BEFORE INSERT ON public.food_tables FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();
CREATE TRIGGER validate_food_tables_scope BEFORE INSERT OR UPDATE ON public.food_tables FOR EACH ROW EXECUTE FUNCTION public.validate_food_location_scope();
DROP TRIGGER IF EXISTS validate_food_tables_area ON public.food_tables;
CREATE TRIGGER validate_food_tables_area BEFORE INSERT OR UPDATE ON public.food_tables FOR EACH ROW EXECUTE FUNCTION public.validate_food_table_scope();
DROP TRIGGER IF EXISTS validate_food_sessions_scope ON public.food_table_sessions;
DROP TRIGGER IF EXISTS assign_food_sessions_scope ON public.food_table_sessions;
CREATE TRIGGER assign_food_sessions_scope BEFORE INSERT ON public.food_table_sessions FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();
CREATE TRIGGER validate_food_sessions_scope BEFORE INSERT OR UPDATE ON public.food_table_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_food_location_scope();
DROP TRIGGER IF EXISTS validate_food_sessions_table ON public.food_table_sessions;
CREATE TRIGGER validate_food_sessions_table BEFORE INSERT OR UPDATE ON public.food_table_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_food_table_session_scope();
DROP TRIGGER IF EXISTS validate_food_orders_scope ON public.food_orders;
DROP TRIGGER IF EXISTS assign_food_orders_scope ON public.food_orders;
CREATE TRIGGER assign_food_orders_scope BEFORE INSERT ON public.food_orders FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();
CREATE TRIGGER validate_food_orders_scope BEFORE INSERT OR UPDATE ON public.food_orders FOR EACH ROW EXECUTE FUNCTION public.validate_food_location_scope();
DROP TRIGGER IF EXISTS validate_food_orders_links ON public.food_orders;
CREATE TRIGGER validate_food_orders_links BEFORE INSERT OR UPDATE ON public.food_orders FOR EACH ROW EXECUTE FUNCTION public.validate_food_order_scope();
DROP TRIGGER IF EXISTS validate_food_items_scope ON public.food_order_items;
DROP TRIGGER IF EXISTS assign_food_items_scope ON public.food_order_items;
CREATE TRIGGER assign_food_items_scope BEFORE INSERT ON public.food_order_items FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();
CREATE TRIGGER validate_food_items_scope BEFORE INSERT OR UPDATE ON public.food_order_items FOR EACH ROW EXECUTE FUNCTION public.validate_food_location_scope();
DROP TRIGGER IF EXISTS validate_food_items_order ON public.food_order_items;
CREATE TRIGGER validate_food_items_order BEFORE INSERT OR UPDATE ON public.food_order_items FOR EACH ROW EXECUTE FUNCTION public.validate_food_child_scope();
DROP TRIGGER IF EXISTS validate_food_events_scope ON public.food_order_events;
DROP TRIGGER IF EXISTS assign_food_events_scope ON public.food_order_events;
CREATE TRIGGER assign_food_events_scope BEFORE INSERT ON public.food_order_events FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();
CREATE TRIGGER validate_food_events_scope BEFORE INSERT OR UPDATE ON public.food_order_events FOR EACH ROW EXECUTE FUNCTION public.validate_food_location_scope();
DROP TRIGGER IF EXISTS validate_food_events_order ON public.food_order_events;
CREATE TRIGGER validate_food_events_order BEFORE INSERT OR UPDATE ON public.food_order_events FOR EACH ROW EXECUTE FUNCTION public.validate_food_child_scope();
DROP TRIGGER IF EXISTS validate_food_public_session ON public.food_public_sessions;
CREATE TRIGGER validate_food_public_session BEFORE INSERT OR UPDATE ON public.food_public_sessions FOR EACH ROW EXECUTE FUNCTION public.validate_food_public_session_scope();

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['food_areas', 'food_tables', 'food_table_sessions', 'food_orders', 'food_order_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS food_touch_updated_at ON public.%I', table_name);
    EXECUTE format('CREATE TRIGGER food_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.food_touch_updated_at()', table_name);
  END LOOP;
END $$;

-- Nenhuma tabela Food recebe acesso anonimo. QR publico sera implementado por
-- funcao com token opaco, escopo minimo e service role na proxima parte.
ALTER TABLE public.food_areas ENABLE ROW LEVEL SECURITY; ALTER TABLE public.food_areas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_tables ENABLE ROW LEVEL SECURITY; ALTER TABLE public.food_tables FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_table_sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.food_table_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_orders ENABLE ROW LEVEL SECURITY; ALTER TABLE public.food_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_order_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.food_order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_order_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.food_order_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_public_sessions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.food_public_sessions FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.food_current_scope_matches(row_owner uuid, row_account uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT row_owner = public.get_current_store_owner_id()
     AND row_account = public.get_current_store_account_id_for_context('MIAR Ai FOOD')
     AND public.current_store_has_feature('food.tables')
$$;

CREATE OR REPLACE FUNCTION public.food_can_view()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_has_erp_permission('food.tables.view')
     OR public.current_user_has_erp_permission('food.orders.manage')
$$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['food_areas', 'food_tables', 'food_table_sessions', 'food_orders', 'food_order_items', 'food_order_events'] LOOP
    EXECUTE format('CREATE POLICY food_read_scope ON public.%I FOR SELECT TO authenticated USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.food_can_view())', table_name);
  END LOOP;
END $$;

CREATE POLICY food_areas_write ON public.food_areas FOR ALL TO authenticated
  USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.tables.manage'))
  WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.tables.manage'));
CREATE POLICY food_tables_write ON public.food_tables FOR ALL TO authenticated
  USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.tables.manage'))
  WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.tables.manage'));
CREATE POLICY food_sessions_write ON public.food_table_sessions FOR ALL TO authenticated
  USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.orders.manage'))
  WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.orders.manage'));
CREATE POLICY food_orders_write ON public.food_orders FOR ALL TO authenticated
  USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.orders.manage'))
  WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.orders.manage'));
CREATE POLICY food_items_write ON public.food_order_items FOR ALL TO authenticated
  USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.orders.manage'))
  WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.orders.manage'));
CREATE POLICY food_events_insert ON public.food_order_events FOR INSERT TO authenticated
  WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.orders.manage'));
CREATE POLICY food_public_sessions_admin_only ON public.food_public_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.food_table_sessions session WHERE session.id = food_public_sessions.table_session_id AND public.food_current_scope_matches(session.owner_user_id, session.store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.food_table_sessions session WHERE session.id = food_public_sessions.table_session_id AND public.food_current_scope_matches(session.owner_user_id, session.store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage')));

-- Abertura ocorre somente por RPC: trava a mesa, confirma o escopo e impede
-- duas sessoes abertas mesmo que dois operadores cliquem ao mesmo tempo.
CREATE OR REPLACE FUNCTION public.open_food_table_session(
  p_table_id uuid,
  p_guest_count smallint DEFAULT NULL,
  p_notes text DEFAULT ''
)
RETURNS public.food_table_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  account_id uuid := public.get_current_store_account_id_for_context('MIAR Ai FOOD');
  table_row public.food_tables%ROWTYPE;
  session_row public.food_table_sessions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR account_id IS NULL
    OR NOT public.current_store_has_feature('food.tables')
    OR NOT public.current_user_has_erp_permission('food.orders.manage') THEN
    RAISE EXCEPTION 'Sem permissao para abrir mesa.';
  END IF;
  IF p_guest_count IS NOT NULL AND (p_guest_count < 1 OR p_guest_count > 100) THEN
    RAISE EXCEPTION 'Quantidade de convidados invalida.';
  END IF;

  SELECT * INTO table_row
  FROM public.food_tables
  WHERE id = p_table_id
    AND owner_user_id = owner_id
    AND store_account_id = account_id
    AND active
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mesa nao encontrada ou inativa.'; END IF;

  SELECT * INTO session_row
  FROM public.food_table_sessions
  WHERE table_id = table_row.id AND status IN ('open', 'awaiting_payment')
  FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'Esta mesa ja possui uma sessao aberta.'; END IF;

  INSERT INTO public.food_table_sessions (
    store_account_id, owner_user_id, location_id, table_id, guest_count,
    opened_by_user_id, notes
  ) VALUES (
    account_id, owner_id, table_row.location_id, table_row.id, p_guest_count,
    auth.uid(), left(coalesce(p_notes, ''), 1000)
  ) RETURNING * INTO session_row;

  RETURN session_row;
END;
$$;

REVOKE ALL ON FUNCTION public.food_current_scope_matches(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.food_can_view() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_food_current_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_food_table_session(uuid, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.food_current_scope_matches(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.food_can_view() TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_food_table_session(uuid, smallint, text) TO authenticated;

COMMENT ON TABLE public.food_orders IS 'Pedido operacional Miaifood. A venda financeira definitiva permanece em sales e e vinculada por closed_sale_id.';
COMMENT ON TABLE public.food_public_sessions IS 'Tokens publicos do QR Menu armazenados somente como hash; nao possui politica anonima direta.';
