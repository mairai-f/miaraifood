-- HappyCash ERP: fundacao de permissoes granulares (RBAC).
--
-- Esta migracao separa tres conceitos que antes estavam misturados:
-- 1. plano comercial: define quais modulos a loja contratou;
-- 2. permissao do colaborador: define o que cada pessoa pode fazer;
-- 3. runtime: informa se o recurso deve existir no Web, Desktop ou nos dois.

CREATE TABLE IF NOT EXISTS public.erp_permission_catalog (
  permission_key text PRIMARY KEY,
  module_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  runtime_scope text NOT NULL DEFAULT 'both'
    CHECK (runtime_scope IN ('web', 'desktop', 'both')),
  default_operator boolean NOT NULL DEFAULT false,
  default_waiter boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.erp_permission_catalog IS
  'Catalogo central das acoes do ERP. Nao guarda contratacao de plano; guarda apenas capacidades de usuario e runtime.';
COMMENT ON COLUMN public.erp_permission_catalog.runtime_scope IS
  'both: Web e Desktop; web: administracao remota; desktop: operacao local/offline.';

INSERT INTO public.erp_permission_catalog (
  permission_key, module_key, name, description, runtime_scope, default_operator, default_waiter
)
VALUES
  ('dashboard.view', 'dashboard', 'Visualizar painel', 'Acessar os indicadores iniciais da loja.', 'both', true, false),
  ('pdv.use', 'pdv', 'Usar PDV', 'Registrar vendas no ponto de venda.', 'both', true, false),
  ('pdv.open_cash', 'pdv', 'Abrir caixa', 'Iniciar uma sessao de caixa.', 'both', true, false),
  ('pdv.close_cash', 'pdv', 'Fechar caixa', 'Encerrar e conferir uma sessao de caixa.', 'both', true, false),
  ('pdv.cash_out', 'pdv', 'Realizar sangria', 'Registrar retirada ou pagamento pelo caixa.', 'both', true, false),
  ('pdv.cancel_sale', 'pdv', 'Cancelar venda', 'Cancelar uma venda ja registrada.', 'both', true, false),
  ('pdv.edit_price', 'pdv', 'Editar preco no PDV', 'Alterar o preco unitario durante a venda.', 'both', false, false),
  ('pdv.sell_without_stock', 'pdv', 'Vender sem estoque', 'Permitir venda com saldo insuficiente.', 'both', true, false),
  ('pdv.view_other_cashiers', 'pdv', 'Ver outros caixas', 'Consultar caixas e vendas de outros operadores.', 'both', false, false),
  ('pdv.change_seller', 'pdv', 'Trocar vendedor', 'Atribuir a venda a outro colaborador.', 'both', false, false),
  ('service_tickets.use', 'service_tickets', 'Usar comandas', 'Abrir e movimentar comandas.', 'both', true, true),
  ('service_tickets.transfer', 'service_tickets', 'Transferir comanda', 'Mover itens ou a comanda para outro atendimento.', 'both', true, false),
  ('service_tickets.cancel', 'service_tickets', 'Cancelar comanda', 'Cancelar comandas e seus itens.', 'both', false, false),
  ('clients.view', 'clients', 'Visualizar clientes', 'Consultar cadastro, limite e historico do cliente.', 'both', true, false),
  ('clients.manage', 'clients', 'Gerenciar clientes', 'Cadastrar e alterar clientes.', 'both', true, false),
  ('products.view', 'products', 'Visualizar produtos', 'Consultar catalogo, preco e saldo.', 'both', true, false),
  ('products.manage', 'products', 'Gerenciar produtos', 'Cadastrar, editar ou excluir produtos.', 'both', false, false),
  ('stock.view', 'stock', 'Visualizar estoque', 'Consultar saldos e movimentacoes.', 'both', false, false),
  ('stock.manage', 'stock', 'Movimentar estoque', 'Registrar entradas, saidas e ajustes.', 'both', false, false),
  ('purchases.view', 'purchases', 'Visualizar compras', 'Consultar fornecedores e pedidos de compra.', 'both', false, false),
  ('purchases.manage', 'purchases', 'Gerenciar compras', 'Criar pedidos e receber mercadorias.', 'both', false, false),
  ('reports.view', 'reports', 'Visualizar relatorios', 'Consultar resultados operacionais e comerciais.', 'both', false, false),
  ('financial.view', 'financial', 'Visualizar financeiro', 'Consultar contas, despesas e fluxo financeiro.', 'both', false, false),
  ('financial.manage', 'financial', 'Gerenciar financeiro', 'Criar e alterar lancamentos financeiros.', 'both', false, false),
  ('pricing.view', 'pricing', 'Visualizar precificacao', 'Consultar margens e historico de precos.', 'both', false, false),
  ('pricing.manage', 'pricing', 'Gerenciar precificacao', 'Alterar custos, margens e regras de preco.', 'both', false, false),
  ('fiscal.view', 'fiscal', 'Visualizar fiscal', 'Consultar documentos e configuracoes fiscais.', 'both', false, false),
  ('fiscal.manage', 'fiscal', 'Gerenciar fiscal', 'Emitir, cancelar e configurar documentos fiscais.', 'both', false, false),
  ('rewards.manage', 'rewards', 'Gerenciar recompensas', 'Configurar fidelidade e recompensas.', 'both', false, false),
  ('deleted.view', 'deleted', 'Visualizar excluidos', 'Consultar e restaurar registros excluidos.', 'both', false, false),
  ('settings.manage', 'settings', 'Gerenciar configuracoes', 'Alterar configuracoes gerais da loja.', 'both', false, false),
  ('staff.manage', 'staff', 'Gerenciar colaboradores', 'Cadastrar, redefinir ou remover colaboradores.', 'both', false, false),
  ('rbac.manage', 'staff', 'Gerenciar permissoes', 'Definir grupos e excecoes de acesso.', 'web', false, false),
  ('access_monitor.view', 'security', 'Monitorar acessos', 'Consultar sessoes e eventos de acesso.', 'web', false, false),
  ('audit.view', 'security', 'Visualizar auditoria', 'Consultar trilha de alteracoes sensiveis.', 'web', false, false),
  ('delivery.use', 'delivery', 'Operar delivery', 'Gerenciar pedidos e entregas.', 'both', false, false),
  ('conciliation.manage', 'conciliation', 'Gerenciar conciliacao', 'Conciliar recebiveis e provedores de pagamento.', 'web', false, false),
  ('multi_store.manage', 'multi_store', 'Gerenciar multi-loja', 'Administrar filiais, terminais e consolidacao.', 'web', false, false),
  ('time_clock.manage', 'time_clock', 'Gerenciar ponto', 'Administrar jornadas e marcacoes de ponto.', 'web', false, false),
  ('self_service.manage', 'self_service', 'Gerenciar autoatendimento', 'Configurar totens e cardapios de autoatendimento.', 'web', false, false)
ON CONFLICT (permission_key) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  runtime_scope = EXCLUDED.runtime_scope,
  default_operator = EXCLUDED.default_operator,
  default_waiter = EXCLUDED.default_waiter;

CREATE TABLE IF NOT EXISTS public.erp_permission_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, code)
);

CREATE TABLE IF NOT EXISTS public.erp_permission_group_rules (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.erp_permission_groups(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.erp_permission_catalog(permission_key) ON DELETE CASCADE,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.erp_staff_group_memberships (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.erp_permission_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS public.erp_staff_permission_overrides (
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.erp_permission_catalog(permission_key) ON DELETE CASCADE,
  allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

COMMENT ON TABLE public.erp_permission_groups IS 'Perfis reutilizaveis de acesso, como Operador padrao e Garcom padrao.';
COMMENT ON TABLE public.erp_permission_group_rules IS 'Permissoes herdadas por todos os membros do grupo.';
COMMENT ON TABLE public.erp_staff_permission_overrides IS 'Excecoes individuais; sempre prevalecem sobre os grupos.';

CREATE INDEX IF NOT EXISTS erp_permission_groups_owner_idx
  ON public.erp_permission_groups(owner_user_id, name);
CREATE INDEX IF NOT EXISTS erp_staff_group_memberships_owner_user_idx
  ON public.erp_staff_group_memberships(owner_user_id, user_id);
CREATE INDEX IF NOT EXISTS erp_staff_permission_overrides_owner_user_idx
  ON public.erp_staff_permission_overrides(owner_user_id, user_id);

DROP TRIGGER IF EXISTS touch_erp_permission_groups_updated_at ON public.erp_permission_groups;
CREATE TRIGGER touch_erp_permission_groups_updated_at
BEFORE UPDATE ON public.erp_permission_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_erp_permission_group_rules_updated_at ON public.erp_permission_group_rules;
CREATE TRIGGER touch_erp_permission_group_rules_updated_at
BEFORE UPDATE ON public.erp_permission_group_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_erp_staff_permission_overrides_updated_at ON public.erp_staff_permission_overrides;
CREATE TRIGGER touch_erp_staff_permission_overrides_updated_at
BEFORE UPDATE ON public.erp_staff_permission_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cria os grupos basicos de cada loja e copia os padroes do catalogo.
CREATE OR REPLACE FUNCTION public.ensure_default_erp_permission_groups(target_owner_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operator_group_id uuid;
  waiter_group_id uuid;
BEGIN
  IF target_owner_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.erp_permission_groups (owner_user_id, code, name, description, is_system)
  VALUES
    (target_owner_user_id, 'operator_default', 'Operador padrao', 'Acesso operacional inicial do PDV.', true),
    (target_owner_user_id, 'waiter_default', 'Garcom padrao', 'Acesso inicial para comandas.', true)
  ON CONFLICT (owner_user_id, code) DO NOTHING;

  SELECT id INTO operator_group_id
  FROM public.erp_permission_groups
  WHERE owner_user_id = target_owner_user_id AND code = 'operator_default';

  SELECT id INTO waiter_group_id
  FROM public.erp_permission_groups
  WHERE owner_user_id = target_owner_user_id AND code = 'waiter_default';

  INSERT INTO public.erp_permission_group_rules (owner_user_id, group_id, permission_key, allowed)
  SELECT target_owner_user_id, operator_group_id, permission_key, true
  FROM public.erp_permission_catalog
  WHERE default_operator
  ON CONFLICT (group_id, permission_key) DO NOTHING;

  INSERT INTO public.erp_permission_group_rules (owner_user_id, group_id, permission_key, allowed)
  SELECT target_owner_user_id, waiter_group_id, permission_key, true
  FROM public.erp_permission_catalog
  WHERE default_waiter
  ON CONFLICT (group_id, permission_key) DO NOTHING;
END;
$$;

-- Associa automaticamente colaboradores novos ao grupo inicial da funcao deles.
CREATE OR REPLACE FUNCTION public.sync_profile_default_erp_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_group_id uuid;
BEGIN
  IF NEW.role NOT IN ('operator', 'waiter') THEN
    RETURN NEW;
  END IF;

  PERFORM public.ensure_default_erp_permission_groups(NEW.owner_user_id);

  SELECT id INTO default_group_id
  FROM public.erp_permission_groups
  WHERE owner_user_id = NEW.owner_user_id
    AND code = CASE WHEN NEW.role = 'waiter' THEN 'waiter_default' ELSE 'operator_default' END;

  IF TG_OP = 'UPDATE' AND (OLD.role, OLD.owner_user_id) IS DISTINCT FROM (NEW.role, NEW.owner_user_id) THEN
    DELETE FROM public.erp_staff_group_memberships WHERE user_id = NEW.user_id;
  END IF;

  INSERT INTO public.erp_staff_group_memberships (owner_user_id, user_id, group_id)
  VALUES (NEW.owner_user_id, NEW.user_id, default_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_default_erp_group_trigger ON public.profiles;
CREATE TRIGGER sync_profile_default_erp_group_trigger
AFTER INSERT OR UPDATE OF role, owner_user_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_default_erp_group();

DO $$
DECLARE
  owner_record record;
BEGIN
  FOR owner_record IN SELECT DISTINCT owner_user_id FROM public.profiles LOOP
    PERFORM public.ensure_default_erp_permission_groups(owner_record.owner_user_id);
  END LOOP;
END;
$$;

INSERT INTO public.erp_staff_group_memberships (owner_user_id, user_id, group_id)
SELECT profile.owner_user_id, profile.user_id, permission_group.id
FROM public.profiles profile
JOIN public.erp_permission_groups permission_group
  ON permission_group.owner_user_id = profile.owner_user_id
 AND permission_group.code = CASE
   WHEN profile.role = 'waiter' THEN 'waiter_default'
   ELSE 'operator_default'
 END
WHERE profile.role IN ('operator', 'waiter')
ON CONFLICT (user_id, group_id) DO NOTHING;

-- Calcula a permissao de qualquer colaborador. A funcao e interna e nao e
-- concedida aos clientes; as RPCs publicas abaixo fazem as validacoes de loja.
CREATE OR REPLACE FUNCTION public.erp_user_has_permission(target_user_id uuid, target_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role text;
  override_value boolean;
  grouped_value boolean;
  default_value boolean;
BEGIN
  SELECT role INTO target_role FROM public.profiles WHERE user_id = target_user_id;
  IF target_role IS NULL THEN RETURN false; END IF;
  IF target_role = 'admin' THEN RETURN true; END IF;

  SELECT allowed INTO override_value
  FROM public.erp_staff_permission_overrides
  WHERE user_id = target_user_id AND permission_key = target_permission_key;
  IF FOUND THEN RETURN override_value; END IF;

  SELECT bool_or(rule.allowed) INTO grouped_value
  FROM public.erp_staff_group_memberships membership
  JOIN public.erp_permission_group_rules rule
    ON rule.group_id = membership.group_id
   AND rule.owner_user_id = membership.owner_user_id
  WHERE membership.user_id = target_user_id
    AND rule.permission_key = target_permission_key;
  IF grouped_value IS NOT NULL THEN RETURN grouped_value; END IF;

  SELECT CASE
    WHEN target_role = 'waiter' THEN default_waiter
    ELSE default_operator
  END INTO default_value
  FROM public.erp_permission_catalog
  WHERE permission_key = target_permission_key;

  RETURN COALESCE(default_value, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_erp_permission(target_permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.erp_user_has_permission(auth.uid(), target_permission_key)
$$;

CREATE OR REPLACE FUNCTION public.get_my_erp_permissions()
RETURNS TABLE (permission_key text, runtime_scope text, allowed boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT catalog.permission_key,
         catalog.runtime_scope,
         public.erp_user_has_permission(auth.uid(), catalog.permission_key)
  FROM public.erp_permission_catalog catalog
  WHERE auth.uid() IS NOT NULL
  ORDER BY catalog.module_key, catalog.permission_key
$$;

CREATE OR REPLACE FUNCTION public.get_staff_erp_permissions(target_user_id uuid)
RETURNS TABLE (
  permission_key text,
  module_key text,
  name text,
  description text,
  runtime_scope text,
  effective_allowed boolean,
  override_allowed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem consultar permissoes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = target_user_id
      AND owner_user_id = public.get_current_store_owner_id()
      AND role IN ('operator', 'waiter')
  ) THEN
    RAISE EXCEPTION 'Colaborador nao pertence a esta loja.';
  END IF;

  RETURN QUERY
  SELECT catalog.permission_key,
         catalog.module_key,
         catalog.name,
         catalog.description,
         catalog.runtime_scope,
         public.erp_user_has_permission(target_user_id, catalog.permission_key),
         override_rule.allowed
  FROM public.erp_permission_catalog catalog
  LEFT JOIN public.erp_staff_permission_overrides override_rule
    ON override_rule.user_id = target_user_id
   AND override_rule.permission_key = catalog.permission_key
  ORDER BY catalog.module_key, catalog.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_erp_permission_override(
  target_user_id uuid,
  target_permission_key text,
  target_allowed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  store_owner_id uuid := public.get_current_store_owner_id();
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem alterar permissoes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = target_user_id
      AND owner_user_id = store_owner_id
      AND role IN ('operator', 'waiter')
  ) THEN
    RAISE EXCEPTION 'Colaborador nao pertence a esta loja.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.erp_permission_catalog WHERE permission_key = target_permission_key
  ) THEN
    RAISE EXCEPTION 'Permissao desconhecida.';
  END IF;

  IF target_allowed IS NULL THEN
    DELETE FROM public.erp_staff_permission_overrides
    WHERE user_id = target_user_id AND permission_key = target_permission_key;
  ELSE
    INSERT INTO public.erp_staff_permission_overrides (
      owner_user_id, user_id, permission_key, allowed
    ) VALUES (
      store_owner_id, target_user_id, target_permission_key, target_allowed
    )
    ON CONFLICT (user_id, permission_key) DO UPDATE SET
      allowed = EXCLUDED.allowed,
      owner_user_id = EXCLUDED.owner_user_id,
      updated_at = now();
  END IF;
END;
$$;

-- As regras abaixo levam o RBAC para o servidor nas mutacoes mais sensiveis.
-- A validacao visual do React melhora a UX, mas nunca deve ser a unica barreira.
DROP POLICY IF EXISTS "cash_sessions_insert_store" ON public.cash_sessions;
CREATE POLICY "cash_sessions_insert_store" ON public.cash_sessions
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND operator_user_id = auth.uid()
  AND public.current_store_has_feature('cash.manage')
  AND public.current_user_has_erp_permission('pdv.open_cash')
);

DROP POLICY IF EXISTS "clients_insert_store" ON public.clients;
DROP POLICY IF EXISTS "clients_update_store" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_store" ON public.clients;
CREATE POLICY "clients_insert_store" ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
  AND public.current_user_has_erp_permission('clients.manage')
);
CREATE POLICY "clients_update_store" ON public.clients
FOR UPDATE TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
  AND public.current_user_has_erp_permission('clients.manage')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
  AND public.current_user_has_erp_permission('clients.manage')
);
CREATE POLICY "clients_delete_store" ON public.clients
FOR DELETE TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
  AND public.current_user_has_erp_permission('clients.manage')
);

DROP POLICY IF EXISTS "sales_update_store" ON public.sales;
CREATE POLICY "sales_update_store" ON public.sales
FOR UPDATE TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pdv.use')
  AND public.current_user_has_erp_permission('pdv.cancel_sale')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pdv.use')
  AND public.current_user_has_erp_permission('pdv.cancel_sale')
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.clients client
      WHERE client.id = sales.client_id
        AND client.user_id = public.get_current_store_owner_id()
    )
  )
);

DROP POLICY IF EXISTS "expenses_insert_store" ON public.expenses;
CREATE POLICY "expenses_insert_store" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('financial.manage')
  AND CASE
    WHEN category = 'Saída de caixa'
      THEN public.current_user_has_erp_permission('pdv.cash_out')
    ELSE public.current_user_has_erp_permission('financial.manage')
  END
);

ALTER TABLE public.erp_permission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_permission_group_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_staff_group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_staff_permission_overrides ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.erp_permission_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE public.erp_permission_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.erp_permission_group_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.erp_staff_group_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.erp_staff_permission_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY erp_permission_catalog_read ON public.erp_permission_catalog
FOR SELECT TO authenticated USING (true);

CREATE POLICY erp_permission_groups_read ON public.erp_permission_groups
FOR SELECT TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());
CREATE POLICY erp_permission_groups_admin_write ON public.erp_permission_groups
FOR ALL TO authenticated
USING (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin())
WITH CHECK (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin());

CREATE POLICY erp_permission_group_rules_read ON public.erp_permission_group_rules
FOR SELECT TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());
CREATE POLICY erp_permission_group_rules_admin_write ON public.erp_permission_group_rules
FOR ALL TO authenticated
USING (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin())
WITH CHECK (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin());

CREATE POLICY erp_staff_group_memberships_read ON public.erp_staff_group_memberships
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (user_id = auth.uid() OR public.current_user_is_admin())
);
CREATE POLICY erp_staff_group_memberships_admin_write ON public.erp_staff_group_memberships
FOR ALL TO authenticated
USING (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin())
WITH CHECK (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin());

CREATE POLICY erp_staff_permission_overrides_read ON public.erp_staff_permission_overrides
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (user_id = auth.uid() OR public.current_user_is_admin())
);
CREATE POLICY erp_staff_permission_overrides_admin_write ON public.erp_staff_permission_overrides
FOR ALL TO authenticated
USING (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin())
WITH CHECK (owner_user_id = public.get_current_store_owner_id() AND public.current_user_is_admin());

REVOKE ALL ON FUNCTION public.ensure_default_erp_permission_groups(uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_default_erp_group() FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.erp_user_has_permission(uuid, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.current_user_has_erp_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_erp_permissions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_staff_erp_permissions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_staff_erp_permission_override(uuid, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_user_has_erp_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_erp_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_erp_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_erp_permission_override(uuid, text, boolean) TO authenticated;
