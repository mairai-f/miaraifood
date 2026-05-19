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

export const verifyStoreAdminApproval = async (
  accessToken: string,
  adminEmail: string,
  adminPassword: string,
  requiredFeature?: string,
) => {
  const { data, error } = await supabase.functions.invoke<ApprovalResponse>('authorize-store-admin', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      adminEmail: adminEmail.trim(),
      adminPassword: adminPassword.trim(),
      requiredFeature: requiredFeature?.trim() || undefined,
    },
  });

  if (!error && data?.success) {
    return {
      success: true as const,
      approvedBy: data.approvedBy ?? null,
    };
  }

  let message = data?.error || 'Nao foi possivel validar a autorizacao do administrador.';

  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    try {
      const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
      message = errorPayload.error || errorPayload.message || message;
    } catch {
      message = error.context.status === 401
        ? 'Sua sessao expirou. Entre novamente para continuar.'
        : message;
    }
  }

  return {
    success: false as const,
    error: getPublicErrorMessage(message, 'Nao foi possivel validar a autorizacao do administrador.'),
  };
};
