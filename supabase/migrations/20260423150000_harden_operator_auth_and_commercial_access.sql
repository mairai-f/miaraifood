DELETE FROM public.subscription_plan_features
WHERE plan_id = 'demo'
  AND feature_key IN ('desktop.app', 'offline.access');

DO $$
DECLARE
  duplicate_count integer := 0;
BEGIN
  SELECT count(*)
  INTO duplicate_count
  FROM (
    SELECT lower(username)
    FROM public.profiles
    WHERE role = 'operator'
      AND NULLIF(trim(username), '') IS NOT NULL
    GROUP BY lower(username)
    HAVING count(*) > 1
  ) AS duplicate_usernames;

  IF duplicate_count = 0 THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS profiles_operator_normalized_username_uidx
      ON public.profiles ((lower(username)))
      WHERE role = ''operator'' AND NULLIF(trim(username), '''') IS NOT NULL
    ';
  ELSE
    RAISE NOTICE 'Skipping unique operator username index because duplicate operator usernames already exist.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.operator_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username_hash text,
  ip_hash text,
  origin text,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'blocked', 'invalid', 'config_error')),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operator_login_attempts_username_created_idx
  ON public.operator_login_attempts (username_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS operator_login_attempts_ip_created_idx
  ON public.operator_login_attempts (ip_hash, created_at DESC);

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
    RETURN;
  END IF;

  UPDATE public.store_subscriptions
  SET
    status = 'expired',
    current_period_ends_at = COALESCE(current_period_ends_at, now()),
    trial_ends_at = COALESCE(trial_ends_at, now()),
    metadata = (
      COALESCE(metadata, '{}'::jsonb)
      - 'unlimited_access_email'
      || jsonb_build_object(
        'commercialization_cleanup_at', now(),
        'commercialization_cleanup_reason', 'removed_legacy_manual_override'
      )
    ),
    updated_at = now()
  WHERE owner_user_id = target_user_id
    AND provider = 'manual'
    AND (
      COALESCE(metadata, '{}'::jsonb)->>'source' = 'manual_admin_override'
      OR COALESCE(metadata, '{}'::jsonb) ? 'unlimited_access_email'
    )
    AND status IN ('trialing', 'active', 'past_due', 'pending');
END $$;
