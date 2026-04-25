import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildOperatorEmail,
  isValidOperatorUsername,
  normalizeOperatorUsername,
  operatorUsernameHelpText,
} from '../_shared/operatorCredentials.ts';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { getPasswordPolicyError } from '../_shared/passwordPolicy.ts';

type ManageOperatorRequest =
  | {
      action: 'create';
      username?: string;
      password?: string;
    }
  | {
      action: 'reset_password';
      operatorUserId?: string;
      password?: string;
    }
  | {
      action: 'open_cash';
      operatorUserId?: string;
      openingAmount?: number | string;
    }
  | {
      action: 'delete';
      operatorUserId?: string;
    }
  | {
      action: 'reset_financial' | 'reset_reports' | 'reset_financial_reports';
      adminEmail?: string;
      adminPassword?: string;
    };

interface OperatorLookupRow {
  user_id: string;
  username: string;
}

const jsonResponse = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(buildCorsHeaders(request, {
        allowedMethods: ['POST', 'OPTIONS'],
      }).headers.entries()),
      'Content-Type': 'application/json',
    },
  });

const getBody = async (request: Request): Promise<ManageOperatorRequest | null> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight(request, {
      allowedMethods: ['POST', 'OPTIONS'],
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Método não suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Configuração de autenticação inválida.' }, 500);
  }

  if (!accessToken) {
    return jsonResponse(request, { error: 'Sessão inválida. Faça login novamente.' }, 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonResponse(request, { error: 'Sessão inválida. Faça login novamente.' }, 401);
  }

  const { data: callerProfile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role, owner_user_id, username, email')
    .eq('user_id', user.id)
    .single();

  if (profileError || !callerProfile) {
    return jsonResponse(request, { error: 'Perfil do usuário não encontrado.' }, 403);
  }

  if (callerProfile.role !== 'admin') {
    return jsonResponse(request, { error: 'Somente administradores podem gerenciar operadores.' }, 403);
  }

  const { data: hasSettingsAccess, error: accessError } = await authClient.rpc('current_store_has_feature', {
    target_feature: 'settings.manage',
  });

  if (accessError || !hasSettingsAccess) {
    return jsonResponse(request, { error: 'Seu plano atual nao libera configuracoes da loja.' }, 403);
  }

  const ownerUserId = callerProfile.owner_user_id ?? user.id;
  const body = await getBody(request);

  if (!body?.action) {
    return jsonResponse(request, { error: 'Ação inválida.' }, 400);
  }

  if (body.action === 'create') {
    const normalizedUsername = normalizeOperatorUsername(body.username ?? '');
    const password = body.password?.trim();
    const passwordError = getPasswordPolicyError(password || '');

    if (!isValidOperatorUsername(normalizedUsername)) {
      return jsonResponse(request, { error: operatorUsernameHelpText }, 400);
    }

    if (!password || passwordError) {
      return jsonResponse(request, { error: passwordError || 'Informe a senha do operador.' }, 400);
    }

    const { data: existingOperators, error: existingOperatorsError } = await serviceClient
      .from('profiles')
      .select('user_id, username')
      .eq('role', 'operator');

    if (existingOperatorsError) {
      return jsonResponse(request, { error: 'Não foi possível validar o usuário do operador.' }, 500);
    }

    const usernameAlreadyExists = ((existingOperators as OperatorLookupRow[] | null) ?? []).some(
      (operator) => normalizeOperatorUsername(operator.username) === normalizedUsername,
    );

    if (usernameAlreadyExists) {
      return jsonResponse(request, { error: 'Esse usuário já está em uso. Escolha outro.' }, 409);
    }

    const generatedEmail = buildOperatorEmail(normalizedUsername);

    const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
      email: generatedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: normalizedUsername,
        role: 'operator',
        owner_user_id: ownerUserId,
        created_by_user_id: user.id,
      },
    });

    if (createError || !createdUser.user) {
      const errorMessage = createError?.message?.toLowerCase().includes('already')
        ? 'Esse usuário já está em uso. Escolha outro.'
        : createError?.message || 'Não foi possível criar o operador.';

      return jsonResponse(request, { error: errorMessage }, 400);
    }

    const { error: updateProfileError } = await serviceClient
      .from('profiles')
      .upsert({
        user_id: createdUser.user.id,
        username: normalizedUsername,
        email: generatedEmail,
        role: 'operator',
        owner_user_id: ownerUserId,
        created_by_user_id: user.id,
      }, { onConflict: 'user_id' });

    if (updateProfileError) {
      await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      return jsonResponse(request, { error: 'Operador criado, mas o perfil não foi atualizado corretamente.' }, 500);
    }

    return jsonResponse(request, {
      success: true,
      operator: {
        user_id: createdUser.user.id,
        username: normalizedUsername,
      },
      temporaryPassword: password,
    });
  }

  if (body.action === 'reset_password') {
    const operatorUserId = body.operatorUserId?.trim();
    const password = body.password?.trim();
    const passwordError = getPasswordPolicyError(password || '');

    if (!operatorUserId) {
      return jsonResponse(request, { error: 'Operador inválido.' }, 400);
    }

    if (!password || passwordError) {
      return jsonResponse(request, { error: passwordError || 'Informe a nova senha.' }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id, username')
      .eq('user_id', operatorUserId)
      .single();

    if (targetProfileError || !targetProfile) {
      return jsonResponse(request, { error: 'Operador não encontrado.' }, 404);
    }

    if (targetProfile.role !== 'operator' || targetProfile.owner_user_id !== ownerUserId) {
      return jsonResponse(request, { error: 'Você não pode redefinir a senha deste operador.' }, 403);
    }

    const { error: resetError } = await serviceClient.auth.admin.updateUserById(operatorUserId, {
      password,
    });

    if (resetError) {
      return jsonResponse(request, { error: resetError.message || 'Não foi possível redefinir a senha.' }, 400);
    }

    return jsonResponse(request, {
      success: true,
      operator: {
        user_id: targetProfile.user_id,
        username: targetProfile.username,
      },
      temporaryPassword: password,
    });
  }

  if (body.action === 'open_cash') {
    const operatorUserId = body.operatorUserId?.trim();
    const parsedOpeningAmount = typeof body.openingAmount === 'number'
      ? body.openingAmount
      : Number.parseFloat(String(body.openingAmount ?? '0'));

    if (!operatorUserId) {
      return jsonResponse(request, { error: 'Operador inválido.' }, 400);
    }

    if (Number.isNaN(parsedOpeningAmount) || parsedOpeningAmount < 0) {
      return jsonResponse(request, { error: 'Valor inicial inválido.' }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id, username')
      .eq('user_id', operatorUserId)
      .single();

    if (targetProfileError || !targetProfile) {
      return jsonResponse(request, { error: 'Operador não encontrado.' }, 404);
    }

    if (targetProfile.role !== 'operator' || targetProfile.owner_user_id !== ownerUserId) {
      return jsonResponse(request, { error: 'Você não pode abrir caixa para este operador.' }, 403);
    }

    const { data: existingOpenSession, error: existingOpenSessionError } = await serviceClient
      .from('cash_sessions')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .eq('operator_user_id', operatorUserId)
      .eq('status', 'open')
      .maybeSingle();

    if (existingOpenSessionError) {
      return jsonResponse(request, { error: 'Não foi possível validar o caixa atual do operador.' }, 500);
    }

    if (existingOpenSession?.id) {
      return jsonResponse(request, { error: 'Este operador já está com caixa aberto.' }, 400);
    }

    const openedByName = callerProfile.username || callerProfile.email || user.email || 'Administrador';

    const { data: createdCashSession, error: createCashSessionError } = await serviceClient
      .from('cash_sessions')
      .insert({
        owner_user_id: ownerUserId,
        operator_user_id: operatorUserId,
        operator_name: targetProfile.username || 'Operador',
        opened_by_name: openedByName,
        opening_amount: Number(parsedOpeningAmount.toFixed(2)),
      })
      .select('id')
      .single();

    if (createCashSessionError || !createdCashSession) {
      return jsonResponse(request, { error: createCashSessionError?.message || 'Não foi possível abrir o caixa para este operador.' }, 400);
    }

    return jsonResponse(request, {
      success: true,
      cashSession: {
        id: createdCashSession.id,
      },
    });
  }

  if (body.action === 'delete') {
    const operatorUserId = body.operatorUserId?.trim();

    if (!operatorUserId) {
      return jsonResponse(request, { error: 'Operador inválido.' }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id, username')
      .eq('user_id', operatorUserId)
      .single();

    if (targetProfileError || !targetProfile) {
      return jsonResponse(request, { error: 'Operador não encontrado.' }, 404);
    }

    if (targetProfile.role !== 'operator' || targetProfile.owner_user_id !== ownerUserId) {
      return jsonResponse(request, { error: 'Você não pode excluir este operador.' }, 403);
    }

    const { data: openSession, error: openSessionError } = await serviceClient
      .from('cash_sessions')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .eq('operator_user_id', operatorUserId)
      .eq('status', 'open')
      .maybeSingle();

    if (openSessionError) {
      return jsonResponse(request, { error: 'Não foi possível validar o status do caixa deste operador.' }, 500);
    }

    if (openSession?.id) {
      return jsonResponse(request, { error: 'Feche o caixa desse operador antes de excluí-lo.' }, 400);
    }

    const { error: deleteProfileError } = await serviceClient
      .from('profiles')
      .delete()
      .eq('user_id', operatorUserId);

    if (deleteProfileError) {
      return jsonResponse(request, { error: deleteProfileError.message || 'Não foi possível remover o perfil do operador.' }, 400);
    }

    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(operatorUserId);
    if (deleteUserError) {
      await serviceClient
        .from('profiles')
        .upsert(targetProfile, { onConflict: 'user_id' });

      return jsonResponse(request, { error: deleteUserError.message || 'Não foi possível excluir o acesso do operador.' }, 400);
    }

    return jsonResponse(request, {
      success: true,
      operator: {
        user_id: targetProfile.user_id,
        username: targetProfile.username,
      },
    });
  }

  if (body.action === 'reset_financial' || body.action === 'reset_reports' || body.action === 'reset_financial_reports') {
    const adminEmail = normalizeEmail(body.adminEmail ?? '');
    const adminPassword = body.adminPassword?.trim() ?? '';

    if (!adminEmail) {
      return jsonResponse(request, { error: 'Informe o login do administrador.' }, 400);
    }

    if (!adminPassword) {
      return jsonResponse(request, { error: 'Informe a senha do administrador.' }, 400);
    }

    const verificationClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: verificationSession, error: verificationError } = await verificationClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });

    if (verificationError || !verificationSession.user) {
      return jsonResponse(request, { error: 'Login ou senha de administrador inválidos.' }, 401);
    }

    const { data: verificationProfile, error: verificationProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id')
      .eq('user_id', verificationSession.user.id)
      .single();

    if (verificationProfileError || !verificationProfile || verificationProfile.role !== 'admin') {
      return jsonResponse(request, { error: 'A conta informada não possui acesso de administrador.' }, 403);
    }

    const verifiedOwnerUserId = verificationProfile.owner_user_id ?? verificationProfile.user_id;
    if (verifiedOwnerUserId !== ownerUserId) {
      return jsonResponse(request, { error: 'Este administrador não pertence à mesma loja.' }, 403);
    }

    const deleteFinancialData = async () => {
      const { data: clients, error: clientsError } = await serviceClient
        .from('clients')
        .select('id')
        .eq('user_id', ownerUserId);

      if (clientsError) {
        return { errorResponse: jsonResponse(request, { error: 'Não foi possível preparar a limpeza dos dados financeiros.' }, 500) };
      }

      const clientIds = (clients ?? []).map(client => client.id);

      const { count: deletedExpenses, error: deleteExpensesError } = await serviceClient
        .from('expenses')
        .delete({ count: 'exact' })
        .eq('user_id', ownerUserId);

      if (deleteExpensesError) {
        return { errorResponse: jsonResponse(request, { error: 'Falha ao limpar as despesas.' }, 500) };
      }

      let deletedDebtEntries = 0;
      let deletedPayments = 0;

      if (clientIds.length > 0) {
        const { count: paymentsCount, error: deletePaymentsError } = await serviceClient
          .from('payments')
          .delete({ count: 'exact' })
          .in('client_id', clientIds);

        if (deletePaymentsError) {
          return { errorResponse: jsonResponse(request, { error: 'Falha ao limpar os pagamentos.' }, 500) };
        }

        const { count: debtEntriesCount, error: deleteDebtEntriesError } = await serviceClient
          .from('debt_entries')
          .delete({ count: 'exact' })
          .in('client_id', clientIds);

        if (deleteDebtEntriesError) {
          return { errorResponse: jsonResponse(request, { error: 'Falha ao limpar os fiados.' }, 500) };
        }

        deletedPayments = paymentsCount ?? 0;
        deletedDebtEntries = debtEntriesCount ?? 0;
      }

      return {
        deletedExpenses: deletedExpenses ?? 0,
        deletedDebtEntries,
        deletedPayments,
      };
    };

    const deleteReportData = async () => {
      const { data: salesRows, error: salesRowsError } = await serviceClient
        .from('sales')
        .select('id')
        .eq('user_id', ownerUserId);

      if (salesRowsError) {
        return { errorResponse: jsonResponse(request, { error: 'Falha ao listar as vendas para limpar os relatórios.' }, 500) };
      }

      const saleIds = (salesRows ?? []).map(row => row.id);

      let deletedSaleItems = 0;
      if (saleIds.length > 0) {
        const { count: saleItemsCount, error: saleItemsCountError } = await serviceClient
          .from('sale_items')
          .select('id', { count: 'exact', head: true })
          .in('sale_id', saleIds);

        if (saleItemsCountError) {
          return { errorResponse: jsonResponse(request, { error: 'Falha ao contar os itens de venda.' }, 500) };
        }

        deletedSaleItems = saleItemsCount ?? 0;
      }

      const { count: deletedSales, error: deleteSalesError } = await serviceClient
        .from('sales')
        .delete({ count: 'exact' })
        .eq('user_id', ownerUserId);

      if (deleteSalesError) {
        return { errorResponse: jsonResponse(request, { error: 'Falha ao limpar as vendas dos relatórios.' }, 500) };
      }

      return {
        deletedSales: deletedSales ?? 0,
        deletedSaleItems,
      };
    };

    const shouldDeleteFinancial = body.action === 'reset_financial' || body.action === 'reset_financial_reports';
    const shouldDeleteReports = body.action === 'reset_reports' || body.action === 'reset_financial_reports';

    let financialResult: Awaited<ReturnType<typeof deleteFinancialData>> | null = null;
    let reportResult: Awaited<ReturnType<typeof deleteReportData>> | null = null;

    if (shouldDeleteFinancial) {
      financialResult = await deleteFinancialData();
      if ('errorResponse' in financialResult) {
        return financialResult.errorResponse;
      }
    }

    if (shouldDeleteReports) {
      reportResult = await deleteReportData();
      if ('errorResponse' in reportResult) {
        return reportResult.errorResponse;
      }
    }

    if (body.action === 'reset_financial') {
      return jsonResponse(request, {
        success: true,
        deleted: {
          expenses: financialResult?.deletedExpenses ?? 0,
          debtEntries: financialResult?.deletedDebtEntries ?? 0,
          payments: financialResult?.deletedPayments ?? 0,
        },
      });
    }

    if (body.action === 'reset_reports') {
      return jsonResponse(request, {
        success: true,
        deleted: {
          sales: reportResult?.deletedSales ?? 0,
          saleItems: reportResult?.deletedSaleItems ?? 0,
        },
      });
    }

    return jsonResponse(request, {
      success: true,
      deleted: {
        sales: reportResult?.deletedSales ?? 0,
        saleItems: reportResult?.deletedSaleItems ?? 0,
        expenses: financialResult?.deletedExpenses ?? 0,
        payments: financialResult?.deletedPayments ?? 0,
        debtEntries: financialResult?.deletedDebtEntries ?? 0,
      },
    });
  }

  return jsonResponse(request, { error: 'Ação não suportada.' }, 400);
});
