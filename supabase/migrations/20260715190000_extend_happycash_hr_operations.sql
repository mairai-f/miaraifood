-- HappyCash RH: documentos privados, regras de conformidade e apoio operacional.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents',
  'hr-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS hr_documents_storage_select ON storage.objects;
CREATE POLICY hr_documents_storage_select
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.documents.manage')
);

DROP POLICY IF EXISTS hr_documents_storage_insert ON storage.objects;
CREATE POLICY hr_documents_storage_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.documents.manage')
);

DROP POLICY IF EXISTS hr_documents_storage_update ON storage.objects;
CREATE POLICY hr_documents_storage_update
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.documents.manage')
)
WITH CHECK (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.documents.manage')
);

DROP POLICY IF EXISTS hr_documents_storage_delete ON storage.objects;
CREATE POLICY hr_documents_storage_delete
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.documents.manage')
);

CREATE TABLE IF NOT EXISTS public.hr_compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  requirement_summary text NOT NULL DEFAULT '',
  source_name text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_compliance_rules_owner_code_idx
  ON public.hr_compliance_rules(COALESCE(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

CREATE INDEX IF NOT EXISTS hr_compliance_rules_category_idx
  ON public.hr_compliance_rules(category, active);

DROP TRIGGER IF EXISTS touch_hr_compliance_rules_updated_at ON public.hr_compliance_rules;
CREATE TRIGGER touch_hr_compliance_rules_updated_at
BEFORE UPDATE ON public.hr_compliance_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hr_compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_compliance_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_compliance_rules_select ON public.hr_compliance_rules;
CREATE POLICY hr_compliance_rules_select ON public.hr_compliance_rules
FOR SELECT TO authenticated
USING (
  public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.view')
  AND (owner_user_id IS NULL OR owner_user_id = public.get_current_store_owner_id())
);

DROP POLICY IF EXISTS hr_compliance_rules_write ON public.hr_compliance_rules;
CREATE POLICY hr_compliance_rules_write ON public.hr_compliance_rules
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.settings.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.settings.manage')
);

INSERT INTO public.hr_compliance_rules (
  owner_user_id, code, category, title, requirement_summary, source_name, source_url, severity, configuration
)
VALUES
  (
    NULL,
    'clt-base',
    'clt',
    'Base CLT',
    'Usar a CLT consolidada como referencia principal para relacoes individuais e coletivas de trabalho.',
    'Planalto - Decreto-Lei 5.452/1943 compilado',
    'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm',
    'high',
    '{"review": "legal"}'::jsonb
  ),
  (
    NULL,
    'rep-portaria-671',
    'ponto',
    'Registro eletronico de ponto',
    'Classificar e auditar controles de jornada conforme regras de REP-C, REP-A ou REP-P quando aplicavel.',
    'Gov.br - Registro Eletronico de Ponto',
    'https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/rep',
    'critical',
    '{"requires_audit_trail": true, "requires_secure_clock": true}'::jsonb
  ),
  (
    NULL,
    'esocial-s13',
    'esocial',
    'Leiautes eSocial S-1.3',
    'Manter eventos, rubricas e arquivos exportaveis compatíveis com a documentacao tecnica vigente do eSocial.',
    'Gov.br - Documentacao tecnica eSocial',
    'https://www.gov.br/esocial/pt-br/documentacao-tecnica',
    'high',
    '{"version": "S-1.3", "export_format": "structured"}'::jsonb
  ),
  (
    NULL,
    'lgpd-rh-docs',
    'lgpd',
    'Documentos sensiveis de RH',
    'Guardar documentos trabalhistas em bucket privado, com permissao separada e trilha de auditoria.',
    'HappyCash RH',
    '',
    'critical',
    '{"private_storage": true, "permission": "hr.documents.manage"}'::jsonb
  )
ON CONFLICT (COALESCE(owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid), code) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  requirement_summary = EXCLUDED.requirement_summary,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  severity = EXCLUDED.severity,
  configuration = EXCLUDED.configuration,
  active = true,
  updated_at = now();

COMMENT ON TABLE public.hr_compliance_rules IS 'Regras e referencias de conformidade usadas pelo modulo HappyCash RH.';
