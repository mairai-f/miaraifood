import { getPasswordPolicyError, passwordPolicyHint } from "./passwordPolicy.ts";

const OPERATOR_PIN_PATTERN = /^\d{4,8}$/;
const OPERATOR_AUTH_PIN_PREFIX = "happycash-operator-pin-v1";

export const operatorPinHelpText = "Ou use um PIN de 4 a 8 digitos.";

export const operatorCredentialHint = `${passwordPolicyHint} ${operatorPinHelpText}`;

export const isOperatorPin = (value: string) => OPERATOR_PIN_PATTERN.test(value.trim());

const normalizeOperatorCredentialUsername = (value: string) => value.trim().toLowerCase();

export const resolveOperatorAuthPassword = (username: string, value: string) => {
  const normalizedValue = value.trim();
  if (!isOperatorPin(normalizedValue)) {
    return normalizedValue;
  }

  return `${OPERATOR_AUTH_PIN_PREFIX}:${normalizeOperatorCredentialUsername(username)}:${normalizedValue}`;
};

export const buildOperatorAuthPasswordCandidates = (username: string, value: string) => {
  const normalizedValue = value.trim();
  if (!normalizedValue) return [];

  if (!isOperatorPin(normalizedValue)) {
    return [normalizedValue];
  }

  return [
    resolveOperatorAuthPassword(username, normalizedValue),
    normalizedValue,
  ];
};

export const getOperatorCredentialError = (value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "Informe a senha ou PIN do operador.";
  }

  if (isOperatorPin(normalizedValue)) {
    return null;
  }

  return getPasswordPolicyError(normalizedValue);
};
