import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, GripHorizontal, Loader2, Send, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePlanAccess } from '@/contexts/PlanContext';
import { useMiarAssistant, type MiarAction } from '@/hooks/use-miar-assistant';
import { MiarAvatar } from './MiarAvatar';

const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 560;
const POSITION_KEY = 'miar:assistant:position';

const SUGGESTIONS = [
  'Quais produtos venderam menos esta semana?',
  'O que devo comprar para não faltar estoque?',
  'Qual produto tem margem baixa?',
  'Qual foi o melhor horário de vendas?',
  'Que promoção posso criar?',
];

interface Position { x: number; y: number }

const clampToViewport = (position: Position): Position => ({
  x: Math.min(Math.max(position.x, 8), Math.max(window.innerWidth - PANEL_WIDTH - 8, 8)),
  y: Math.min(Math.max(position.y, 8), Math.max(window.innerHeight - PANEL_HEIGHT - 8, 8)),
});

const defaultPosition = (): Position => ({
  x: Math.max(window.innerWidth - PANEL_WIDTH - 24, 8),
  y: Math.max(window.innerHeight - PANEL_HEIGHT - 96, 8),
});

function ActionCard({
  action,
  canExecute,
  onDecide,
}: {
  action: MiarAction;
  canExecute: boolean;
  onDecide: (id: string, approved: boolean) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);

  const decide = async (approved: boolean) => {
    setBusy(true);
    try {
      await onDecide(action.id, approved);
    } catch {
      // O estado de falha já é refletido pelo hook.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-medium text-foreground">{action.summary}</p>

      {action.status === 'pending' && (
        canExecute ? (
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="h-7 flex-1 text-xs" disabled={busy} onClick={() => void decide(true)}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Confirmar
            </Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" disabled={busy} onClick={() => void decide(false)}>
              Recusar
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Você não tem permissão para aplicar alterações da MIAR. Peça a um administrador.
          </p>
        )
      )}

      {action.status === 'confirmed' && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
          <Check className="h-3 w-3" /> Aplicado.
        </p>
      )}
      {action.status === 'rejected' && <p className="mt-2 text-[11px] text-muted-foreground">Recusado.</p>}
      {(action.status === 'failed' || action.status === 'expired') && (
        <p className="mt-2 flex items-start gap-1 text-[11px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {action.error_message || 'A sugestão expirou.'}
        </p>
      )}
    </div>
  );
}

export function MiarAssistantWidget() {
  const { planId } = usePlanAccess();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const dragOffset = useRef<Position | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { access, messages, sending, loadingAccess, error, send, decide } = useMiarAssistant(open);

  // Posição inicial e persistência entre sessões.
  useEffect(() => {
    if (!open || position) return;
    try {
      const stored = window.localStorage.getItem(POSITION_KEY);
      setPosition(stored ? clampToViewport(JSON.parse(stored) as Position) : defaultPosition());
    } catch {
      setPosition(defaultPosition());
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const handleResize = () => setPosition((current) => (current ? clampToViewport(current) : current));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [open]);

  useEffect(() => {
    const node = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, sending]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!position) return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    dragOffset.current = { x: event.clientX - position.x, y: event.clientY - position.y };
  }, [position]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    event.preventDefault();
    setPosition(clampToViewport({
      x: event.clientX - dragOffset.current.x,
      y: event.clientY - dragOffset.current.y,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragOffset.current) return;
    dragOffset.current = null;
    setPosition((current) => {
      if (current) {
        try { window.localStorage.setItem(POSITION_KEY, JSON.stringify(current)); } catch { /* opcional */ }
      }
      return current;
    });
  }, []);

  const submit = () => {
    if (!draft.trim() || sending) return;
    void send(draft);
    setDraft('');
  };

  const quotaExhausted = Boolean(access && access.messages_remaining <= 0 && access.message_limit > 0);
  const blocked = Boolean(access && !access.has_access);

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir MIAR Gestora IA"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-primary/20 bg-background/95 py-2 pl-2 pr-4 shadow-lg backdrop-blur transition hover:shadow-xl"
        >
          <span className="relative">
            <MiarAvatar className="h-9 w-9" iconClassName="h-5 w-5" />
            <span className="absolute inset-0 animate-ping rounded-full border border-primary/30" />
          </span>
          <span className="text-left">
            <span className="block text-xs font-semibold leading-tight">MIAR Gestora IA</span>
            <span className="block text-[10px] leading-tight text-muted-foreground">Sua analista da loja</span>
          </span>
        </button>
      )}

      {/* Painel arrastável */}
      {open && position && (
        <div
          className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
          style={{ left: position.x, top: position.y, width: PANEL_WIDTH, height: PANEL_HEIGHT }}
        >
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="flex cursor-grab items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 active:cursor-grabbing"
          >
            <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
            <MiarAvatar className="h-7 w-7" iconClassName="h-4 w-4" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">MIAR Gestora IA</p>
              {access && access.message_limit > 0 && (
                <p className="text-[10px] leading-tight text-muted-foreground">
                  {access.messages_remaining} de {access.message_limit} mensagens neste mês
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3 py-3" ref={scrollRef}>
            {loadingAccess && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando seu acesso...
              </p>
            )}

            {!loadingAccess && blocked && (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" /> MIAR indisponível no seu plano
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {access?.plan_allows_ai === false
                    ? `O plano ${planId ?? 'atual'} não inclui a IA de gestão. Ela começa no plano Intermediário.`
                    : 'Seu usuário não tem permissão para conversar com a MIAR. Peça a um administrador.'}
                </p>
              </div>
            )}

            {!loadingAccess && !blocked && messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Pergunte sobre a operação da sua loja. Eu leio suas vendas, estoque e financeiro.
                </p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="block w-full rounded-lg border border-border px-3 py-2 text-left text-xs transition hover:border-primary/40 hover:bg-muted/50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                    )}
                  >
                    {message.content}
                    {message.actions?.map((action) => (
                      <ActionCard
                        key={action.id}
                        action={action}
                        canExecute={Boolean(access?.user_can_execute && access?.plan_allows_actions)}
                        onDecide={decide}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {sending && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Analisando seus dados...
                </p>
              )}
            </div>

            {error && (
              <p className="mt-3 flex items-start gap-1 rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
              </p>
            )}
          </ScrollArea>

          {!blocked && (
            <div className="border-t border-border p-2">
              {quotaExhausted ? (
                <p className="px-1 py-2 text-center text-[11px] text-muted-foreground">
                  Cota mensal encerrada. Renova em {access ? new Date(access.period_end).toLocaleDateString('pt-BR') : '-'}.
                </p>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    placeholder="Pergunte sobre vendas, estoque, margem..."
                    rows={2}
                    disabled={sending}
                    className="min-h-[44px] resize-none text-xs"
                  />
                  <Button size="icon" className="h-9 w-9 shrink-0" disabled={sending || !draft.trim()} onClick={submit}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
