-- The site registration creates the headquarters under the MIAR AI/FOOD
-- product context. These policies still used the retired happycash context,
-- making a valid headquarters invisible to the web application.
DROP POLICY IF EXISTS store_locations_read_store ON public.store_locations;
CREATE POLICY store_locations_read_store
ON public.store_locations
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('MIAR Ai FOOD')
);

DROP POLICY IF EXISTS store_locations_permission_write ON public.store_locations;
CREATE POLICY store_locations_permission_write
ON public.store_locations
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('MIAR Ai FOOD')
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('MIAR Ai FOOD')
  AND public.current_user_has_erp_permission('multi_store.manage')
);
