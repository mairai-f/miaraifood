ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('admin', 'operator'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_owner_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_created_by_user_id_fkey
      FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;
UPDATE public.profiles AS profile
SET
  owner_user_id = COALESCE(profile.owner_user_id, profile.user_id),
  email = COALESCE(profile.email, auth_user.email)
FROM auth.users AS auth_user
WHERE auth_user.id = profile.user_id;
ALTER TABLE public.profiles
  ALTER COLUMN owner_user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_owner_user_id_idx ON public.profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
CREATE OR REPLACE FUNCTION public.get_current_store_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE COALESCE(
      (SELECT owner_user_id FROM public.profiles WHERE user_id = auth.uid()),
      auth.uid()
    )
  END
$$;
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE COALESCE(
      (SELECT role FROM public.profiles WHERE user_id = auth.uid()),
      'admin'
    )
  END
$$;
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_current_user_role() = 'admin'
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  metadata_role text;
  metadata_owner_user_id uuid;
  metadata_created_by_user_id uuid;
BEGIN
  metadata_role := CASE
    WHEN lower(COALESCE(NEW.raw_user_meta_data->>'role', 'admin')) = 'operator' THEN 'operator'
    ELSE 'admin'
  END;

  metadata_owner_user_id := NULLIF(NEW.raw_user_meta_data->>'owner_user_id', '')::uuid;
  metadata_created_by_user_id := NULLIF(NEW.raw_user_meta_data->>'created_by_user_id', '')::uuid;

  INSERT INTO public.profiles (user_id, username, email, role, owner_user_id, created_by_user_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email),
    NEW.email,
    metadata_role,
    COALESCE(metadata_owner_user_id, NEW.id),
    metadata_created_by_user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operator_name text NOT NULL,
  opened_by_name text NOT NULL,
  opening_amount numeric(10,2) NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by_name text,
  closing_balance numeric(10,2),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cash_sessions_select_store" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_insert_store" ON public.cash_sessions;
DROP POLICY IF EXISTS "cash_sessions_update_store" ON public.cash_sessions;
CREATE POLICY "cash_sessions_select_store"
ON public.cash_sessions
FOR SELECT
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());
CREATE POLICY "cash_sessions_insert_store"
ON public.cash_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND operator_user_id = auth.uid()
);
CREATE POLICY "cash_sessions_update_store"
ON public.cash_sessions
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (operator_user_id = auth.uid() OR public.current_user_is_admin())
)
WITH CHECK (owner_user_id = public.get_current_store_owner_id());
CREATE INDEX IF NOT EXISTS cash_sessions_owner_status_idx
  ON public.cash_sessions(owner_user_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS cash_sessions_operator_status_idx
  ON public.cash_sessions(operator_user_id, status, opened_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_operator_idx
  ON public.cash_sessions(operator_user_id)
  WHERE status = 'open';
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_store" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_store" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_store" ON public.profiles;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_store"
ON public.profiles
FOR SELECT
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());
CREATE POLICY "profiles_insert_store"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND (auth.uid() = user_id OR public.current_user_is_admin())
);
CREATE POLICY "profiles_update_store"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND (auth.uid() = user_id OR public.current_user_is_admin())
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND (auth.uid() = user_id OR public.current_user_is_admin())
);
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
DROP POLICY IF EXISTS "clients_insert_own" ON public.clients;
DROP POLICY IF EXISTS "clients_update_own" ON public.clients;
DROP POLICY IF EXISTS "clients_delete_own" ON public.clients;
CREATE POLICY "clients_select_store"
ON public.clients
FOR SELECT
TO authenticated
USING (user_id = public.get_current_store_owner_id());
CREATE POLICY "clients_insert_store"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.get_current_store_owner_id());
CREATE POLICY "clients_update_store"
ON public.clients
FOR UPDATE
TO authenticated
USING (user_id = public.get_current_store_owner_id())
WITH CHECK (user_id = public.get_current_store_owner_id());
CREATE POLICY "clients_delete_store"
ON public.clients
FOR DELETE
TO authenticated
USING (user_id = public.get_current_store_owner_id());
DROP POLICY IF EXISTS "products_select_own" ON public.products;
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
DROP POLICY IF EXISTS "products_update_own" ON public.products;
DROP POLICY IF EXISTS "products_delete_own" ON public.products;
CREATE POLICY "products_select_store"
ON public.products
FOR SELECT
TO authenticated
USING (user_id = public.get_current_store_owner_id());
CREATE POLICY "products_insert_store"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);
CREATE POLICY "products_update_store"
ON public.products
FOR UPDATE
TO authenticated
USING (user_id = public.get_current_store_owner_id())
WITH CHECK (user_id = public.get_current_store_owner_id());
CREATE POLICY "products_delete_store"
ON public.products
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);
DROP POLICY IF EXISTS "debt_entries_select_own" ON public.debt_entries;
DROP POLICY IF EXISTS "debt_entries_insert_own" ON public.debt_entries;
DROP POLICY IF EXISTS "debt_entries_update_own" ON public.debt_entries;
DROP POLICY IF EXISTS "debt_entries_delete_own" ON public.debt_entries;
CREATE POLICY "debt_entries_select_store"
ON public.debt_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
  EXISTS (
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
  EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = debt_entries.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
)
WITH CHECK (
  EXISTS (
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
  EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = debt_entries.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
DROP POLICY IF EXISTS "payments_update_own" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_own" ON public.payments;
CREATE POLICY "payments_select_store"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
  EXISTS (
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
  EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = payments.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
)
WITH CHECK (
  EXISTS (
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
  EXISTS (
    SELECT 1
    FROM public.clients AS client
    WHERE client.id = payments.client_id
      AND client.user_id = public.get_current_store_owner_id()
  )
);
DROP POLICY IF EXISTS "rewards_select_own" ON public.rewards;
DROP POLICY IF EXISTS "rewards_insert_own" ON public.rewards;
DROP POLICY IF EXISTS "rewards_update_own" ON public.rewards;
DROP POLICY IF EXISTS "rewards_delete_own" ON public.rewards;
CREATE POLICY "rewards_select_store"
ON public.rewards
FOR SELECT
TO authenticated
USING (user_id = public.get_current_store_owner_id());
CREATE POLICY "rewards_insert_store"
ON public.rewards
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);
CREATE POLICY "rewards_update_store"
ON public.rewards
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
CREATE POLICY "rewards_delete_store"
ON public.rewards
FOR DELETE
TO authenticated
USING (
  user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);
DROP POLICY IF EXISTS "sales_select_own" ON public.sales;
DROP POLICY IF EXISTS "sales_insert_own" ON public.sales;
DROP POLICY IF EXISTS "sales_update_own" ON public.sales;
DROP POLICY IF EXISTS "sales_delete_own" ON public.sales;
CREATE POLICY "sales_select_store"
ON public.sales
FOR SELECT
TO authenticated
USING (user_id = public.get_current_store_owner_id());
CREATE POLICY "sales_insert_store"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
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
USING (user_id = public.get_current_store_owner_id())
WITH CHECK (
  user_id = public.get_current_store_owner_id()
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
USING (user_id = public.get_current_store_owner_id());
DROP POLICY IF EXISTS "sale_items_select_own" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_insert_own" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_update_own" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_delete_own" ON public.sale_items;
CREATE POLICY "sale_items_select_store"
ON public.sale_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
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
  EXISTS (
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
  EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.id = sale_items.sale_id
      AND sale.user_id = public.get_current_store_owner_id()
  )
)
WITH CHECK (
  EXISTS (
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
  EXISTS (
    SELECT 1
    FROM public.sales AS sale
    WHERE sale.id = sale_items.sale_id
      AND sale.user_id = public.get_current_store_owner_id()
  )
);
DROP POLICY IF EXISTS "stock_movements_select_own" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert_own" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_update_own" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_delete_own" ON public.stock_movements;
CREATE POLICY "stock_movements_select_store"
ON public.stock_movements
FOR SELECT
TO authenticated
USING (user_id = public.get_current_store_owner_id());
CREATE POLICY "stock_movements_insert_store"
ON public.stock_movements
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = public.get_current_store_owner_id()
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
USING (user_id = public.get_current_store_owner_id())
WITH CHECK (
  user_id = public.get_current_store_owner_id()
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
USING (user_id = public.get_current_store_owner_id());
DROP POLICY IF EXISTS "expenses_select_own" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert_own" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update_own" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete_own" ON public.expenses;
CREATE POLICY "expenses_select_store"
ON public.expenses
FOR SELECT
TO authenticated
USING (user_id = public.get_current_store_owner_id());
CREATE POLICY "expenses_insert_store"
ON public.expenses
FOR INSERT
TO authenticated
WITH CHECK (user_id = public.get_current_store_owner_id());
CREATE POLICY "expenses_update_store"
ON public.expenses
FOR UPDATE
TO authenticated
USING (user_id = public.get_current_store_owner_id())
WITH CHECK (user_id = public.get_current_store_owner_id());
CREATE POLICY "expenses_delete_store"
ON public.expenses
FOR DELETE
TO authenticated
USING (user_id = public.get_current_store_owner_id());
