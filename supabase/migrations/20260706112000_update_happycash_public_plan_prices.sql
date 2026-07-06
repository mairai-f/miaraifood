UPDATE public.subscription_plans
SET
  price = CASE
    WHEN id = 'fiado' THEN 79.90
    WHEN id = 'completo' THEN 119.99
    WHEN id = 'pro' THEN 159.99
    ELSE price
  END,
  annual_price = CASE
    WHEN id = 'fiado' THEN 799.00
    WHEN id = 'completo' THEN 1199.90
    WHEN id = 'pro' THEN 1599.90
    ELSE annual_price
  END,
  updated_at = now()
WHERE id IN ('fiado', 'completo', 'pro');
