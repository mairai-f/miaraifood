// Distingue "o usuario precisa corrigir algo" de "quebrou algo aqui dentro".
// Sem essa separacao, o catch do cadastro respondia a mesma frase generica
// para os dois casos e o motivo real se perdia — inclusive nos logs.
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const isValidationError = (error: unknown): error is ValidationError =>
  error instanceof ValidationError
  || (error instanceof Error && error.name === "ValidationError");
