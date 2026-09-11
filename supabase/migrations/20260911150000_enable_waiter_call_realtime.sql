-- Chamados feitos no QR Menu precisam chegar imediatamente à tela do garçom.
-- Sem esta publicação o registro era criado, mas os clientes conectados não
-- recebiam o evento que aciona som, notificação e atualização da lista.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.food_waiter_calls;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
