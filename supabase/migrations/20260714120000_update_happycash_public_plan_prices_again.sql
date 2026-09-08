UPDATE public.subscription_plans
SET
  price = CASE
    WHEN id = 'fiado' THEN 20.00
    WHEN id = 'completo' THEN 70.00
    WHEN id = 'pro' THEN 130.00
    ELSE price
  END,
  annual_price = CASE
    WHEN id = 'fiado' THEN 200.00
    WHEN id = 'completo' THEN 700.00
    WHEN id = 'pro' THEN 1300.00
    ELSE annual_price
  END
WHERE id IN ('fiado', 'completo', 'pro');
