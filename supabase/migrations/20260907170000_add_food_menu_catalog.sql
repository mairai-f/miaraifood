-- Vitrine do QR Menu: complemento do produto ERP, sem duplicar preco ou estoque.
CREATE TABLE public.food_menu_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_account_id, product_id)
);
CREATE INDEX food_menu_products_public_idx ON public.food_menu_products(store_account_id, active, featured, sort_order);

-- Produtos ja cadastrados continuam aparecendo no QR Menu; o administrador
-- passa a enriquecê-los com foto, descricao e destaque sem recadastro.
INSERT INTO public.food_menu_products (store_account_id, owner_user_id, product_id)
SELECT account.id, product.user_id, product.id
FROM public.products product
JOIN public.store_accounts account
  ON account.owner_user_id = product.user_id AND account.product_context = 'happycash'
WHERE NOT product.deleted
ON CONFLICT (store_account_id, product_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validate_food_menu_product_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.products product
    WHERE product.id = NEW.product_id AND product.user_id = NEW.owner_user_id AND NOT product.deleted
  ) THEN RAISE EXCEPTION 'O produto do QR Menu deve pertencer a empresa e estar ativo.'; END IF;
  NEW.description := left(trim(NEW.description), 600);
  NEW.image_url := left(trim(NEW.image_url), 2000);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS assign_food_menu_product_scope ON public.food_menu_products;
CREATE TRIGGER assign_food_menu_product_scope BEFORE INSERT ON public.food_menu_products
FOR EACH ROW EXECUTE FUNCTION public.assign_food_current_scope();
DROP TRIGGER IF EXISTS validate_food_menu_product_scope ON public.food_menu_products;
CREATE TRIGGER validate_food_menu_product_scope BEFORE INSERT OR UPDATE ON public.food_menu_products
FOR EACH ROW EXECUTE FUNCTION public.validate_food_menu_product_scope();
DROP TRIGGER IF EXISTS food_touch_updated_at ON public.food_menu_products;
CREATE TRIGGER food_touch_updated_at BEFORE UPDATE ON public.food_menu_products
FOR EACH ROW EXECUTE FUNCTION public.food_touch_updated_at();

ALTER TABLE public.food_menu_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_menu_products FORCE ROW LEVEL SECURITY;
CREATE POLICY food_menu_products_admin ON public.food_menu_products FOR ALL TO authenticated
USING (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage'))
WITH CHECK (public.food_current_scope_matches(owner_user_id, store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage'));
REVOKE ALL ON FUNCTION public.validate_food_menu_product_scope() FROM PUBLIC;
