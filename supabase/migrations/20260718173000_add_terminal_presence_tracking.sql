ALTER TABLE public.desktop_machine_activations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS current_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_username text,
  ADD COLUMN IF NOT EXISTS current_email text,
  ADD COLUMN IF NOT EXISTS current_user_role text,
  ADD COLUMN IF NOT EXISTS current_session_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_session_seen_at timestamptz;

ALTER TABLE public.pos_terminals
  ADD COLUMN IF NOT EXISTS current_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_username text,
  ADD COLUMN IF NOT EXISTS current_email text,
  ADD COLUMN IF NOT EXISTS current_user_role text,
  ADD COLUMN IF NOT EXISTS current_session_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_session_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS desktop_machine_activations_presence_idx
  ON public.desktop_machine_activations(store_account_id, current_user_id, current_session_seen_at DESC)
  WHERE current_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pos_terminals_presence_idx
  ON public.pos_terminals(store_account_id, current_user_id, current_session_seen_at DESC)
  WHERE current_user_id IS NOT NULL;

COMMENT ON COLUMN public.desktop_machine_activations.current_user_id IS
  'Usuario atualmente identificado nesta instalacao desktop. Substitui o historico de login para reduzir escrita e egress.';
COMMENT ON COLUMN public.pos_terminals.current_user_id IS
  'Usuario atualmente identificado neste terminal. Web e mobile nao criam terminais automaticamente.';

DROP TRIGGER IF EXISTS touch_desktop_machine_activations_updated_at ON public.desktop_machine_activations;
CREATE TRIGGER touch_desktop_machine_activations_updated_at
BEFORE UPDATE ON public.desktop_machine_activations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.assign_desktop_activation_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_location_id uuid;
  resolved_terminal_id uuid;
  generated_code text;
  terminal_last_seen_at timestamptz;
BEGIN
  IF NEW.app_context <> 'happycash' THEN
    RETURN NEW;
  END IF;

  terminal_last_seen_at := COALESCE(NEW.current_session_seen_at, NEW.last_seen_at, now());

  IF NEW.terminal_id IS NOT NULL THEN
    SELECT terminal.id INTO resolved_terminal_id
    FROM public.pos_terminals terminal
    WHERE terminal.id = NEW.terminal_id
      AND terminal.store_account_id = NEW.store_account_id
    LIMIT 1;

    IF resolved_terminal_id IS NULL THEN
      RAISE EXCEPTION 'Terminal nao pertence a empresa ativada.';
    END IF;
  ELSE
    SELECT terminal.id INTO resolved_terminal_id
    FROM public.pos_terminals terminal
    WHERE terminal.store_account_id = NEW.store_account_id
      AND terminal.installation_id = NEW.installation_id
    LIMIT 1;

    IF resolved_terminal_id IS NULL THEN
      SELECT location.id INTO resolved_location_id
      FROM public.store_locations location
      WHERE location.store_account_id = NEW.store_account_id
        AND location.is_headquarters
      LIMIT 1;

      generated_code := 'DESK-' || upper(substr(md5(NEW.installation_id), 1, 10));
      INSERT INTO public.pos_terminals (
        store_account_id, owner_user_id, location_id, code, name, terminal_type,
        installation_id, last_seen_at, current_user_id, current_username, current_email,
        current_user_role, current_session_started_at, current_session_seen_at
      ) VALUES (
        NEW.store_account_id, NEW.owner_user_id, resolved_location_id,
        generated_code, COALESCE(NULLIF(trim(NEW.company_name), ''), generated_code),
        'desktop', NEW.installation_id, terminal_last_seen_at, NEW.current_user_id,
        NEW.current_username, NEW.current_email, NEW.current_user_role,
        NEW.current_session_started_at, NEW.current_session_seen_at
      )
      ON CONFLICT (store_account_id, installation_id) WHERE installation_id IS NOT NULL
      DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
      RETURNING id INTO resolved_terminal_id;
    END IF;
  END IF;

  IF NEW.current_user_id IS NULL THEN
    UPDATE public.pos_terminals
    SET last_seen_at = terminal_last_seen_at,
        active = true,
        current_user_id = NULL,
        current_username = NULL,
        current_email = NULL,
        current_user_role = NULL,
        current_session_started_at = NULL,
        current_session_seen_at = NULL
    WHERE id = resolved_terminal_id;
  ELSE
    UPDATE public.pos_terminals terminal
    SET last_seen_at = terminal_last_seen_at,
        active = true,
        current_user_id = NEW.current_user_id,
        current_username = NEW.current_username,
        current_email = NEW.current_email,
        current_user_role = NEW.current_user_role,
        current_session_started_at = CASE
          WHEN terminal.current_user_id = NEW.current_user_id
            AND terminal.current_session_started_at IS NOT NULL
          THEN terminal.current_session_started_at
          ELSE COALESCE(NEW.current_session_started_at, terminal_last_seen_at)
        END,
        current_session_seen_at = terminal_last_seen_at
    WHERE terminal.id = resolved_terminal_id;
  END IF;

  NEW.terminal_id := resolved_terminal_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_desktop_activation_terminal_trigger ON public.desktop_machine_activations;
CREATE TRIGGER assign_desktop_activation_terminal_trigger
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id, installation_id, app_context, terminal_id,
  last_seen_at, current_user_id, current_username, current_email, current_user_role,
  current_session_started_at, current_session_seen_at
ON public.desktop_machine_activations
FOR EACH ROW EXECUTE FUNCTION public.assign_desktop_activation_terminal();
