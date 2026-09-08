ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_sale_items_updated_at ON public.sale_items;
CREATE TRIGGER update_sale_items_updated_at
BEFORE UPDATE ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_stock_movements_updated_at ON public.stock_movements;
CREATE TRIGGER update_stock_movements_updated_at
BEFORE UPDATE ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS clients_user_updated_at_idx
  ON public.clients(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS products_user_updated_at_idx
  ON public.products(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS debt_entries_client_updated_at_idx
  ON public.debt_entries(client_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS payments_client_updated_at_idx
  ON public.payments(client_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sales_user_location_updated_at_idx
  ON public.sales(user_id, location_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS sale_items_sale_updated_at_idx
  ON public.sale_items(sale_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_user_location_updated_at_idx
  ON public.stock_movements(user_id, location_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS expenses_user_location_updated_at_idx
  ON public.expenses(user_id, location_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS rewards_user_updated_at_idx
  ON public.rewards(user_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.get_store_data_sync_state(p_location_id uuid DEFAULT NULL)
RETURNS TABLE (
  module text,
  signature text,
  row_count bigint,
  last_changed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH owner_context AS (
    SELECT public.get_current_store_owner_id() AS owner_id
    WHERE auth.uid() IS NOT NULL
  ),
  module_parts AS (
    SELECT 'storeOperationalSettings'::text AS module,
           count(*)::bigint AS row_count,
           max(account.updated_at) AS last_changed_at
    FROM public.store_accounts account
    JOIN owner_context context ON context.owner_id = account.owner_user_id
    WHERE account.product_context = 'happycash'

    UNION ALL
    SELECT 'clients', count(*)::bigint, max(client.updated_at)
    FROM public.clients client
    JOIN owner_context context ON context.owner_id = client.user_id

    UNION ALL
    SELECT 'clients', count(*)::bigint, max(entry.updated_at)
    FROM public.debt_entries entry
    JOIN public.clients client ON client.id = entry.client_id
    JOIN owner_context context ON context.owner_id = client.user_id

    UNION ALL
    SELECT 'clients', count(*)::bigint, max(payment.updated_at)
    FROM public.payments payment
    JOIN public.clients client ON client.id = payment.client_id
    JOIN owner_context context ON context.owner_id = client.user_id

    UNION ALL
    SELECT 'products', count(*)::bigint, max(product.updated_at)
    FROM public.products product
    JOIN owner_context context ON context.owner_id = product.user_id

    UNION ALL
    SELECT 'products', count(*)::bigint, max(packaging.updated_at)
    FROM public.product_packagings packaging
    JOIN owner_context context ON context.owner_id = packaging.owner_user_id

    UNION ALL
    SELECT 'products', count(*)::bigint, max(inventory.updated_at)
    FROM public.location_inventory inventory
    JOIN owner_context context ON context.owner_id = inventory.owner_user_id
    WHERE p_location_id IS NOT NULL
      AND inventory.location_id = p_location_id

    UNION ALL
    SELECT 'rewards', count(*)::bigint, max(reward.updated_at)
    FROM public.rewards reward
    JOIN owner_context context ON context.owner_id = reward.user_id

    UNION ALL
    SELECT 'sales', count(*)::bigint, max(sale.updated_at)
    FROM public.sales sale
    JOIN owner_context context ON context.owner_id = sale.user_id
    WHERE p_location_id IS NULL OR sale.location_id = p_location_id

    UNION ALL
    SELECT 'saleItems', count(*)::bigint, max(item.updated_at)
    FROM public.sale_items item
    JOIN public.sales sale ON sale.id = item.sale_id
    JOIN owner_context context ON context.owner_id = sale.user_id

    UNION ALL
    SELECT 'serviceTickets', count(*)::bigint, max(ticket.updated_at)
    FROM public.service_tickets ticket
    JOIN owner_context context ON context.owner_id = ticket.owner_user_id
    WHERE p_location_id IS NULL OR ticket.location_id = p_location_id

    UNION ALL
    SELECT 'serviceTicketItems', count(*)::bigint, max(item.updated_at)
    FROM public.service_ticket_items item
    JOIN public.service_tickets ticket ON ticket.id = item.ticket_id
    JOIN owner_context context ON context.owner_id = item.owner_user_id

    UNION ALL
    SELECT 'stock', count(*)::bigint, max(movement.updated_at)
    FROM public.stock_movements movement
    JOIN owner_context context ON context.owner_id = movement.user_id
    WHERE p_location_id IS NULL OR movement.location_id = p_location_id

    UNION ALL
    SELECT 'expenses', count(*)::bigint, max(expense.updated_at)
    FROM public.expenses expense
    JOIN owner_context context ON context.owner_id = expense.user_id
    WHERE p_location_id IS NULL OR expense.location_id = p_location_id

    UNION ALL
    SELECT 'pricing', count(*)::bigint, max(rule.updated_at)
    FROM public.product_category_pricing_rules rule
    JOIN owner_context context ON context.owner_id = rule.owner_user_id

    UNION ALL
    SELECT 'pricing', count(*)::bigint, max(history.created_at)
    FROM public.product_price_history history
    JOIN owner_context context ON context.owner_id = history.owner_user_id
  ),
  module_totals AS (
    SELECT
      module,
      COALESCE(sum(row_count), 0)::bigint AS row_count,
      max(last_changed_at) AS last_changed_at
    FROM module_parts
    GROUP BY module
  )
  SELECT
    module,
    md5(row_count::text || ':' || COALESCE(last_changed_at::text, 'never')) AS signature,
    row_count,
    last_changed_at
  FROM module_totals
  ORDER BY module;
$$;

REVOKE ALL ON FUNCTION public.get_store_data_sync_state(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_data_sync_state(uuid) TO authenticated;
