ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'gift',
  ADD COLUMN IF NOT EXISTS reward_value numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validity_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS allow_pdv_redemption boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rewards_reward_type_check'
  ) THEN
    ALTER TABLE public.rewards
      ADD CONSTRAINT rewards_reward_type_check
      CHECK (reward_type IN ('gift', 'discount_amount', 'discount_percent', 'cashback_amount', 'cashback_percent', 'points'));
  END IF;
END $$;
