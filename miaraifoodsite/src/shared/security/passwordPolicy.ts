export const passwordPolicy = {
  minLength: 10,
} as const;

export const passwordPolicyHint =
  "Use no minimo 10 caracteres, com letra maiuscula, letra minuscula, numero e simbolo.";

const hasUppercase = (value: string) => /[A-Z]/.test(value);
const hasLowercase = (value: string) => /[a-z]/.test(value);
const hasNumber = (value: string) => /\d/.test(value);
const hasSymbol = (value: string) => /[^A-Za-z0-9]/.test(value);

export const getPasswordPolicyErrors = (password: string) => {
  const errors: string[] = [];

  if (password.length < passwordPolicy.minLength) {
    errors.push(`A senha deve ter no minimo ${passwordPolicy.minLength} caracteres.`);
  }

  if (!hasUppercase(password)) {
    errors.push("A senha deve ter pelo menos uma letra maiuscula.");
  }

  if (!hasLowercase(password)) {
    errors.push("A senha deve ter pelo menos uma letra minuscula.");
  }

  if (!hasNumber(password)) {
    errors.push("A senha deve ter pelo menos um numero.");
  }

  if (!hasSymbol(password)) {
    errors.push("A senha deve ter pelo menos um simbolo.");
  }

  return errors;
};

export const getPasswordPolicyError = (password: string) =>
  getPasswordPolicyErrors(password)[0] ?? null;

export const isStrongPassword = (password: string) =>
  getPasswordPolicyErrors(password).length === 0;
