CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.confirm_delivery_pin(p_delivery_id uuid, p_pin text)
RETURNS public.deliveries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE current_row public.deliveries; result public.deliveries;
BEGIN
  SELECT * INTO current_row FROM public.deliveries d
  JOIN public.delivery_drivers driver ON driver.id = d.driver_id
  WHERE d.id = p_delivery_id AND driver.user_id = auth.uid() AND driver.status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Entrega não encontrada'; END IF;
  IF current_row.delivery_pin_hash IS NULL OR crypt(trim(p_pin), current_row.delivery_pin_hash) <> current_row.delivery_pin_hash THEN RAISE EXCEPTION 'PIN inválido'; END IF;
  UPDATE public.deliveries SET status='delivered', delivered_at=now(), updated_at=now() WHERE id=p_delivery_id RETURNING * INTO result;
  INSERT INTO public.delivery_events (delivery_id, actor_user_id, event_type, details) VALUES (p_delivery_id, auth.uid(), 'delivered', jsonb_build_object('confirmed_by_pin',true));
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_delivery_pin(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_delivery_pin_hash()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.delivery_pin_hash IS NULL THEN NEW.delivery_pin_hash := crypt(lpad((floor(random()*10000))::int::text, 4, '0'), gen_salt('bf')); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS ensure_delivery_pin_trigger ON public.deliveries;
CREATE TRIGGER ensure_delivery_pin_trigger BEFORE INSERT ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.ensure_delivery_pin_hash();
