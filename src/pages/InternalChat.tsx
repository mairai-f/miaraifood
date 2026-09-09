import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCheck,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/usePermissions";
import type { ErpPermissionKey } from "@/lib/permissions";
import { chatErrorMessage } from "@/lib/chatErrors";

type Conversation = {
  id: string;
  name: string;
  kind: "direct" | "group";
  updated_at: string;
  photo_url?: string | null;
  archived_at?: string | null;
  peer_name?: string | null;
  peer_role_label?: string | null;
  peer_photo_url?: string | null;
  peer_user_id?: string | null;
  unread?: number;
};
type Message = {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  deleted_at?: string | null;
  read_by_all?: boolean;
};
type Profile = {
  user_id: string;
  username: string | null;
  email: string | null;
  photo_url: string | null;
  role_label?: string | null;
};
type Dialog =
  | { kind: "edit-message"; message: Message }
  | { kind: "delete-message"; message: Message }
  | { kind: "rename-group"; conversation: Conversation }
  | { kind: "delete-conversation"; conversation: Conversation }
  | { kind: "group-members"; conversation: Conversation }
  | { kind: "group-audit"; conversation: Conversation };
type AuditEntry = {
  id: string;
  action: string;
  created_at: string;
  actor_name: string | null;
};

export default function InternalChat() {
  const { user, ownerUserId, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogValue, setDialogValue] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const groupPhotoInputRef = useRef<HTMLInputElement>(null);
  const owner = ownerUserId === user?.id;
  const can = (key: ErpPermissionKey) => isAdmin || owner || hasPermission(key);
  const uploadMyAvatar = async (file?: File) => {
    if (!file || !user) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Escolha uma imagem de até 5 MB.");
      return;
    }
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("internal-chat-media")
      .upload(path, file, { upsert: false });
    if (uploadError) {
      setError(chatErrorMessage(uploadError.message));
      return;
    }
    const { data } = supabase.storage
      .from("internal-chat-media")
      .getPublicUrl(path);
    const { error: avatarError } = await supabase.rpc(
      "update_my_internal_chat_avatar",
      {
        p_avatar_url: data.publicUrl,
      },
    );
    if (avatarError) setError(chatErrorMessage(avatarError.message));
    else {
      setMenu(false);
      void load();
    }
  };
  const uploadGroupPhoto = async (file?: File) => {
    if (!file || !current || current.kind !== "group") return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setError("Escolha uma imagem de até 5 MB.");
      return;
    }
    if (!user) return;
    const extension = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/grupo-${current.id}-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("internal-chat-media")
      .upload(path, file, { upsert: false });
    if (uploadError) {
      setError(chatErrorMessage(uploadError.message));
      return;
    }
    const { data } = supabase.storage
      .from("internal-chat-media")
      .getPublicUrl(path);
    const { error: groupError } = await supabase.rpc(
      "update_internal_chat_group",
      {
        p_conversation_id: current.id,
        p_name: null,
        p_photo_url: data.publicUrl,
        p_clear_photo: false,
      },
    );
    if (groupError) setError(chatErrorMessage(groupError.message));
    else {
      setMenu(false);
      void load();
    }
  };
  const clearGroupPhoto = async (conversation: Conversation) => {
    setMenu(false);
    const { error: groupError } = await supabase.rpc(
      "update_internal_chat_group",
      {
        p_conversation_id: conversation.id,
        p_name: null,
        p_photo_url: null,
        p_clear_photo: true,
      },
    );
    if (groupError) setError(chatErrorMessage(groupError.message));
    else void load();
  };
  const toggleArchive = async (conversation: Conversation) => {
    setMenu(false);
    const { error: archiveError } = await supabase.rpc(
      "archive_internal_chat_group",
      {
        p_conversation_id: conversation.id,
        p_archive: !conversation.archived_at,
      },
    );
    if (archiveError) setError(chatErrorMessage(archiveError.message));
    else void load();
  };
  const openGroupMembers = async (conversation: Conversation) => {
    setMenu(false);
    const { data, error: membersError } = await supabase.rpc(
      "list_internal_chat_group_members",
      { p_conversation_id: conversation.id },
    );
    if (membersError) {
      setError(chatErrorMessage(membersError.message));
      return;
    }
    setGroupMembers(
      ((data || []) as { user_id: string }[])
        .map((member) => member.user_id)
        .filter((id) => id !== ownerUserId),
    );
    setDialog({ kind: "group-members", conversation });
  };
  const openAudit = async (conversation: Conversation) => {
    setMenu(false);
    const { data, error: auditError } = await supabase.rpc(
      "list_internal_chat_audit",
      { p_conversation_id: conversation.id },
    );
    if (auditError) {
      setError(chatErrorMessage(auditError.message));
      return;
    }
    setAudit((data || []) as AuditEntry[]);
    setDialog({ kind: "group-audit", conversation });
  };
  const load = useCallback(async () => {
    if (!user) return;
    const { data: rows, error: loadError } = await supabase.rpc(
      "list_my_internal_chat_conversations",
    );
    if (loadError) {
      setError(chatErrorMessage(loadError.message));
      return;
    }
    const list = (rows || []) as Conversation[];
    const ids = list.map((x) => x.id);
    const { data: mine } = ids.length
      ? await supabase
          .from("internal_chat_members")
          .select("conversation_id,last_read_at")
          .eq("user_id", user.id)
          .in("conversation_id", ids)
      : { data: [] };
    const read = new Map(
      (mine || []).map((x: any) => [
        x.conversation_id,
        x.last_read_at ? new Date(x.last_read_at).getTime() : 0,
      ]),
    );
    const { data: allMessages } = ids.length
      ? await supabase
          .from("internal_chat_messages")
          .select("conversation_id,created_at,sender_user_id")
          .in("conversation_id", ids)
          .is("deleted_at", null)
      : { data: [] };
    const unread = new Map<string, number>();
    (allMessages || []).forEach((m: any) => {
      if (
        m.sender_user_id !== user.id &&
        new Date(m.created_at).getTime() > (read.get(m.conversation_id) || 0)
      )
        unread.set(m.conversation_id, (unread.get(m.conversation_id) || 0) + 1);
    });
    setConversations(list.map((x) => ({ ...x, unread: unread.get(x.id) || 0 })));
    const { data: contacts, error: contactsError } = await supabase.rpc(
      "list_internal_chat_contacts",
    );
    if (contactsError) setError(chatErrorMessage(contactsError.message));
    else
      setProfiles(
        (contacts || []).map((contact: any) => ({
          user_id: contact.user_id,
          username: contact.display_name,
          email: null,
          photo_url: contact.photo_url,
          role_label: contact.role_label,
        })),
      );
  }, [ownerUserId, user]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`internal-chat-inbox-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "internal_chat_messages" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "internal_chat_members" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, user]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (dialog) {
        setDialog(null);
        return;
      }
      setMenu(false);
      setNewGroup(false);
      setSelected(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialog]);
  useEffect(() => {
    if (!selected || !user) {
      setMessages([]);
      return;
    }
    const read = async () => {
      const { data, error: messagesError } = await supabase.rpc(
        "list_internal_chat_messages",
        { p_conversation_id: selected },
      );
      if (messagesError) setError(chatErrorMessage(messagesError.message));
      else setMessages((data || []) as Message[]);
      await supabase
        .from("internal_chat_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", selected)
        .eq("user_id", user.id);
      void load();
    };
    void read();
    const c = supabase
      .channel(`chat-${selected}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "internal_chat_messages",
          filter: `conversation_id=eq.${selected}`,
        },
        () => void read(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "internal_chat_members",
          filter: `conversation_id=eq.${selected}`,
        },
        () => void read(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(c);
    };
  }, [load, selected, user]);
  const current = conversations.find((x) => x.id === selected);
  const visible = useMemo(
    () =>
      conversations.filter((x) =>
        (x.kind === "direct" ? x.peer_name || x.name : x.name)
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [conversations, search],
  );
  const send = async () => {
    if (!selected || !user || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase
      .from("internal_chat_messages")
      .insert({ conversation_id: selected, sender_user_id: user.id, body });
    if (error) {
      setText(body);
      setError(chatErrorMessage(error.message));
    }
  };
  const direct = async (p: Profile) => {
    const { data, error } = await supabase.rpc(
      "ensure_internal_direct_conversation",
      { p_target_user_id: p.user_id },
    );
    if (error || !data)
      setError(chatErrorMessage(error?.message) || "Não foi possível abrir a conversa");
    else {
      setSelected(data);
      await load();
    }
  };
  const create = async () => {
    const { data, error } = await supabase.rpc("create_internal_chat_group", {
      p_name: groupName,
      p_member_ids: members,
    });
    if (error || !data)
      setError(chatErrorMessage(error?.message) || "Não foi possível criar o grupo");
    else {
      setNewGroup(false);
      setGroupName("");
      setMembers([]);
      setSelected(data);
      await load();
    }
  };
  const openDialog = (next: Dialog) => {
    setMenu(false);
    setDialogValue(
      next.kind === "edit-message"
        ? next.message.body
        : next.kind === "rename-group"
          ? next.conversation.name
          : "",
    );
    setDialog(next);
  };
  const confirmDialog = async () => {
    if (!dialog) return;
    const value = dialogValue.trim();
    setDialog(null);
    if (dialog.kind === "edit-message") {
      if (!value || value === dialog.message.body) return;
      const { error } = await supabase.rpc("update_internal_chat_message", {
        p_message_id: dialog.message.id,
        p_body: value,
      });
      if (error) setError(chatErrorMessage(error.message));
      return;
    }
    if (dialog.kind === "delete-message") {
      const { error } = await supabase.rpc("delete_internal_chat_message", {
        p_message_id: dialog.message.id,
      });
      if (error) setError(chatErrorMessage(error.message));
      return;
    }
    if (dialog.kind === "rename-group") {
      if (!value || value === dialog.conversation.name) return;
      const { error } = await supabase.rpc("update_internal_chat_group", {
        p_conversation_id: dialog.conversation.id,
        p_name: value,
        p_photo_url: null,
        p_clear_photo: false,
      });
      if (error) setError(chatErrorMessage(error.message));
      else void load();
      return;
    }
    if (dialog.kind === "group-audit") return;
    if (dialog.kind === "group-members") {
      const { error } = await supabase.rpc("set_internal_chat_group_members", {
        p_conversation_id: dialog.conversation.id,
        p_member_ids: groupMembers,
      });
      if (error) setError(chatErrorMessage(error.message));
      else void load();
      return;
    }
    const { error } = await supabase.rpc("delete_internal_chat_conversation", {
      p_conversation_id: dialog.conversation.id,
    });
    if (error) setError(chatErrorMessage(error.message));
    else {
      setSelected(null);
      void load();
    }
  };
  return (
    <div
      className="relative flex w-full min-w-0 max-w-[1320px] overflow-hidden rounded-xl border bg-background"
      style={{ height: "min(78vh, 720px)", minHeight: 520 }}
    >
      {error && (
        <button
          className="absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded bg-destructive px-3 py-2 text-sm text-white"
          onClick={() => setError(null)}
        >
          {error}
        </button>
      )}
      <aside className="flex w-[340px] shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h1 className="font-semibold">Conversas</h1>
            <p className="text-xs text-muted-foreground">
              Chat interno da equipe
            </p>
          </div>
          {can("chat.group.create") && (
            <button onClick={() => setNewGroup(true)}>
              <Plus />
            </button>
          )}
        </div>
        <div className="border-b p-3">
          <div className="flex gap-2 rounded bg-muted px-3 py-2">
            <Search size={16} />
            <input
              className="w-full bg-transparent outline-none"
              placeholder="Pesquisar ou iniciar conversa"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <small className="block px-4 pt-3 text-muted-foreground">
            CONVERSAS
          </small>
          <div className="max-h-[225px] overflow-y-auto border-b">
            {visible.map((c) => (
              <button
                key={c.id}
                className={`flex w-full items-center gap-3 border-b p-3 text-left ${selected === c.id ? "bg-muted" : ""}`}
                onClick={() => setSelected(c.id)}
              >
                {(c.kind === "direct" ? c.peer_photo_url : c.photo_url) ? (
                  <img
                    className="h-9 w-9 rounded-full object-cover"
                    src={
                      (c.kind === "direct" ? c.peer_photo_url : c.photo_url) ??
                      undefined
                    }
                    alt=""
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                    <Users size={17} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">
                    {c.kind === "direct" ? c.peer_name || c.name : c.name}
                  </strong>
                  <small className="text-muted-foreground">
                    {c.kind === "direct"
                      ? c.peer_role_label || "Conversa direta"
                      : c.archived_at
                        ? "Grupo arquivado"
                        : "Grupo da equipe"}
                  </small>
                </span>
                {c.unread ? (
                  <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                    {c.unread}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <small className="block px-4 pt-4 text-muted-foreground">
            COLABORADORES
          </small>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {profiles
              .filter(
                (p) =>
                  p.user_id !== user?.id &&
                  (p.username || "")
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((p) => (
                <button
                  key={p.user_id}
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => void direct(p)}
                >
                  {p.photo_url ? (
                    <img
                      className="h-8 w-8 rounded-full object-cover"
                      src={p.photo_url}
                      alt=""
                    />
                  ) : (
                    <Users size={18} />
                  )}
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {p.username || "Colaborador"}
                    </strong>
                    {p.role_label && (
                      <small className="block truncate text-xs text-muted-foreground">
                        {p.role_label}
                      </small>
                    )}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            {current &&
            (current.kind === "direct"
              ? current.peer_photo_url
              : current.photo_url) ? (
              <img
                className="h-10 w-10 rounded-full object-cover"
                src={
                  (current.kind === "direct"
                    ? current.peer_photo_url
                    : current.photo_url) ?? undefined
                }
                alt=""
              />
            ) : current ? (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
                <Users size={18} />
              </span>
            ) : null}
            <div>
              <h2 className="font-semibold">
                {current
                  ? current.kind === "direct"
                    ? current.peer_name || current.name
                    : current.name
                  : "Selecione uma conversa"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {current?.kind === "direct"
                  ? current.peer_role_label || "Conversa direta"
                  : current?.archived_at
                    ? "Grupo arquivado"
                    : "Mensagens protegidas pelas permissões da equipe"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setMenu(!menu)}
            title={current ? "Ações da conversa" : "Opções do chat"}
            aria-label={current ? "Ações da conversa" : "Opções do chat"}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <MoreVertical />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              void uploadMyAvatar(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={groupPhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              void uploadGroupPhoto(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          {menu && !current && (
            <div className="absolute right-3 top-14 z-20 w-56 rounded border bg-card p-1 shadow">
              <button
                className="w-full rounded p-2 text-left hover:bg-muted"
                onClick={() => avatarInputRef.current?.click()}
              >
                {owner || isAdmin
                  ? "Alterar foto do administrador"
                  : "Alterar minha foto"}
              </button>
              {can("chat.group.create") && (
                <button
                  className="w-full rounded p-2 text-left hover:bg-muted"
                  onClick={() => {
                    setMenu(false);
                    setNewGroup(true);
                  }}
                >
                  Criar grupo
                </button>
              )}
            </div>
          )}
          {menu && current && (
            <div className="absolute right-3 top-14 z-20 w-56 rounded border bg-card p-1 shadow">
              {current.kind === "group" && can("chat.group.edit") && (
                <button
                  className="w-full rounded p-2 text-left hover:bg-muted"
                  onClick={() =>
                    openDialog({ kind: "rename-group", conversation: current })
                  }
                >
                  Alterar nome
                </button>
              )}
              {current.kind === "group" && can("chat.group.members.manage") && (
                <button
                  className="w-full rounded p-2 text-left hover:bg-muted"
                  onClick={() => void openGroupMembers(current)}
                >
                  Participantes
                </button>
              )}
              {current.kind === "group" && can("chat.group.photo.edit") && (
                <button
                  className="w-full rounded p-2 text-left hover:bg-muted"
                  onClick={() => groupPhotoInputRef.current?.click()}
                >
                  Alterar foto do grupo
                </button>
              )}
              {current.kind === "group" &&
                can("chat.group.photo.edit") &&
                current.photo_url && (
                  <button
                    className="w-full rounded p-2 text-left hover:bg-muted"
                    onClick={() => void clearGroupPhoto(current)}
                  >
                    Remover foto do grupo
                  </button>
                )}
              {current.kind === "group" && can("chat.group.archive") && (
                <button
                  className="w-full rounded p-2 text-left hover:bg-muted"
                  onClick={() => void toggleArchive(current)}
                >
                  {current.archived_at ? "Restaurar grupo" : "Arquivar grupo"}
                </button>
              )}
              {can("chat.audit.view") && (
                <button
                  className="w-full rounded p-2 text-left hover:bg-muted"
                  onClick={() => void openAudit(current)}
                >
                  Ver auditoria
                </button>
              )}
              {owner && (
                <button
                  className="w-full rounded p-2 text-left text-destructive hover:bg-muted"
                  onClick={() =>
                    openDialog({
                      kind: "delete-conversation",
                      conversation: current,
                    })
                  }
                >
                  Excluir conversa
                </button>
              )}
            </div>
          )}
        </header>
        <div className="flex-1 overflow-auto bg-muted/20 p-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`group mb-3 flex ${m.sender_user_id === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[72%] rounded-2xl px-4 py-2 text-sm ${m.sender_user_id === user?.id ? "bg-emerald-600 text-white" : "bg-card"}`}
              >
                {m.body}
                <div className="mt-1 flex justify-end gap-2 text-[10px] opacity-75">
                  {m.sender_user_id === user?.id && !m.deleted_at && (
                    <>
                      {can("chat.message.edit") && (
                        <button
                          onClick={() =>
                            openDialog({ kind: "edit-message", message: m })
                          }
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {can("chat.message.delete") && (
                        <button
                          onClick={() =>
                            openDialog({ kind: "delete-message", message: m })
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </>
                  )}
                  {m.sender_user_id === user?.id &&
                    (m.read_by_all ? (
                      <CheckCheck size={13} className="text-sky-300" />
                    ) : (
                      <Check size={13} />
                    ))}
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t p-3">
          <input
            disabled={!current}
            className="flex-1 rounded border bg-background px-3"
            placeholder="Digite uma mensagem"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <button
            disabled={!current || !text.trim()}
            className="rounded bg-primary px-4 text-primary-foreground"
            onClick={() => void send()}
          >
            <Send size={18} />
          </button>
        </div>
      </main>
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6">
            <h3 className="font-semibold">
              {dialog.kind === "edit-message"
                ? "Editar mensagem"
                : dialog.kind === "delete-message"
                  ? "Remover mensagem"
                  : dialog.kind === "rename-group"
                    ? "Alterar nome do grupo"
                    : dialog.kind === "group-members"
                      ? "Participantes do grupo"
                      : dialog.kind === "group-audit"
                        ? "Auditoria da conversa"
                        : "Excluir conversa"}
            </h3>
            {dialog.kind === "edit-message" || dialog.kind === "rename-group" ? (
              <input
                autoFocus
                className="my-4 w-full rounded border bg-background p-2"
                value={dialogValue}
                onChange={(e) => setDialogValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmDialog();
                }}
              />
            ) : dialog.kind === "group-members" ? (
              <div className="my-4 max-h-72 overflow-y-auto">
                {profiles
                  .filter((p) => p.user_id !== user?.id)
                  .map((p) => (
                    <label key={p.user_id} className="block p-2">
                      <input
                        type="checkbox"
                        checked={groupMembers.includes(p.user_id)}
                        onChange={() =>
                          setGroupMembers((ids) =>
                            ids.includes(p.user_id)
                              ? ids.filter((id) => id !== p.user_id)
                              : [...ids, p.user_id],
                          )
                        }
                      />{" "}
                      {p.username || "Colaborador"}
                    </label>
                  ))}
              </div>
            ) : dialog.kind === "group-audit" ? (
              <div className="my-4 max-h-72 overflow-y-auto text-sm">
                {audit.length === 0 && (
                  <p className="text-muted-foreground">
                    Nenhum registro de auditoria para esta conversa.
                  </p>
                )}
                {audit.map((entry) => (
                  <div key={entry.id} className="border-b py-2 last:border-b-0">
                    <strong className="block">{entry.action}</strong>
                    <small className="text-muted-foreground">
                      {entry.actor_name || "Sistema"} ·{" "}
                      {new Date(entry.created_at).toLocaleString("pt-BR")}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="my-4 text-sm text-muted-foreground">
                {dialog.kind === "delete-message"
                  ? "A mensagem deixa de aparecer para todos os participantes."
                  : "A conversa sai da lista de todos os participantes. O histórico é preservado para auditoria."}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDialog(null)}>
                {dialog.kind === "group-audit" ? "Fechar" : "Cancelar"}
              </button>
              {dialog.kind !== "group-audit" && (
                <button
                  disabled={
                    (dialog.kind === "edit-message" ||
                      dialog.kind === "rename-group") &&
                    !dialogValue.trim()
                  }
                  className={`rounded px-3 py-2 ${
                    dialog.kind === "delete-message" ||
                    dialog.kind === "delete-conversation"
                      ? "bg-destructive text-white"
                      : "bg-primary text-primary-foreground"
                  }`}
                  onClick={() => void confirmDialog()}
                >
                  {dialog.kind === "delete-message"
                    ? "Remover"
                    : dialog.kind === "delete-conversation"
                      ? "Excluir"
                      : "Salvar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {newGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-card p-6">
            <h3 className="font-semibold">Criar grupo</h3>
            <input
              className="my-4 w-full rounded border bg-background p-2"
              placeholder="Nome do grupo"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            {profiles
              .filter((p) => p.user_id !== user?.id)
              .map((p) => (
                <label key={p.user_id} className="block p-2">
                  <input
                    type="checkbox"
                    checked={members.includes(p.user_id)}
                    onChange={() =>
                      setMembers((x) =>
                        x.includes(p.user_id)
                          ? x.filter((id) => id !== p.user_id)
                          : [...x, p.user_id],
                      )
                    }
                  />{" "}
                  {p.username}
                </label>
              ))}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNewGroup(false)}>Cancelar</button>
              <button
                disabled={!groupName || !members.length}
                className="rounded bg-primary px-3 py-2 text-primary-foreground"
                onClick={() => void create()}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
