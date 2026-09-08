CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.verify_admin_password_for_owner(
  target_owner_user_id uuid,
  target_email text,
  target_password text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
  verified_user_id uuid;
  verified_owner_user_id uuid;
BEGIN
  IF target_owner_user_id IS NULL
    OR NULLIF(trim(target_email), '') IS NULL
    OR NULLIF(target_password, '') IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT auth_user.id
    INTO verified_user_id
  FROM auth.users AS auth_user
  WHERE lower(auth_user.email) = lower(trim(target_email))
    AND auth_user.encrypted_password IS NOT NULL
    AND auth_user.encrypted_password = extensions.crypt(target_password, auth_user.encrypted_password)
  LIMIT 1;

  IF verified_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(profile.owner_user_id, profile.user_id)
    INTO verified_owner_user_id
  FROM public.profiles AS profile
  WHERE profile.user_id = verified_user_id
    AND profile.role = 'admin'
  LIMIT 1;

  IF verified_owner_user_id = target_owner_user_id THEN
    RETURN verified_user_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_admin_password_for_owner(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_admin_password_for_owner(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_admin_password_for_owner(uuid, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_password_for_owner(uuid, text, text) TO service_role;
