INSERT INTO public.erp_permission_catalog (permission_key,module_key,name,description,runtime_scope,default_operator,default_waiter)
VALUES
 ('chat.view','chat','Conversar com a equipe','Ver e enviar mensagens autorizadas.', 'both', true, true),
 ('chat.manage','chat','Gerenciar conversas','Criar grupos e administrar participantes.', 'web', false, false)
ON CONFLICT (permission_key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.internal_chat_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_account_id uuid NOT NULL REFERENCES public.store_accounts(id) ON DELETE CASCADE,
 owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, location_id uuid REFERENCES public.store_locations(id) ON DELETE SET NULL,
 name text NOT NULL, kind text NOT NULL DEFAULT 'group' CHECK (kind IN ('direct','group')), created_by_user_id uuid REFERENCES auth.users(id), archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.internal_chat_members (
 conversation_id uuid NOT NULL REFERENCES public.internal_chat_conversations(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
 joined_at timestamptz NOT NULL DEFAULT now(), last_read_at timestamptz, PRIMARY KEY (conversation_id,user_id)
);
CREATE TABLE IF NOT EXISTS public.internal_chat_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.internal_chat_conversations(id) ON DELETE CASCADE,
 sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.internal_chat_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.internal_chat_conversations(id) ON DELETE CASCADE,
 actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, action text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 months')
);
CREATE INDEX IF NOT EXISTS internal_chat_messages_conversation_idx ON public.internal_chat_messages(conversation_id,created_at);
CREATE INDEX IF NOT EXISTS internal_chat_audit_expiry_idx ON public.internal_chat_audit(expires_at);
ALTER TABLE public.internal_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_chat_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY internal_chat_conversation_member ON public.internal_chat_conversations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=id AND m.user_id=auth.uid()));
CREATE POLICY internal_chat_member_self ON public.internal_chat_members FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY internal_chat_message_member ON public.internal_chat_messages FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=internal_chat_messages.conversation_id AND m.user_id=auth.uid())) WITH CHECK (sender_user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=internal_chat_messages.conversation_id AND m.user_id=auth.uid()));
CREATE POLICY internal_chat_audit_member ON public.internal_chat_audit FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.internal_chat_members m WHERE m.conversation_id=internal_chat_audit.conversation_id AND m.user_id=auth.uid()));
