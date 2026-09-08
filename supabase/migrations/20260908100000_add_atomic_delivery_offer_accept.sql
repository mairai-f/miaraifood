CREATE OR REPLACE FUNCTION public.accept_delivery_offer(p_offer_id uuid)
RETURNS public.deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE driver_row public.delivery_drivers; offer_row public.delivery_offers; result public.deliveries;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  SELECT * INTO driver_row FROM public.delivery_drivers WHERE user_id = auth.uid() AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entregador não aprovado'; END IF;
  SELECT * INTO offer_row FROM public.delivery_offers WHERE id = p_offer_id AND driver_id = driver_row.id FOR UPDATE;
  IF NOT FOUND OR offer_row.status <> 'offered' THEN RAISE EXCEPTION 'Oferta indisponível'; END IF;
  UPDATE public.deliveries SET driver_id = driver_row.id, status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = offer_row.delivery_id AND status IN ('waiting','offered')
  RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega já aceita por outro entregador'; END IF;
  UPDATE public.delivery_offers SET status = CASE WHEN id = p_offer_id THEN 'accepted' ELSE 'expired' END, responded_at = now() WHERE delivery_id = offer_row.delivery_id AND status = 'offered';
  INSERT INTO public.delivery_events (delivery_id, actor_user_id, event_type, details) VALUES (result.id, auth.uid(), 'accepted', jsonb_build_object('offer_id',p_offer_id));
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_delivery_offer(uuid) TO authenticated;
