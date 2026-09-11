-- MIAR: retrato da loja apurado no banco + telas de TV do salão.
--
-- Antes, a Edge Function da MIAR baixava até 4000 vendas, os itens de cada
-- uma, 2000 produtos, despesas e movimentações A CADA mensagem e somava tudo
-- em TypeScript. Agora o Postgres devolve só os totais, em poucos KB.
-- As funções de leitura são SECURITY INVOKER: o RLS do ERP continua sendo a
-- barreira entre estabelecimentos, exatamente como era nas consultas diretas.

-- ---------------------------------------------------------------------------
-- 1. Índices para as janelas de 30 dias
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sales_user_date_idx ON public.sales (user_id, date DESC);
CREATE INDEX IF NOT EXISTS stock_movements_user_date_idx ON public.stock_movements (user_id, date DESC);

-- ---------------------------------------------------------------------------
-- 2. Retrato da operação para o system prompt da MIAR
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_miar_store_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  since30 timestamptz := now() - interval '30 days';
  since7 timestamptz := now() - interval '7 days';
  local_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  result jsonb;
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '28000';
  END IF;

  WITH sales30 AS (
    SELECT id, total, discount, payment_method, date, operator_user_id, seller_name
    FROM public.sales
    WHERE user_id = owner_id AND date >= since30 AND status <> 'cancelled'
  ),
  items30 AS (
    SELECT item.product_id, item.product_name, item.quantity, item.total, item.cost_price,
           sale.date >= since7 AS recent
    FROM public.sale_items item
    JOIN sales30 sale ON sale.id = item.sale_id
  ),
  sold AS (
    SELECT COALESCE(product_id::text, lower(product_name)) AS key,
           max(product_id::text) AS product_id_text,
           max(product_name) AS name,
           sum(quantity) AS qty,
           sum(total) AS revenue,
           sum(cost_price * quantity) AS cost,
           COALESCE(sum(quantity) FILTER (WHERE recent), 0) AS qty7,
           COALESCE(sum(total) FILTER (WHERE recent), 0) AS revenue7
    FROM items30
    GROUP BY 1
  ),
  catalog AS (
    SELECT id, name, price, cost_price, stock, min_stock
    FROM public.products
    WHERE user_id = owner_id AND NOT deleted
  ),
  stagnant AS (
    SELECT c.name, c.stock, c.price, c.cost_price
    FROM catalog c
    WHERE NOT EXISTS (
      SELECT 1 FROM sold s WHERE s.product_id_text = c.id::text OR s.key = lower(c.name)
    )
  ),
  losses AS (
    SELECT COALESCE(NULLIF(movement.reason, ''), movement.type) AS reason,
           abs(movement.quantity) AS quantity,
           COALESCE(product.cost_price, 0) AS unit_cost
    FROM public.stock_movements movement
    LEFT JOIN catalog product ON product.id = movement.product_id
    WHERE movement.user_id = owner_id
      AND movement.date >= since30
      AND (movement.type || ' ' || COALESCE(movement.reason, '')) ~* '(perda|quebra|desperd|vencid|avaria)'
  ),
  expenses30 AS (
    -- Despesas seguem apenas o RLS, como na consulta que substituímos.
    SELECT amount, COALESCE(NULLIF(category, ''), 'sem categoria') AS category
    FROM public.expenses
    WHERE date >= since30
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'sales', jsonb_build_object(
      'revenue30', COALESCE((SELECT sum(total) FROM sales30), 0),
      'count30', (SELECT count(*) FROM sales30),
      'revenue7', COALESCE((SELECT sum(total) FROM sales30 WHERE date >= since7), 0),
      'count7', (SELECT count(*) FROM sales30 WHERE date >= since7),
      'discount30', COALESCE((SELECT sum(discount) FROM sales30), 0)
    ),
    'by_payment', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total DESC)
      FROM (SELECT payment_method AS method, sum(total) AS total FROM sales30 GROUP BY 1) x
    ), '[]'::jsonb),
    'best_hours', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.revenue DESC)
      FROM (
        SELECT extract(hour FROM date AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
               sum(total) AS revenue, count(*) AS count
        FROM sales30 GROUP BY 1 ORDER BY 2 DESC LIMIT 5
      ) x
    ), '[]'::jsonb),
    'top_products', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.revenue DESC)
      FROM (SELECT name, qty, revenue, cost FROM sold ORDER BY revenue DESC LIMIT 10) x
    ), '[]'::jsonb),
    'least_sold7', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.qty ASC)
      FROM (SELECT name, qty7 AS qty, revenue7 AS revenue FROM sold WHERE qty7 > 0 ORDER BY qty7 ASC LIMIT 10) x
    ), '[]'::jsonb),
    'stagnant_count', (SELECT count(*) FROM stagnant),
    'stagnant', COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (SELECT name, stock, price FROM stagnant ORDER BY stock * cost_price DESC, name LIMIT 15) x
    ), '[]'::jsonb),
    'low_margin', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.margin ASC)
      FROM (
        SELECT name, price, cost_price, (price - cost_price) / price AS margin
        FROM catalog WHERE price > 0 AND cost_price > 0
        ORDER BY (price - cost_price) / price ASC LIMIT 10
      ) x
    ), '[]'::jsonb),
    'product_count', (SELECT count(*) FROM catalog),
    'low_stock_count', (SELECT count(*) FROM catalog WHERE stock <= min_stock),
    'low_stock', COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT c.name, c.stock, c.min_stock, COALESCE(s.qty, 0) AS qty30
        FROM catalog c
        LEFT JOIN sold s ON s.product_id_text = c.id::text
        WHERE c.stock <= c.min_stock
        ORDER BY c.stock - c.min_stock ASC, c.name
        LIMIT 20
      ) x
    ), '[]'::jsonb),
    'stock_value', COALESCE((SELECT sum(stock * cost_price) FROM catalog), 0),
    'losses', jsonb_build_object(
      'count', (SELECT count(*) FROM losses),
      'value', COALESCE((SELECT sum(quantity * unit_cost) FROM losses), 0),
      'by_reason', COALESCE((
        SELECT jsonb_agg(to_jsonb(x) ORDER BY x.qty DESC)
        FROM (SELECT reason, sum(quantity) AS qty FROM losses GROUP BY 1 ORDER BY 2 DESC LIMIT 8) x
      ), '[]'::jsonb)
    ),
    'expenses', jsonb_build_object(
      'total', COALESCE((SELECT sum(amount) FROM expenses30), 0),
      'by_category', COALESCE((
        SELECT jsonb_agg(to_jsonb(x) ORDER BY x.total DESC)
        FROM (SELECT category, sum(amount) AS total FROM expenses30 GROUP BY 1 ORDER BY 2 DESC LIMIT 8) x
      ), '[]'::jsonb)
    ),
    'operators', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.revenue DESC)
      FROM (
        SELECT COALESCE(NULLIF(max(seller_name), ''), 'Operador ' || left(operator_user_id::text, 8)) AS name,
               sum(total) AS revenue, count(*) AS count
        FROM sales30 GROUP BY operator_user_id ORDER BY 2 DESC LIMIT 10
      ) x
    ), '[]'::jsonb),
    'promotions', COALESCE((
      SELECT jsonb_agg(to_jsonb(x))
      FROM (
        SELECT title, product_name, discount_type, discount_value, ends_at
        FROM public.product_promotions
        WHERE owner_user_id = owner_id AND active
          AND starts_at <= local_today AND (ends_at IS NULL OR ends_at >= local_today)
        ORDER BY created_at DESC
        LIMIT 10
      ) x
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_miar_store_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_miar_store_snapshot() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Vendas de um produto (ferramenta consultar_vendas_produto)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_miar_product_sales(p_term text, p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'quantity', COALESCE(sum(item.quantity), 0),
    'revenue', COALESCE(sum(item.total), 0),
    'cost', COALESCE(sum(item.cost_price * item.quantity), 0),
    'products', COALESCE(jsonb_agg(DISTINCT item.product_name), '[]'::jsonb)
  )
  FROM public.sales sale
  JOIN public.sale_items item ON item.sale_id = sale.id
  WHERE sale.user_id = public.get_current_store_owner_id()
    AND sale.date >= now() - make_interval(days => LEAST(GREATEST(COALESCE(p_days, 30), 1), 365))
    AND sale.status <> 'cancelled'
    AND item.product_name ILIKE '%' || replace(replace(replace(COALESCE(p_term, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

REVOKE ALL ON FUNCTION public.get_miar_product_sales(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_miar_product_sales(text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Telas de TV do salão (promoções e produtos escolhidos)
-- ---------------------------------------------------------------------------
-- Módulo das Configurações da loja, independente do QR Menu: gerencia quem tem
-- 'settings.manage'. O código da TV (8 caracteres, sem 0/O/1/I/L) é o que se
-- digita na TV para ela saber qual tela exibir. Os bytes vêm de
-- gen_random_uuid(), pulando os bits fixos de versão/variante.
CREATE OR REPLACE FUNCTION public.generate_tv_screen_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT string_agg(
    substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + get_byte(random_bytes.value, byte_index) % 31, 1),
    '' ORDER BY byte_index
  )
  FROM (SELECT uuid_send(gen_random_uuid()) AS value) AS random_bytes,
       unnest(ARRAY[0, 1, 2, 3, 4, 5, 7, 9]) AS byte_index
$$;

CREATE TABLE IF NOT EXISTS public.tv_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'TV do salão' CHECK (char_length(name) BETWEEN 1 AND 60),
  access_code text NOT NULL UNIQUE DEFAULT public.generate_tv_screen_code()
    CHECK (access_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
  headline text NOT NULL DEFAULT '' CHECK (char_length(headline) <= 80),
  footer_message text NOT NULL DEFAULT '' CHECK (char_length(footer_message) <= 140),
  slide_seconds integer NOT NULL DEFAULT 10 CHECK (slide_seconds BETWEEN 4 AND 60),
  show_prices boolean NOT NULL DEFAULT true,
  product_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(product_ids) <= 30),
  active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tv_screens_owner_idx ON public.tv_screens (owner_user_id, created_at);

CREATE OR REPLACE FUNCTION public.assign_tv_screen_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.owner_user_id := public.get_current_store_owner_id();
  IF NEW.owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível identificar o estabelecimento desta TV.' USING ERRCODE = '42501';
  END IF;
  NEW.store_account_id := public.get_current_store_account_id();
  IF (SELECT count(*) FROM public.tv_screens WHERE owner_user_id = NEW.owner_user_id) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 TVs por estabelecimento.' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_tv_screen_scope ON public.tv_screens;
CREATE TRIGGER assign_tv_screen_scope BEFORE INSERT ON public.tv_screens
FOR EACH ROW EXECUTE FUNCTION public.assign_tv_screen_scope();

-- last_seen_at fica de fora para a marcação de "TV exibindo" não mexer em updated_at.
DROP TRIGGER IF EXISTS tv_screens_touch_updated_at ON public.tv_screens;
CREATE TRIGGER tv_screens_touch_updated_at
BEFORE UPDATE OF name, access_code, headline, footer_message, slide_seconds, show_prices, product_ids, active
ON public.tv_screens
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.tv_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tv_screens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tv_screens_manage ON public.tv_screens;
CREATE POLICY tv_screens_manage ON public.tv_screens FOR ALL TO authenticated
USING (owner_user_id = public.get_current_store_owner_id() AND public.current_user_has_erp_permission('settings.manage'))
WITH CHECK (owner_user_id = public.get_current_store_owner_id() AND public.current_user_has_erp_permission('settings.manage'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tv_screens TO authenticated;
REVOKE ALL ON FUNCTION public.assign_tv_screen_scope() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5. Conteúdo público de uma TV (chamado só pela Edge Function tv-display)
-- ---------------------------------------------------------------------------
-- Uma consulta por atualização da TV. A versão (md5 do conteúdo) permite à TV
-- perguntar "mudou?" e receber uma resposta vazia quando nada mudou. A foto de
-- cada produto é a já cadastrada no sistema; a TV só lê.
CREATE OR REPLACE FUNCTION public.get_tv_screen_payload(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  screen public.tv_screens%ROWTYPE;
  local_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  body jsonb;
BEGIN
  IF p_code IS NULL OR upper(p_code) !~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO screen FROM public.tv_screens WHERE access_code = upper(p_code) AND active;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Marca a TV como exibindo no máximo a cada 10 minutos, para não gravar a cada consulta.
  IF screen.last_seen_at IS NULL OR screen.last_seen_at < now() - interval '10 minutes' THEN
    UPDATE public.tv_screens SET last_seen_at = now() WHERE id = screen.id;
  END IF;

  SELECT jsonb_build_object(
    'store_name', COALESCE(
      (SELECT account.nome_estabelecimento FROM public.store_accounts account WHERE account.id = screen.store_account_id),
      (SELECT account.nome_estabelecimento FROM public.store_accounts account WHERE account.owner_user_id = screen.owner_user_id ORDER BY account.created_at LIMIT 1)
    ),
    'screen', jsonb_build_object(
      'name', screen.name,
      'headline', screen.headline,
      'footer_message', screen.footer_message,
      'slide_seconds', screen.slide_seconds,
      'show_prices', screen.show_prices
    ),
    'promotions', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) - 'created_at' ORDER BY x.created_at DESC)
      FROM (
        SELECT promo.id, promo.product_id,
               COALESCE(NULLIF(promo.title, ''), product.name, promo.product_name) AS title,
               COALESCE(product.name, promo.product_name) AS product_name,
               product.price, promo.discount_type, promo.discount_value, promo.ends_at,
               photo.image_url, photo.description,
               promo.created_at
        FROM public.product_promotions promo
        LEFT JOIN public.products product
          ON product.id = promo.product_id AND product.user_id = screen.owner_user_id AND NOT product.deleted
        LEFT JOIN LATERAL (
          SELECT NULLIF(menu.image_url, '') AS image_url, NULLIF(menu.description, '') AS description
          FROM public.food_menu_products menu
          WHERE menu.product_id = promo.product_id AND menu.owner_user_id = screen.owner_user_id AND menu.image_url <> ''
          ORDER BY menu.updated_at DESC
          LIMIT 1
        ) photo ON true
        WHERE promo.owner_user_id = screen.owner_user_id
          AND promo.active
          AND promo.starts_at <= local_today
          AND (promo.ends_at IS NULL OR promo.ends_at >= local_today)
          AND (promo.product_id IS NULL OR product.id IS NOT NULL)
        ORDER BY promo.created_at DESC
        LIMIT 20
      ) x
    ), '[]'::jsonb),
    'products', COALESCE((
      SELECT jsonb_agg(to_jsonb(x) - 'position' ORDER BY x.position)
      FROM (
        SELECT product.id, product.name, product.price, photo.image_url, photo.description, chosen.position
        FROM unnest(screen.product_ids) WITH ORDINALITY AS chosen(product_id, position)
        JOIN public.products product
          ON product.id = chosen.product_id AND product.user_id = screen.owner_user_id AND NOT product.deleted
        LEFT JOIN LATERAL (
          SELECT NULLIF(menu.image_url, '') AS image_url, NULLIF(menu.description, '') AS description
          FROM public.food_menu_products menu
          WHERE menu.product_id = product.id AND menu.owner_user_id = screen.owner_user_id AND menu.image_url <> ''
          ORDER BY menu.updated_at DESC
          LIMIT 1
        ) photo ON true
      ) x
    ), '[]'::jsonb)
  ) INTO body;

  RETURN body || jsonb_build_object('version', md5(body::text));
END;
$$;

REVOKE ALL ON FUNCTION public.get_tv_screen_payload(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tv_screen_payload(text) TO service_role;
