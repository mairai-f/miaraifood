CREATE TABLE IF NOT EXISTS public.delivery_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_incidents_access ON public.delivery_incidents FOR ALL TO authenticated
USING (reporter_user_id = auth.uid() OR public.current_user_is_admin() OR EXISTS (SELECT 1 FROM public.deliveries d JOIN public.store_accounts s ON s.id=d.store_account_id WHERE d.id=delivery_id AND s.owner_user_id=auth.uid()))
WITH CHECK (reporter_user_id = auth.uid() OR public.current_user_is_admin());

CREATE OR REPLACE FUNCTION public.report_delivery_incident(p_delivery_id uuid, p_reason text, p_note text DEFAULT '')
RETURNS public.delivery_incidents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE driver_id uuid; result public.delivery_incidents;
BEGIN
  SELECT d.id INTO driver_id FROM public.delivery_drivers d JOIN public.deliveries delivery ON delivery.driver_id=d.id WHERE delivery.id=p_delivery_id AND d.user_id=auth.uid();
  IF driver_id IS NULL THEN RAISE EXCEPTION 'Entrega não pertence ao entregador'; END IF;
  INSERT INTO public.delivery_incidents(delivery_id, reporter_user_id, reason, note) VALUES(p_delivery_id, auth.uid(), trim(p_reason), coalesce(p_note,'')) RETURNING * INTO result;
  INSERT INTO public.delivery_events(delivery_id, actor_user_id, event_type, details) VALUES(p_delivery_id, auth.uid(), 'incident', jsonb_build_object('reason',p_reason,'note',p_note));
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.report_delivery_incident(uuid,text,text) TO authenticated;
