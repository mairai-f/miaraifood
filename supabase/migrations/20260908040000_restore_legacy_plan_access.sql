-- Contas históricas continuam precisando ler suas permissões. A oferta pública
-- do site usa a lista nova de planos e não depende deste sinal de compatibilidade.
UPDATE public.subscription_plans
SET is_public = true,
    is_active = true
WHERE id IN ('fiado', 'completo', 'pro');
