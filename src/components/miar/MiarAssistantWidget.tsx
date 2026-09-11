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
const BUTTON_POSITION_KEY = 'miar:assistant:button-position';

const SUGGESTIONS = [
  'Quais produtos venderam menos esta semana?',
  'O que devo comprar para não faltar estoque?',
  'Qual produto tem margem baixa?',
  'Que promoção posso criar para passar na TV?',
  'Como registro uma venda de balcão com você?',
];

const brl = (value: unknown) =>
  Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Resumo do que a ação confirmada realmente fez, a partir do resultado devolvido pela função. */
function confirmedDetail(action: MiarAction): string {
  const result = action.result ?? {};
  switch (action.tool_name) {
    case 'registrar_venda':
      return result.total !== undefined ? `Venda de ${brl(result.total)} registrada no seu caixa.` : 'Venda registrada.';
    case 'ajustar_estoque':
      return result.estoque_novo !== undefined ? `Estoque agora: ${result.estoque_novo}.` : 'Estoque atualizado.';
    case 'criar_promocao':
      return result.preco_promocional !== undefined
        ? `Promoção criada: sai por ${brl(result.preco_promocional)}. Já entra nas TVs.`
        : 'Promoção criada.';
    case 'gerar_foto_produto':
      return result.publicado ? 'Foto salva no cardápio.' : 'Foto salva. Publique o item em Configurações > QR Menu.';
    default:
      return 'Aplicado.';
  }
}

interface Position { x: number; y: number }

const clampToViewport = (position: Position): Position => ({
  x: Math.min(Math.max(position.x, 8), Math.max(window.innerWidth - PANEL_WIDTH - 8, 8)),
  y: Math.min(Math.max(position.y, 8), Math.max(window.innerHeight - PANEL_HEIGHT - 8, 8)),
});

const defaultPosition = (): Position => ({
  x: Math.max(window.innerWidth - PANEL_WIDTH - 24, 8),
  y: Math.max(window.innerHeight - PANEL_HEIGHT - 96, 8),
});

const defaultButtonPosition = (): Position => ({
  x: Math.max(window.innerWidth - 220, 8),
  y: Math.max(window.innerHeight - 72, 8),
});

const clampButtonToViewport = (position: Position): Position => ({
  x: Math.min(Math.max(position.x, 8), Math.max(window.innerWidth - 220, 8)),
  y: Math.min(Math.max(position.y, 8), Math.max(window.innerHeight - 56, 8)),
});

function ActionCard({
  action,
  blockReason,
  onDecide,
}: {
  action: MiarAction;
  /** Motivo real de não poder confirmar (plano ou permissão); null quando pode. */
  blockReason: string | null;
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

  const imageUrl = typeof action.result?.image_url === 'string' ? action.result.image_url : null;

  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-medium text-foreground">{action.summary}</p>

      {action.status === 'pending' && (
        !blockReason ? (
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
          <p className="mt-2 text-[11px] text-muted-foreground">{blockReason}</p>
        )
      )}

      {action.status === 'confirmed' && (
        <>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600">
            <Check className="h-3 w-3" /> {confirmedDetail(action)}
          </p>
          {imageUrl && (
            <img src={imageUrl} alt="" loading="lazy" className="mt-2 h-28 w-28 rounded-md border border-border object-cover" />
          )}
        </>
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
  const [buttonPosition, setButtonPosition] = useState<Position | null>(null);
  const dragOffset = useRef<Position | null>(null);
  const buttonDragOffset = useRef<Position | null>(null);
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
    if (open || buttonPosition) return;
    try {
      const stored = window.localStorage.getItem(BUTTON_POSITION_KEY);
      setButtonPosition(stored ? clampButtonToViewport(JSON.parse(stored) as Position) : defaultButtonPosition());
    } catch {
      setButtonPosition(defaultButtonPosition());
    }
  }, [buttonPosition, open]);

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

  const handleButtonPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!buttonPosition) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    buttonDragOffset.current = { x: event.clientX - buttonPosition.x, y: event.clientY - buttonPosition.y };
  }, [buttonPosition]);

  const handleButtonPointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!buttonDragOffset.current) return;
    event.preventDefault();
    setButtonPosition(clampButtonToViewport({
      x: event.clientX - buttonDragOffset.current.x,
      y: event.clientY - buttonDragOffset.current.y,
    }));
  }, []);

  const handleButtonPointerUp = useCallback(() => {
    if (!buttonDragOffset.current) return;
    buttonDragOffset.current = null;
    setButtonPosition((current) => {
      if (current) {
        try { window.localStorage.setItem(BUTTON_POSITION_KEY, JSON.stringify(current)); } catch { /* opcional */ }
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
  // Mostra o motivo verdadeiro: plano sem ações é diferente de usuário sem permissão.
  const actionBlockReason = !access
    ? 'Verificando se você pode aplicar alterações...'
    : !access.plan_allows_actions
      ? `O plano ${access.plan_id ?? planId ?? 'atual'} não permite que a MIAR aplique alterações. Ela continua analisando; aplicar é liberado nos planos Intermediário e Premium.`
      : !access.user_can_execute
        ? 'Seu usuário não tem a permissão "Aplicar ações sugeridas pela MIAR". Peça a um administrador.'
        : null;

  return (
    <>
      {/* Botão flutuante */}
      {!open && buttonPosition && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerDown={handleButtonPointerDown}
          onPointerMove={handleButtonPointerMove}
          onPointerUp={handleButtonPointerUp}
          onPointerCancel={handleButtonPointerUp}
          aria-label="Abrir MIAR Gestora IA"
          style={{ left: buttonPosition.x, top: buttonPosition.y, touchAction: 'none' }}
          className="fixed z-50 flex cursor-grab items-center gap-2 rounded-full border border-primary/20 bg-background/95 py-2 pl-2 pr-4 shadow-lg backdrop-blur transition hover:shadow-xl active:cursor-grabbing"
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
                  Pergunte sobre a operação da sua loja ou peça para cadastrar produto, lançar estoque,
                  registrar venda de balcão ou criar promoção. Nada muda sem a sua confirmação.
                </p>
                {access && !access.plan_allows_actions && (
                  <Badge variant="secondary" className="text-[10px]">Neste plano a MIAR só analisa, sem alterar dados</Badge>
                )}
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
                        blockReason={actionBlockReason}
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
                    placeholder="Pergunte ou peça: venda, estoque, promoção..."
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
