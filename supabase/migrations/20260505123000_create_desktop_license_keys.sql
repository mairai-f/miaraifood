-- # Chaves de licenca do HappyCash PRO Offline
-- # A chave fica liberada somente depois que o plano PRO estiver ativo.
-- # O texto completo da chave nao fica gravado puro; a Edge Function recalcula e exibe ao dono da conta.

CREATE TABLE IF NOT EXISTS public.desktop_license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.store_subscriptions(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL DEFAULT 'HC-PRO',
  key_suffix text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id)
);
COMMENT ON TABLE public.desktop_license_keys IS
  '# Registro auditavel das chaves PRO Offline. Guarda hash, prefixo e final da chave; a chave completa e recalculada por HMAC na Edge Function desktop-license-key.';
COMMENT ON COLUMN public.desktop_license_keys.owner_user_id IS
  '# Dono da loja que pagou o Plano PRO e pode ver/usar a chave.';
COMMENT ON COLUMN public.desktop_license_keys.subscription_id IS
  '# Assinatura PRO ativa que originou a chave. Pagamento aprovado no Asaas ativa a assinatura antes da chave aparecer.';
COMMENT ON COLUMN public.desktop_license_keys.key_hash IS
  '# Hash SHA-256 da chave de licenca. Nao salve a chave pura no banco.';
CREATE INDEX IF NOT EXISTS desktop_license_keys_owner_status_idx
  ON public.desktop_license_keys(owner_user_id, status, issued_at DESC);
CREATE INDEX IF NOT EXISTS desktop_license_keys_subscription_idx
  ON public.desktop_license_keys(subscription_id);
ALTER TABLE public.desktop_license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desktop_license_keys FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "desktop_license_keys_select_owner" ON public.desktop_license_keys;
CREATE POLICY "desktop_license_keys_select_owner"
ON public.desktop_license_keys
FOR SELECT
TO authenticated
USING (owner_user_id = public.get_current_store_owner_id());
DROP TRIGGER IF EXISTS update_desktop_license_keys_updated_at ON public.desktop_license_keys;
CREATE TRIGGER update_desktop_license_keys_updated_at
BEFORE UPDATE ON public.desktop_license_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
