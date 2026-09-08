-- HappyCash RH: evita novos colaboradores com o mesmo nome completo na mesma loja.

CREATE OR REPLACE FUNCTION public.happycash_normalized_person_name(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(value, '')), '[[:space:]]+', ' ', 'g'))
$$;

DO $$
DECLARE
  duplicate_count integer := 0;
BEGIN
  SELECT count(*)
  INTO duplicate_count
  FROM (
    SELECT owner_user_id, public.happycash_normalized_person_name(full_name) AS normalized_name
    FROM public.hr_employees
    WHERE public.happycash_normalized_person_name(full_name) <> ''
    GROUP BY owner_user_id, public.happycash_normalized_person_name(full_name)
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_count = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS hr_employees_owner_full_name_normalized_uidx
      ON public.hr_employees(owner_user_id, public.happycash_normalized_person_name(full_name))
      WHERE public.happycash_normalized_person_name(full_name) <> '';
  ELSE
    RAISE NOTICE 'Skipping unique RH employee name index because duplicate names already exist.';
  END IF;
END $$;
