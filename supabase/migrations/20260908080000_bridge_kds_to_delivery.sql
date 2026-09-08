CREATE OR REPLACE FUNCTION public.create_delivery_when_food_order_ready()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'delivery' AND NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.deliveries (order_id, store_account_id, status, customer_name, customer_phone)
    VALUES (NEW.id, NEW.store_account_id, 'waiting', NEW.customer_name, NEW.customer_phone)
    ON CONFLICT (order_id) DO NOTHING;
    INSERT INTO public.food_order_events (store_account_id, owner_user_id, location_id, order_id, actor_type, event_type, details)
    VALUES (NEW.store_account_id, NEW.owner_user_id, NEW.location_id, NEW.id, 'system', 'delivery_waiting', jsonb_build_object('source','kds'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS food_order_ready_delivery_trigger ON public.food_orders;
CREATE TRIGGER food_order_ready_delivery_trigger
AFTER UPDATE OF status ON public.food_orders
FOR EACH ROW EXECUTE FUNCTION public.create_delivery_when_food_order_ready();
