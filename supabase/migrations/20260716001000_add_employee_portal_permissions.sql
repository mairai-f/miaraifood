-- HappyCash RH: permissao de acessos e MVP do Portal do Funcionario.

INSERT INTO public.erp_permission_catalog (
  permission_key, module_key, name, description, runtime_scope, default_operator, default_waiter, default_hr
)
VALUES
  ('hr.access.manage', 'hr', 'Gerenciar acessos do RH', 'Criar acessos, alterar permissoes e redefinir senha de funcionarios pelo RH.', 'both', false, false, false),
  ('employee_portal.view', 'employee_portal', 'Acessar portal do funcionario', 'Abrir o portal do proprio funcionario.', 'both', false, false, false),
  ('employee_portal.profile.update', 'employee_portal', 'Atualizar dados pessoais', 'Atualizar contato, endereco e foto no proprio cadastro.', 'both', false, false, false),
  ('employee_portal.time_clock', 'employee_portal', 'Registrar ponto proprio', 'Registrar ponto e consultar banco de horas proprio.', 'both', false, false, false),
  ('employee_portal.leave', 'employee_portal', 'Solicitar ferias e ausencias', 'Solicitar ferias, faltas, licencas e enviar atestados.', 'both', false, false, false),
  ('employee_portal.documents', 'employee_portal', 'Consultar documentos proprios', 'Consultar documentos, atestados e termos do proprio cadastro.', 'both', false, false, false),
  ('employee_portal.payroll', 'employee_portal', 'Consultar holerites proprios', 'Consultar eventos de folha, beneficios, descontos e holerites proprios.', 'both', false, false, false),
  ('employee_portal.announcements', 'employee_portal', 'Visualizar comunicados', 'Visualizar comunicados internos da empresa.', 'both', false, false, false)
ON CONFLICT (permission_key) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  runtime_scope = EXCLUDED.runtime_scope,
  default_operator = EXCLUDED.default_operator,
  default_waiter = EXCLUDED.default_waiter,
  default_hr = EXCLUDED.default_hr;

CREATE TABLE IF NOT EXISTS public.hr_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'employees', 'hr')),
  active boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_announcements_owner_active_idx
  ON public.hr_announcements(owner_user_id, active, published_at DESC);

DROP TRIGGER IF EXISTS touch_hr_announcements_updated_at ON public.hr_announcements;
CREATE TRIGGER touch_hr_announcements_updated_at
BEFORE UPDATE ON public.hr_announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hr_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_announcements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_announcements_select ON public.hr_announcements;
CREATE POLICY hr_announcements_select ON public.hr_announcements
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND active
  AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  AND (
    public.current_user_has_erp_permission('hr.view')
    OR public.current_user_has_erp_permission('employee_portal.announcements')
  )
);

DROP POLICY IF EXISTS hr_announcements_write ON public.hr_announcements;
CREATE POLICY hr_announcements_write ON public.hr_announcements
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

DROP POLICY IF EXISTS hr_employees_portal_select ON public.hr_employees;
CREATE POLICY hr_employees_portal_select ON public.hr_employees
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND profile_user_id = auth.uid()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.view')
);

DROP FUNCTION IF EXISTS public.update_my_hr_profile(text, text, text, text, text, text, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.update_my_hr_profile(
  target_preferred_name text,
  target_email text,
  target_phone text,
  target_photo_url text,
  target_address_zip_code text,
  target_address_street text,
  target_address_number text,
  target_address_complement text,
  target_address_neighborhood text,
  target_address_city text,
  target_address_state text,
  target_emergency_contact_phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
    OR NOT public.current_store_has_feature('hr.manage')
    OR NOT public.current_user_has_erp_permission('employee_portal.profile.update') THEN
    RAISE EXCEPTION 'Sem permissao para atualizar dados pessoais.';
  END IF;

  UPDATE public.hr_employees
  SET
    preferred_name = NULLIF(trim(target_preferred_name), ''),
    email = NULLIF(lower(trim(target_email)), ''),
    phone = NULLIF(trim(target_phone), ''),
    photo_url = NULLIF(trim(target_photo_url), ''),
    address_zip_code = NULLIF(trim(target_address_zip_code), ''),
    address_street = NULLIF(trim(target_address_street), ''),
    address_number = NULLIF(trim(target_address_number), ''),
    address_complement = NULLIF(trim(target_address_complement), ''),
    address_neighborhood = NULLIF(trim(target_address_neighborhood), ''),
    address_city = NULLIF(trim(target_address_city), ''),
    address_state = NULLIF(upper(trim(target_address_state)), ''),
    emergency_contact_phone = NULLIF(trim(target_emergency_contact_phone), ''),
    updated_by = auth.uid()
  WHERE owner_user_id = public.get_current_store_owner_id()
    AND profile_user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_hr_profile(text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_hr_profile(text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

DROP POLICY IF EXISTS hr_time_clock_entries_portal_select ON public.hr_time_clock_entries;
CREATE POLICY hr_time_clock_entries_portal_select ON public.hr_time_clock_entries
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.time_clock')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_time_clock_entries.employee_id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_time_clock_entries_portal_insert ON public.hr_time_clock_entries;
CREATE POLICY hr_time_clock_entries_portal_insert ON public.hr_time_clock_entries
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.time_clock')
  AND source = 'portal'
  AND status = 'pending_approval'
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_time_clock_entries.employee_id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_leave_requests_portal_select ON public.hr_leave_requests;
CREATE POLICY hr_leave_requests_portal_select ON public.hr_leave_requests
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.leave')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_leave_requests.employee_id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_leave_requests_portal_insert ON public.hr_leave_requests;
CREATE POLICY hr_leave_requests_portal_insert ON public.hr_leave_requests
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.leave')
  AND status = 'requested'
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_leave_requests.employee_id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_employee_documents_portal_select ON public.hr_employee_documents;
CREATE POLICY hr_employee_documents_portal_select ON public.hr_employee_documents
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.documents')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_employee_documents.employee_id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_employee_documents_portal_insert ON public.hr_employee_documents;
CREATE POLICY hr_employee_documents_portal_insert ON public.hr_employee_documents
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.documents')
  AND document_type IN ('atestado', 'comprovante', 'documento')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_employee_documents.employee_id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_payroll_items_portal_select ON public.hr_payroll_items;
CREATE POLICY hr_payroll_items_portal_select ON public.hr_payroll_items
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.payroll')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id = hr_payroll_items.employee_id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_payroll_runs_portal_select ON public.hr_payroll_runs;
CREATE POLICY hr_payroll_runs_portal_select ON public.hr_payroll_runs
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.payroll')
  AND EXISTS (
    SELECT 1
    FROM public.hr_payroll_items item
    JOIN public.hr_employees employee ON employee.id = item.employee_id
    WHERE item.payroll_run_id = hr_payroll_runs.id
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_documents_storage_portal_select ON storage.objects;
CREATE POLICY hr_documents_storage_portal_select
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.documents')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id::text = (storage.foldername(name))[2]
      AND employee.profile_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS hr_documents_storage_portal_insert ON storage.objects;
CREATE POLICY hr_documents_storage_portal_insert
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'hr-documents'
  AND (storage.foldername(name))[1] = public.get_current_store_owner_id()::text
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('employee_portal.documents')
  AND EXISTS (
    SELECT 1 FROM public.hr_employees employee
    WHERE employee.id::text = (storage.foldername(name))[2]
      AND employee.profile_user_id = auth.uid()
  )
);
