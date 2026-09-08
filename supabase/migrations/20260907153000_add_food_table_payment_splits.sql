-- Miaifood Food: divisao igual de conta por pessoas, sem duplicar a venda PDV.

CREATE TABLE public.food_table_payment_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  table_session_id uuid NOT NULL REFERENCES public.food_table_sessions(id) ON DELETE CASCADE,
  person_number smallint NOT NULL CHECK (person_number BETWEEN 1 AND 100),
  amount_due numeric(12,2) NOT NULL CHECK (amount_due >= 0),
  amount_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  payment_method text CHECK (payment_method IN ('dinheiro', 'pix', 'credito', 'debito', 'fiado')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_session_id, person_number),
  CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
  CHECK ((status = 'paid') = (payment_method IS NOT NULL))
);

CREATE INDEX food_table_payment_splits_session_idx
  ON public.food_table_payment_splits(table_session_id, person_number);

CREATE OR REPLACE FUNCTION public.validate_food_payment_split_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.food_table_sessions session
    WHERE session.id = NEW.table_session_id
      AND session.store_account_id = NEW.store_account_id
      AND session.owner_user_id = NEW.owner_user_id
      AND session.location_id = NEW.location_id
  ) THEN
    RAISE EXCEPTION 'A parcela deve pertencer a sessao, empresa e filial correspondentes.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_food_payment_split_scope ON public.food_table_payment_splits;
CREATE TRIGGER assign_food_payment_split_scope
BEFORE INSERT ON public.food_table_payment_splits
FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();

DROP TRIGGER IF EXISTS validate_food_payment_split_scope ON public.food_table_payment_splits;
CREATE TRIGGER validate_food_payment_split_scope
BEFORE INSERT OR UPDATE ON public.food_table_payment_splits
FOR EACH ROW EXECUTE FUNCTION public.validate_food_payment_split_scope();

DROP TRIGGER IF EXISTS food_touch_updated_at ON public.food_table_payment_splits;
CREATE TRIGGER food_touch_updated_at
BEFORE UPDATE ON public.food_table_payment_splits
FOR EACH ROW EXECUTE FUNCTION public.food_touch_updated_at();

ALTER TABLE public.food_table_payment_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_table_payment_splits FORCE ROW LEVEL SECURITY;

CREATE POLICY food_payment_splits_read ON public.food_table_payment_splits
FOR SELECT TO authenticated
USING (
  public.food_current_scope_matches(owner_user_id, store_account_id)
  AND public.food_can_view()
);

CREATE POLICY food_payment_splits_write ON public.food_table_payment_splits
FOR ALL TO authenticated
USING (
  public.food_current_scope_matches(owner_user_id, store_account_id)
  AND public.current_user_has_erp_permission('food.orders.manage')
)
WITH CHECK (
  public.food_current_scope_matches(owner_user_id, store_account_id)
  AND public.current_user_has_erp_permission('food.orders.manage')
);

-- Divide o total operacional aberto em centavos, para nunca perder ou criar
-- R$ 0,01. A ultima pessoa recebe o eventual resto da divisao.
CREATE OR REPLACE FUNCTION public.replace_food_table_payment_splits(
  p_table_session_id uuid,
  p_people_count smallint
)
RETURNS SETOF public.food_table_payment_splits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  account_id uuid := public.get_current_store_account_id_for_context('MIAR Ai FOOD');
  session_row public.food_table_sessions%ROWTYPE;
  total_cents bigint;
  base_cents bigint;
  remainder_cents bigint;
  person_index smallint;
BEGIN
  IF auth.uid() IS NULL OR owner_id IS NULL OR account_id IS NULL
    OR NOT public.current_store_has_feature('food.tables')
    OR NOT public.current_user_has_erp_permission('food.orders.manage') THEN
    RAISE EXCEPTION 'Sem permissao para dividir a conta da mesa.';
  END IF;
  IF p_people_count < 1 OR p_people_count > 100 THEN
    RAISE EXCEPTION 'Quantidade de pessoas invalida.';
  END IF;

  SELECT * INTO session_row
  FROM public.food_table_sessions
  WHERE id = p_table_session_id
    AND owner_user_id = owner_id
    AND store_account_id = account_id
    AND status IN ('open', 'awaiting_payment')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mesa nao encontrada ou ja fechada.'; END IF;

  IF EXISTS (SELECT 1 FROM public.food_table_payment_splits WHERE table_session_id = session_row.id AND status = 'paid') THEN
    RAISE EXCEPTION 'Nao e possivel recalcular uma conta que ja possui pagamento confirmado.';
  END IF;

  SELECT COALESCE(round(sum(total) * 100), 0)::bigint INTO total_cents
  FROM public.food_orders
  WHERE table_session_id = session_row.id
    AND status <> 'cancelled';
  base_cents := total_cents / p_people_count;
  remainder_cents := total_cents % p_people_count;

  DELETE FROM public.food_table_payment_splits WHERE table_session_id = session_row.id;
  FOR person_index IN 1..p_people_count LOOP
    INSERT INTO public.food_table_payment_splits (
      store_account_id, owner_user_id, location_id, table_session_id, person_number, amount_due
    ) VALUES (
      account_id, owner_id, session_row.location_id, session_row.id, person_index,
      (base_cents + CASE WHEN person_index = p_people_count THEN remainder_cents ELSE 0 END)::numeric / 100
    );
  END LOOP;

  RETURN QUERY SELECT * FROM public.food_table_payment_splits
    WHERE table_session_id = session_row.id ORDER BY person_number;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_food_payment_split_scope() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_food_table_payment_splits(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_food_table_payment_splits(uuid, smallint) TO authenticated;

COMMENT ON TABLE public.food_table_payment_splits IS
  'Parcelas da divisao de uma mesa. Todas serao vinculadas a uma unica venda final no PDV.';
