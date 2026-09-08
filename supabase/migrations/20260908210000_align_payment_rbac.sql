DROP POLICY IF EXISTS store_payment_transaction_owner ON public.store_payment_transactions;
CREATE POLICY store_payment_transaction_read ON public.store_payment_transactions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id=store_account_id AND s.owner_user_id=auth.uid())
  OR public.current_user_is_admin()
  OR (public.current_user_has_erp_permission('food.payments.manage') AND public.current_user_has_erp_permission('food.tables.view'))
);
CREATE POLICY store_payment_transaction_manage ON public.store_payment_transactions FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.store_accounts s WHERE s.id=store_account_id AND s.owner_user_id=auth.uid())
  OR public.current_user_is_admin()
  OR public.current_user_has_erp_permission('food.payments.manage')
);
