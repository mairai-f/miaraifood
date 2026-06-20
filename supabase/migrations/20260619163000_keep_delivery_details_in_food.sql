ALTER TABLE public.sales
  DROP COLUMN IF EXISTS delivery_address,
  DROP COLUMN IF EXISTS delivery_fee,
  DROP COLUMN IF EXISTS delivery_courier_name;
