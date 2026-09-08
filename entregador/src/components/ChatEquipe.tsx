import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, Hash, Users, UserRound, MessageCircle } from 'lucide-react';
import { getSupabaseClient } from '@workspace/api-client-react';

type Channel = { id: string; name: string; type: 'general' | 'group' | 'direct'; createdAt: string };
type Message = {
  id: string;
  sender_type: 'owner' | 'employee';
  sender_name: string;
  content: string;
  created_at: string;
};

const CHANNEL_ICON = { general: Hash, group: Users, direct: UserRound } as const;

export function ChatEquipe({ token, onClose }: { token: string; onClose: () => void }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const loadChannels = useCallback(async () => {
    const { data: dataUser } = await getSupabaseClient().auth.getUser();
    if (!dataUser.user) return;
    const { data: memberships } = await getSupabaseClient().from('chat_channel_members').select('channel_id,chat_channels(id,name,channel_type,created_at)').eq('user_id', dataUser.user.id);
    const data: Channel[] = (memberships ?? []).map((row: any) => ({ id: row.chat_channels.id, name: row.chat_channels.name, type: row.chat_channels.channel_type === 'direct' ? 'direct' : row.chat_channels.channel_type === 'team' ? 'group' : 'general', createdAt: row.chat_channels.created_at }));
    setChannels(data);
    setActiveChannelId((prev) => prev ?? data[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadMessages = useCallback(async (channelId: string) => {
    const { data } = await getSupabaseClient().from('chat_messages').select('id,sender_user_id,body,created_at').eq('channel_id', channelId).order('created_at', { ascending: true });
    if (data) setMessages(data.map((row: any) => ({ id: row.id, sender_type: row.sender_user_id ? 'employee' : 'owner', sender_name: row.sender_user_id ?? 'Equipe', content: row.body, created_at: row.created_at })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { void loadChannels(); }, [loadChannels]);

  useEffect(() => {
    if (!activeChannelId) return;
    void loadMessages(activeChannelId);
    const interval = setInterval(() => void loadMessages(activeChannelId), 4000);
    const channel = getSupabaseClient().channel(`chat-${activeChannelId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${activeChannelId}` }, () => { void loadMessages(activeChannelId); }).subscribe();
    return () => { clearInterval(interval); void getSupabaseClient().removeChannel(channel); };
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!activeChannelId || !draft.trim()) return;
    setSending(true);
    try {
      const { data: userData } = await getSupabaseClient().auth.getUser();
      const { error } = await getSupabaseClient().from('chat_messages').insert({ channel_id: activeChannelId, sender_user_id: userData.user?.id, body: draft.trim() });
      if (!error) { setDraft(''); await loadMessages(activeChannelId); }
    } finally {
      setSending(false);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-orange-400" /> Chat da Equipe</p>
        <button onClick={onClose} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"><X className="h-4 w-4" /></button>
      </header>

      <div className="flex gap-2 overflow-x-auto border-b border-slate-800 px-3 py-2">
        {channels.map((c) => {
          const Icon = CHANNEL_ICON[c.type];
          return (
            <button
              key={c.id}
              onClick={() => setActiveChannelId(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                activeChannelId === c.id ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {c.name}
            </button>
          );
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {!activeChannel && <p className="text-xs text-slate-500">Nenhum canal disponível.</p>}
        {activeChannel && messages.length === 0 && <p className="text-xs text-slate-500">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => (
          <div key={m.id} className="max-w-[85%] rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-2.5">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[11px] font-bold text-orange-400">{m.sender_name}</span>
              <span className="text-[10px] text-slate-500">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-xs text-slate-100">{m.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2 border-t border-slate-800 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Escreva uma mensagem..."
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-slate-100 focus:border-orange-500 focus:outline-none"
        />
        <button type="submit" disabled={sending || !draft.trim()} className="rounded-xl bg-orange-500 p-2.5 text-white disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
