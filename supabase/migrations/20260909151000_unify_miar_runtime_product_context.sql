-- "happycash" is still the internal product-context identifier used by the
-- shared auth, site finalizer and existing account rows. MIAR AI/FOOD is the
-- user-facing brand. Keep all runtime scope functions on one identifier.
DO $$
DECLARE
  fn regprocedure;
  definition text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.assign_food_current_scope()'::regprocedure,
    'public.food_current_scope_matches(uuid,uuid)'::regprocedure,
    'public.open_food_table_session(uuid,smallint,text)'::regprocedure,
    'public.replace_food_table_payment_splits(uuid,smallint)'::regprocedure
  ] LOOP
    definition := replace(pg_get_functiondef(fn), '''MIAR Ai FOOD''', '''happycash''');
    EXECUTE definition;
  END LOOP;
END $$;

DROP POLICY IF EXISTS store_locations_read_store ON public.store_locations;
CREATE POLICY store_locations_read_store ON public.store_locations FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
);

DROP POLICY IF EXISTS store_locations_permission_write ON public.store_locations;
CREATE POLICY store_locations_permission_write ON public.store_locations FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_has_erp_permission('multi_store.manage')
);
