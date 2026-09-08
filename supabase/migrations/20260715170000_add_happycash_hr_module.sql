-- HappyCash ERP: modulo de Recursos Humanos isolado por permissao.
-- O acesso RH e um papel de colaborador separado: ve somente /rh no app.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'operator', 'waiter', 'hr'));

ALTER TABLE public.access_sessions
  DROP CONSTRAINT IF EXISTS access_sessions_role_check;

ALTER TABLE public.access_sessions
  ADD CONSTRAINT access_sessions_role_check
  CHECK (role IN ('admin', 'operator', 'waiter', 'hr'));

ALTER TABLE public.access_logs
  DROP CONSTRAINT IF EXISTS access_logs_role_check;

ALTER TABLE public.access_logs
  ADD CONSTRAINT access_logs_role_check
  CHECK (role IN ('admin', 'operator', 'waiter', 'hr'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  metadata_role text;
  metadata_owner_user_id uuid;
  metadata_created_by_user_id uuid;
BEGIN
  metadata_role := CASE lower(COALESCE(NEW.raw_user_meta_data->>'role', 'admin'))
    WHEN 'operator' THEN 'operator'
    WHEN 'waiter' THEN 'waiter'
    WHEN 'hr' THEN 'hr'
    ELSE 'admin'
  END;

  metadata_owner_user_id := NULLIF(NEW.raw_user_meta_data->>'owner_user_id', '')::uuid;
  metadata_created_by_user_id := NULLIF(NEW.raw_user_meta_data->>'created_by_user_id', '')::uuid;

  INSERT INTO public.profiles (user_id, username, email, role, owner_user_id, created_by_user_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email),
    NEW.email,
    metadata_role,
    COALESCE(metadata_owner_user_id, NEW.id),
    metadata_created_by_user_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    role = EXCLUDED.role,
    owner_user_id = COALESCE(public.profiles.owner_user_id, EXCLUDED.owner_user_id),
    created_by_user_id = COALESCE(public.profiles.created_by_user_id, EXCLUDED.created_by_user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.erp_permission_catalog
  ADD COLUMN IF NOT EXISTS default_hr boolean NOT NULL DEFAULT false;

INSERT INTO public.erp_permission_catalog (
  permission_key, module_key, name, description, runtime_scope, default_operator, default_waiter, default_hr
)
VALUES
  ('hr.view', 'hr', 'Acessar RH', 'Abrir o modulo de Recursos Humanos.', 'both', false, false, true),
  ('hr.employees.manage', 'hr', 'Gerenciar colaboradores do RH', 'Cadastrar, editar e desligar colaboradores no RH.', 'both', false, false, false),
  ('hr.documents.manage', 'hr', 'Gerenciar documentos de RH', 'Controlar documentos, vencimentos e arquivos trabalhistas.', 'both', false, false, false),
  ('hr.time_clock.manage', 'hr', 'Gerenciar ponto', 'Registrar, ajustar, aprovar e auditar marcacoes de ponto.', 'both', false, false, false),
  ('hr.schedules.manage', 'hr', 'Gerenciar escalas', 'Criar jornadas, escalas, tolerancias e atribuicoes.', 'both', false, false, false),
  ('hr.leave.manage', 'hr', 'Gerenciar afastamentos', 'Aprovar ferias, ausencias, licencas e abonos.', 'both', false, false, false),
  ('hr.payroll.manage', 'hr', 'Gerenciar folha', 'Controlar eventos, bases e fechamentos de folha.', 'both', false, false, false),
  ('hr.exports.manage', 'hr', 'Exportar dados de RH', 'Gerar arquivos e relatorios oficiais do modulo RH.', 'both', false, false, false),
  ('hr.audit.view', 'hr', 'Visualizar auditoria de RH', 'Consultar trilha de alteracoes sensiveis de RH.', 'both', false, false, false),
  ('hr.settings.manage', 'hr', 'Configurar RH', 'Ajustar regras gerais do modulo RH.', 'both', false, false, false)
ON CONFLICT (permission_key) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  runtime_scope = EXCLUDED.runtime_scope,
  default_operator = EXCLUDED.default_operator,
  default_waiter = EXCLUDED.default_waiter,
  default_hr = EXCLUDED.default_hr;

CREATE OR REPLACE FUNCTION public.ensure_default_erp_permission_groups(target_owner_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operator_group_id uuid;
  waiter_group_id uuid;
  hr_group_id uuid;
BEGIN
  IF target_owner_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.erp_permission_groups (owner_user_id, code, name, description, is_system)
  VALUES
    (target_owner_user_id, 'operator_default', 'Operador padrao', 'Acesso operacional inicial do PDV.', true),
    (target_owner_user_id, 'waiter_default', 'Garcom padrao', 'Acesso inicial para comandas.', true),
    (target_owner_user_id, 'hr_default', 'RH padrao', 'Acesso inicial e isolado para Recursos Humanos.', true)
  ON CONFLICT (owner_user_id, code) DO NOTHING;

  SELECT id INTO operator_group_id
  FROM public.erp_permission_groups
  WHERE owner_user_id = target_owner_user_id AND code = 'operator_default';

  SELECT id INTO waiter_group_id
  FROM public.erp_permission_groups
  WHERE owner_user_id = target_owner_user_id AND code = 'waiter_default';

  SELECT id INTO hr_group_id
  FROM public.erp_permission_groups
  WHERE owner_user_id = target_owner_user_id AND code = 'hr_default';

  INSERT INTO public.erp_permission_group_rules (owner_user_id, group_id, permission_key, allowed)
  SELECT target_owner_user_id, operator_group_id, permission_key, true
  FROM public.erp_permission_catalog
  WHERE default_operator
  ON CONFLICT (group_id, permission_key) DO NOTHING;

  INSERT INTO public.erp_permission_group_rules (owner_user_id, group_id, permission_key, allowed)
  SELECT target_owner_user_id, waiter_group_id, permission_key, true
  FROM public.erp_permission_catalog
  WHERE default_waiter
  ON CONFLICT (group_id, permission_key) DO NOTHING;

  INSERT INTO public.erp_permission_group_rules (owner_user_id, group_id, permission_key, allowed)
  SELECT target_owner_user_id, hr_group_id, permission_key, true
  FROM public.erp_permission_catalog
  WHERE default_hr
  ON CONFLICT (group_id, permission_key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_profile_default_erp_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_group_id uuid;
BEGIN
  IF NEW.role NOT IN ('operator', 'waiter', 'hr') THEN
    RETURN NEW;
  END IF;

  PERFORM public.ensure_default_erp_permission_groups(NEW.owner_user_id);

  SELECT id INTO default_group_id
  FROM public.erp_permission_groups
  WHERE owner_user_id = NEW.owner_user_id
    AND code = CASE
      WHEN NEW.role = 'waiter' THEN 'waiter_default'
      WHEN NEW.role = 'hr' THEN 'hr_default'
      ELSE 'operator_default'
    END;

  IF TG_OP = 'UPDATE' AND (OLD.role, OLD.owner_user_id) IS DISTINCT FROM (NEW.role, NEW.owner_user_id) THEN
    DELETE FROM public.erp_staff_group_memberships WHERE user_id = NEW.user_id;
  END IF;

  INSERT INTO public.erp_staff_group_memberships (owner_user_id, user_id, group_id)
  VALUES (NEW.owner_user_id, NEW.user_id, default_group_id)
  ON CONFLICT (user_id, group_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  owner_record record;
BEGIN
  FOR owner_record IN SELECT DISTINCT owner_user_id FROM public.profiles LOOP
    PERFORM public.ensure_default_erp_permission_groups(owner_record.owner_user_id);
  END LOOP;
END;
$$;

INSERT INTO public.erp_staff_group_memberships (owner_user_id, user_id, group_id)
SELECT profile.owner_user_id, profile.user_id, permission_group.id
FROM public.profiles profile
JOIN public.erp_permission_groups permission_group
  ON permission_group.owner_user_id = profile.owner_user_id
 AND permission_group.code = CASE
   WHEN profile.role = 'waiter' THEN 'waiter_default'
   WHEN profile.role = 'hr' THEN 'hr_default'
   ELSE 'operator_default'
 END
WHERE profile.role IN ('operator', 'waiter', 'hr')
ON CONFLICT (user_id, group_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.erp_user_has_permission(target_user_id uuid, target_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role text;
  override_value boolean;
  grouped_value boolean;
  default_value boolean;
BEGIN
  SELECT role INTO target_role FROM public.profiles WHERE user_id = target_user_id;
  IF target_role IS NULL THEN RETURN false; END IF;
  IF target_role = 'admin' THEN RETURN true; END IF;

  SELECT allowed INTO override_value
  FROM public.erp_staff_permission_overrides
  WHERE user_id = target_user_id AND permission_key = target_permission_key;
  IF FOUND THEN RETURN override_value; END IF;

  SELECT bool_or(rule.allowed) INTO grouped_value
  FROM public.erp_staff_group_memberships membership
  JOIN public.erp_permission_group_rules rule
    ON rule.group_id = membership.group_id
   AND rule.owner_user_id = membership.owner_user_id
  WHERE membership.user_id = target_user_id
    AND rule.permission_key = target_permission_key;
  IF grouped_value IS NOT NULL THEN RETURN grouped_value; END IF;

  SELECT CASE
    WHEN target_role = 'waiter' THEN default_waiter
    WHEN target_role = 'hr' THEN default_hr
    ELSE default_operator
  END INTO default_value
  FROM public.erp_permission_catalog
  WHERE permission_key = target_permission_key;

  RETURN COALESCE(default_value, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_erp_permissions(target_user_id uuid)
RETURNS TABLE (
  permission_key text,
  module_key text,
  name text,
  description text,
  runtime_scope text,
  effective_allowed boolean,
  override_allowed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem consultar permissoes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = target_user_id
      AND owner_user_id = public.get_current_store_owner_id()
      AND role IN ('operator', 'waiter', 'hr')
  ) THEN
    RAISE EXCEPTION 'Colaborador nao pertence a esta loja.';
  END IF;

  RETURN QUERY
  SELECT catalog.permission_key,
         catalog.module_key,
         catalog.name,
         catalog.description,
         catalog.runtime_scope,
         public.erp_user_has_permission(target_user_id, catalog.permission_key),
         override_rule.allowed
  FROM public.erp_permission_catalog catalog
  LEFT JOIN public.erp_staff_permission_overrides override_rule
    ON override_rule.user_id = target_user_id
   AND override_rule.permission_key = catalog.permission_key
  ORDER BY catalog.module_key, catalog.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_erp_permission_override(
  target_user_id uuid,
  target_permission_key text,
  target_allowed boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  store_owner_id uuid := public.get_current_store_owner_id();
BEGIN
  IF NOT public.current_user_is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem alterar permissoes.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = target_user_id
      AND owner_user_id = store_owner_id
      AND role IN ('operator', 'waiter', 'hr')
  ) THEN
    RAISE EXCEPTION 'Colaborador nao pertence a esta loja.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.erp_permission_catalog WHERE permission_key = target_permission_key
  ) THEN
    RAISE EXCEPTION 'Permissao desconhecida.';
  END IF;

  IF target_allowed IS NULL THEN
    DELETE FROM public.erp_staff_permission_overrides
    WHERE user_id = target_user_id AND permission_key = target_permission_key;
  ELSE
    INSERT INTO public.erp_staff_permission_overrides (
      owner_user_id, user_id, permission_key, allowed
    ) VALUES (
      store_owner_id, target_user_id, target_permission_key, target_allowed
    )
    ON CONFLICT (user_id, permission_key) DO UPDATE SET
      allowed = EXCLUDED.allowed,
      owner_user_id = EXCLUDED.owner_user_id,
      updated_at = now();
  END IF;
END;
$$;

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('demo', 'hr.manage', true),
  ('completo', 'hr.manage', true),
  ('pro', 'hr.manage', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;

CREATE TABLE IF NOT EXISTS public.hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_code text,
  full_name text NOT NULL,
  preferred_name text,
  cpf text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'terminated', 'on_leave')),
  employment_type text NOT NULL DEFAULT 'clt'
    CHECK (employment_type IN ('clt', 'pj', 'intern', 'temporary', 'third_party', 'other')),
  admission_date date,
  termination_date date,
  department text,
  position text,
  work_location_id uuid REFERENCES public.store_locations(id) ON DELETE SET NULL,
  manager_employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  salary_amount numeric(12,2) NOT NULL DEFAULT 0,
  salary_type text NOT NULL DEFAULT 'monthly'
    CHECK (salary_type IN ('hourly', 'daily', 'monthly', 'commission', 'other')),
  benefits jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  title text NOT NULL,
  file_url text,
  expires_at date,
  sensitive boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  weekly_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  tolerance_minutes integer NOT NULL DEFAULT 0 CHECK (tolerance_minutes >= 0),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_employee_schedule_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES public.hr_work_schedules(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_time_clock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  entry_type text NOT NULL
    CHECK (entry_type IN ('entry', 'break_start', 'break_end', 'exit', 'manual_adjustment')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'kiosk', 'mobile', 'manual', 'import')),
  status text NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'pending_approval', 'adjusted', 'canceled')),
  schedule_id uuid REFERENCES public.hr_work_schedules(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL
    CHECK (leave_type IN ('vacation', 'sick_leave', 'absence', 'maternity', 'paternity', 'bereavement', 'other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'approved', 'rejected', 'canceled')),
  reason text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.hr_payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'closed', 'exported', 'canceled')),
  gross_total numeric(12,2) NOT NULL DEFAULT 0,
  net_total numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.hr_payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payroll_run_id uuid NOT NULL REFERENCES public.hr_payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  description text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('earning', 'discount', 'base', 'info')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  quantity numeric(12,4),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hr_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.hr_employees(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_owner_code_idx
  ON public.hr_employees(owner_user_id, employee_code)
  WHERE employee_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_owner_cpf_idx
  ON public.hr_employees(owner_user_id, cpf)
  WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS hr_employees_owner_status_idx
  ON public.hr_employees(owner_user_id, status, full_name);
CREATE INDEX IF NOT EXISTS hr_employee_documents_owner_employee_idx
  ON public.hr_employee_documents(owner_user_id, employee_id, expires_at);
CREATE INDEX IF NOT EXISTS hr_employee_compensation_owner_employee_idx
  ON public.hr_employee_compensation(owner_user_id, employee_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS hr_work_schedules_owner_idx
  ON public.hr_work_schedules(owner_user_id, active, name);
CREATE INDEX IF NOT EXISTS hr_employee_schedule_assignments_owner_employee_idx
  ON public.hr_employee_schedule_assignments(owner_user_id, employee_id, starts_on DESC);
CREATE INDEX IF NOT EXISTS hr_time_clock_entries_owner_employee_idx
  ON public.hr_time_clock_entries(owner_user_id, employee_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS hr_leave_requests_owner_status_idx
  ON public.hr_leave_requests(owner_user_id, status, start_date DESC);
CREATE INDEX IF NOT EXISTS hr_payroll_runs_owner_period_idx
  ON public.hr_payroll_runs(owner_user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS hr_payroll_items_owner_run_idx
  ON public.hr_payroll_items(owner_user_id, payroll_run_id);
CREATE INDEX IF NOT EXISTS hr_audit_events_owner_created_idx
  ON public.hr_audit_events(owner_user_id, created_at DESC);

DROP TRIGGER IF EXISTS touch_hr_employees_updated_at ON public.hr_employees;
CREATE TRIGGER touch_hr_employees_updated_at
BEFORE UPDATE ON public.hr_employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_hr_employee_compensation_updated_at ON public.hr_employee_compensation;
CREATE TRIGGER touch_hr_employee_compensation_updated_at
BEFORE UPDATE ON public.hr_employee_compensation
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_hr_employee_documents_updated_at ON public.hr_employee_documents;
CREATE TRIGGER touch_hr_employee_documents_updated_at
BEFORE UPDATE ON public.hr_employee_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_hr_work_schedules_updated_at ON public.hr_work_schedules;
CREATE TRIGGER touch_hr_work_schedules_updated_at
BEFORE UPDATE ON public.hr_work_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_hr_time_clock_entries_updated_at ON public.hr_time_clock_entries;
CREATE TRIGGER touch_hr_time_clock_entries_updated_at
BEFORE UPDATE ON public.hr_time_clock_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_hr_leave_requests_updated_at ON public.hr_leave_requests;
CREATE TRIGGER touch_hr_leave_requests_updated_at
BEFORE UPDATE ON public.hr_leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS touch_hr_payroll_runs_updated_at ON public.hr_payroll_runs;
CREATE TRIGGER touch_hr_payroll_runs_updated_at
BEFORE UPDATE ON public.hr_payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_schedule_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_time_clock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hr_employees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_compensation FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_work_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_schedule_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_time_clock_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_leave_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_payroll_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.hr_audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hr_employees_select ON public.hr_employees;
CREATE POLICY hr_employees_select ON public.hr_employees
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.view')
);

DROP POLICY IF EXISTS hr_employees_write ON public.hr_employees;
CREATE POLICY hr_employees_write ON public.hr_employees
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.employees.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.employees.manage')
);

DROP POLICY IF EXISTS hr_employee_compensation_access ON public.hr_employee_compensation;
CREATE POLICY hr_employee_compensation_access ON public.hr_employee_compensation
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.payroll.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.payroll.manage')
);

DROP POLICY IF EXISTS hr_employee_documents_access ON public.hr_employee_documents;
CREATE POLICY hr_employee_documents_access ON public.hr_employee_documents
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.documents.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.documents.manage')
);

DROP POLICY IF EXISTS hr_work_schedules_select ON public.hr_work_schedules;
CREATE POLICY hr_work_schedules_select ON public.hr_work_schedules
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.view')
);

DROP POLICY IF EXISTS hr_work_schedules_write ON public.hr_work_schedules;
CREATE POLICY hr_work_schedules_write ON public.hr_work_schedules
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.schedules.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.schedules.manage')
);

DROP POLICY IF EXISTS hr_employee_schedule_assignments_select ON public.hr_employee_schedule_assignments;
CREATE POLICY hr_employee_schedule_assignments_select ON public.hr_employee_schedule_assignments
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.view')
);

DROP POLICY IF EXISTS hr_employee_schedule_assignments_write ON public.hr_employee_schedule_assignments;
CREATE POLICY hr_employee_schedule_assignments_write ON public.hr_employee_schedule_assignments
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.schedules.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.schedules.manage')
);

DROP POLICY IF EXISTS hr_time_clock_entries_access ON public.hr_time_clock_entries;
CREATE POLICY hr_time_clock_entries_access ON public.hr_time_clock_entries
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND (
    public.current_user_has_erp_permission('hr.time_clock.manage')
    OR public.current_user_has_erp_permission('hr.view')
  )
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.time_clock.manage')
);

DROP POLICY IF EXISTS hr_leave_requests_access ON public.hr_leave_requests;
CREATE POLICY hr_leave_requests_access ON public.hr_leave_requests
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND (
    public.current_user_has_erp_permission('hr.leave.manage')
    OR public.current_user_has_erp_permission('hr.view')
  )
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.leave.manage')
);

DROP POLICY IF EXISTS hr_payroll_runs_access ON public.hr_payroll_runs;
CREATE POLICY hr_payroll_runs_access ON public.hr_payroll_runs
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.payroll.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.payroll.manage')
);

DROP POLICY IF EXISTS hr_payroll_items_access ON public.hr_payroll_items;
CREATE POLICY hr_payroll_items_access ON public.hr_payroll_items
FOR ALL TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.payroll.manage')
)
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.payroll.manage')
);

DROP POLICY IF EXISTS hr_audit_events_select ON public.hr_audit_events;
CREATE POLICY hr_audit_events_select ON public.hr_audit_events
FOR SELECT TO authenticated
USING (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.audit.view')
);

DROP POLICY IF EXISTS hr_audit_events_insert ON public.hr_audit_events;
CREATE POLICY hr_audit_events_insert ON public.hr_audit_events
FOR INSERT TO authenticated
WITH CHECK (
  owner_user_id = public.get_current_store_owner_id()
  AND public.current_store_has_feature('hr.manage')
  AND public.current_user_has_erp_permission('hr.view')
);

COMMENT ON TABLE public.hr_employees IS 'Cadastro funcional de colaboradores gerido pelo modulo HappyCash RH.';
COMMENT ON TABLE public.hr_employee_compensation IS 'Dados salariais isolados por permissao de folha.';
COMMENT ON TABLE public.hr_time_clock_entries IS 'Marcacoes de ponto, ajustes e importacoes do RH.';
COMMENT ON TABLE public.hr_payroll_runs IS 'Fechamentos de folha e bases para exportacao.';
