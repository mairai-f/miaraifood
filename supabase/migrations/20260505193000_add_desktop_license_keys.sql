ALTER TABLE public.store_accounts
  ADD COLUMN IF NOT EXISTS desktop_license_key text;

CREATE OR REPLACE FUNCTION public.generate_store_desktop_license_key()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  raw_value text;
BEGIN
  raw_value := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
  RETURN 'HC-' || substring(raw_value from 1 for 4)
    || '-' || substring(raw_value from 5 for 4)
    || '-' || substring(raw_value from 9 for 4);
END;
$$;

UPDATE public.store_accounts
SET desktop_license_key = public.generate_store_desktop_license_key()
WHERE COALESCE(trim(desktop_license_key), '') = '';

ALTER TABLE public.store_accounts
  ALTER COLUMN desktop_license_key SET DEFAULT public.generate_store_desktop_license_key();

ALTER TABLE public.store_accounts
  ALTER COLUMN desktop_license_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS store_accounts_desktop_license_key_uidx
  ON public.store_accounts (desktop_license_key);

CREATE OR REPLACE FUNCTION public.ensure_store_account_desktop_license_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(trim(NEW.desktop_license_key), '') = '' THEN
    NEW.desktop_license_key := public.generate_store_desktop_license_key();
  END IF;

  NEW.desktop_license_key := upper(trim(NEW.desktop_license_key));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_store_account_desktop_license_key_trigger ON public.store_accounts;
CREATE TRIGGER ensure_store_account_desktop_license_key_trigger
BEFORE INSERT OR UPDATE OF desktop_license_key ON public.store_accounts
FOR EACH ROW
EXECUTE FUNCTION public.ensure_store_account_desktop_license_key();

CREATE TABLE IF NOT EXISTS public.desktop_machine_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id text NOT NULL,
  platform text,
  app_version text,
  company_name text,
  activated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS desktop_machine_activations_store_account_idx
  ON public.desktop_machine_activations (store_account_id, activated_at DESC);

CREATE INDEX IF NOT EXISTS desktop_machine_activations_owner_idx
  ON public.desktop_machine_activations (owner_user_id, activated_at DESC);
