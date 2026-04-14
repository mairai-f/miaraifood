DROP POLICY IF EXISTS "products_update_store" ON public.products;

CREATE POLICY "products_update_store"
ON public.products
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);
