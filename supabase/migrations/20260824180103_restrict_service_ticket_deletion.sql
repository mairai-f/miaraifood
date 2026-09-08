DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.service_ticket_items'::regclass
      AND confrelid = 'public.service_tickets'::regclass
      AND contype = 'f';
      
    IF fk_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.service_ticket_items DROP CONSTRAINT ' || fk_name;
    END IF;
END $$;

ALTER TABLE public.service_ticket_items
  ADD CONSTRAINT service_ticket_items_ticket_id_fkey
  FOREIGN KEY (ticket_id)
  REFERENCES public.service_tickets(id)
  ON DELETE RESTRICT;

DROP POLICY IF EXISTS "service_tickets_delete_store" ON public.service_tickets;

CREATE POLICY "service_tickets_delete_store"
ON public.service_tickets
FOR DELETE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('service_tickets.use')
  AND public.get_current_user_role() = 'admin'
);
