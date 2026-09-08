-- Atendimento do Marketplace/Cliente sem endpoints REST. Todos os RPCs
-- abaixo conferem a titularidade do pedido pelo auth.uid().
CREATE TABLE IF NOT EXISTS public.food_customer_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.food_orders(id) ON DELETE CASCADE,
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_type text NOT NULL CHECK (char_length(btrim(issue_type)) BETWEEN 1 AND 64),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.food_customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.food_orders(id) ON DELETE CASCADE,
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_rating smallint NOT NULL CHECK (food_rating BETWEEN 1 AND 10),
  food_comment text NOT NULL DEFAULT '',
  waiter_rating smallint CHECK (waiter_rating BETWEEN 1 AND 10),
  waiter_name text NOT NULL DEFAULT '',
  waiter_comment text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  is_anonymous boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.food_customer_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_waiter_calls ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'waiter_call' CHECK (kind IN ('waiter_call','bill_request'));
CREATE POLICY food_customer_issues_own_read ON public.food_customer_issues FOR SELECT TO authenticated USING (customer_user_id = auth.uid());
CREATE POLICY food_customer_feedback_own_read ON public.food_customer_feedback FOR SELECT TO authenticated USING (customer_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_customer_order_issue(p_order_id uuid, p_issue_type text, p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.food_orders WHERE id = p_order_id AND customer_user_id = auth.uid()) THEN RAISE EXCEPTION 'Pedido não disponível para este cliente'; END IF;
  INSERT INTO public.food_customer_issues(order_id, customer_user_id, issue_type, description) VALUES (p_order_id, auth.uid(), btrim(p_issue_type), btrim(p_description)) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
CREATE OR REPLACE FUNCTION public.create_customer_order_feedback(p_order_id uuid, p_food_rating smallint, p_food_comment text DEFAULT '', p_waiter_rating smallint DEFAULT NULL, p_waiter_name text DEFAULT '', p_waiter_comment text DEFAULT '', p_customer_name text DEFAULT '', p_is_anonymous boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.food_orders WHERE id = p_order_id AND customer_user_id = auth.uid()) THEN RAISE EXCEPTION 'Pedido não disponível para este cliente'; END IF;
  INSERT INTO public.food_customer_feedback(order_id, customer_user_id, food_rating, food_comment, waiter_rating, waiter_name, waiter_comment, customer_name, is_anonymous)
  VALUES (p_order_id, auth.uid(), p_food_rating, left(coalesce(p_food_comment,''),2000), p_waiter_rating, left(coalesce(p_waiter_name,''),160), left(coalesce(p_waiter_comment,''),2000), left(coalesce(p_customer_name,''),160), p_is_anonymous)
  ON CONFLICT (order_id) DO UPDATE SET food_rating=EXCLUDED.food_rating, food_comment=EXCLUDED.food_comment, waiter_rating=EXCLUDED.waiter_rating, waiter_name=EXCLUDED.waiter_name, waiter_comment=EXCLUDED.waiter_comment, customer_name=EXCLUDED.customer_name, is_anonymous=EXCLUDED.is_anonymous, updated_at=now()
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
CREATE OR REPLACE FUNCTION public.request_food_table_bill(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  SELECT table_session_id INTO v_session FROM public.food_orders WHERE id = p_order_id AND customer_user_id = auth.uid();
  IF v_session IS NULL THEN RAISE EXCEPTION 'Este pedido não está vinculado a uma mesa'; END IF;
  IF EXISTS (SELECT 1 FROM public.food_waiter_calls WHERE table_session_id = v_session AND kind = 'bill_request' AND status IN ('open','acknowledged') AND created_at > now() - interval '2 minutes') THEN RETURN; END IF;
  INSERT INTO public.food_waiter_calls(table_session_id, kind, status) VALUES (v_session, 'bill_request', 'open');
END; $$;
GRANT EXECUTE ON FUNCTION public.create_customer_order_issue(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order_feedback(uuid,smallint,text,smallint,text,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_food_table_bill(uuid) TO authenticated;
