-- HappyCash RH: portal do funcionario sempre disponivel e somente leitura.

UPDATE public.erp_permission_catalog
SET
  default_operator = true,
  default_waiter = true,
  default_hr = true,
  name = 'Acessar portal do funcionario',
  description = 'Abrir o portal de consulta do proprio funcionario.'
WHERE permission_key = 'employee_portal.view';

UPDATE public.erp_permission_catalog
SET
  default_operator = false,
  default_waiter = false,
  default_hr = false
WHERE permission_key IN (
  'employee_portal.profile.update',
  'employee_portal.time_clock',
  'employee_portal.leave',
  'employee_portal.documents',
  'employee_portal.payroll',
  'employee_portal.announcements'
);

UPDATE public.erp_permission_catalog
SET
  name = 'Consultar ponto proprio',
  description = 'Consultar marcacoes e banco de horas do proprio cadastro.'
WHERE permission_key = 'employee_portal.time_clock';

UPDATE public.erp_permission_catalog
SET
  name = 'Consultar ferias e ausencias',
  description = 'Consultar ferias, faltas, licencas e afastamentos do proprio cadastro.'
WHERE permission_key = 'employee_portal.leave';

UPDATE public.erp_permission_catalog
SET
  name = 'Consultar documentos proprios',
  description = 'Consultar documentos, atestados e termos do proprio cadastro.'
WHERE permission_key = 'employee_portal.documents';

INSERT INTO public.erp_staff_permission_overrides (owner_user_id, user_id, permission_key, allowed)
SELECT profile.owner_user_id, profile.user_id, 'employee_portal.view', true
FROM public.profiles profile
WHERE profile.role IN ('operator', 'waiter', 'hr')
  AND profile.owner_user_id IS NOT NULL
ON CONFLICT (user_id, permission_key) DO UPDATE SET
  owner_user_id = EXCLUDED.owner_user_id,
  allowed = true;

-- Portal e leitura: nenhuma acao de escrita deve sair do Portal do Funcionario.
DROP POLICY IF EXISTS hr_time_clock_entries_portal_insert ON public.hr_time_clock_entries;
DROP POLICY IF EXISTS hr_leave_requests_portal_insert ON public.hr_leave_requests;
DROP POLICY IF EXISTS hr_employee_documents_portal_insert ON public.hr_employee_documents;
DROP POLICY IF EXISTS hr_documents_storage_portal_insert ON storage.objects;

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
  RAISE EXCEPTION 'Portal do funcionario e somente leitura.';
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_hr_profile(text, text, text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_hr_profile(text, text, text, text, text, text, text, text, text, text, text, text) TO authenticated;

-- Corrige usuarios RH antigos que ficaram como operador porque Portal foi adicionado junto.
UPDATE public.profiles profile
SET role = 'hr'
WHERE profile.role IN ('operator', 'waiter')
  AND public.erp_user_has_permission(profile.user_id, 'hr.view')
  AND NOT EXISTS (
    SELECT 1
    FROM public.erp_staff_permission_overrides override_rule
    WHERE override_rule.user_id = profile.user_id
      AND override_rule.allowed
      AND override_rule.permission_key NOT LIKE 'hr.%'
      AND override_rule.permission_key NOT LIKE 'employee_portal.%'
  );
