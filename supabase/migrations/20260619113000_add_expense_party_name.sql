ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS party_name text;

COMMENT ON COLUMN public.expenses.party_name IS
  'Pessoa, empresa ou fornecedor que recebeu o pagamento da despesa.';
