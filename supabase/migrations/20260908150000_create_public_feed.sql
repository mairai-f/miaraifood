CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  media_url text,
  media_type text NOT NULL DEFAULT 'texto' CHECK (media_type IN ('texto','imagem','video','publicidade')),
  active boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.feed_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  reporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_post_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY feed_public_read ON public.feed_posts FOR SELECT TO anon, authenticated USING (active = true AND published_at <= now());
CREATE POLICY feed_owner_write ON public.feed_posts FOR ALL TO authenticated USING (owner_user_id = auth.uid() OR public.current_user_is_admin()) WITH CHECK (owner_user_id = auth.uid() OR public.current_user_is_admin());
CREATE POLICY feed_report_insert ON public.feed_post_reports FOR INSERT TO anon, authenticated WITH CHECK (reporter_user_id IS NULL OR reporter_user_id = auth.uid());
CREATE POLICY feed_report_admin_read ON public.feed_post_reports FOR SELECT TO authenticated USING (public.current_user_is_admin());
GRANT SELECT ON public.feed_posts TO anon, authenticated;
GRANT INSERT ON public.feed_post_reports TO anon, authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
