export const normalizeOperatorUsername = (value: string) => value.trim().toLowerCase();

export const isValidOperatorUsername = (value: string) =>
  /^[a-z0-9._-]{3,24}$/.test(normalizeOperatorUsername(value));

export const buildOperatorEmail = (username: string) =>
  `operator.${normalizeOperatorUsername(username)}@happycash.local`;

export const operatorUsernameHelpText =
  'Use de 3 a 24 caracteres com letras, numeros, ponto, hifen ou underscore.';

export {
  buildOperatorAuthPasswordCandidates,
  isOperatorPin,
  resolveOperatorAuthPassword,
} from "../../../shared/security/operatorCredential.ts";
