CREATE OR REPLACE FUNCTION public.delete_pos_terminal_operationally(target_terminal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  account_id uuid := public.get_current_store_account_id_for_context('happycash');
  terminal_row public.pos_terminals%ROWTYPE;
  revoked_desktops integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida. Faca login novamente.';
  END IF;

  IF NOT public.current_user_is_admin()
    OR NOT public.current_user_has_erp_permission('multi_store.manage') THEN
    RAISE EXCEPTION 'Somente administrador com acesso a filiais pode excluir terminais.';
  END IF;

  SELECT *
  INTO terminal_row
  FROM public.pos_terminals
  WHERE id = target_terminal_id
    AND owner_user_id = owner_id
    AND store_account_id = account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Terminal nao encontrado.';
  END IF;

  IF terminal_row.code = 'LEGACY' THEN
    RAISE EXCEPTION 'O terminal padrao da Matriz nao pode ser excluido.';
  END IF;

  DELETE FROM public.desktop_machine_activations activation
  WHERE activation.store_account_id = terminal_row.store_account_id
    AND activation.owner_user_id = terminal_row.owner_user_id
    AND activation.app_context = 'happycash'
    AND (
      activation.terminal_id = terminal_row.id
      OR (
        terminal_row.installation_id IS NOT NULL
        AND activation.installation_id = terminal_row.installation_id
      )
    );
  GET DIAGNOSTICS revoked_desktops = ROW_COUNT;

  DELETE FROM public.pos_terminals
  WHERE id = terminal_row.id;

  RETURN jsonb_build_object(
    'success', true,
    'deletedTerminalId', terminal_row.id,
    'revokedDesktops', revoked_desktops
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_store_location_operationally(target_location_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := public.get_current_store_owner_id();
  account_id uuid := public.get_current_store_account_id_for_context('happycash');
  location_row public.store_locations%ROWTYPE;
  terminal_ids uuid[];
  terminal_installations text[];
  revoked_desktops integer := 0;
  deleted_terminals integer := 0;
  hard_deleted_location boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessao invalida. Faca login novamente.';
  END IF;

  IF NOT public.current_user_is_admin()
    OR NOT public.current_user_has_erp_permission('multi_store.manage') THEN
    RAISE EXCEPTION 'Somente administrador com acesso a filiais pode excluir filiais.';
  END IF;

  SELECT *
  INTO location_row
  FROM public.store_locations
  WHERE id = target_location_id
    AND owner_user_id = owner_id
    AND store_account_id = account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Filial nao encontrada.';
  END IF;

  IF location_row.is_headquarters THEN
    RAISE EXCEPTION 'A Matriz nao pode ser excluida.';
  END IF;

  SELECT
    COALESCE(array_agg(terminal.id), ARRAY[]::uuid[]),
    COALESCE(array_agg(terminal.installation_id) FILTER (WHERE terminal.installation_id IS NOT NULL), ARRAY[]::text[])
  INTO terminal_ids, terminal_installations
  FROM public.pos_terminals terminal
  WHERE terminal.location_id = location_row.id
    AND terminal.owner_user_id = owner_id
    AND terminal.store_account_id = account_id;

  IF array_length(terminal_ids, 1) IS NOT NULL THEN
    DELETE FROM public.desktop_machine_activations activation
    WHERE activation.store_account_id = location_row.store_account_id
      AND activation.owner_user_id = location_row.owner_user_id
      AND activation.app_context = 'happycash'
      AND (
        activation.terminal_id = ANY(terminal_ids)
        OR (
          array_length(terminal_installations, 1) IS NOT NULL
          AND activation.installation_id = ANY(terminal_installations)
        )
      );
    GET DIAGNOSTICS revoked_desktops = ROW_COUNT;

    DELETE FROM public.pos_terminals
    WHERE id = ANY(terminal_ids);
    GET DIAGNOSTICS deleted_terminals = ROW_COUNT;
  END IF;

  BEGIN
    DELETE FROM public.store_locations
    WHERE id = location_row.id;
    hard_deleted_location := true;
  EXCEPTION
    WHEN foreign_key_violation THEN
      UPDATE public.store_locations
      SET active = false
      WHERE id = location_row.id;
      hard_deleted_location := false;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'deletedLocationId', location_row.id,
    'locationRemovedFromDatabase', hard_deleted_location,
    'deletedTerminals', deleted_terminals,
    'revokedDesktops', revoked_desktops
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_pos_terminal_operationally(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_store_location_operationally(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_pos_terminal_operationally(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_store_location_operationally(uuid) TO authenticated;
