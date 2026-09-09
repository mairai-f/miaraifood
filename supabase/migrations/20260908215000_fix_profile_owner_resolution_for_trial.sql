-- Perfis legados podem carregar owner_user_id desatualizado. Nessa situação a
-- sessão autenticada é dona da loja, mas as funções de plano consultavam outro
-- usuário e retornavam "Sem plano ativo". Só usa o dono do perfil se ele tiver
-- uma loja real; caso contrário, preserva o próprio auth.uid().
CREATE OR REPLACE FUNCTION public.get_current_store_owner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles profile
      JOIN public.store_accounts account ON account.owner_user_id = profile.owner_user_id
      WHERE profile.user_id = auth.uid()
    ) THEN (
      SELECT profile.owner_user_id FROM public.profiles profile WHERE profile.user_id = auth.uid() LIMIT 1
    )
    ELSE auth.uid()
  END;
$$;
