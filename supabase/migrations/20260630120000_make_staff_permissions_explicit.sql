-- Remove dependencia pratica de perfil-base sem alterar o acesso atual.
-- Cada permissao efetiva existente vira uma regra individual explicita.

INSERT INTO public.erp_staff_permission_overrides (
  owner_user_id, user_id, permission_key, allowed
)
SELECT profile.owner_user_id,
       profile.user_id,
       catalog.permission_key,
       public.erp_user_has_permission(profile.user_id, catalog.permission_key)
FROM public.profiles profile
CROSS JOIN public.erp_permission_catalog catalog
WHERE profile.role IN ('operator', 'waiter')
  AND profile.owner_user_id IS NOT NULL
ON CONFLICT (user_id, permission_key) DO NOTHING;

COMMENT ON TABLE public.erp_staff_permission_overrides IS
  'Regras explicitas de cada colaborador. O cadastro administrativo grava todas as chaves, sem perfil-base implicito.';
