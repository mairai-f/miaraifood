CREATE OR REPLACE FUNCTION public.advance_delivery_status(p_delivery_id uuid, p_status text)
RETURNS public.deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE driver_id uuid; current_row public.deliveries; result public.deliveries;
BEGIN
  SELECT id INTO driver_id FROM public.delivery_drivers WHERE user_id = auth.uid() AND status = 'approved';
  IF driver_id IS NULL THEN RAISE EXCEPTION 'Entregador não aprovado'; END IF;
  SELECT * INTO current_row FROM public.deliveries WHERE id = p_delivery_id AND driver_id = driver_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega não pertence ao entregador'; END IF;
  IF p_status NOT IN ('pickup','in_transit','delivered','failed','cancelled') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  IF current_row.status IN ('delivered','failed','cancelled') THEN RAISE EXCEPTION 'Entrega já encerrada'; END IF;
  UPDATE public.deliveries SET status=p_status, delivered_at=CASE WHEN p_status='delivered' THEN now() ELSE delivered_at END, updated_at=now() WHERE id=p_delivery_id RETURNING * INTO result;
  INSERT INTO public.delivery_events (delivery_id, actor_user_id, event_type, details) VALUES (p_delivery_id, auth.uid(), p_status, '{}'::jsonb);
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.advance_delivery_status(uuid,text) TO authenticated;
