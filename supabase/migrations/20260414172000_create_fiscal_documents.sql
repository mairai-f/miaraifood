CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL UNIQUE REFERENCES public.sales(id) ON DELETE CASCADE,
  operator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  document_model text NOT NULL DEFAULT '65' CHECK (document_model IN ('55', '65')),
  environment text NOT NULL DEFAULT 'homologacao' CHECK (environment IN ('homologacao', 'producao')),
  status text NOT NULL DEFAULT 'homologacao_emitida' CHECK (
    status IN ('pendente', 'homologacao_emitida', 'autorizada', 'erro', 'cancelada')
  ),
  series integer NOT NULL CHECK (series > 0),
  number integer NOT NULL CHECK (number > 0),
  access_key text NOT NULL UNIQUE,
  protocol text,
  homologation_message text,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  emitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_documents FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiscal_documents_select_store" ON public.fiscal_documents;
DROP POLICY IF EXISTS "fiscal_documents_insert_admin_store" ON public.fiscal_documents;
DROP POLICY IF EXISTS "fiscal_documents_update_admin_store" ON public.fiscal_documents;

CREATE POLICY "fiscal_documents_select_store"
ON public.fiscal_documents
FOR SELECT
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());

CREATE POLICY "fiscal_documents_insert_admin_store"
ON public.fiscal_documents
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);

CREATE POLICY "fiscal_documents_update_admin_store"
ON public.fiscal_documents
FOR UPDATE
TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_user_is_admin()
);

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_documents_series_number_idx
  ON public.fiscal_documents(owner_user_id, document_model, series, number);

CREATE INDEX IF NOT EXISTS fiscal_documents_owner_emitted_at_idx
  ON public.fiscal_documents(owner_user_id, emitted_at DESC);

CREATE INDEX IF NOT EXISTS fiscal_documents_sale_id_idx
  ON public.fiscal_documents(sale_id);

DROP TRIGGER IF EXISTS update_fiscal_documents_updated_at ON public.fiscal_documents;
CREATE TRIGGER update_fiscal_documents_updated_at
BEFORE UPDATE ON public.fiscal_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
