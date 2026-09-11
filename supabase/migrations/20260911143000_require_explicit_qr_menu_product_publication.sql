-- QR Menu e estoque são catálogos distintos. Um produto só aparece para a
-- mesa após o gestor publicá-lo explicitamente em Configurações > QR Menu.
ALTER TABLE public.food_menu_products
  ALTER COLUMN active SET DEFAULT false;

-- A versão inicial do QR Menu materializou todos os produtos do estoque como
-- ativos. Mantemos os metadados (foto, descrição e ordem), mas retiramos a
-- publicação até que o estabelecimento escolha cada item do cardápio.
UPDATE public.food_menu_products
SET active = false,
    featured = false,
    updated_at = now()
WHERE active = true OR featured = true;

COMMENT ON COLUMN public.food_menu_products.active IS
  'Publicação explícita no QR Menu. Produtos do estoque permanecem ocultos por padrão.';
