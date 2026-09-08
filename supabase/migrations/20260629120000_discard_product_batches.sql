CREATE OR REPLACE FUNCTION public.discard_product_batch(
  p_batch_id uuid,
  p_adjust_stock boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid;
  batch_row public.product_batches%ROWTYPE;
  product_row public.products%ROWTYPE;
  stock_quantity numeric := 0;
BEGIN
  owner_id := public.get_current_store_owner_id();
  IF auth.uid() IS NULL
    OR owner_id IS NULL
    OR NOT public.current_user_is_admin()
    OR NOT public.current_store_has_feature('financial.manage')
  THEN
    RAISE EXCEPTION 'Sem permissao para retirar lotes.';
  END IF;

  SELECT * INTO batch_row
  FROM public.product_batches
  WHERE id = p_batch_id AND owner_user_id = owner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote nao encontrado.';
  END IF;

  IF p_adjust_stock AND batch_row.product_id IS NOT NULL AND batch_row.quantity > 0 THEN
    IF NOT public.current_store_has_feature('stock.manage') THEN
      RAISE EXCEPTION 'Seu plano nao permite movimentar o estoque.';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = batch_row.product_id AND user_id = owner_id
    FOR UPDATE;

    IF FOUND AND NOT product_row.deleted THEN
      stock_quantity := least(batch_row.quantity, greatest(coalesce(product_row.stock, 0), 0));
      IF stock_quantity > 0 THEN
        PERFORM public.apply_stock_delta(
          gen_random_uuid(),
          product_row.id,
          -stock_quantity,
          'saida',
          concat('Vencimento do lote ', coalesce(nullif(batch_row.batch_code, ''), 'nao informado')),
          'expiration_batch',
          batch_row.id
        );
      END IF;
    END IF;
  END IF;

  DELETE FROM public.product_batches WHERE id = batch_row.id;

  RETURN jsonb_build_object(
    'batch_id', batch_row.id,
    'product_id', batch_row.product_id,
    'stock_quantity', stock_quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.discard_product_batch(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.discard_product_batch(uuid, boolean) TO authenticated;
