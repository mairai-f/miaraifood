CREATE OR REPLACE FUNCTION public.offer_delivery_to_online_drivers()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'waiting' THEN
    INSERT INTO public.delivery_offers (delivery_id, driver_id, status)
    SELECT NEW.id, driver.id, 'offered'
    FROM public.delivery_drivers driver
    JOIN public.delivery_driver_stores link ON link.driver_id = driver.id
    WHERE link.store_account_id = NEW.store_account_id
      AND link.active = true
      AND driver.status = 'approved'
      AND driver.availability = 'online'
    ON CONFLICT (delivery_id, driver_id) DO NOTHING;

    UPDATE public.deliveries
    SET status = 'offered', updated_at = now()
    WHERE id = NEW.id
      AND EXISTS (SELECT 1 FROM public.delivery_offers offer WHERE offer.delivery_id = NEW.id AND offer.status = 'offered');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS delivery_offer_dispatch_trigger ON public.deliveries;
CREATE TRIGGER delivery_offer_dispatch_trigger
AFTER INSERT ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.offer_delivery_to_online_drivers();
