import { supabase } from '@/integrations/supabase/client';
import { getPublicErrorMessage } from '../../shared/security/redaction';

interface ApprovalResponse {
  success?: boolean;
  approvedBy?: {
    email?: string | null;
    username?: string | null;
  };
  error?: string;
}

export const verifyPricingManagerApproval = async (
  accessToken: string,
  adminEmail: string,
  adminPassword: string,
) => {
  const { data, error } = await supabase.functions.invoke<ApprovalResponse>('authorize-pricing-manager', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      adminEmail: adminEmail.trim(),
      adminPassword: adminPassword.trim(),
    },
  });

  if (!error && data?.success) {
    return {
      success: true as const,
      approvedBy: data.approvedBy ?? null,
    };
  }

  let message = data?.error || 'Não foi possível validar a autorização do gerente.';

  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    try {
      const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
      message = errorPayload.error || errorPayload.message || message;
    } catch {
      message = error.context.status === 401
        ? 'Sua sessão expirou. Entre novamente para continuar.'
        : message;
    }
  }

  return {
    success: false as const,
    error: getPublicErrorMessage(message, 'Não foi possível validar a autorização do gerente.'),
  };
};
