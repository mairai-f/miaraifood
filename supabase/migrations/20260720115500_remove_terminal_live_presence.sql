DROP TRIGGER IF EXISTS assign_desktop_activation_terminal_trigger ON public.desktop_machine_activations;

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
BEGIN
  IF NEW.app_context <> 'happycash' THEN
    RETURN NEW;
  END IF;

  IF NEW.terminal_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.pos_terminals terminal
      WHERE terminal.id = NEW.terminal_id
        AND terminal.store_account_id = NEW.store_account_id
    ) THEN
      RAISE EXCEPTION 'Terminal nao pertence a empresa ativada.';
    END IF;
    RETURN NEW;
  END IF;

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
      installation_id, last_seen_at
    ) VALUES (
      NEW.store_account_id, NEW.owner_user_id, resolved_location_id,
      generated_code, COALESCE(NULLIF(trim(NEW.company_name), ''), generated_code),
      'desktop', NEW.installation_id, COALESCE(NEW.last_seen_at, now())
    )
    ON CONFLICT (store_account_id, installation_id) WHERE installation_id IS NOT NULL
    DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
    RETURNING id INTO resolved_terminal_id;
  ELSE
    UPDATE public.pos_terminals
    SET last_seen_at = COALESCE(NEW.last_seen_at, now()), active = true
    WHERE id = resolved_terminal_id;
  END IF;

  NEW.terminal_id := resolved_terminal_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_desktop_activation_terminal_trigger
BEFORE INSERT OR UPDATE OF store_account_id, owner_user_id, installation_id, app_context, terminal_id, last_seen_at
ON public.desktop_machine_activations
FOR EACH ROW EXECUTE FUNCTION public.assign_desktop_activation_terminal();

DROP INDEX IF EXISTS public.desktop_machine_activations_presence_idx;
DROP INDEX IF EXISTS public.pos_terminals_presence_idx;

ALTER TABLE public.desktop_machine_activations
  DROP COLUMN IF EXISTS current_user_id,
  DROP COLUMN IF EXISTS current_username,
  DROP COLUMN IF EXISTS current_email,
  DROP COLUMN IF EXISTS current_user_role,
  DROP COLUMN IF EXISTS current_session_started_at,
  DROP COLUMN IF EXISTS current_session_seen_at;

ALTER TABLE public.pos_terminals
  DROP COLUMN IF EXISTS current_user_id,
  DROP COLUMN IF EXISTS current_username,
  DROP COLUMN IF EXISTS current_email,
  DROP COLUMN IF EXISTS current_user_role,
  DROP COLUMN IF EXISTS current_session_started_at,
  DROP COLUMN IF EXISTS current_session_seen_at;
