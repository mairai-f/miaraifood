-- Catálogo mínimo público do Marketplace. Somente dados publicados entram
-- nesta view; dados fiscais, proprietários e estoque permanecem isolados.
CREATE OR REPLACE VIEW public.miaifood_public_menu
WITH (security_invoker = false) AS
SELECT
  menu.id AS menu_id,
  menu.store_account_id AS restaurant_id,
  account.nome_estabelecimento AS restaurant_name,
  account.tipo_estabelecimento AS segment,
  account.cidade AS city,
  account.estado AS state,
  menu.product_id,
  product.name,
  product.category,
  product.price,
  menu.description,
  menu.image_url,
  menu.featured,
  menu.sort_order
FROM public.food_menu_products menu
JOIN public.products product ON product.id = menu.product_id
JOIN public.store_accounts account ON account.id = menu.store_account_id
WHERE menu.active = true;

GRANT SELECT ON public.miaifood_public_menu TO anon, authenticated;
