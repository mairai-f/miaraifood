DROP POLICY IF EXISTS food_orders_customer_read ON public.food_orders;
CREATE POLICY food_orders_customer_read ON public.food_orders
FOR SELECT TO authenticated
USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS food_order_items_customer_read ON public.food_order_items;
CREATE POLICY food_order_items_customer_read ON public.food_order_items
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.food_orders o WHERE o.id = order_id AND o.customer_user_id = auth.uid()));
