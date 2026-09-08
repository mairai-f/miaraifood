CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  channel_type text NOT NULL DEFAULT 'support' CHECK (channel_type IN ('support','team','delivery','direct')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(channel_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_channels_member ON public.chat_channels FOR SELECT TO authenticated USING (created_by=auth.uid() OR EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id=id AND m.user_id=auth.uid()) OR public.current_user_is_admin());
CREATE POLICY chat_channels_create ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (created_by=auth.uid());
CREATE POLICY chat_members_self ON public.chat_channel_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.current_user_is_admin());
CREATE POLICY chat_messages_member ON public.chat_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id=channel_id AND m.user_id=auth.uid()) OR public.current_user_is_admin());
CREATE POLICY chat_messages_send ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (sender_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id=channel_id AND m.user_id=auth.uid()));
GRANT SELECT, INSERT ON public.chat_channels, public.chat_channel_members, public.chat_messages TO authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
