CREATE TABLE public.food_menu_addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_product_id uuid NOT NULL REFERENCES public.food_menu_products(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  required boolean NOT NULL DEFAULT false,
  min_select smallint NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select smallint NOT NULL DEFAULT 1 CHECK (max_select BETWEEN 1 AND 20),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_select <= max_select)
);
CREATE TABLE public.food_menu_addon_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_group_id uuid NOT NULL REFERENCES public.food_menu_addon_groups(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 100),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.food_order_item_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES public.food_order_items(id) ON DELETE CASCADE,
  addon_option_id uuid REFERENCES public.food_menu_addon_options(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  total numeric(12,2) NOT NULL CHECK (total = round(unit_price * quantity, 2)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX food_menu_addon_groups_product_idx ON public.food_menu_addon_groups(menu_product_id, active, sort_order);
CREATE INDEX food_menu_addon_options_group_idx ON public.food_menu_addon_options(addon_group_id, active, sort_order);
CREATE INDEX food_order_item_addons_item_idx ON public.food_order_item_addons(order_item_id);

ALTER TABLE public.food_menu_addon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_menu_addon_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_menu_addon_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_menu_addon_options FORCE ROW LEVEL SECURITY;
ALTER TABLE public.food_order_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_order_item_addons FORCE ROW LEVEL SECURITY;

CREATE POLICY food_addon_groups_admin ON public.food_menu_addon_groups FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.food_menu_products menu WHERE menu.id = food_menu_addon_groups.menu_product_id AND public.food_current_scope_matches(menu.owner_user_id, menu.store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage')))
WITH CHECK (EXISTS (SELECT 1 FROM public.food_menu_products menu WHERE menu.id = food_menu_addon_groups.menu_product_id AND public.food_current_scope_matches(menu.owner_user_id, menu.store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage')));
CREATE POLICY food_addon_options_admin ON public.food_menu_addon_options FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.food_menu_addon_groups addon_group JOIN public.food_menu_products menu ON menu.id = addon_group.menu_product_id WHERE addon_group.id = food_menu_addon_options.addon_group_id AND public.food_current_scope_matches(menu.owner_user_id, menu.store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage')))
WITH CHECK (EXISTS (SELECT 1 FROM public.food_menu_addon_groups addon_group JOIN public.food_menu_products menu ON menu.id = addon_group.menu_product_id WHERE addon_group.id = food_menu_addon_options.addon_group_id AND public.food_current_scope_matches(menu.owner_user_id, menu.store_account_id) AND public.current_user_has_erp_permission('food.qrmenu.manage')));
CREATE POLICY food_order_item_addons_staff_read ON public.food_order_item_addons FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.food_order_items item WHERE item.id = food_order_item_addons.order_item_id AND public.food_current_scope_matches(item.owner_user_id, item.store_account_id) AND public.food_can_view()));

COMMENT ON TABLE public.food_menu_addon_groups IS 'Grupos de adicionais configurados pelo administrador para um produto do QR Menu.';
