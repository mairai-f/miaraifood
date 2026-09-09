-- Repair direct chats created before recipient membership became atomic. A
-- legacy direct chat can have only its owner member; its display name is the
-- recipient's employee/profile name, so safely add the matching colleague in
-- the same company. The owner is explicitly excluded.
INSERT INTO public.internal_chat_members(conversation_id, user_id, role)
SELECT DISTINCT conversation.id, profile.user_id, 'member'
FROM public.internal_chat_conversations conversation
JOIN public.profiles profile
  ON profile.owner_user_id = conversation.owner_user_id
 AND profile.user_id <> conversation.owner_user_id
LEFT JOIN public.hr_employees employee ON employee.profile_user_id = profile.user_id
WHERE conversation.kind = 'direct'
  AND lower(trim(conversation.name)) = lower(trim(COALESCE(NULLIF(employee.full_name, ''), NULLIF(profile.username, ''), NULLIF(profile.email, ''))))
  AND EXISTS (
    SELECT 1 FROM public.internal_chat_members owner_member
    WHERE owner_member.conversation_id = conversation.id
      AND owner_member.user_id = conversation.owner_user_id
  )
ON CONFLICT (conversation_id, user_id) DO NOTHING;
