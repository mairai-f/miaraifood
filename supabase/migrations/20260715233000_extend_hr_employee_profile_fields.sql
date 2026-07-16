-- Expande a pasta do colaborador no modulo RH.
ALTER TABLE public.hr_employees
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS address_zip_code text,
  ADD COLUMN IF NOT EXISTS address_street text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_city text,
  ADD COLUMN IF NOT EXISTS address_state text,
  ADD COLUMN IF NOT EXISTS unit_name text,
  ADD COLUMN IF NOT EXISTS contract_type text,
  ADD COLUMN IF NOT EXISTS work_journey text,
  ADD COLUMN IF NOT EXISTS salary_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

CREATE INDEX IF NOT EXISTS hr_employees_owner_department_idx
  ON public.hr_employees(owner_user_id, department, position);

CREATE INDEX IF NOT EXISTS hr_employees_owner_address_city_idx
  ON public.hr_employees(owner_user_id, address_city, address_state)
  WHERE address_city IS NOT NULL;
