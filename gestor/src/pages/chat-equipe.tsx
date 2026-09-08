import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Plus, Users, X, Hash, UserRound } from 'lucide-react';
import { toast } from 'sonner';

function getToken() {
  return window.localStorage.getItem('miar-owner-token') ?? window.sessionStorage.getItem('miar-owner-token') ?? '';
}

function isOwnerSession() {
  const role = (window.localStorage.getItem('miar-current-user-role') || 'owner').toLowerCase();
  return !window.localStorage.getItem('miar-employee-permissions') || ['owner', 'manager', 'gestor'].includes(role);
}

type Channel = { id: string; name: string; type: 'general' | 'group' | 'direct'; createdAt: string };
type Message = {
  id: string;
  sender_type: 'owner' | 'employee';
  sender_id: string;
  sender_name: string;
  content: string;
  attachment_data: string | null;
  attachment_type: string | null;
  created_at: string;
};
type DirectoryPerson = { id: string; name: string; type: 'owner' | 'employee' };

const CHANNEL_ICON = { general: Hash, group: Users, direct: UserRound } as const;

export default function ChatEquipe() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [directory, setDirectory] = useState<DirectoryPerson[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const owner = isOwnerSession();

  const loadChannels = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/channels', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!r.ok) return;
      const data: Channel[] = await r.json();
      setChannels(data);
      setActiveChannelId((prev) => prev ?? data[0]?.id ?? null);
    } catch { /* mantém a última lista carregada */ }
  }, []);

  const loadMessages = useCallback(async (channelId: string, { silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoadingMessages(true);
    try {
      const r = await fetch(`/api/chat/channels/${channelId}/messages`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) setMessages(await r.json());
    } catch { /* próximo poll tenta de novo */ }
    finally { if (!silent) setLoadingMessages(false); }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  useEffect(() => {
    if (!activeChannelId) return;
    loadMessages(activeChannelId);
    // Mesmo padrão de "tempo real" já usado no resto do sistema (mesas.tsx,
    // board do entregador) — polling curto, sem infra de Realtime extra.
    const interval = setInterval(() => loadMessages(activeChannelId, { silent: true }), 4000);
    return () => clearInterval(interval);
  }, [activeChannelId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!activeChannelId || !draft.trim()) return;
    setSending(true);
    try {
      const r = await fetch(`/api/chat/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ content: draft.trim() }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error ?? 'Não foi possível enviar a mensagem.');
        return;
      }
      setDraft('');
      await loadMessages(activeChannelId, { silent: true });
    } catch {
      toast.error('Falha de conexão ao enviar mensagem.');
    } finally {
      setSending(false);
    }
  };

  const openNewChat = async () => {
    setIsNewChatOpen(true);
    setNewGroupName('');
    setSelectedMemberIds(new Set());
    try {
      // /api/chat/directory funciona pra dono E funcionário (requireAnyAuth)
      // — antes disso usava /api/employees, que é owner-only e sempre dava
      // 401 quando um funcionário abria "nova conversa" (05/09/2026).
      const r = await fetch('/api/chat/directory', { headers: { Authorization: `Bearer ${getToken()}` } });
      if (r.ok) setDirectory(await r.json());
    } catch { /* lista fica vazia, mas não trava a tela */ }
  };

  const employeesForGroup = directory.filter((p) => p.type === 'employee');

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) { toast.error('Dê um nome ao grupo.'); return; }
    try {
      const r = await fetch('/api/chat/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: newGroupName.trim(), memberIds: Array.from(selectedMemberIds) }),
      });
      if (!r.ok) { toast.error('Não foi possível criar o grupo.'); return; }
      const created = await r.json();
      setIsNewChatOpen(false);
      await loadChannels();
      setActiveChannelId(created.id);
      toast.success('Grupo criado!');
    } catch {
      toast.error('Falha de conexão ao criar grupo.');
    }
  };

  const startDirect = async (targetId: string, targetType: 'owner' | 'employee') => {
    try {
      const r = await fetch('/api/chat/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ targetType, targetId }),
      });
      if (!r.ok) { toast.error('Não foi possível abrir a conversa.'); return; }
      const channel = await r.json();
      setIsNewChatOpen(false);
      await loadChannels();
      setActiveChannelId(channel.id);
    } catch {
      toast.error('Falha de conexão ao abrir conversa.');
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#06100A] text-[#F2F7F3]">
      {/* Lista de canais */}
      <aside className="w-64 shrink-0 border-r border-[#16301F] bg-[#0B1A10] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#16301F]">
          <h2 className="font-manrope font-bold text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#38B000]" /> Chat da Equipe
          </h2>
          <button onClick={openNewChat} className="rounded-lg p-1.5 text-[#8FA396] hover:text-[#38B000] hover:bg-[#06100A]" title="Nova conversa">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {channels.length === 0 && <p className="text-xs text-[#8FA396] p-3">Nenhum canal ainda.</p>}
          {channels.map((c) => {
            const Icon = CHANNEL_ICON[c.type];
            return (
              <button
                key={c.id}
                onClick={() => setActiveChannelId(c.id)}
                className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-left transition-colors ${
                  activeChannelId === c.id ? 'bg-[#16301F] text-[#38B000]' : 'text-[#8FA396] hover:bg-[#06100A]/60 hover:text-[#F2F7F3]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Thread da conversa */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[#8FA396]">Selecione uma conversa.</div>
        ) : (
          <>
            <div className="border-b border-[#16301F] px-4 py-3 font-manrope font-bold text-sm bg-[#0B1A10]">
              {activeChannel.name}
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingMessages && <p className="text-xs text-[#8FA396]">Carregando...</p>}
              {!loadingMessages && messages.length === 0 && <p className="text-xs text-[#8FA396]">Nenhuma mensagem ainda. Diga oi!</p>}
              {messages.map((m) => (
                <div key={m.id} className="max-w-[75%] rounded-2xl border border-[#16301F] bg-[#0B1A10] px-3.5 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-[#38B000]">{m.sender_name}</span>
                    <span className="text-[10px] text-[#8FA396]">{new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {m.content && <p className="text-xs text-[#F2F7F3] whitespace-pre-wrap break-words">{m.content}</p>}
                  {m.attachment_data && <img src={m.attachment_data} alt="anexo" className="mt-2 max-h-48 rounded-lg" />}
                </div>
              ))}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
              className="border-t border-[#16301F] p-3 flex items-center gap-2 bg-[#0B1A10]"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva uma mensagem..."
                className="flex-1 rounded-xl border border-[#16301F] bg-[#06100A] px-3.5 py-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="rounded-xl bg-[#008000] p-2.5 text-[#F2F7F3] hover:bg-[#38B000] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </div>

      {/* Modal: nova conversa */}
      {isNewChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06100A]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#16301F] bg-[#0B1A10] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-manrope font-bold text-sm">Nova conversa</h3>
              <button onClick={() => setIsNewChatOpen(false)} className="rounded-lg p-1.5 text-[#8FA396] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-[11px] text-[#8FA396]">Conversar direto com:</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {directory.length === 0 && <p className="text-xs text-[#8FA396]">Ninguém mais cadastrado nesta empresa ainda.</p>}
              {directory.map((p) => (
                <button
                  key={`${p.type}-${p.id}`}
                  onClick={() => void startDirect(p.id, p.type)}
                  className="w-full text-left rounded-xl border border-[#16301F] bg-[#06100A] px-3 py-2 text-xs text-[#F2F7F3] hover:border-[#008000]"
                >
                  {p.name} {p.type === 'owner' && <span className="text-[#8FA396]">(dono)</span>}
                </button>
              ))}
            </div>

            {owner && (
              <>
                <div className="border-t border-[#16301F] pt-4">
                  <p className="text-[11px] text-[#8FA396] mb-2">Ou crie um grupo:</p>
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nome do grupo (ex: Cozinha)"
                    className="w-full rounded-xl border border-[#16301F] bg-[#06100A] p-2.5 text-xs text-[#F2F7F3] focus:border-[#008000] focus:outline-none mb-2"
                  />
                  <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                    {employeesForGroup.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-xs text-[#8FA396] px-1">
                        <input type="checkbox" checked={selectedMemberIds.has(e.id)} onChange={() => toggleMember(e.id)} />
                        {e.name}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={() => void createGroup()}
                    className="w-full rounded-xl bg-[#008000] py-2.5 text-xs font-bold text-[#F2F7F3] hover:bg-[#38B000]"
                  >
                    Criar grupo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
