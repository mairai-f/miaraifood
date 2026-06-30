-- A funcao exibida do colaborador e definida livremente pelo administrador.
-- O campo `role` continua exclusivamente tecnico para autenticacao e seguranca.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title text;

UPDATE public.profiles
SET job_title = CASE role
  WHEN 'waiter' THEN 'Garcom'
  WHEN 'operator' THEN 'Operador do caixa'
  ELSE 'Administrador'
END
WHERE job_title IS NULL OR btrim(job_title) = '';

-- A partir desta versao nao existem perfis funcionais predefinidos. Todo
-- colaborador usa o papel tecnico `operator` e recebe acessos explicitos.
UPDATE public.profiles
SET role = 'operator'
WHERE role = 'waiter';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_job_title_length_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_job_title_length_check
  CHECK (job_title IS NULL OR char_length(btrim(job_title)) BETWEEN 2 AND 60);

COMMENT ON COLUMN public.profiles.job_title IS
  'Nome livre da funcao do colaborador, definido pelo administrador; nao concede permissoes.';
