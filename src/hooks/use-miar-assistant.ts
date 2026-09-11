import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MiarAccess {
  has_access: boolean;
  plan_id: string | null;
  plan_allows_ai: boolean;
  plan_allows_actions: boolean;
  user_can_chat: boolean;
  user_can_execute: boolean;
  message_limit: number;
  messages_used: number;
  messages_remaining: number;
  period_end: string;
}

export interface MiarAction {
  id: string;
  tool_name: string;
  summary: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'failed' | 'expired';
  error_message?: string | null;
}

export interface MiarMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  actions?: MiarAction[];
}

const FUNCTION_NAME = 'miar-assistant';

async function readFunctionError(error: unknown): Promise<string | null> {
  const response = (error as { context?: unknown } | null)?.context;
  if (!(response instanceof Response)) return null;

  try {
    const payload = await response.clone().json() as { error?: unknown };
    return typeof payload?.error === 'string' && payload.error.trim() ? payload.error : null;
  } catch {
    return null;
  }
}

export function useMiarAssistant(enabled: boolean) {
  const [access, setAccess] = useState<MiarAccess | null>(null);
  const [messages, setMessages] = useState<MiarMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const call = useCallback(async <T,>(body: Record<string, unknown>): Promise<T> => {
    const { data, error: invokeError } = await supabase.functions.invoke<T & { error?: string }>(
      FUNCTION_NAME,
      { body },
    );
    // O corpo de erro da função traz a mensagem útil (cota, plano, permissão).
    if (invokeError) {
      const detail = (data as { error?: string } | null)?.error;
      throw new Error(detail || await readFunctionError(invokeError) || invokeError.message);
    }
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      throw new Error(String(data.error));
    }
    return data as T;
  }, []);

  const refreshAccess = useCallback(async () => {
    if (!enabled) return;
    setLoadingAccess(true);
    try {
      const result = await call<MiarAccess>({ action: 'access' });
      if (mountedRef.current) setAccess(result);
    } catch (accessError) {
      if (mountedRef.current) {
        setAccess(null);
        setError(accessError instanceof Error ? accessError.message : 'Falha ao verificar acesso.');
      }
    } finally {
      if (mountedRef.current) setLoadingAccess(false);
    }
  }, [call, enabled]);

  useEffect(() => { void refreshAccess(); }, [refreshAccess]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const optimistic: MiarMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setSending(true);
    setError(null);

    try {
      const result = await call<{
        conversation_id: string;
        reply: string;
        actions: MiarAction[];
        messages_remaining: number;
      }>({ action: 'chat', message: trimmed, conversation_id: conversationId });

      if (!mountedRef.current) return;
      setConversationId(result.conversation_id);
      setMessages((current) => [...current, {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        content: result.reply,
        created_at: new Date().toISOString(),
        actions: result.actions ?? [],
      }]);
      setAccess((current) => (current
        ? { ...current, messages_remaining: result.messages_remaining, messages_used: current.messages_used + 1 }
        : current));
    } catch (sendError) {
      if (!mountedRef.current) return;
      // Desfaz a mensagem otimista: ela não entrou na conversa.
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setError(sendError instanceof Error ? sendError.message : 'Falha ao falar com a MIAR.');
      void refreshAccess();
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [call, conversationId, refreshAccess, sending]);

  const decide = useCallback(async (actionId: string, approved: boolean) => {
    const setStatus = (status: MiarAction['status'], errorMessage?: string) => {
      setMessages((current) => current.map((message) => ({
        ...message,
        actions: message.actions?.map((item) =>
          item.id === actionId ? { ...item, status, error_message: errorMessage ?? null } : item),
      })));
    };

    try {
      const result = await call<{ status: MiarAction['status']; error?: string }>({
        action: 'decide', action_id: actionId, approved,
      });
      setStatus(result.status, result.error);
      return result;
    } catch (decideError) {
      const message = decideError instanceof Error ? decideError.message : 'Falha ao aplicar.';
      setStatus('failed', message);
      throw decideError;
    }
  }, [call]);

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return { access, messages, sending, loadingAccess, error, send, decide, reset, refreshAccess };
}
