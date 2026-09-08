-- Visitantes do QR Menu sao individuais por celular; nunca gravamos as
-- preferencias de onboarding diretamente na mesa compartilhada.

INSERT INTO public.erp_permission_catalog (permission_key, module_key, name, description, runtime_scope, default_operator, default_waiter)
VALUES
  ('food.orders.create', 'food', 'Criar pedidos Food', 'Lancar pedidos de mesa e enviar para cozinha.', 'both', true, true),
  ('food.orders.edit', 'food', 'Editar pedidos Food', 'Editar pedidos ainda abertos.', 'both', true, true),
  ('food.tables.close', 'food', 'Fechar mesas Food', 'Encerrar conta e sessao da mesa.', 'both', true, true),
  ('food.payments.manage', 'food', 'Receber pagamentos Food', 'Registrar pagamentos e divisao da conta.', 'both', true, true),
  ('food.qr.manage', 'food', 'Gerenciar QR das mesas', 'Imprimir e administrar QR Codes fixos.', 'web', false, false),
  ('food.waiter_calls.handle', 'food', 'Atender chamados de garcom', 'Visualizar e resolver chamados do QR Menu.', 'both', true, true)
ON CONFLICT (permission_key) DO UPDATE SET
  module_key = EXCLUDED.module_key, name = EXCLUDED.name, description = EXCLUDED.description,
  runtime_scope = EXCLUDED.runtime_scope, default_operator = EXCLUDED.default_operator, default_waiter = EXCLUDED.default_waiter;

-- Compatibilidade: food.orders.manage continua valido para perfis antigos,
-- enquanto os novos perfis passam a operar com a permissao especifica.
CREATE OR REPLACE FUNCTION public.food_can_view()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_has_erp_permission('food.tables.view')
      OR public.current_user_has_erp_permission('food.orders.manage')
      OR public.current_user_has_erp_permission('food.orders.create')
$$;
CREATE OR REPLACE FUNCTION public.food_can_operate_orders()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_has_erp_permission('food.orders.manage')
      OR public.current_user_has_erp_permission('food.orders.create')
$$;

DROP POLICY IF EXISTS food_sessions_write ON public.food_table_sessions;
CREATE POLICY food_sessions_write ON public.food_table_sessions FOR ALL TO authenticated
USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.food_can_operate_orders())
WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.food_can_operate_orders());
DROP POLICY IF EXISTS food_orders_write ON public.food_orders;
CREATE POLICY food_orders_write ON public.food_orders FOR ALL TO authenticated
USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.food_can_operate_orders())
WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.food_can_operate_orders());
DROP POLICY IF EXISTS food_items_write ON public.food_order_items;
CREATE POLICY food_items_write ON public.food_order_items FOR ALL TO authenticated
USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.food_can_operate_orders())
WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.food_can_operate_orders());

CREATE TABLE public.food_guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id uuid NOT NULL REFERENCES public.food_table_sessions(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  appetite_level text CHECK (appetite_level IN ('low', 'moderate', 'high')),
  experience_mode text CHECK (experience_mode IN ('calm', 'fast', 'suggestions')),
  party_size_hint smallint CHECK (party_size_hint BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX food_guest_sessions_table_session_idx ON public.food_guest_sessions(table_session_id, created_at DESC) WHERE revoked_at IS NULL;

ALTER TABLE public.food_orders ADD COLUMN guest_session_id uuid REFERENCES public.food_guest_sessions(id) ON DELETE SET NULL;
CREATE INDEX food_orders_guest_session_idx ON public.food_orders(guest_session_id, created_at DESC) WHERE guest_session_id IS NOT NULL;

CREATE TABLE public.food_waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_session_id uuid NOT NULL REFERENCES public.food_table_sessions(id) ON DELETE CASCADE,
  guest_session_id uuid REFERENCES public.food_guest_sessions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  handled_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX food_waiter_calls_open_idx ON public.food_waiter_calls(table_session_id, created_at DESC) WHERE status IN ('open', 'acknowledged');

CREATE OR REPLACE FUNCTION public.validate_food_order_guest_session()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.guest_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.food_guest_sessions guest
    WHERE guest.id = NEW.guest_session_id
      AND guest.table_session_id = NEW.table_session_id
      AND guest.revoked_at IS NULL
  ) THEN RAISE EXCEPTION 'O visitante deve pertencer a sessao desta mesa.'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_food_orders_guest_session ON public.food_orders;
CREATE TRIGGER validate_food_orders_guest_session BEFORE INSERT OR UPDATE ON public.food_orders
FOR EACH ROW EXECUTE FUNCTION public.validate_food_order_guest_session();

ALTER TABLE public.food_guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_guest_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_waiter_calls FORCE ROW LEVEL SECURITY;

CREATE POLICY food_guest_sessions_staff_read ON public.food_guest_sessions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.food_table_sessions session WHERE session.id = food_guest_sessions.table_session_id AND public.food_current_scope_matches(session.owner_user_id, session.store_account_id) AND public.food_can_view()));
CREATE POLICY food_waiter_calls_staff_read ON public.food_waiter_calls FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.food_table_sessions session WHERE session.id = food_waiter_calls.table_session_id AND public.food_current_scope_matches(session.owner_user_id, session.store_account_id) AND public.current_user_has_erp_permission('food.waiter_calls.handle')));
CREATE POLICY food_waiter_calls_staff_update ON public.food_waiter_calls FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.food_table_sessions session WHERE session.id = food_waiter_calls.table_session_id AND public.food_current_scope_matches(session.owner_user_id, session.store_account_id) AND public.current_user_has_erp_permission('food.waiter_calls.handle')))
WITH CHECK (EXISTS (SELECT 1 FROM public.food_table_sessions session WHERE session.id = food_waiter_calls.table_session_id AND public.food_current_scope_matches(session.owner_user_id, session.store_account_id) AND public.current_user_has_erp_permission('food.waiter_calls.handle')));

REVOKE ALL ON FUNCTION public.validate_food_order_guest_session() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.food_can_operate_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.food_can_operate_orders() TO authenticated;
