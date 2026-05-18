CREATE TABLE IF NOT EXISTS public.restaurant_public_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL UNIQUE REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  receipt_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  logo_url text,
  cover_url text,
  phone text NOT NULL DEFAULT '',
  whatsapp text NOT NULL DEFAULT '',
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  accepts_dine_in boolean NOT NULL DEFAULT true,
  accepts_delivery boolean NOT NULL DEFAULT true,
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  minimum_order_amount numeric(10,2) NOT NULL DEFAULT 0 CHECK (minimum_order_amount >= 0),
  estimated_delivery_minutes integer NOT NULL DEFAULT 45 CHECK (estimated_delivery_minutes > 0),
  is_open boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_public_profiles_slug_format
    CHECK (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

ALTER TABLE public.restaurant_menu_categories
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE public.restaurant_menu_items
  ADD COLUMN IF NOT EXISTS price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(10,2) CHECK (compare_at_price IS NULL OR compare_at_price >= 0),
  ADD COLUMN IF NOT EXISTS image_alt text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_for_dine_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS available_for_delivery boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.restaurant_menu_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.restaurant_menu_items(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  badge_label text NOT NULL DEFAULT 'Oferta',
  discount_type text NOT NULL DEFAULT 'amount' CHECK (discount_type IN ('amount', 'percent', 'fixed_price')),
  discount_value numeric(10,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  active boolean NOT NULL DEFAULT true,
  show_on_menu boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_menu_promotions_date_range
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE IF NOT EXISTS public.restaurant_menu_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  number text NOT NULL DEFAULT '',
  complement text NOT NULL DEFAULT '',
  neighborhood text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, store_account_id)
);

CREATE INDEX IF NOT EXISTS restaurant_public_profiles_slug_idx
  ON public.restaurant_public_profiles(public_slug)
  WHERE active;

CREATE INDEX IF NOT EXISTS restaurant_menu_categories_public_idx
  ON public.restaurant_menu_categories(store_account_id, active, qr_visible, sort_order);

CREATE INDEX IF NOT EXISTS restaurant_menu_items_public_idx
  ON public.restaurant_menu_items(store_account_id, active, qr_visible, featured, sort_order);

CREATE INDEX IF NOT EXISTS clients_owner_phone_idx
  ON public.clients(user_id, phone)
  WHERE deleted = false;

CREATE INDEX IF NOT EXISTS restaurant_menu_promotions_public_idx
  ON public.restaurant_menu_promotions(store_account_id, active, show_on_menu, starts_at, ends_at, sort_order);

CREATE INDEX IF NOT EXISTS restaurant_menu_customers_store_email_idx
  ON public.restaurant_menu_customers(store_account_id, lower(email));

DROP TRIGGER IF EXISTS touch_restaurant_public_profiles_updated_at ON public.restaurant_public_profiles;
CREATE TRIGGER touch_restaurant_public_profiles_updated_at
BEFORE UPDATE ON public.restaurant_public_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_public_profiles ON public.restaurant_public_profiles;
CREATE TRIGGER assign_store_account_id_restaurant_public_profiles
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_public_profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS touch_restaurant_menu_promotions_updated_at ON public.restaurant_menu_promotions;
CREATE TRIGGER touch_restaurant_menu_promotions_updated_at
BEFORE UPDATE ON public.restaurant_menu_promotions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_menu_promotions ON public.restaurant_menu_promotions;
CREATE TRIGGER assign_store_account_id_restaurant_menu_promotions
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_menu_promotions
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

DROP TRIGGER IF EXISTS touch_restaurant_menu_customers_updated_at ON public.restaurant_menu_customers;
CREATE TRIGGER touch_restaurant_menu_customers_updated_at
BEFORE UPDATE ON public.restaurant_menu_customers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS assign_store_account_id_restaurant_menu_customers ON public.restaurant_menu_customers;
CREATE TRIGGER assign_store_account_id_restaurant_menu_customers
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id ON public.restaurant_menu_customers
FOR EACH ROW
EXECUTE FUNCTION public.assign_store_account_id_from_owner();

ALTER TABLE public.restaurant_public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_public_profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.restaurant_menu_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_promotions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.restaurant_menu_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_menu_customers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_public_profiles_store_select" ON public.restaurant_public_profiles;
CREATE POLICY "restaurant_public_profiles_store_select"
ON public.restaurant_public_profiles
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
  AND public.current_store_has_feature('restaurant.qr_menu')
);

DROP POLICY IF EXISTS "restaurant_public_profiles_store_insert" ON public.restaurant_public_profiles;
CREATE POLICY "restaurant_public_profiles_store_insert"
ON public.restaurant_public_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
  AND public.current_store_has_feature('restaurant.qr_menu')
);

DROP POLICY IF EXISTS "restaurant_menu_promotions_store_all" ON public.restaurant_menu_promotions;
CREATE POLICY "restaurant_menu_promotions_store_all"
ON public.restaurant_menu_promotions
FOR ALL
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
  AND public.current_store_has_feature('restaurant.qr_menu')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
  AND public.current_store_has_feature('restaurant.qr_menu')
);

DROP POLICY IF EXISTS "restaurant_menu_customers_self_select" ON public.restaurant_menu_customers;
CREATE POLICY "restaurant_menu_customers_self_select"
ON public.restaurant_menu_customers
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "restaurant_menu_customers_self_insert" ON public.restaurant_menu_customers;
CREATE POLICY "restaurant_menu_customers_self_insert"
ON public.restaurant_menu_customers
FOR INSERT
TO authenticated
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "restaurant_menu_customers_self_update" ON public.restaurant_menu_customers;
CREATE POLICY "restaurant_menu_customers_self_update"
ON public.restaurant_menu_customers
FOR UPDATE
TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "restaurant_menu_customers_store_select" ON public.restaurant_menu_customers;
CREATE POLICY "restaurant_menu_customers_store_select"
ON public.restaurant_menu_customers
FOR SELECT
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
  AND public.current_store_has_feature('restaurant.qr_menu')
);

DROP POLICY IF EXISTS "restaurant_public_profiles_store_update" ON public.restaurant_public_profiles;
CREATE POLICY "restaurant_public_profiles_store_update"
ON public.restaurant_public_profiles
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
  AND public.current_store_has_feature('restaurant.qr_menu')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND store_account_id = public.get_current_store_account_id()
  AND public.current_store_has_feature('restaurant.qr_menu')
);

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'restaurant-menu-images',
  'restaurant-menu-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "restaurant_menu_images_public_read" ON storage.objects;
CREATE POLICY "restaurant_menu_images_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'restaurant-menu-images');

DROP POLICY IF EXISTS "restaurant_menu_images_insert_store" ON storage.objects;
CREATE POLICY "restaurant_menu_images_insert_store"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'restaurant-menu-images'
  AND (storage.foldername(name))[1] = public.get_current_store_account_id()::text
  AND public.current_store_has_feature('restaurant.qr_menu')
);

DROP POLICY IF EXISTS "restaurant_menu_images_update_store" ON storage.objects;
CREATE POLICY "restaurant_menu_images_update_store"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'restaurant-menu-images'
  AND (storage.foldername(name))[1] = public.get_current_store_account_id()::text
  AND public.current_store_has_feature('restaurant.qr_menu')
)
WITH CHECK (
  bucket_id = 'restaurant-menu-images'
  AND (storage.foldername(name))[1] = public.get_current_store_account_id()::text
  AND public.current_store_has_feature('restaurant.qr_menu')
);

DROP POLICY IF EXISTS "restaurant_menu_images_delete_store" ON storage.objects;
CREATE POLICY "restaurant_menu_images_delete_store"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'restaurant-menu-images'
  AND (storage.foldername(name))[1] = public.get_current_store_account_id()::text
  AND public.current_store_has_feature('restaurant.qr_menu')
);
