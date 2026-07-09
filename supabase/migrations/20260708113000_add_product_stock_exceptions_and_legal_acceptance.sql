ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS block_sale_without_stock boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.products.block_sale_without_stock IS
  'Quando false, este produto pode vender sem saldo mesmo se a loja mantiver a trava global de venda sem estoque.';

ALTER TABLE public.site_pending_registrations
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS lgpd_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_version text,
  ADD COLUMN IF NOT EXISTS legal_acceptance_source text;

ALTER TABLE public.store_accounts
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS lgpd_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_version text,
  ADD COLUMN IF NOT EXISTS legal_acceptance_source text;

ALTER TABLE public.desktop_machine_activations
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS lgpd_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_version text,
  ADD COLUMN IF NOT EXISTS legal_acceptance_source text;

COMMENT ON COLUMN public.site_pending_registrations.legal_acceptance_source IS
  'Origem do aceite legal do cadastro, como site-signup ou desktop-activation.';

COMMENT ON COLUMN public.store_accounts.legal_acceptance_source IS
  'Origem mais recente do aceite legal registrado para a empresa.';

COMMENT ON COLUMN public.desktop_machine_activations.legal_acceptance_source IS
  'Origem do aceite legal informado para a ativacao desta maquina.';

CREATE OR REPLACE FUNCTION public.erp_apply_product_stock(
  target_product_id uuid, target_location_id uuid, target_delta numeric,
  target_type text, target_reason text, target_source text, target_reference_id uuid
)
RETURNS public.stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  product_row public.products%ROWTYPE;
  location_row public.store_locations%ROWTYPE;
  inventory_row public.location_inventory%ROWTYPE;
  movement_row public.stock_movements%ROWTYPE;
  next_stock numeric(12,3);
  actor_name text;
  allow_negative_stock boolean := false;
BEGIN
  SELECT * INTO product_row FROM public.products
  WHERE id = target_product_id AND user_id = owner_id AND NOT deleted FOR UPDATE;
  IF product_row.id IS NULL THEN RAISE EXCEPTION 'Produto nao encontrado.'; END IF;
  IF NOT product_row.control_stock THEN RETURN NULL; END IF;

  location_row := public.erp_operational_location(target_location_id);

  INSERT INTO public.location_inventory (owner_user_id, location_id, product_id, stock, min_stock, max_stock)
  VALUES (
    owner_id,
    location_row.id,
    product_row.id,
    CASE WHEN location_row.is_headquarters THEN product_row.stock ELSE 0 END,
    product_row.min_stock,
    product_row.max_stock
  )
  ON CONFLICT (location_id, product_id) DO NOTHING;

  SELECT * INTO inventory_row FROM public.location_inventory
  WHERE location_id = location_row.id AND product_id = product_row.id FOR UPDATE;

  next_stock := round(COALESCE(inventory_row.stock, 0) + target_delta, 3);
  allow_negative_stock := next_stock < 0
    AND COALESCE(target_source, '') IN ('sale', 'debt')
    AND (
      NOT public.current_store_blocks_sale_without_stock()
      OR COALESCE(product_row.block_sale_without_stock, true) = false
    );

  IF next_stock < 0 AND NOT allow_negative_stock THEN
    RAISE EXCEPTION 'Estoque insuficiente para % (codigo %). Saldo: %.', product_row.name, product_row.code, inventory_row.stock;
  END IF;

  UPDATE public.location_inventory
  SET stock = next_stock,
      max_stock = product_row.max_stock,
      updated_at = now()
  WHERE location_id = inventory_row.location_id
    AND product_id = inventory_row.product_id;

  IF location_row.is_headquarters THEN
    UPDATE public.products
    SET stock = next_stock
    WHERE id = product_row.id;
  END IF;

  SELECT COALESCE(NULLIF(profile.username, ''), NULLIF(profile.email, ''), auth.uid()::text)
  INTO actor_name FROM public.profiles AS profile WHERE profile.user_id = auth.uid();

  INSERT INTO public.stock_movements (
    product_id, user_id, type, quantity, reason, source, reference_id,
    balance_before, balance_after, operator_user_id, actor_label, location_id
  ) VALUES (
    product_row.id, owner_id, target_type, abs(target_delta), trim(target_reason),
    target_source, target_reference_id, inventory_row.stock, next_stock,
    auth.uid(), actor_name, location_row.id
  ) RETURNING * INTO movement_row;

  RETURN movement_row;
END;
$$;
