CREATE OR REPLACE FUNCTION public.get_current_store_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.store_accounts
  WHERE owner_user_id = public.get_current_store_owner_id()
  LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.get_current_store_plan_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subscription.plan_id
  FROM public.store_subscriptions AS subscription
  WHERE subscription.owner_user_id = public.get_current_store_owner_id()
    AND (
      (
        subscription.status = 'trialing'
        AND COALESCE(subscription.trial_ends_at, subscription.current_period_ends_at) > now()
      )
      OR (
        subscription.status IN ('active', 'past_due')
        AND (
          subscription.current_period_ends_at IS NULL
          OR subscription.current_period_ends_at > now()
        )
      )
    )
  ORDER BY
    CASE
      WHEN subscription.status = 'active' THEN 0
      WHEN subscription.status = 'past_due' THEN 1
      ELSE 2
    END,
    COALESCE(subscription.current_period_ends_at, subscription.trial_ends_at, subscription.created_at) DESC
  LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.current_store_has_feature(target_feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscription_plan_features AS feature
    WHERE feature.plan_id = public.get_current_store_plan_id()
      AND feature.feature_key = target_feature
      AND feature.enabled
  )
$$;
DROP POLICY IF EXISTS "cash_sessions_select_store" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert_store" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update_store" ON public.cash_sessions;
CREATE POLICY "cash_sessions_select_store"
ON public.cash_sessions
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('cash.manage')
);
CREATE POLICY "cash_sessions_insert_store"
ON public.cash_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND operator_user_id = auth.uid()
  AND public.current_store_has_feature('cash.manage')
);
CREATE POLICY "cash_sessions_update_store"
ON public.cash_sessions
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('cash.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('cash.manage')
);
DROP POLICY IF EXISTS "clients_select_store" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_store" ON public.clients;
DROP POLICY IF EXISTS "clients_update_store" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_store" ON public.clients;
CREATE POLICY "clients_select_store"
ON public.clients
FOR SELECT
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
);
CREATE POLICY "clients_insert_store"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
);
CREATE POLICY "clients_update_store"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
);
CREATE POLICY "clients_delete_store"
ON public.clients
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('clients.manage')
);
DROP POLICY IF EXISTS "products_select_store" ON public.products;
DROP POLICY IF EXISTS "products_insert_store" ON public.products;
DROP POLICY IF EXISTS "products_update_store" ON public.products;
DROP POLICY IF EXISTS "products_delete_store" ON public.products;
CREATE POLICY "products_select_store"
ON public.products
FOR SELECT
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
);
CREATE POLICY "products_insert_store"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
);
CREATE POLICY "products_update_store"
ON public.products
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
);
CREATE POLICY "products_delete_store"
ON public.products
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('products.manage')
);
DROP POLICY IF EXISTS "debt_entries_select_store" ON public.debt_entries;
DROP POLICY IF EXISTS "debt_entries_insert_store" ON public.debt_entries;
DROP POLICY IF EXISTS "debt_entries_update_store" ON public.debt_entries;
DROP POLICY IF EXISTS "debt_entries_delete_store" ON public.debt_entries;
CREATE POLICY "debt_entries_select_store"
ON public.debt_entries
FOR SELECT
TO authenticated
USING (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = debt_entries.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "debt_entries_insert_store"
ON public.debt_entries
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = debt_entries.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
  AND EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = debt_entries.product_id
      AND product.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "debt_entries_update_store"
ON public.debt_entries
FOR UPDATE
TO authenticated
USING (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = debt_entries.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
)
WITH CHECK (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = debt_entries.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
  AND EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = debt_entries.product_id
      AND product.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "debt_entries_delete_store"
ON public.debt_entries
FOR DELETE
TO authenticated
USING (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = debt_entries.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
DROP POLICY IF EXISTS "payments_select_store" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_store" ON public.payments;
DROP POLICY IF EXISTS "payments_update_store" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_store" ON public.payments;
CREATE POLICY "payments_select_store"
ON public.payments
FOR SELECT
TO authenticated
USING (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = payments.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "payments_insert_store"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = payments.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "payments_update_store"
ON public.payments
FOR UPDATE
TO authenticated
USING (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = payments.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
)
WITH CHECK (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = payments.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "payments_delete_store"
ON public.payments
FOR DELETE
TO authenticated
USING (
  public.current_store_has_feature('fiado.manage')
  AND EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = payments.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
DROP POLICY IF EXISTS "rewards_select_store" ON public.rewards;
DROP POLICY IF EXISTS "rewards_insert_store" ON public.rewards;
DROP POLICY IF EXISTS "rewards_update_store" ON public.rewards;
DROP POLICY IF EXISTS "rewards_delete_store" ON public.rewards;
CREATE POLICY "rewards_select_store"
ON public.rewards
FOR SELECT
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('rewards.manage')
);
CREATE POLICY "rewards_insert_store"
ON public.rewards
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('rewards.manage')
);
CREATE POLICY "rewards_update_store"
ON public.rewards
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('rewards.manage')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('rewards.manage')
);
CREATE POLICY "rewards_delete_store"
ON public.rewards
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('rewards.manage')
);
DROP POLICY IF EXISTS "sales_select_store" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_store" ON public.sales;
DROP POLICY IF EXISTS "sales_update_store" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_store" ON public.sales;
CREATE POLICY "sales_select_store"
ON public.sales
FOR SELECT
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pdv.use')
);
CREATE POLICY "sales_insert_store"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pdv.use')
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.clients AS client
      WHERE client.id = sales.client_id
        AND client.user_id = public.get_current_store_owner_id()
    )
  )
);
CREATE POLICY "sales_update_store"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pdv.use')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pdv.use')
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.clients AS client
      WHERE client.id = sales.client_id
        AND client.user_id = public.get_current_store_owner_id()
    )
  )
);
CREATE POLICY "sales_delete_store"
ON public.sales
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('pdv.use')
);
DROP POLICY IF EXISTS "sale_items_select_store" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_insert_store" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_update_store" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete_store" ON public.sale_items;
CREATE POLICY "sale_items_select_store"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  public.current_store_has_feature('pdv.use')
  AND EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.id = sale_items.sale_id
      AND sale.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "sale_items_insert_store"
ON public.sale_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_store_has_feature('pdv.use')
  AND EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.id = sale_items.sale_id
      AND sale.user_id = public.get_current_store_owner_id()
  )
  AND (
    product_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.products AS product
      WHERE product.id = sale_items.product_id
        AND product.user_id = public.get_current_store_owner_id()
    )
  )
);
CREATE POLICY "sale_items_update_store"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (
  public.current_store_has_feature('pdv.use')
  AND EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.id = sale_items.sale_id
      AND sale.user_id = public.get_current_store_owner_id()
  )
)
WITH CHECK (
  public.current_store_has_feature('pdv.use')
  AND EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.id = sale_items.sale_id
      AND sale.user_id = public.get_current_store_owner_id()
  )
  AND (
    product_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.products AS product
      WHERE product.id = sale_items.product_id
        AND product.user_id = public.get_current_store_owner_id()
    )
  )
);
CREATE POLICY "sale_items_delete_store"
ON public.sale_items
FOR DELETE
TO authenticated
USING (
  public.current_store_has_feature('pdv.use')
  AND EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.id = sale_items.sale_id
      AND sale.user_id = public.get_current_store_owner_id()
  )
);
DROP POLICY IF EXISTS "stock_movements_select_store" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_store" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_update_store" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_delete_store" ON public.stock_movements;
CREATE POLICY "stock_movements_select_store"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('stock.manage')
);
CREATE POLICY "stock_movements_insert_store"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('stock.manage')
  AND EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = stock_movements.product_id
      AND product.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "stock_movements_update_store"
ON public.stock_movements
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('stock.manage')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('stock.manage')
  AND EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = stock_movements.product_id
      AND product.user_id = public.get_current_store_owner_id()
  )
);
CREATE POLICY "stock_movements_delete_store"
ON public.stock_movements
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('stock.manage')
);
DROP POLICY IF EXISTS "expenses_select_store" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_store" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_store" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_store" ON public.expenses;
CREATE POLICY "expenses_select_store"
ON public.expenses
FOR SELECT
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('financial.manage')
);
CREATE POLICY "expenses_insert_store"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('financial.manage')
);
CREATE POLICY "expenses_update_store"
ON public.expenses
FOR UPDATE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('financial.manage')
)
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('financial.manage')
);
CREATE POLICY "expenses_delete_store"
ON public.expenses
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('financial.manage')
);
DROP POLICY IF EXISTS "store_fiscal_settings_select_admin_store" ON public.store_fiscal_settings;
DROP POLICY IF EXISTS "store_fiscal_settings_insert_admin_store" ON public.store_fiscal_settings;
DROP POLICY IF EXISTS "store_fiscal_settings_update_admin_store" ON public.store_fiscal_settings;
CREATE POLICY "store_fiscal_settings_select_admin_store"
ON public.store_fiscal_settings
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('settings.manage')
);
CREATE POLICY "store_fiscal_settings_insert_admin_store"
ON public.store_fiscal_settings
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('settings.manage')
);
CREATE POLICY "store_fiscal_settings_update_admin_store"
ON public.store_fiscal_settings
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('settings.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('settings.manage')
);
DROP POLICY IF EXISTS "fiscal_documents_select_store" ON public.fiscal_documents;
DROP POLICY IF EXISTS "fiscal_documents_insert_admin_store" ON public.fiscal_documents;
DROP POLICY IF EXISTS "fiscal_documents_update_admin_store" ON public.fiscal_documents;
CREATE POLICY "fiscal_documents_select_store"
ON public.fiscal_documents
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('fiscal.manage')
);
CREATE POLICY "fiscal_documents_insert_admin_store"
ON public.fiscal_documents
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('fiscal.manage')
);
CREATE POLICY "fiscal_documents_update_admin_store"
ON public.fiscal_documents
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('fiscal.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
  AND public.current_store_has_feature('fiscal.manage')
);
