/**
 * jwt.ts — leitura (client-side, sem verificação de assinatura) do payload
 * de um JWT já emitido pelo backend, só pra decidir o que renderizar na UI.
 *
 * IMPORTANTE: isto NUNCA deve ser usado como controle de acesso real — o
 * backend sempre reverifica o token (verifyToken/requireAnyAuth/
 * requireEmployeePermission em api-server/src/routes/auth.ts). Aqui serve
 * só pra saber, no cliente, se o token guardado em 'miar-owner-token' é de
 * um funcionário (isEmployee: true, employeeId presente — como assinado em
 * POST /auth/employee-login e POST /employees/verify-pin) ou do dono
 * (role: "owner", sem isEmployee — como assinado no cadastro/login normal),
 * pra decidir a moldura da tela (RoleShell "Piloto operacional" vs sessão
 * de funcionário real).
 */
export interface DecodedTokenPayload {
  role?: string;
  isEmployee?: boolean;
  employeeId?: string;
  name?: string;
  companyId?: string;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string | null | undefined): DecodedTokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as DecodedTokenPayload;
  } catch {
    return null;
  }
}

/** true quando o token guardado pertence a um funcionário (não ao dono em modo preview). */
export function isEmployeeToken(payload: DecodedTokenPayload | null): boolean {
  return Boolean(payload?.isEmployee && payload?.employeeId);
}
