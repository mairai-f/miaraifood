-- Toda empresa precisa da filial matriz para operar: o escopo operacional do
-- app resolve filial e terminal a partir de store_locations, e sem nenhuma
-- linha visível o cadastro de mesas, o PDV e o salão ficam inertes -- a tela
-- simplesmente não responde ao clique.
--
-- A matriz era criada apenas por um backfill de 20260629173000, que rodou uma
-- única vez. Empresas cadastradas depois disso dependiam da edge function
-- finalize-site-registration, que só materializa a filial se estiver
-- publicada. O banco passa a garantir isso sozinho.

CREATE OR REPLACE FUNCTION public.ensure_store_account_headquarters(p_store_account_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_account public.store_accounts;
  v_location_id uuid;
BEGIN
  SELECT * INTO v_account FROM public.store_accounts WHERE id = p_store_account_id;
  -- Só o contexto happycash aceita filial: validate_erp_location_scope rejeita
  -- qualquer outro, e uma exceção aqui abortaria a criação da própria empresa.
  IF NOT FOUND OR v_account.product_context <> 'happycash' THEN
    RETURN NULL;
  END IF;

  SELECT location.id INTO v_location_id
  FROM public.store_locations location
  WHERE location.store_account_id = v_account.id
    AND (location.is_headquarters OR upper(trim(location.code)) = 'MATRIZ')
  ORDER BY location.is_headquarters DESC, location.created_at
  LIMIT 1;

  IF v_location_id IS NULL THEN
    INSERT INTO public.store_locations (
      store_account_id, owner_user_id, code, name, location_type, is_headquarters,
      document, phone, email, postal_code, street, street_number, complement,
      district, city, state
    ) VALUES (
      v_account.id,
      v_account.owner_user_id,
      'MATRIZ',
      COALESCE(NULLIF(trim(v_account.nome_estabelecimento), ''), 'Matriz'),
      'headquarters',
      true,
      COALESCE(v_account.cnpj, ''),
      COALESCE(v_account.telefone, ''),
      COALESCE(v_account.email, ''),
      COALESCE(v_account.cep, ''),
      COALESCE(NULLIF(v_account.nome_rua, ''), v_account.endereco, ''),
      COALESCE(v_account.numero, ''),
      COALESCE(v_account.complemento, ''),
      COALESCE(v_account.bairro, ''),
      COALESCE(v_account.cidade, ''),
      COALESCE(v_account.estado, '')
    )
    RETURNING id INTO v_location_id;
  END IF;

  -- Terminal Web de compatibilidade: o PDV Web e o salão operam sem ativação
  -- de máquina, então a matriz precisa de um terminal desde o primeiro acesso.
  INSERT INTO public.pos_terminals (
    store_account_id, owner_user_id, location_id, code, name, terminal_type
  ) VALUES (
    v_account.id, v_account.owner_user_id, v_location_id, 'LEGACY', 'Terminal padrao', 'web'
  )
  ON CONFLICT (store_account_id, code) DO NOTHING;

  RETURN v_location_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_store_account_headquarters(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.store_accounts_ensure_headquarters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_store_account_headquarters(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_accounts_headquarters ON public.store_accounts;
CREATE TRIGGER store_accounts_headquarters
AFTER INSERT ON public.store_accounts
FOR EACH ROW EXECUTE FUNCTION public.store_accounts_ensure_headquarters();

-- Empresas que já existem sem matriz recebem a filial agora, com o nome e o
-- e-mail do próprio cadastro. Quem já tem matriz não é tocado.
DO $$
DECLARE v_account_id uuid;
BEGIN
  FOR v_account_id IN
    SELECT account.id FROM public.store_accounts account
    WHERE account.product_context = 'happycash'
      AND NOT EXISTS (
        SELECT 1 FROM public.store_locations location
        WHERE location.store_account_id = account.id AND location.is_headquarters
      )
  LOOP
    PERFORM public.ensure_store_account_headquarters(v_account_id);
  END LOOP;
END $$;
