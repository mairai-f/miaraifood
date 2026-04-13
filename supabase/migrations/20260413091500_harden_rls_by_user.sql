ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS user_id uuid;

ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$
DECLARE
  inferred_owner_id uuid;
  missing_product_count integer;
  missing_reward_count integer;
BEGIN
  SELECT CASE WHEN count(*) = 1 THEN min(owner_id) ELSE NULL END
  INTO inferred_owner_id
  FROM (
    SELECT DISTINCT user_id AS owner_id FROM public.clients
    UNION
    SELECT DISTINCT user_id AS owner_id FROM public.sales
    UNION
    SELECT DISTINCT user_id AS owner_id FROM public.stock_movements
    UNION
    SELECT DISTINCT user_id AS owner_id FROM public.expenses
    UNION
    SELECT DISTINCT user_id AS owner_id FROM public.profiles
  ) AS owners;

  WITH product_owner_from_stock AS (
    SELECT
      sm.product_id,
      min(sm.user_id) AS user_id
    FROM public.stock_movements AS sm
    GROUP BY sm.product_id
    HAVING count(DISTINCT sm.user_id) = 1
  )
  UPDATE public.products AS p
  SET user_id = source.user_id
  FROM product_owner_from_stock AS source
  WHERE p.id = source.product_id
    AND p.user_id IS NULL;

  WITH product_owner_from_sales AS (
    SELECT
      si.product_id,
      min(s.user_id) AS user_id
    FROM public.sale_items AS si
    JOIN public.sales AS s
      ON s.id = si.sale_id
    WHERE si.product_id IS NOT NULL
    GROUP BY si.product_id
    HAVING count(DISTINCT s.user_id) = 1
  )
  UPDATE public.products AS p
  SET user_id = source.user_id
  FROM product_owner_from_sales AS source
  WHERE p.id = source.product_id
    AND p.user_id IS NULL;

  WITH product_owner_from_debts AS (
    SELECT
      de.product_id,
      min(c.user_id) AS user_id
    FROM public.debt_entries AS de
    JOIN public.clients AS c
      ON c.id = de.client_id
    GROUP BY de.product_id
    HAVING count(DISTINCT c.user_id) = 1
  )
  UPDATE public.products AS p
  SET user_id = source.user_id
  FROM product_owner_from_debts AS source
  WHERE p.id = source.product_id
    AND p.user_id IS NULL;

  IF inferred_owner_id IS NOT NULL THEN
    UPDATE public.products
    SET user_id = inferred_owner_id
    WHERE user_id IS NULL;

    UPDATE public.rewards
    SET user_id = inferred_owner_id
    WHERE user_id IS NULL;
  END IF;

  SELECT count(*) INTO missing_product_count
  FROM public.products
  WHERE user_id IS NULL;

  SELECT count(*) INTO missing_reward_count
  FROM public.rewards
  WHERE user_id IS NULL;

  IF missing_product_count > 0 OR missing_reward_count > 0 THEN
    RAISE EXCEPTION
      'Could not infer user_id for % product(s) and % reward(s). Backfill those rows before applying this migration.',
      missing_product_count,
      missing_reward_count;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_user_id_fkey'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rewards_user_id_fkey'
  ) THEN
    ALTER TABLE public.rewards
      ADD CONSTRAINT rewards_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.products
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.rewards
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS products_user_id_idx ON public.products(user_id);
CREATE INDEX IF NOT EXISTS sales_user_id_idx ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS stock_movements_user_id_idx ON public.stock_movements(user_id);
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS rewards_user_id_idx ON public.rewards(user_id);
CREATE INDEX IF NOT EXISTS debt_entries_client_id_idx ON public.debt_entries(client_id);
CREATE INDEX IF NOT EXISTS payments_client_id_idx ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON public.sale_items(sale_id);

ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.debt_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rewards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sales FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.expenses FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;

DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

DROP POLICY IF EXISTS "Authenticated users can view debt_entries" ON public.debt_entries;
DROP POLICY IF EXISTS "Authenticated users can insert debt_entries" ON public.debt_entries;
DROP POLICY IF EXISTS "Authenticated users can update debt_entries" ON public.debt_entries;
DROP POLICY IF EXISTS "Authenticated users can delete debt_entries" ON public.debt_entries;

DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON public.payments;

DROP POLICY IF EXISTS "Authenticated users can view rewards" ON public.rewards;
DROP POLICY IF EXISTS "Authenticated users can insert rewards" ON public.rewards;
DROP POLICY IF EXISTS "Authenticated users can update rewards" ON public.rewards;
DROP POLICY IF EXISTS "Authenticated users can delete rewards" ON public.rewards;

DROP POLICY IF EXISTS "Auth users can view sales" ON public.sales;
DROP POLICY IF EXISTS "Auth users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Auth users can update sales" ON public.sales;
DROP POLICY IF EXISTS "Auth users can delete sales" ON public.sales;

DROP POLICY IF EXISTS "Auth users can view sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Auth users can insert sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Auth users can update sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Auth users can delete sale_items" ON public.sale_items;

DROP POLICY IF EXISTS "Auth users can view stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Auth users can insert stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Auth users can update stock_movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Auth users can delete stock_movements" ON public.stock_movements;

DROP POLICY IF EXISTS "Auth users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Auth users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Auth users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Auth users can delete expenses" ON public.expenses;

CREATE POLICY "clients_select_own"
ON public.clients
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "clients_insert_own"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "clients_update_own"
ON public.clients
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "clients_delete_own"
ON public.clients
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "products_select_own"
ON public.products
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "products_insert_own"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "products_update_own"
ON public.products
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "products_delete_own"
ON public.products
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "debt_entries_select_own"
ON public.debt_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = debt_entries.client_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "debt_entries_insert_own"
ON public.debt_entries
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = debt_entries.client_id
      AND c.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = debt_entries.product_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "debt_entries_update_own"
ON public.debt_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = debt_entries.client_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = debt_entries.client_id
      AND c.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = debt_entries.product_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "debt_entries_delete_own"
ON public.debt_entries
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = debt_entries.client_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "payments_select_own"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = payments.client_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "payments_insert_own"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = payments.client_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "payments_update_own"
ON public.payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = payments.client_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = payments.client_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "payments_delete_own"
ON public.payments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients AS c
    WHERE c.id = payments.client_id
      AND c.user_id = auth.uid()
  )
);

CREATE POLICY "rewards_select_own"
ON public.rewards
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "rewards_insert_own"
ON public.rewards
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "rewards_update_own"
ON public.rewards
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "rewards_delete_own"
ON public.rewards
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "sales_select_own"
ON public.sales
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "sales_insert_own"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.clients AS c
      WHERE c.id = sales.client_id
        AND c.user_id = auth.uid()
    )
  )
);

CREATE POLICY "sales_update_own"
ON public.sales
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    client_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.clients AS c
      WHERE c.id = sales.client_id
        AND c.user_id = auth.uid()
    )
  )
);

CREATE POLICY "sales_delete_own"
ON public.sales
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "sale_items_select_own"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales AS s
    WHERE s.id = sale_items.sale_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "sale_items_insert_own"
ON public.sale_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales AS s
    WHERE s.id = sale_items.sale_id
      AND s.user_id = auth.uid()
  )
  AND (
    product_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.products AS p
      WHERE p.id = sale_items.product_id
        AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "sale_items_update_own"
ON public.sale_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales AS s
    WHERE s.id = sale_items.sale_id
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales AS s
    WHERE s.id = sale_items.sale_id
      AND s.user_id = auth.uid()
  )
  AND (
    product_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.products AS p
      WHERE p.id = sale_items.product_id
        AND p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "sale_items_delete_own"
ON public.sale_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales AS s
    WHERE s.id = sale_items.sale_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "stock_movements_select_own"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "stock_movements_insert_own"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = stock_movements.product_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "stock_movements_update_own"
ON public.stock_movements
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = stock_movements.product_id
      AND p.user_id = auth.uid()
  )
);

CREATE POLICY "stock_movements_delete_own"
ON public.stock_movements
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "expenses_select_own"
ON public.expenses
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "expenses_insert_own"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_update_own"
ON public.expenses
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "expenses_delete_own"
ON public.expenses
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
