import { getPublicAuthErrorMessage } from '../../shared/security/redaction';

export interface PasskeyEntry {
  id: string;
  friendly_name?: string;
  created_at: string;
  last_used_at?: string;
}

const isDesktopShell = () => typeof window !== 'undefined' && Boolean(window.electronAPI);
const PASSKEY_RP_ID = 'miaraifood.com.br';
const isLoopbackHost = (hostname: string) =>
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '[::1]';

export const getPasskeySupportErrorMessage = () => {
  if (typeof window === 'undefined') {
    return 'Biometria por passkey está disponível apenas no navegador.';
  }

  if (isDesktopShell()) {
    return 'Biometria por passkey será liberada no app em uma etapa nativa separada. Por enquanto, use o navegador seguro.';
  }

  if (!/^https?:$/.test(window.location.protocol)) {
    return 'Biometria por passkey exige um navegador aberto em HTTP seguro ou HTTPS.';
  }

  if (!window.isSecureContext) {
    return 'Biometria por passkey exige um navegador em contexto seguro.';
  }

  if (isLoopbackHost(window.location.hostname)) {
    return 'Biometria por passkey ficara disponivel nos dominios oficiais do MIAR AI/FOOD. No localhost, continue usando senha.';
  }

  if (!window.location.hostname.endsWith(PASSKEY_RP_ID)) {
    return 'Este dominio ainda nao faz parte da biometria configurada do MIAR AI/FOOD.';
  }

  if (typeof window.PublicKeyCredential === 'undefined' || typeof navigator.credentials === 'undefined') {
    return 'Este navegador não oferece suporte a biometria por passkey.';
  }

  return null;
};

const getErrorField = (error: unknown, field: 'code' | 'name' | 'message') => {
  if (!error || typeof error !== 'object' || !(field in error)) {
    return '';
  }

  const value = error[field];
  return typeof value === 'string' ? value : '';
};

const getOriginalErrorName = (error: unknown) => {
  if (!error || typeof error !== 'object' || !('originalError' in error)) {
    return '';
  }

  const originalError = error.originalError;
  if (!originalError || typeof originalError !== 'object' || !('name' in originalError)) {
    return '';
  }

  return typeof originalError.name === 'string' ? originalError.name : '';
};

export const getPasskeyErrorMessage = (error: unknown, fallbackMessage: string) => {
  const code = getErrorField(error, 'code').toLowerCase();
  const name = getErrorField(error, 'name').toLowerCase();
  const message = getPublicAuthErrorMessage(error, fallbackMessage);
  const originalErrorName = getOriginalErrorName(error).toLowerCase();
  const normalized = `${code} ${name} ${originalErrorName} ${message}`.toLowerCase();

  if (normalized.includes('email_not_confirmed')) {
    return 'Confirme o email do administrador antes de cadastrar a biometria.';
  }

  if (normalized.includes('passkey_disabled')) {
    return 'Biometria por passkey ainda não está habilitada no servidor.';
  }

  if (normalized.includes('auth session missing')) {
    return 'Entre com email e senha antes de cadastrar a biometria.';
  }

  if (normalized.includes('browser does not support webauthn')) {
    return 'Este navegador não oferece suporte a biometria por passkey.';
  }

  if (
    normalized.includes('notallowederror')
    || normalized.includes('aborterror')
    || normalized.includes('timed out')
    || normalized.includes('not allowed')
    || normalized.includes('ceremony was sent an abort signal')
  ) {
    return 'A biometria foi cancelada ou não foi autorizada neste dispositivo.';
  }

  if (
    normalized.includes('invalid domain')
    || normalized.includes('invalid rp id')
    || normalized.includes('securityerror')
  ) {
    return 'Este domínio ainda não está apto para usar passkeys.';
  }

  return message;
};
