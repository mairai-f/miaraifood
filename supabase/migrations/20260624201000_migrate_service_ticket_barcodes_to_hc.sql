ALTER TABLE public.service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_barcode_five_digits_check;

ALTER TABLE public.service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_barcode_hc_check;

UPDATE public.service_tickets
SET barcode = CASE
  WHEN number BETWEEN 1 AND 999
    THEN 'HC' || LPAD(number::text, 3, '0')
  ELSE 'HC' || LPAD(number::text, 4, '0')
END;

ALTER TABLE public.service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_number_range_check;

ALTER TABLE public.service_tickets
  ADD CONSTRAINT service_tickets_number_range_check
  CHECK (number BETWEEN 1 AND 9999);

ALTER TABLE public.service_tickets
  ADD CONSTRAINT service_tickets_barcode_hc_check
  CHECK (barcode ~ '^HC[0-9]{3,4}$');
