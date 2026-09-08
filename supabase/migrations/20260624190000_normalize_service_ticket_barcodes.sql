UPDATE public.service_tickets
SET barcode = LPAD(number::text, 5, '0');

ALTER TABLE public.service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_number_range_check;

ALTER TABLE public.service_tickets
  ADD CONSTRAINT service_tickets_number_range_check
  CHECK (number BETWEEN 1 AND 99999);

ALTER TABLE public.service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_barcode_five_digits_check;

ALTER TABLE public.service_tickets
  ADD CONSTRAINT service_tickets_barcode_five_digits_check
  CHECK (barcode ~ '^[0-9]{5}$');
