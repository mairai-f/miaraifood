DO $$
DECLARE
  target_email CONSTANT text := 'celioantonio.dev@gmail.com';
  target_user_id uuid;
BEGIN
  SELECT user_auth.id
  INTO target_user_id
  FROM auth.users AS user_auth
  WHERE lower(user_auth.email) = lower(target_email)
  ORDER BY user_auth.created_at
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'Usuario % nao encontrado em auth.users. Migration ignorada.', target_email;
    RETURN;
  END IF;

  INSERT INTO public.profiles (
    user_id,
    username,
    email,
    role,
    owner_user_id,
    created_by_user_id
  )
  VALUES (
    target_user_id,
    split_part(target_email, '@', 1),
    target_email,
    'admin',
    target_user_id,
    target_user_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    username = COALESCE(NULLIF(public.profiles.username, ''), EXCLUDED.username),
    email = EXCLUDED.email,
    role = 'admin',
    owner_user_id = COALESCE(public.profiles.owner_user_id, EXCLUDED.owner_user_id),
    created_by_user_id = COALESCE(public.profiles.created_by_user_id, EXCLUDED.created_by_user_id);
END $$;
