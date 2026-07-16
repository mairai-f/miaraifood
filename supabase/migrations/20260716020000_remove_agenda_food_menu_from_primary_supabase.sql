-- Keep the primary HappyCash Supabase focused on HappyCash ERP + HappyCashSite.
-- Agenda, Food and Menu were moved to standalone repositories.

BEGIN;

-- Database routines used only by Agenda/Food/Menu. Generic ERP helpers are kept.
DO $$
DECLARE
  routine_record record;
BEGIN
  FOR routine_record IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS routine_name,
      oidvectortypes(p.proargtypes) AS args
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE 'agenda_%'
        OR p.proname LIKE '%_agenda_%'
        OR p.proname LIKE '%appointment%'
        OR p.proname LIKE '%barber%'
        OR p.proname LIKE 'restaurant_%'
        OR p.proname LIKE '%restaurant%'
        OR p.proname LIKE '%public_menu%'
        OR p.proname LIKE '%loyalty%'
      )
  LOOP
    EXECUTE format(
      'DROP ROUTINE IF EXISTS %I.%I(%s) CASCADE',
      routine_record.schema_name,
      routine_record.routine_name,
      routine_record.args
    );
  END LOOP;
END $$;

-- Food/Menu tables.
DROP TABLE IF EXISTS
  public.restaurant_table_service_requests,
  public.restaurant_delivery_orders,
  public.restaurant_order_payments,
  public.restaurant_order_items,
  public.restaurant_orders,
  public.restaurant_menu_item_option_values,
  public.restaurant_menu_item_options,
  public.restaurant_menu_promotions,
  public.restaurant_menu_items,
  public.restaurant_menu_categories,
  public.restaurant_menu_customers,
  public.restaurant_public_profiles,
  public.restaurant_product_technical_sheet_ingredients,
  public.restaurant_product_technical_sheets,
  public.restaurant_inventory_items,
  public.restaurant_stock_movements,
  public.restaurant_recipe_items,
  public.restaurant_tables
CASCADE;

-- Agenda tables, including legacy unprefixed Agenda tables.
DROP TABLE IF EXISTS
  public.agenda_appointment_reminders,
  public.agenda_audit_events,
  public.agenda_product_order_items,
  public.agenda_product_orders,
  public.agenda_products,
  public.agenda_clients,
  public.agenda_business_settings,
  public.appointment_services,
  public.appointments,
  public.barber_login_sessions,
  public.barbers,
  public.business_hours,
  public.business_locations,
  public.loyalty_progress,
  public.loyalty_programs,
  public.services
CASCADE;

DROP TYPE IF EXISTS public.appointment_status CASCADE;

COMMIT;
