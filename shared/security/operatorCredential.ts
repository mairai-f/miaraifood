import { getPasswordPolicyError, passwordPolicyHint } from "./passwordPolicy.ts";

const OPERATOR_PIN_PATTERN = /^\d{4,8}$/;

export const operatorPinHelpText = "Ou use um PIN de 4 a 8 digitos.";

export const operatorCredentialHint = `${passwordPolicyHint} ${operatorPinHelpText}`;

export const isOperatorPin = (value: string) => OPERATOR_PIN_PATTERN.test(value.trim());

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
