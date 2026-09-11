-- O contexto interno da MIAR AI/FOOD continua sendo "happycash" no banco.
-- A migração 20260909150000 trocou apenas as policies de filial para
-- "MIAR Ai FOOD", deixando a matriz invisível e impedindo a troca/criação.

DROP POLICY IF EXISTS store_locations_read_store ON public.store_locations;
DROP POLICY IF EXISTS store_locations_admin_write ON public.store_locations;
DROP POLICY IF EXISTS store_locations_permission_write ON public.store_locations;

CREATE POLICY store_locations_read_store
ON public.store_locations
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
);

CREATE POLICY store_locations_admin_write
ON public.store_locations
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
);

DROP POLICY IF EXISTS pos_terminals_read_store ON public.pos_terminals;
DROP POLICY IF EXISTS pos_terminals_admin_write ON public.pos_terminals;

CREATE POLICY pos_terminals_read_store
ON public.pos_terminals
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
);

CREATE POLICY pos_terminals_admin_write
ON public.pos_terminals
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id_for_context('happycash')
  AND public.current_user_is_admin()
  AND public.current_user_has_erp_permission('multi_store.manage')
);
