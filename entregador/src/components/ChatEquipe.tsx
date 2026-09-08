import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, Hash, Users, UserRound, MessageCircle } from 'lucide-react';

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
    const r = await fetch('/api/chat/channels', { headers: authHeaders });
    if (!r.ok) return;
    const data: Channel[] = await r.json();
    setChannels(data);
    setActiveChannelId((prev) => prev ?? data[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadMessages = useCallback(async (channelId: string) => {
    const r = await fetch(`/api/chat/channels/${channelId}/messages`, { headers: authHeaders });
    if (r.ok) setMessages(await r.json());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { void loadChannels(); }, [loadChannels]);

  useEffect(() => {
    if (!activeChannelId) return;
    void loadMessages(activeChannelId);
    const interval = setInterval(() => void loadMessages(activeChannelId), 4000);
    return () => clearInterval(interval);
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!activeChannelId || !draft.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`/api/chat/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ content: draft.trim() }),
      });
      if (r.ok) { setDraft(''); await loadMessages(activeChannelId); }
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
