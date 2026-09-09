import { describe, expect, it } from 'vitest';
import { chatErrorMessage } from '@/lib/chatErrors';

describe('chat error messages', () => {
  it('traduz a recusa do banco para o usuario', () => {
    expect(chatErrorMessage('unauthorized_message_edit')).toBe(
      'Você não tem permissão para editar mensagens.',
    );
  });

  it('reconhece o codigo mesmo quando o driver acrescenta prefixo', () => {
    expect(chatErrorMessage('P0001: chat_conversation_not_available')).toBe(
      'Esta conversa não está mais disponível para você.',
    );
  });

  it('preserva mensagem desconhecida para nao esconder erro novo', () => {
    expect(chatErrorMessage('storage: payload too large')).toBe('storage: payload too large');
  });

  it('tem texto proprio quando o driver nao informa nada', () => {
    expect(chatErrorMessage('')).toBe('Não foi possível concluir a ação do chat.');
    expect(chatErrorMessage(null)).toBe('Não foi possível concluir a ação do chat.');
  });
});
