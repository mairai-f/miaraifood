import { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, ChevronLeft } from 'lucide-react';
import { getUser } from '../lib/storage';
import type { Restaurant, ChatMsg } from '../types';
import { useTranslation } from '../i18n/IdiomaContext';

const SUGGESTIONS = [
  'Quero algo rápido para almoçar',
  'Sugestão para jantar a dois',
  'Onde tem promoção hoje?',
  'Quero comer algo saudável',
  'Quero uma balada hoje',
  'Quero reservar uma mesa',
];

export default function AIChat({
  restaurants, onBack,
}: {
  restaurants: Restaurant[];
  onBack: () => void;
}) {
  const user = getUser();
  const { idioma } = useTranslation();
  const [messages, setMessages] = useState<ChatMsg[]>([{
    role: 'assistant',
    content: `Olá${user && !user.isGuest ? ', ' + user.name.split(' ')[0] : ''}! Sou a IA do Miar 🍽️\nPosso te ajudar a encontrar restaurantes, sugerir pratos, descobrir promoções ou planejar uma saída. O que você tem vontade hoje?`,
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    const newMessages: ChatMsg[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    setLoading(true);
    const needle = msg.toLocaleLowerCase('pt-BR');
    const matches = restaurants.filter((restaurant) =>
      [restaurant.name, restaurant.segment, restaurant.cuisine, restaurant.address]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(needle),
    ).slice(0, 4);
    const greeting = idioma === 'en' ? 'I found' : 'Encontrei';
    const response = matches.length
      ? `${greeting} ${matches.length === 1 ? 'esta opção' : 'estas opções'} para você:\n${matches.map((restaurant) => `• ${restaurant.name}${restaurant.segment ? ` — ${restaurant.segment}` : ''}${restaurant.address ? ` (${restaurant.address})` : ''}`).join('\n')}\n\nToque em Buscar para ver o cardápio e os detalhes.`
      : `Ainda não encontrei uma opção confirmada para “${msg}”. Use Buscar para procurar por produto, restaurante ou cidade — os resultados vêm diretamente do catálogo publicado.`;
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <div className="client-ai-shell flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="client-ai-header flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <button onClick={onBack} className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="client-ai-orb flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20">
            <Bot className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">IA Miar</p>
            <p className="text-[10px] text-slate-400">Assistente de gastronomia</p>
          </div>
        </div>
      </header>

      <div className="client-ai-messages flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <Bot className="h-3.5 w-3.5 text-emerald-400" />
              </div>
            )}
            <div className={`client-ai-bubble max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line
              ${m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-100 rounded-bl-sm'}`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20">
              <Bot className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="flex gap-1 rounded-2xl bg-slate-800 px-4 py-3">
              {[0,1,2].map(j => <div key={j} className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${j * 0.15}s` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="client-ai-suggestions px-4 pb-2 flex gap-2 overflow-x-auto">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => void send(s)}
              className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="client-ai-composer border-t border-slate-800 p-3 flex gap-2 pb-20">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void send()}
          placeholder="Pergunte à IA Miar..."
          className="client-ai-input flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none" />
        <button onClick={() => void send()} disabled={!input.trim() || loading}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white disabled:opacity-50 hover:bg-emerald-400">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
