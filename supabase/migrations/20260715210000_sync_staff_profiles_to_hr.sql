-- HappyCash RH: manter acessos de colaboradores visiveis no cadastro de RH.

CREATE INDEX IF NOT EXISTS hr_employees_profile_user_id_idx
  ON public.hr_employees(profile_user_id)
  WHERE profile_user_id IS NOT NULL;

WITH staff_profiles AS (
  SELECT
    profile.user_id,
    COALESCE(profile.owner_user_id, profile.user_id) AS owner_user_id,
    NULLIF(btrim(profile.username), '') AS username,
    NULLIF(btrim(profile.email), '') AS email,
    profile.role,
    NULLIF(btrim(profile.job_title), '') AS job_title,
    profile.created_by_user_id,
    profile.created_at
  FROM public.profiles profile
  WHERE profile.role IN ('operator', 'waiter', 'hr')
    AND COALESCE(profile.owner_user_id, profile.user_id) IS NOT NULL
),
prepared AS (
  SELECT
    staff.*,
    COALESCE(staff.username, staff.email, 'Colaborador ' || left(staff.user_id::text, 8)) AS full_name,
    CASE
      WHEN staff.email IS NULL THEN NULL
      WHEN staff.email LIKE '%@operators.happycash.local' THEN NULL
      WHEN staff.email LIKE '%@happycash.local' THEN NULL
      ELSE lower(staff.email)
    END AS employee_email,
    COALESCE(
      staff.job_title,
      CASE staff.role
        WHEN 'hr' THEN 'Analista de RH'
        ELSE 'Colaborador'
      END
    ) AS position_name
  FROM staff_profiles staff
)
INSERT INTO public.hr_employees (
  owner_user_id,
  profile_user_id,
  full_name,
  preferred_name,
  email,
  status,
  employment_type,
  department,
  position,
  created_by,
  updated_by,
  created_at,
  updated_at
)
SELECT
  prepared.owner_user_id,
  prepared.user_id,
  prepared.full_name,
  prepared.username,
  prepared.employee_email,
  'active',
  'other',
  CASE WHEN prepared.role = 'hr' THEN 'RH' ELSE NULL END,
  prepared.position_name,
  prepared.created_by_user_id,
  prepared.created_by_user_id,
  COALESCE(prepared.created_at, now()),
  now()
FROM prepared
WHERE NOT EXISTS (
  SELECT 1
  FROM public.hr_employees employee
  WHERE employee.profile_user_id = prepared.user_id
);

WITH staff_profiles AS (
  SELECT
    profile.user_id,
    COALESCE(profile.owner_user_id, profile.user_id) AS owner_user_id,
    NULLIF(btrim(profile.username), '') AS username,
    NULLIF(btrim(profile.email), '') AS email,
    profile.role,
    NULLIF(btrim(profile.job_title), '') AS job_title,
    profile.created_by_user_id
  FROM public.profiles profile
  WHERE profile.role IN ('operator', 'waiter', 'hr')
    AND COALESCE(profile.owner_user_id, profile.user_id) IS NOT NULL
),
prepared AS (
  SELECT
    staff.*,
    COALESCE(staff.username, staff.email, 'Colaborador ' || left(staff.user_id::text, 8)) AS full_name,
    CASE
      WHEN staff.email IS NULL THEN NULL
      WHEN staff.email LIKE '%@operators.happycash.local' THEN NULL
      WHEN staff.email LIKE '%@happycash.local' THEN NULL
      ELSE lower(staff.email)
    END AS employee_email,
    COALESCE(
      staff.job_title,
      CASE staff.role
        WHEN 'hr' THEN 'Analista de RH'
        ELSE 'Colaborador'
      END
    ) AS position_name
  FROM staff_profiles staff
)
UPDATE public.hr_employees employee
SET
  owner_user_id = prepared.owner_user_id,
  full_name = COALESCE(NULLIF(btrim(employee.full_name), ''), prepared.full_name),
  preferred_name = COALESCE(NULLIF(btrim(employee.preferred_name), ''), prepared.username),
  email = COALESCE(NULLIF(btrim(employee.email), ''), prepared.employee_email),
  status = CASE WHEN employee.status = 'terminated' THEN employee.status ELSE 'active' END,
  department = CASE WHEN prepared.role = 'hr' THEN 'RH' ELSE employee.department END,
  position = COALESCE(NULLIF(btrim(employee.position), ''), prepared.position_name),
  updated_by = COALESCE(prepared.created_by_user_id, employee.updated_by),
  updated_at = now()
FROM prepared
WHERE employee.profile_user_id = prepared.user_id;
