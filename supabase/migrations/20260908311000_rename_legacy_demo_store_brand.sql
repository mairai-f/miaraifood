-- Atualiza somente o estabelecimento de demonstração conhecido. Contas reais
-- com nome escolhido pelo cliente nunca são alteradas automaticamente.
UPDATE public.store_accounts
SET nome_estabelecimento = 'Bistrô Miar Demo'
WHERE nome_estabelecimento = 'Loja Demo HappyCash';

UPDATE public.system_account_registry
SET store_name = 'Bistrô Miar Demo'
WHERE store_name = 'Loja Demo HappyCash';
