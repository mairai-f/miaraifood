ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('internal-chat-media','internal-chat-media',true,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=true,file_size_limit=5242880,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS internal_chat_media_read ON storage.objects;
CREATE POLICY internal_chat_media_read ON storage.objects FOR SELECT USING (bucket_id='internal-chat-media');
DROP POLICY IF EXISTS internal_chat_media_upload ON storage.objects;
CREATE POLICY internal_chat_media_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='internal-chat-media' AND (storage.foldername(name))[1]=auth.uid()::text);
DROP POLICY IF EXISTS internal_chat_media_update ON storage.objects;
CREATE POLICY internal_chat_media_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='internal-chat-media' AND (storage.foldername(name))[1]=auth.uid()::text)
WITH CHECK (bucket_id='internal-chat-media' AND (storage.foldername(name))[1]=auth.uid()::text);

CREATE OR REPLACE FUNCTION public.update_my_internal_chat_avatar(p_avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth SET row_security=off AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  UPDATE public.profiles SET avatar_url=NULLIF(btrim(p_avatar_url),'') WHERE user_id=auth.uid();
END; $$;

CREATE OR REPLACE FUNCTION public.update_internal_chat_message(p_message_id uuid,p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth SET row_security=off AS $$
BEGIN
  IF char_length(btrim(coalesce(p_body,''))) NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid_message_body'; END IF;
  UPDATE public.internal_chat_messages SET body=btrim(p_body)
  WHERE id=p_message_id AND sender_user_id=auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'message_not_editable'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_internal_chat_message(p_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,auth SET row_security=off AS $$
BEGIN
  UPDATE public.internal_chat_messages SET deleted_at=now(),body='Mensagem removida'
  WHERE id=p_message_id AND sender_user_id=auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'message_not_deletable'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.update_my_internal_chat_avatar(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_internal_chat_message(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_internal_chat_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_internal_chat_avatar(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_internal_chat_message(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_internal_chat_message(uuid) TO authenticated;

-- pg_cron is optional in local development; production projects with the
-- extension enabled clean expired audit rows daily without user interaction.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.schedule('internal-chat-audit-retention','17 3 * * *','DELETE FROM public.internal_chat_audit WHERE expires_at <= now()');
  END IF;
EXCEPTION WHEN undefined_function OR insufficient_privilege THEN NULL;
END $$;
