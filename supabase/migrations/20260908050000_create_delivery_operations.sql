CREATE TABLE IF NOT EXISTS public.delivery_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','blocked')),
  availability text NOT NULL DEFAULT 'offline' CHECK (availability IN ('online','paused','offline')),
  display_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_driver_stores (
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  exclusive boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (driver_id, store_account_id)
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.food_orders(id) ON DELETE CASCADE,
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','offered','accepted','pickup','in_transit','delivered','failed','cancelled')),
  driver_id uuid REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  pickup_address text NOT NULL DEFAULT '',
  delivery_address text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  delivery_pin_hash text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','declined','expired')),
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (delivery_id, driver_id)
);

CREATE TABLE IF NOT EXISTS public.delivery_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  latitude numeric(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy numeric(8,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_driver_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY delivery_driver_self ON public.delivery_drivers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY delivery_driver_owner ON public.delivery_drivers FOR ALL TO authenticated USING (public.current_user_is_admin() OR user_id = auth.uid()) WITH CHECK (public.current_user_is_admin() OR user_id = auth.uid());
CREATE POLICY delivery_store_member ON public.delivery_driver_stores FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.current_user_is_admin());
CREATE POLICY delivery_store_owner ON public.delivery_driver_stores FOR ALL TO authenticated USING (public.current_user_is_admin() OR EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id = store_account_id AND s.owner_user_id = auth.uid())) WITH CHECK (public.current_user_is_admin() OR EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id = store_account_id AND s.owner_user_id = auth.uid()));
CREATE POLICY deliveries_driver_or_owner ON public.deliveries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id = store_account_id AND s.owner_user_id = auth.uid()) OR public.current_user_is_admin());
CREATE POLICY delivery_offers_driver_or_owner ON public.delivery_offers FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.deliveries x JOIN public.store_accounts s ON s.id=x.store_account_id WHERE x.id=delivery_id AND s.owner_user_id=auth.uid()) OR public.current_user_is_admin()) WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.current_user_is_admin());
CREATE POLICY delivery_locations_driver_or_owner ON public.delivery_locations FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.deliveries x JOIN public.store_accounts s ON s.id=x.store_account_id WHERE x.id=delivery_id AND s.owner_user_id=auth.uid()) OR public.current_user_is_admin()) WITH CHECK (EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()) OR public.current_user_is_admin());
CREATE POLICY delivery_events_driver_or_owner ON public.delivery_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.deliveries x JOIN public.delivery_drivers d ON d.id=x.driver_id WHERE x.id=delivery_id AND d.user_id=auth.uid()) OR EXISTS (SELECT 1 FROM public.deliveries x JOIN public.store_accounts s ON s.id=x.store_account_id WHERE x.id=delivery_id AND s.owner_user_id=auth.uid()) OR public.current_user_is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries, public.delivery_offers, public.delivery_events;
