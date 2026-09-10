-- Catálogo inicial para empresas que selecionam o segmento Mercado.
-- A função é idempotente: não duplica produtos já existentes na mesma categoria.

CREATE OR REPLACE FUNCTION public.seed_market_starter_catalog(
  p_store_account_id uuid,
  p_owner_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seed_item record;
  department_uuid uuid;
  unit_uuid uuid;
  inserted_count integer := 0;
BEGIN
  INSERT INTO public.measurement_units (
    store_account_id, owner_user_id, code, name, symbol, decimal_places
  ) VALUES
    (p_store_account_id, p_owner_user_id, 'UN', 'Unidade', 'UN', 0),
    (p_store_account_id, p_owner_user_id, 'KG', 'Quilograma', 'KG', 3),
    (p_store_account_id, p_owner_user_id, 'PCT', 'Pacote', 'PCT', 0)
  ON CONFLICT (store_account_id, code) DO UPDATE
  SET name = EXCLUDED.name, symbol = EXCLUDED.symbol, decimal_places = EXCLUDED.decimal_places;

  FOR seed_item IN
    SELECT *
    FROM (VALUES
    ('MKT01', 'Mercearia', 'Arroz 1kg', 'UN', 7.99::numeric),
    ('MKT01', 'Mercearia', 'Arroz 5kg', 'UN', 32.90::numeric),
    ('MKT01', 'Mercearia', 'Feijão Carioca 1kg', 'UN', 8.99::numeric),
    ('MKT01', 'Mercearia', 'Feijão Preto 1kg', 'UN', 9.49::numeric),
    ('MKT01', 'Mercearia', 'Açúcar 1kg', 'UN', 5.49::numeric),
    ('MKT01', 'Mercearia', 'Açúcar 5kg', 'UN', 24.90::numeric),
    ('MKT01', 'Mercearia', 'Sal Refinado 1kg', 'UN', 2.99::numeric),
    ('MKT01', 'Mercearia', 'Farinha de Trigo 1kg', 'UN', 6.49::numeric),
    ('MKT01', 'Mercearia', 'Farinha de Mandioca 500g', 'UN', 6.99::numeric),
    ('MKT01', 'Mercearia', 'Fubá 500g', 'UN', 4.49::numeric),
    ('MKT01', 'Mercearia', 'Milho para Pipoca 500g', 'UN', 5.99::numeric),
    ('MKT01', 'Mercearia', 'Lentilha 500g', 'UN', 8.99::numeric),
    ('MKT01', 'Mercearia', 'Grão-de-bico 500g', 'UN', 10.90::numeric),
    ('MKT01', 'Mercearia', 'Aveia 500g', 'UN', 8.49::numeric),
    ('MKT01', 'Mercearia', 'Amido de Milho 500g', 'UN', 7.99::numeric),
    ('MKT02', 'Massas e Molhos', 'Macarrão Espaguete 500g', 'UN', 4.99::numeric),
    ('MKT02', 'Massas e Molhos', 'Macarrão Parafuso 500g', 'UN', 5.49::numeric),
    ('MKT02', 'Massas e Molhos', 'Macarrão Penne 500g', 'UN', 5.99::numeric),
    ('MKT02', 'Massas e Molhos', 'Macarrão Instantâneo', 'UN', 2.49::numeric),
    ('MKT02', 'Massas e Molhos', 'Molho de Tomate 300g', 'UN', 2.99::numeric),
    ('MKT02', 'Massas e Molhos', 'Extrato de Tomate 300g', 'UN', 4.49::numeric),
    ('MKT02', 'Massas e Molhos', 'Lasanha Massa 500g', 'UN', 9.99::numeric),
    ('MKT03', 'Óleos e Temperos', 'Óleo de Soja 900ml', 'UN', 8.49::numeric),
    ('MKT03', 'Óleos e Temperos', 'Azeite 500ml', 'UN', 32.90::numeric),
    ('MKT03', 'Óleos e Temperos', 'Vinagre 750ml', 'UN', 4.99::numeric),
    ('MKT03', 'Óleos e Temperos', 'Tempero Completo 300g', 'UN', 6.99::numeric),
    ('MKT03', 'Óleos e Temperos', 'Pimenta-do-Reino 50g', 'UN', 6.49::numeric),
    ('MKT03', 'Óleos e Temperos', 'Orégano 20g', 'UN', 4.49::numeric),
    ('MKT03', 'Óleos e Temperos', 'Caldo de Tempero', 'UN', 3.99::numeric),
    ('MKT03', 'Óleos e Temperos', 'Alho Triturado 200g', 'UN', 8.99::numeric),
    ('MKT04', 'Café e Matinais', 'Café 250g', 'UN', 12.99::numeric),
    ('MKT04', 'Café e Matinais', 'Café 500g', 'UN', 24.90::numeric),
    ('MKT04', 'Café e Matinais', 'Achocolatado 400g', 'UN', 9.99::numeric),
    ('MKT04', 'Café e Matinais', 'Leite em Pó 400g', 'UN', 16.90::numeric),
    ('MKT04', 'Café e Matinais', 'Cereal Matinal 300g', 'UN', 13.90::numeric),
    ('MKT04', 'Café e Matinais', 'Cappuccino 200g', 'UN', 15.90::numeric),
    ('MKT04', 'Café e Matinais', 'Filtro de Café', 'UN', 5.99::numeric),
    ('MKT05', 'Leites e Laticínios', 'Leite Integral 1L', 'UN', 5.49::numeric),
    ('MKT05', 'Leites e Laticínios', 'Leite Desnatado 1L', 'UN', 5.79::numeric),
    ('MKT05', 'Leites e Laticínios', 'Leite Condensado 395g', 'UN', 7.49::numeric),
    ('MKT05', 'Leites e Laticínios', 'Creme de Leite 200g', 'UN', 3.99::numeric),
    ('MKT05', 'Leites e Laticínios', 'Margarina 500g', 'UN', 8.99::numeric),
    ('MKT05', 'Leites e Laticínios', 'Manteiga 200g', 'UN', 12.90::numeric),
    ('MKT05', 'Leites e Laticínios', 'Requeijão 200g', 'UN', 9.49::numeric),
    ('MKT05', 'Leites e Laticínios', 'Iogurte 170g', 'UN', 3.49::numeric),
    ('MKT05', 'Leites e Laticínios', 'Iogurte 1L', 'UN', 11.90::numeric),
    ('MKT05', 'Leites e Laticínios', 'Queijo Mussarela', 'KG', 49.90::numeric),
    ('MKT05', 'Leites e Laticínios', 'Queijo Prato', 'KG', 52.90::numeric),
    ('MKT06', 'Padaria', 'Pão Francês', 'KG', 18.90::numeric),
    ('MKT06', 'Padaria', 'Pão de Forma', 'UN', 9.99::numeric),
    ('MKT06', 'Padaria', 'Pão de Leite', 'UN', 8.99::numeric),
    ('MKT06', 'Padaria', 'Pão de Hambúrguer', 'UN', 8.49::numeric),
    ('MKT06', 'Padaria', 'Pão de Hot Dog', 'UN', 8.49::numeric),
    ('MKT06', 'Padaria', 'Bolo Simples', 'UN', 15.90::numeric),
    ('MKT06', 'Padaria', 'Rosca', 'UN', 9.90::numeric),
    ('MKT06', 'Padaria', 'Torrada', 'UN', 6.99::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Biscoito Recheado', 'UN', 3.99::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Biscoito Cream Cracker', 'UN', 5.49::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Biscoito Maisena', 'UN', 5.49::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Wafer', 'UN', 3.49::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Salgadinho Pequeno', 'UN', 3.99::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Salgadinho Grande', 'UN', 8.99::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Amendoim 200g', 'UN', 6.99::numeric),
    ('MKT07', 'Biscoitos e Snacks', 'Pipoca de Micro-ondas', 'UN', 4.99::numeric),
    ('MKT08', 'Doces', 'Chocolate Barra 80g', 'UN', 7.99::numeric),
    ('MKT08', 'Doces', 'Bombom', 'UN', 2.49::numeric),
    ('MKT08', 'Doces', 'Bala Pacote', 'UN', 6.99::numeric),
    ('MKT08', 'Doces', 'Chiclete', 'UN', 1.50::numeric),
    ('MKT08', 'Doces', 'Paçoca', 'UN', 1.50::numeric),
    ('MKT08', 'Doces', 'Pé de Moleque', 'UN', 2.49::numeric),
    ('MKT08', 'Doces', 'Doce de Leite 400g', 'UN', 9.99::numeric),
    ('MKT08', 'Doces', 'Gelatina', 'UN', 2.49::numeric),
    ('MKT09', 'Bebidas', 'Água Mineral 500ml', 'UN', 2.49::numeric),
    ('MKT09', 'Bebidas', 'Água Mineral 1,5L', 'UN', 4.49::numeric),
    ('MKT09', 'Bebidas', 'Refrigerante Lata 350ml', 'UN', 5.49::numeric),
    ('MKT09', 'Bebidas', 'Refrigerante 600ml', 'UN', 7.49::numeric),
    ('MKT09', 'Bebidas', 'Refrigerante 1L', 'UN', 8.99::numeric),
    ('MKT09', 'Bebidas', 'Refrigerante 2L', 'UN', 11.99::numeric),
    ('MKT09', 'Bebidas', 'Suco 1L', 'UN', 8.99::numeric),
    ('MKT09', 'Bebidas', 'Água de Coco 1L', 'UN', 10.90::numeric),
    ('MKT09', 'Bebidas', 'Energético 250ml', 'UN', 8.99::numeric),
    ('MKT09', 'Bebidas', 'Isotônico 500ml', 'UN', 6.99::numeric),
    ('MKT10', 'Hortifruti', 'Banana', 'KG', 7.99::numeric),
    ('MKT10', 'Hortifruti', 'Maçã', 'KG', 12.90::numeric),
    ('MKT10', 'Hortifruti', 'Laranja', 'KG', 6.99::numeric),
    ('MKT10', 'Hortifruti', 'Limão', 'KG', 7.99::numeric),
    ('MKT10', 'Hortifruti', 'Mamão', 'KG', 8.99::numeric),
    ('MKT10', 'Hortifruti', 'Manga', 'KG', 8.49::numeric),
    ('MKT10', 'Hortifruti', 'Tomate', 'KG', 9.99::numeric),
    ('MKT10', 'Hortifruti', 'Cebola', 'KG', 6.99::numeric),
    ('MKT10', 'Hortifruti', 'Batata', 'KG', 7.99::numeric),
    ('MKT10', 'Hortifruti', 'Cenoura', 'KG', 6.99::numeric),
    ('MKT10', 'Hortifruti', 'Pimentão', 'KG', 11.90::numeric),
    ('MKT10', 'Hortifruti', 'Abobrinha', 'KG', 7.49::numeric),
    ('MKT10', 'Hortifruti', 'Alface', 'UN', 4.49::numeric),
    ('MKT10', 'Hortifruti', 'Couve', 'UN', 4.99::numeric),
    ('MKT11', 'Açougue', 'Carne Moída', 'KG', 34.90::numeric),
    ('MKT11', 'Açougue', 'Acém', 'KG', 35.90::numeric),
    ('MKT11', 'Açougue', 'Coxão Mole', 'KG', 49.90::numeric),
    ('MKT11', 'Açougue', 'Patinho', 'KG', 47.90::numeric),
    ('MKT11', 'Açougue', 'Contrafilé', 'KG', 59.90::numeric),
    ('MKT11', 'Açougue', 'Frango Inteiro', 'KG', 12.90::numeric),
    ('MKT11', 'Açougue', 'Peito de Frango', 'KG', 18.90::numeric),
    ('MKT11', 'Açougue', 'Coxa e Sobrecoxa', 'KG', 13.90::numeric),
    ('MKT11', 'Açougue', 'Linguiça Toscana', 'KG', 22.90::numeric),
    ('MKT11', 'Açougue', 'Pernil Suíno', 'KG', 21.90::numeric),
    ('MKT11', 'Açougue', 'Bacon', 'KG', 36.90::numeric),
    ('MKT12', 'Frios', 'Presunto', 'KG', 32.90::numeric),
    ('MKT12', 'Frios', 'Mussarela', 'KG', 49.90::numeric),
    ('MKT12', 'Frios', 'Mortadela', 'KG', 22.90::numeric),
    ('MKT12', 'Frios', 'Salame', 'KG', 69.90::numeric),
    ('MKT12', 'Frios', 'Peito de Peru', 'KG', 54.90::numeric),
    ('MKT12', 'Frios', 'Salsicha', 'KG', 16.90::numeric),
    ('MKT13', 'Congelados', 'Hambúrguer Congelado', 'UN', 3.99::numeric),
    ('MKT13', 'Congelados', 'Nuggets 300g', 'UN', 13.90::numeric),
    ('MKT13', 'Congelados', 'Batata Frita Congelada 1kg', 'UN', 21.90::numeric),
    ('MKT13', 'Congelados', 'Pizza Congelada', 'UN', 17.90::numeric),
    ('MKT13', 'Congelados', 'Lasanha Congelada', 'UN', 16.90::numeric),
    ('MKT13', 'Congelados', 'Pão de Queijo 1kg', 'UN', 24.90::numeric),
    ('MKT13', 'Congelados', 'Polpa de Frutas', 'UN', 4.99::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Milho Verde', 'UN', 4.49::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Ervilha', 'UN', 4.49::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Sardinha', 'UN', 7.99::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Atum', 'UN', 9.99::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Seleta de Legumes', 'UN', 5.49::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Azeitona 200g', 'UN', 8.99::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Palmito 300g', 'UN', 19.90::numeric),
    ('MKT14', 'Enlatados e Conservas', 'Pepino em Conserva', 'UN', 9.99::numeric),
    ('MKT15', 'Higiene Pessoal', 'Papel Higiênico 4 Rolos', 'UN', 8.99::numeric),
    ('MKT15', 'Higiene Pessoal', 'Papel Higiênico 12 Rolos', 'UN', 19.90::numeric),
    ('MKT15', 'Higiene Pessoal', 'Sabonete', 'UN', 3.49::numeric),
    ('MKT15', 'Higiene Pessoal', 'Shampoo 350ml', 'UN', 13.90::numeric),
    ('MKT15', 'Higiene Pessoal', 'Condicionador 350ml', 'UN', 14.90::numeric),
    ('MKT15', 'Higiene Pessoal', 'Creme Dental 90g', 'UN', 6.99::numeric),
    ('MKT15', 'Higiene Pessoal', 'Escova Dental', 'UN', 7.99::numeric),
    ('MKT15', 'Higiene Pessoal', 'Desodorante', 'UN', 14.90::numeric),
    ('MKT15', 'Higiene Pessoal', 'Absorvente', 'UN', 8.99::numeric),
    ('MKT15', 'Higiene Pessoal', 'Aparelho de Barbear', 'UN', 6.99::numeric),
    ('MKT16', 'Limpeza', 'Detergente 500ml', 'UN', 2.99::numeric),
    ('MKT16', 'Limpeza', 'Sabão em Pó 800g', 'UN', 12.90::numeric),
    ('MKT16', 'Limpeza', 'Sabão Líquido 1L', 'UN', 15.90::numeric),
    ('MKT16', 'Limpeza', 'Amaciante 2L', 'UN', 11.90::numeric),
    ('MKT16', 'Limpeza', 'Água Sanitária 1L', 'UN', 4.99::numeric),
    ('MKT16', 'Limpeza', 'Desinfetante 2L', 'UN', 8.99::numeric),
    ('MKT16', 'Limpeza', 'Limpador Multiuso', 'UN', 6.99::numeric),
    ('MKT16', 'Limpeza', 'Esponja', 'UN', 2.49::numeric),
    ('MKT16', 'Limpeza', 'Sabão em Barra', 'UN', 2.99::numeric),
    ('MKT16', 'Limpeza', 'Saco de Lixo 30L', 'UN', 7.99::numeric),
    ('MKT16', 'Limpeza', 'Saco de Lixo 50L', 'UN', 9.99::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Papel Toalha', 'UN', 6.99::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Guardanapo', 'UN', 3.99::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Papel Alumínio', 'UN', 7.99::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Filme PVC', 'UN', 6.99::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Fósforo', 'UN', 3.49::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Vela', 'UN', 5.99::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Pilha AA', 'UN', 9.99::numeric),
    ('MKT17', 'Utilidades Domésticas', 'Pilha AAA', 'UN', 9.99::numeric),
    ('MKT18', 'Pet', 'Ração Cachorro 1kg', 'UN', 16.90::numeric),
    ('MKT18', 'Pet', 'Ração Cachorro 10kg', 'UN', 89.90::numeric),
    ('MKT18', 'Pet', 'Ração Gato 1kg', 'UN', 19.90::numeric),
    ('MKT18', 'Pet', 'Sachê Cachorro', 'UN', 3.49::numeric),
    ('MKT18', 'Pet', 'Sachê Gato', 'UN', 3.49::numeric),
    ('MKT18', 'Pet', 'Areia Sanitária 4kg', 'UN', 14.90::numeric),
    ('MKT19', 'Bebê', 'Fralda P', 'PCT', 34.90::numeric),
    ('MKT19', 'Bebê', 'Fralda M', 'PCT', 39.90::numeric),
    ('MKT19', 'Bebê', 'Fralda G', 'PCT', 42.90::numeric),
    ('MKT19', 'Bebê', 'Fralda XG', 'PCT', 44.90::numeric),
    ('MKT19', 'Bebê', 'Lenço Umedecido', 'UN', 12.90::numeric),
    ('MKT19', 'Bebê', 'Pomada para Assadura', 'UN', 14.90::numeric),
    ('MKT19', 'Bebê', 'Shampoo Infantil', 'UN', 15.90::numeric),
    ('MKT19', 'Bebê', 'Sabonete Infantil', 'UN', 5.99::numeric),
    ('MKT20', 'Molhos e Complementos', 'Ketchup 400g', 'UN', 7.99::numeric),
    ('MKT20', 'Molhos e Complementos', 'Maionese 500g', 'UN', 9.99::numeric),
    ('MKT20', 'Molhos e Complementos', 'Mostarda 200g', 'UN', 5.99::numeric),
    ('MKT20', 'Molhos e Complementos', 'Farofa Pronta 400g', 'UN', 7.99::numeric),
    ('MKT20', 'Molhos e Complementos', 'Leite de Coco 200ml', 'UN', 4.99::numeric),
    ('MKT20', 'Molhos e Complementos', 'Coco Ralado 100g', 'UN', 5.49::numeric),
    ('MKT20', 'Molhos e Complementos', 'Fermento Químico 100g', 'UN', 5.99::numeric)
    ) AS catalog(department_code, department_name, product_name, unit_code, suggested_price)
  LOOP
    INSERT INTO public.product_departments (
      store_account_id, owner_user_id, code, name
    ) VALUES (
      p_store_account_id, p_owner_user_id, seed_item.department_code, seed_item.department_name
    )
    ON CONFLICT (store_account_id, code) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id INTO department_uuid;

    SELECT id INTO unit_uuid
    FROM public.measurement_units
    WHERE store_account_id = p_store_account_id
      AND code = seed_item.unit_code
    LIMIT 1;

    IF NOT EXISTS (
      SELECT 1
      FROM public.products
      WHERE user_id = p_owner_user_id
        AND NOT deleted
        AND lower(trim(name)) = lower(trim(seed_item.product_name))
        AND lower(trim(category)) = lower(trim(seed_item.department_name))
    ) THEN
      INSERT INTO public.products (
        user_id, name, category, price, cost_price, stock, min_stock,
        control_stock, department_id, measurement_unit_id, product_kind
      ) VALUES (
        p_owner_user_id, seed_item.product_name, seed_item.department_name,
        seed_item.suggested_price, 0, 0, 0, true,
        department_uuid, unit_uuid, 'simple'
      );
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;

  RETURN inserted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_market_starter_catalog_for_new_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(trim(COALESCE(NEW.tipo_estabelecimento, ''))) IN ('mercado', 'supermercado', 'mercearia') THEN
    PERFORM public.seed_market_starter_catalog(NEW.id, NEW.owner_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_market_starter_catalog_for_new_store_trigger ON public.store_accounts;
CREATE TRIGGER seed_market_starter_catalog_for_new_store_trigger
AFTER INSERT ON public.store_accounts
FOR EACH ROW
EXECUTE FUNCTION public.seed_market_starter_catalog_for_new_store();

-- Aplica o catálogo às lojas Mercado já criadas, sem sobrescrever produtos próprios.
SELECT public.seed_market_starter_catalog(id, owner_user_id)
FROM public.store_accounts
WHERE lower(trim(COALESCE(tipo_estabelecimento, ''))) IN ('mercado', 'supermercado', 'mercearia');
