-- O token fisico nao fica na tabela operacional que o garcom pode consultar.
CREATE TABLE public.food_table_qr_credentials (
  table_id uuid PRIMARY KEY REFERENCES public.food_tables(id) ON DELETE CASCADE,
  qr_token text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  rotated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.food_table_qr_credentials (table_id, qr_token, rotated_at)
SELECT id, qr_token, qr_token_rotated_at FROM public.food_tables
ON CONFLICT (table_id) DO NOTHING;

ALTER TABLE public.food_tables DROP COLUMN qr_token;
ALTER TABLE public.food_tables DROP COLUMN qr_token_rotated_at;

CREATE OR REPLACE FUNCTION public.create_food_table_qr_credential()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.food_table_qr_credentials(table_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER create_food_table_qr_credential
AFTER INSERT ON public.food_tables FOR EACH ROW EXECUTE FUNCTION public.create_food_table_qr_credential();

ALTER TABLE public.food_table_qr_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_table_qr_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY food_table_qr_admin_read ON public.food_table_qr_credentials FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.food_tables food_table
  WHERE food_table.id = food_table_qr_credentials.table_id
    AND public.food_current_scope_matches(food_table.owner_user_id, food_table.store_account_id)
    AND public.current_user_has_erp_permission('food.qr.manage')
));

REVOKE ALL ON FUNCTION public.create_food_table_qr_credential() FROM PUBLIC;
COMMENT ON TABLE public.food_table_qr_credentials IS 'Credencial opaca do QR fisico, legivel somente por administrador autorizado.';
