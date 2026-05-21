-- Add HappyCash Agenda as a paid product context managed from HappyCashSite.

ALTER TABLE public.store_accounts
  DROP CONSTRAINT IF EXISTS store_accounts_product_context_check;

ALTER TABLE public.store_accounts
  ADD CONSTRAINT store_accounts_product_context_check
  CHECK (product_context IN ('happycash', 'happycashfood', 'happycashagenda'));

ALTER TABLE public.site_pending_registrations
  DROP CONSTRAINT IF EXISTS site_pending_registrations_product_context_check;

ALTER TABLE public.site_pending_registrations
  ADD CONSTRAINT site_pending_registrations_product_context_check
  CHECK (product_context IN ('happycash', 'happycashfood', 'happycashagenda'));

ALTER TABLE public.store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_product_context_check;

ALTER TABLE public.store_subscriptions
  ADD CONSTRAINT store_subscriptions_product_context_check
  CHECK (product_context IN ('happycash', 'happycashfood', 'happycashagenda'));

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_id_check;

ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_id_check
  CHECK (id IN ('demo', 'fiado', 'completo', 'pro', 'food', 'food_offline', 'agenda'));

INSERT INTO public.subscription_plans (
  id,
  name,
  description,
  price,
  annual_price,
  billing_cycle,
  duration_days,
  trial_hours,
  sort_order,
  is_active,
  is_public
)
VALUES (
  'agenda',
  'HappyCash Agenda',
  'Agenda online para servicos com clientes, profissionais, QR Code, WhatsApp, pagamentos, relatorios e integracao futura com PDV.',
  197,
  1997,
  'monthly',
  30,
  0,
  6,
  true,
  true
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  annual_price = EXCLUDED.annual_price,
  billing_cycle = EXCLUDED.billing_cycle,
  duration_days = EXCLUDED.duration_days,
  trial_hours = EXCLUDED.trial_hours,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  is_public = true;

INSERT INTO public.subscription_plan_features (plan_id, feature_key, enabled)
VALUES
  ('agenda', 'agenda.use', true),
  ('agenda', 'agenda.professionals', true),
  ('agenda', 'agenda.qrcode', true),
  ('agenda', 'agenda.whatsapp', true),
  ('agenda', 'agenda.payments', true),
  ('agenda', 'agenda.reports', true),
  ('agenda', 'branding.manage', true)
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET enabled = EXCLUDED.enabled;

CREATE TABLE IF NOT EXISTS public.agenda_business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_account_id uuid REFERENCES public.store_accounts(id) ON DELETE SET NULL,
  slug text NOT NULL,
  display_name text NOT NULL DEFAULT 'HappyCash Agenda',
  business_type text NOT NULL DEFAULT 'Servicos',
  professional_label text NOT NULL DEFAULT 'Profissional',
  service_label text NOT NULL DEFAULT 'Servico',
  tagline text NOT NULL DEFAULT 'Agendamentos, pagamentos e clientes em um so lugar.',
  logo_url text,
  primary_hsl text NOT NULL DEFAULT '258 84% 58%',
  accent_hsl text NOT NULL DEFAULT '44 96% 56%',
  success_hsl text NOT NULL DEFAULT '151 74% 43%',
  public_booking_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_business_settings_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS agenda_business_settings_owner_idx
  ON public.agenda_business_settings(owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS agenda_business_settings_slug_idx
  ON public.agenda_business_settings(slug);

ALTER TABLE public.agenda_business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_business_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda settings public read enabled" ON public.agenda_business_settings;
CREATE POLICY "agenda settings public read enabled"
ON public.agenda_business_settings
FOR SELECT
USING (public_booking_enabled = true);

DROP POLICY IF EXISTS "agenda settings owner manage" ON public.agenda_business_settings;
CREATE POLICY "agenda settings owner manage"
ON public.agenda_business_settings
FOR ALL
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

DROP TRIGGER IF EXISTS update_agenda_business_settings_updated_at ON public.agenda_business_settings;
CREATE TRIGGER update_agenda_business_settings_updated_at
BEFORE UPDATE ON public.agenda_business_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
