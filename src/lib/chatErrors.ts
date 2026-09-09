// O banco sinaliza recusas do chat com códigos estáveis (RAISE EXCEPTION).
// Eles são contrato entre banco e interface, nunca texto para o usuário final.
const CHAT_ERROR_MESSAGES: Record<string, string> = {
  chat_conversation_not_available: 'Esta conversa não está mais disponível para você.',
  conversation_not_found: 'Conversa não encontrada.',
  group_not_found: 'Grupo não encontrado.',
  invalid_direct_conversation: 'Não é possível abrir uma conversa com você mesmo.',
  invalid_group_name: 'O nome do grupo precisa ter entre 2 e 80 caracteres.',
  invalid_message_body: 'A mensagem precisa ter entre 1 e 10.000 caracteres.',
  message_not_deletable: 'Esta mensagem não pode mais ser removida.',
  message_not_editable: 'Esta mensagem não pode mais ser editada.',
  only_subscription_owner_can_delete: 'Somente o administrador da assinatura pode excluir conversas.',
  target_not_authorized_for_chat: 'Este colaborador não tem permissão para usar o chat.',
  target_not_in_company: 'Este colaborador não pertence à sua empresa.',
  unauthenticated: 'Sua sessão expirou. Entre novamente para continuar.',
  unauthorized_chat_access: 'Você não tem permissão para usar o chat interno.',
  unauthorized_chat_audit: 'Você não tem permissão para ver a auditoria do chat.',
  unauthorized_group_archive: 'Você não tem permissão para arquivar grupos.',
  unauthorized_group_create: 'Você não tem permissão para criar grupos.',
  unauthorized_group_members: 'Você não tem permissão para gerenciar participantes.',
  unauthorized_group_photo: 'Você não tem permissão para alterar a foto do grupo.',
  unauthorized_message_delete: 'Você não tem permissão para excluir mensagens.',
  unauthorized_message_edit: 'Você não tem permissão para editar mensagens.',
  unauthorized_or_invalid_group_name: 'Você não tem permissão para renomear o grupo, ou o nome informado é inválido.',
};

/**
 * Traduz a recusa do banco para o usuário. Um código desconhecido devolve o
 * texto original: esconder a causa atrasaria o diagnóstico de um erro novo.
 */
export const chatErrorMessage = (raw?: string | null): string => {
  const message = (raw || '').trim();
  if (!message) return 'Não foi possível concluir a ação do chat.';
  const known = Object.keys(CHAT_ERROR_MESSAGES).find(
    (code) => message === code || message.includes(code),
  );
  return known ? CHAT_ERROR_MESSAGES[known] : message;
};
