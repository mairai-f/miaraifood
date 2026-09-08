CREATE TABLE IF NOT EXISTS public.food_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.store_locations(id) ON DELETE CASCADE,
  customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  party_size smallint NOT NULL CHECK (party_size BETWEEN 1 AND 100),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','cancelled','completed','no_show')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.food_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY reservations_customer_read ON public.food_reservations FOR SELECT TO authenticated USING (customer_user_id=auth.uid() OR public.current_user_is_admin());
CREATE POLICY reservations_customer_insert ON public.food_reservations FOR INSERT TO authenticated WITH CHECK (customer_user_id=auth.uid());
CREATE POLICY reservations_owner_manage ON public.food_reservations FOR ALL TO authenticated USING (public.current_user_is_admin() OR EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id=store_account_id AND s.owner_user_id=auth.uid())) WITH CHECK (public.current_user_is_admin() OR EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id=store_account_id AND s.owner_user_id=auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.food_reservations;
