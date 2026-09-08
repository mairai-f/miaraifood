ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'operator', 'waiter'));

UPDATE public.profiles AS profile
SET role = 'waiter'
FROM auth.users AS auth_user
WHERE auth_user.id = profile.user_id
  AND lower(COALESCE(auth_user.raw_user_meta_data->>'role', '')) = 'waiter'
  AND profile.role <> 'waiter';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  metadata_role text;
  metadata_owner_user_id uuid;
  metadata_created_by_user_id uuid;
BEGIN
  metadata_role := CASE lower(COALESCE(NEW.raw_user_meta_data->>'role', 'admin'))
    WHEN 'operator' THEN 'operator'
    WHEN 'waiter' THEN 'waiter'
    ELSE 'admin'
  END;

  metadata_owner_user_id := NULLIF(NEW.raw_user_meta_data->>'owner_user_id', '')::uuid;
  metadata_created_by_user_id := NULLIF(NEW.raw_user_meta_data->>'created_by_user_id', '')::uuid;

  INSERT INTO public.profiles (user_id, username, email, role, owner_user_id, created_by_user_id)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), NEW.email),
    NEW.email,
    metadata_role,
    COALESCE(metadata_owner_user_id, NEW.id),
    metadata_created_by_user_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    role = EXCLUDED.role,
    owner_user_id = COALESCE(public.profiles.owner_user_id, EXCLUDED.owner_user_id),
    created_by_user_id = COALESCE(public.profiles.created_by_user_id, EXCLUDED.created_by_user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.access_sessions
  DROP CONSTRAINT IF EXISTS access_sessions_role_check;

ALTER TABLE public.access_sessions
  ADD CONSTRAINT access_sessions_role_check
  CHECK (role IN ('admin', 'operator', 'waiter'));

ALTER TABLE public.access_logs
  DROP CONSTRAINT IF EXISTS access_logs_role_check;

ALTER TABLE public.access_logs
  ADD CONSTRAINT access_logs_role_check
  CHECK (role IN ('admin', 'operator', 'waiter'));
