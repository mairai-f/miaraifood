UPDATE public.subscription_plans
SET
  price = CASE
    WHEN id = 'fiado' THEN 100
    WHEN id = 'completo' THEN 189
    WHEN id = 'pro' THEN 250
    ELSE price
  END,
  annual_price = CASE
    WHEN id = 'fiado' THEN 997
    WHEN id = 'completo' THEN 1887
    WHEN id = 'pro' THEN 2497
    ELSE annual_price
  END,
  updated_at = now()
WHERE id IN ('fiado', 'completo', 'pro');
