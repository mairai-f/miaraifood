-- Set HappyCash Agenda commercial price to R$ 80 monthly.

UPDATE public.subscription_plans
SET
  price = 80,
  annual_price = 800,
  updated_at = now()
WHERE id = 'agenda';
