import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  buildOperatorEmail,
  isValidOperatorUsername,
  normalizeOperatorUsername,
  operatorUsernameHelpText,
  resolveOperatorAuthPassword,
} from '../_shared/operatorCredentials.ts';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';
import { getOperatorCredentialError } from '../../../shared/security/operatorCredential.ts';

type ManageOperatorRequest =
  | {
      action: 'list';
    }
  | {
      action: 'create';
      fullName?: string;
      username?: string;
      password?: string;
      jobTitle?: string;
      staffRole?: string;
      permissionKeys?: string[];
      commissionEnabled?: boolean;
      commissionRatePct?: number | string | null;
      photoUrl?: string | null;
      addressZipCode?: string | null;
      addressStreet?: string | null;
      addressNumber?: string | null;
      addressComplement?: string | null;
      addressNeighborhood?: string | null;
      addressCity?: string | null;
      addressState?: string | null;
      workJourney?: string | null;
      adminEmail?: string;
      adminPassword?: string;
      adminAccessToken?: string;
    }
  | {
      action: 'update_access';
      operatorUserId?: string;
      fullName?: string;
      jobTitle?: string;
      staffRole?: string;
      permissionKeys?: string[];
      commissionEnabled?: boolean;
      commissionRatePct?: number | string | null;
      photoUrl?: string | null;
      addressZipCode?: string | null;
      addressStreet?: string | null;
      addressNumber?: string | null;
      addressComplement?: string | null;
      addressNeighborhood?: string | null;
      addressCity?: string | null;
      addressState?: string | null;
      workJourney?: string | null;
      adminEmail?: string;
      adminPassword?: string;
      adminAccessToken?: string;
    }
  | {
      action: 'reset_password';
      operatorUserId?: string;
      password?: string;
      adminEmail?: string;
      adminPassword?: string;
      adminAccessToken?: string;
    }
  | {
      action: 'verify_admin';
      adminEmail?: string;
      adminPassword?: string;
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
    }
  | {
      action: 'delete_account';
      adminEmail?: string;
      adminPassword?: string;
    };

interface OperatorLookupRow {
  user_id: string;
  username: string;
}

interface HrEmployeeLookupRow {
  id: string;
  full_name: string;
}

interface StaffEmployeeDetails {
  photoUrl?: string | null;
  addressZipCode?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  workJourney?: string | null;
}

type StaffRole = 'operator' | 'waiter' | 'hr';
const staffRoles: StaffRole[] = ['operator', 'waiter', 'hr'];
const normalizeJobTitle = (value: string | undefined | null) => value?.trim().replace(/\s+/g, ' ') ?? '';
const isValidJobTitle = (value: string) => value.length >= 2 && value.length <= 60;
const normalizePersonName = (value: string | undefined | null) => value?.trim().replace(/\s+/g, ' ') ?? '';
const normalizePersonNameKey = (value: string | undefined | null) =>
  normalizePersonName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const isValidPersonName = (value: string) => value.length >= 3 && value.length <= 100;
const normalizeCommissionSettings = (details: { commissionEnabled?: boolean; commissionRatePct?: number | string | null }) => {
  const enabled = details.commissionEnabled === true;
  const rawRate = typeof details.commissionRatePct === 'number'
    ? details.commissionRatePct
    : Number(String(details.commissionRatePct ?? '').replace(',', '.'));
  const ratePct = Number.isFinite(rawRate) ? Number(rawRate.toFixed(2)) : 0;

  if (!enabled) {
    return { enabled: false, ratePct: 0, error: null as string | null };
  }

  if (ratePct <= 0 || ratePct > 100) {
    return { enabled, ratePct, error: 'Informe uma comissao entre 0,01% e 100%.' };
  }

  return { enabled, ratePct, error: null as string | null };
};
const isHrPermissionKey = (permissionKey: string) => permissionKey.startsWith('hr.');
const isEmployeePortalPermissionKey = (permissionKey: string) => permissionKey.startsWith('employee_portal.');
const isEnterpriseOnlyPermissionKey = (permissionKey: string) =>
  isHrPermissionKey(permissionKey) || isEmployeePortalPermissionKey(permissionKey);
const requiredStaffPermissionKeys: string[] = [];
const protectedManagerGrantPermissionKeys = new Set<string>([
  'settings.manage',
  'rbac.manage',
  'fiscal.manage',
  'audit.view',
  'staff.manage',
  'multi_store.manage',
]);
const ensureRequiredStaffPermissions = (permissionKeys: string[]) => [...new Set([
  ...permissionKeys,
  ...requiredStaffPermissionKeys,
])];
const resolveStaffRoleFromPermissions = (_permissionKeys: string[]): StaffRole => 'operator';
const isInternalOperatorEmail = (value: string | null | undefined) =>
  Boolean(value?.endsWith('@operators.happycash.local') || value?.endsWith('@happycash.local'));
const normalizeOptionalText = (value: string | null | undefined) => value?.trim() ?? '';

const readStaffEmployeeDetails = (body: Extract<ManageOperatorRequest, { action: 'create' | 'update_access' }>): StaffEmployeeDetails => ({
  photoUrl: body.photoUrl,
  addressZipCode: body.addressZipCode,
  addressStreet: body.addressStreet,
  addressNumber: body.addressNumber,
  addressComplement: body.addressComplement,
  addressNeighborhood: body.addressNeighborhood,
  addressCity: body.addressCity,
  addressState: body.addressState,
  workJourney: body.workJourney,
});

interface CallerProfile {
  role: string;
  owner_user_id: string | null;
  username: string | null;
  email: string | null;
}

const ensureUniqueHrEmployeeName = async (details: {
  serviceClient: SupabaseClient;
  ownerUserId: string;
  fullName: string;
  excludeEmployeeId?: string | null;
}) => {
  const normalizedTarget = normalizePersonNameKey(details.fullName);
  if (!normalizedTarget) return null;

  const { data, error } = await details.serviceClient
    .from('hr_employees')
    .select('id, full_name')
    .eq('owner_user_id', details.ownerUserId);

  if (error) {
    return 'Nao foi possivel validar se ja existe colaborador com esse nome.';
  }

  const duplicate = ((data ?? []) as HrEmployeeLookupRow[]).find((employee) =>
    employee.id !== details.excludeEmployeeId
    && normalizePersonNameKey(employee.full_name) === normalizedTarget,
  );

  return duplicate
    ? 'Ja existe colaborador com esse nome completo. Use o segundo nome, sobrenome ou outro identificador diferente.'
    : null;
};

const syncHrEmployeeForStaffProfile = async (details: {
  serviceClient: SupabaseClient;
  ownerUserId: string;
  profileUserId: string;
  fullName?: string | null;
  username: string;
  email?: string | null;
  role: StaffRole;
  jobTitle: string;
  employeeDetails?: StaffEmployeeDetails;
  actorUserId?: string | null;
}) => {
  const requestedFullName = normalizePersonName(details.fullName);
  const fullName = requestedFullName || normalizeJobTitle(details.username) || details.jobTitle || `Colaborador ${details.profileUserId.slice(0, 8)}`;
  const normalizedEmail = normalizeEmail(details.email ?? '');
  const employeeDetailsPayload = details.employeeDetails ? {
    photo_url: normalizeOptionalText(details.employeeDetails.photoUrl) || null,
    address_zip_code: normalizeOptionalText(details.employeeDetails.addressZipCode) || null,
    address_street: normalizeOptionalText(details.employeeDetails.addressStreet) || null,
    address_number: normalizeOptionalText(details.employeeDetails.addressNumber) || null,
    address_complement: normalizeOptionalText(details.employeeDetails.addressComplement) || null,
    address_neighborhood: normalizeOptionalText(details.employeeDetails.addressNeighborhood) || null,
    address_city: normalizeOptionalText(details.employeeDetails.addressCity) || null,
    address_state: normalizeOptionalText(details.employeeDetails.addressState).toUpperCase() || null,
    work_journey: normalizeOptionalText(details.employeeDetails.workJourney) || null,
  } : {};
  const payload = {
    owner_user_id: details.ownerUserId,
    profile_user_id: details.profileUserId,
    full_name: fullName,
    preferred_name: normalizeJobTitle(details.username) || null,
    email: !normalizedEmail || isInternalOperatorEmail(normalizedEmail) ? null : normalizedEmail,
    status: 'active',
    employment_type: 'other',
    department: details.role === 'hr' ? 'RH' : null,
    position: details.jobTitle,
    updated_by: details.actorUserId ?? null,
    ...employeeDetailsPayload,
  };

  const { data: existingEmployee, error: lookupError } = await details.serviceClient
    .from('hr_employees')
    .select('id, full_name, preferred_name, email, employment_type, department')
    .eq('owner_user_id', details.ownerUserId)
    .eq('profile_user_id', details.profileUserId)
    .maybeSingle();

  if (lookupError) {
    return lookupError.message;
  }

  if (existingEmployee?.id) {
    const nextFullName = requestedFullName || normalizePersonName(existingEmployee.full_name) || payload.full_name;
    const duplicateNameError = await ensureUniqueHrEmployeeName({
      serviceClient: details.serviceClient,
      ownerUserId: details.ownerUserId,
      fullName: nextFullName,
      excludeEmployeeId: existingEmployee.id,
    });
    if (duplicateNameError) return duplicateNameError;

    const { error } = await details.serviceClient
      .from('hr_employees')
      .update({
        ...payload,
        full_name: nextFullName,
        preferred_name: normalizeJobTitle(existingEmployee.preferred_name) || payload.preferred_name,
        email: normalizeEmail(existingEmployee.email ?? '') || payload.email,
        employment_type: existingEmployee.employment_type ?? payload.employment_type,
        department: details.role === 'hr' ? 'RH' : existingEmployee.department,
      })
      .eq('id', existingEmployee.id);
    return error?.message ?? null;
  }

  const duplicateNameError = await ensureUniqueHrEmployeeName({
    serviceClient: details.serviceClient,
    ownerUserId: details.ownerUserId,
    fullName: payload.full_name,
  });
  if (duplicateNameError) return duplicateNameError;

  const { error } = await details.serviceClient
    .from('hr_employees')
    .insert({
      ...payload,
      created_by: details.actorUserId ?? null,
    });

  return error?.message ?? null;
};

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

const verifyAdminProfileForOwner = async (
  details: {
    serviceClient: SupabaseClient;
    ownerUserId: string;
    adminUserId: string;
  },
) => {
  const { data: verificationProfile, error: verificationProfileError } = await details.serviceClient
    .from('profiles')
    .select('user_id, role, owner_user_id')
    .eq('user_id', details.adminUserId)
    .single();

  if (verificationProfileError || !verificationProfile || verificationProfile.role !== 'admin') {
    return 'A conta informada nao possui acesso de administrador.';
  }

  const verifiedOwnerUserId = verificationProfile.owner_user_id ?? verificationProfile.user_id;
  if (verifiedOwnerUserId !== details.ownerUserId) {
    return 'Este administrador nao pertence a mesma loja.';
  }

  return null;
};

const verifyAdminPasswordForOwner = async (
  details: {
    serviceClient: SupabaseClient;
    ownerUserId: string;
    adminEmail: string;
    adminPassword: string;
  },
) => {
  const { data: verifiedAdminUserId, error } = await details.serviceClient.rpc('verify_admin_password_for_owner', {
    target_owner_user_id: details.ownerUserId,
    target_email: details.adminEmail,
    target_password: details.adminPassword,
  });

  if (error) {
    console.error('Erro ao validar senha do administrador:', error.message);
    return null;
  }

  if (!verifiedAdminUserId || typeof verifiedAdminUserId !== 'string') {
    return null;
  }

  return verifiedAdminUserId;
};

const verifyAdminCredentials = async (
  details: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    serviceClient: SupabaseClient;
    ownerUserId: string;
    adminEmail?: string;
    adminPassword?: string;
    adminAccessToken?: string;
  },
) => {
  const adminAccessToken = details.adminAccessToken?.trim() ?? '';
  if (adminAccessToken) {
    const { data: verifiedUser, error: verifiedUserError } = await details.serviceClient.auth.getUser(adminAccessToken);

    if (verifiedUserError || !verifiedUser.user?.id) {
      return 'Nao foi possivel validar a autorizacao do administrador.';
    }

    return verifyAdminProfileForOwner({
      serviceClient: details.serviceClient,
      ownerUserId: details.ownerUserId,
      adminUserId: verifiedUser.user.id,
    });
  }

  const adminEmail = normalizeEmail(details.adminEmail ?? '');
  const adminPassword = details.adminPassword?.trim() ?? '';

  if (!adminEmail || !adminPassword) {
    return 'Confirme esta acao com login e senha do administrador.';
  }

  const verifiedAdminUserId = await verifyAdminPasswordForOwner({
    serviceClient: details.serviceClient,
    ownerUserId: details.ownerUserId,
    adminEmail,
    adminPassword,
  });

  if (!verifiedAdminUserId) {
    return 'Login ou senha do administrador invalidos.';
  }

  return null;
};

const userHasErpPermission = async (
  serviceClient: SupabaseClient,
  targetUserId: string,
  permissionKey: string,
) => {
  const { data, error } = await serviceClient.rpc('erp_user_has_permission', {
    target_user_id: targetUserId,
    target_permission_key: permissionKey,
  });

  if (error) {
    console.error('Erro ao consultar permissao efetiva:', error.message);
    return false;
  }

  return data === true;
};

const getProtectedManagerPermissions = async (
  serviceClient: SupabaseClient,
  targetUserId: string,
) => {
  const checks = await Promise.all([...protectedManagerGrantPermissionKeys].map(async (permissionKey) => {
    const allowed = await userHasErpPermission(serviceClient, targetUserId, permissionKey);
    return allowed ? permissionKey : null;
  }));

  return checks.filter((permissionKey): permissionKey is string => Boolean(permissionKey));
};

const verifyStaffCredentialsForOwner = async (
  details: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    serviceClient: SupabaseClient;
    ownerUserId: string;
    callerUserId: string;
    login?: string;
    password?: string;
    requiredPermissionKey: string;
  },
) => {
  const normalizedLogin = normalizeOperatorUsername(details.login ?? '');
  const password = details.password?.trim() ?? '';

  if (!normalizedLogin || !password) {
    return 'Confirme esta acao com usuario e senha/PIN do gerente.';
  }

  if (!isValidOperatorUsername(normalizedLogin)) {
    return operatorUsernameHelpText;
  }

  const verificationClient = createClient(details.supabaseUrl, details.supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await verificationClient.auth.signInWithPassword({
    email: buildOperatorEmail(normalizedLogin),
    password: resolveOperatorAuthPassword(normalizedLogin, password),
  });

  if (error || !data.user?.id) {
    return 'Usuario ou senha/PIN do gerente invalidos.';
  }

  if (data.user.id !== details.callerUserId) {
    return 'A credencial informada precisa ser do gerente logado nesta sessao.';
  }

  const { data: verificationProfile, error: verificationProfileError } = await details.serviceClient
    .from('profiles')
    .select('user_id, role, owner_user_id')
    .eq('user_id', data.user.id)
    .single();

  if (
    verificationProfileError
    || !verificationProfile
    || verificationProfile.owner_user_id !== details.ownerUserId
    || !staffRoles.includes(verificationProfile.role)
  ) {
    return 'Esta credencial nao pertence a um gerente desta loja.';
  }

  const hasRequiredPermission = await userHasErpPermission(
    details.serviceClient,
    data.user.id,
    details.requiredPermissionKey,
  );

  if (!hasRequiredPermission) {
    return 'Este gerente nao possui permissao para gerenciar colaboradores.';
  }

  return null;
};

const verifyStaffAccessAuthorization = async (
  details: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    serviceClient: SupabaseClient;
    ownerUserId: string;
    callerUserId: string;
    callerProfile: CallerProfile;
    adminEmail?: string;
    adminPassword?: string;
    adminAccessToken?: string;
  },
) => {
  if (details.callerProfile.role === 'admin') {
    return verifyAdminCredentials({
      supabaseUrl: details.supabaseUrl,
      supabaseAnonKey: details.supabaseAnonKey,
      serviceClient: details.serviceClient,
      ownerUserId: details.ownerUserId,
      adminEmail: details.adminEmail,
      adminPassword: details.adminPassword,
      adminAccessToken: details.adminAccessToken,
    });
  }

  return verifyStaffCredentialsForOwner({
    supabaseUrl: details.supabaseUrl,
    supabaseAnonKey: details.supabaseAnonKey,
    serviceClient: details.serviceClient,
    ownerUserId: details.ownerUserId,
    callerUserId: details.callerUserId,
    login: details.adminEmail,
    password: details.adminPassword,
    requiredPermissionKey: 'staff.manage',
  });
};

Deno.serve(async (request): Promise<Response> => {
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

  const endpointRateLimit = await checkRedisRateLimit(request, {
    namespace: 'manage-operators',
    limit: readRateLimitEnv('MANAGE_OPERATORS_RATE_LIMIT_PER_MINUTE', 120),
    windowSeconds: 60,
  });

  if (!endpointRateLimit.allowed) {
    return jsonResponse(
      request,
      {
        error: 'Muitas operacoes administrativas em pouco tempo. Aguarde alguns instantes e tente novamente.',
        retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
      },
      429,
    );
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

  const ownerUserId = callerProfile.owner_user_id ?? user.id;
  const body = await getBody(request);

  if (!body?.action) {
    return jsonResponse(request, { error: 'Ação inválida.' }, 400);
  }

  const callerIsAdmin = callerProfile.role === 'admin';
  const isAdminVerificationAction = body.action === 'verify_admin';
  const callerCanManageStaff = callerIsAdmin || await userHasErpPermission(serviceClient, user.id, 'staff.manage');
  const callerHasCashPermission = callerIsAdmin || await userHasErpPermission(serviceClient, user.id, 'pdv.open_cash');
  const callerCanOpenCash = callerIsAdmin || (callerCanManageStaff && callerHasCashPermission);

  if (!isAdminVerificationAction) {
    const isStaffManagementAction = ['list', 'create', 'update_access', 'reset_password'].includes(body.action);
    const isCashAction = body.action === 'open_cash';

    if (isStaffManagementAction && !callerCanManageStaff) {
      return jsonResponse(request, { error: 'Somente administrador ou gerente autorizado pode gerenciar colaboradores e acessos.' }, 403);
    }

    if (isCashAction && !callerCanOpenCash) {
      return jsonResponse(request, { error: 'Voce nao possui permissao para abrir caixa de colaborador.' }, 403);
    }

    if (!isStaffManagementAction && !isCashAction && !callerIsAdmin) {
      return jsonResponse(request, { error: 'Somente administrador pode executar esta acao.' }, 403);
    }
  }

  if (body.action !== 'delete_account' && !isAdminVerificationAction) {
    const { data: hasSettingsAccess, error: accessError } = await authClient.rpc('current_store_has_feature', {
      target_feature: 'settings.manage',
    });

    if (accessError || !hasSettingsAccess) {
      return jsonResponse(
        request,
        { error: 'Seu plano atual nao libera configuracoes da loja.' },
        403,
      );
    }
  }

  if (body.action === 'verify_admin') {
    const adminEmail = normalizeEmail(body.adminEmail ?? '');
    const adminPassword = body.adminPassword?.trim() ?? '';

    if (!adminEmail || !adminPassword) {
      return jsonResponse(request, { error: 'Informe login e senha do administrador.' }, 400);
    }

    const verifiedAdminUserId = await verifyAdminPasswordForOwner({
      serviceClient,
      ownerUserId,
      adminEmail,
      adminPassword,
    });

    if (!verifiedAdminUserId) {
      return jsonResponse(request, { error: 'Login ou senha do administrador invalidos.' }, 401);
    }

    return jsonResponse(request, { success: true });
  }

  if (body.action === 'list') {
    const [
      { data: operators, error: operatorsError },
      { data: openCashSessions, error: openCashSessionsError },
      { data: permissionRows, error: permissionError },
      { data: employeeRows, error: employeeError },
    ] = await Promise.all([
      serviceClient
        .from('profiles')
        .select('user_id, username, role, job_title, created_at, commission_enabled, commission_rate_pct')
        .eq('owner_user_id', ownerUserId)
        .in('role', staffRoles)
        .order('username', { ascending: true }),
      serviceClient
        .from('cash_sessions')
        .select('id, operator_user_id, operator_name, opening_amount, opened_at')
        .eq('owner_user_id', ownerUserId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false }),
      serviceClient
        .from('erp_staff_permission_overrides')
        .select('user_id, permission_key, allowed')
        .eq('owner_user_id', ownerUserId)
        .eq('allowed', true),
      serviceClient
        .from('hr_employees')
        .select('profile_user_id, full_name, photo_url, address_zip_code, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, work_journey')
        .eq('owner_user_id', ownerUserId)
        .not('profile_user_id', 'is', null),
    ]);

    if (operatorsError) {
      return jsonResponse(request, { error: 'Nao foi possivel consultar os operadores.' }, 500);
    }

    if (openCashSessionsError) {
      return jsonResponse(request, { error: 'Nao foi possivel consultar os caixas abertos.' }, 500);
    }

    if (permissionError || employeeError) {
      return jsonResponse(request, { error: 'Nao foi possivel consultar os acessos do RH.' }, 500);
    }

    const permissionsByUserId = new Map<string, string[]>();
    for (const row of (permissionRows ?? []) as Array<{ user_id: string; permission_key: string; allowed: boolean }>) {
      if (!row.allowed) continue;
      const current = permissionsByUserId.get(row.user_id) ?? [];
      current.push(row.permission_key);
      permissionsByUserId.set(row.user_id, current);
    }

    const employeeDetailsByUserId = new Map<string, Record<string, unknown>>();
    for (const row of (employeeRows ?? []) as Array<Record<string, unknown> & { profile_user_id: string | null; full_name?: string | null }>) {
      if (!row.profile_user_id) continue;
      employeeDetailsByUserId.set(row.profile_user_id, row);
    }

    return jsonResponse(request, {
      success: true,
      operators: (operators ?? []).map((operator) => ({
        ...operator,
        ...(employeeDetailsByUserId.get(operator.user_id) ?? {}),
        full_name: (employeeDetailsByUserId.get(operator.user_id)?.full_name as string | null | undefined) ?? null,
        permission_keys: permissionsByUserId.get(operator.user_id) ?? [],
      })),
      openCashSessions: openCashSessions ?? [],
    });
  }

  if (body.action === 'create') {
    const fullName = normalizePersonName(body.fullName ?? body.username ?? '');
    const normalizedUsername = normalizeOperatorUsername(body.username ?? '');
    const password = body.password?.trim();
    const jobTitle = normalizeJobTitle(body.jobTitle);
    const employeeDetails = readStaffEmployeeDetails(body);
    const commissionSettings = callerIsAdmin
      ? normalizeCommissionSettings(body)
      : { enabled: false, ratePct: 0, error: null as string | null };
    const credentialError = getOperatorCredentialError(password || '');
    const authPassword = resolveOperatorAuthPassword(normalizedUsername, password || '');
    const requestedPermissionKeys = ensureRequiredStaffPermissions([...new Set(
      (Array.isArray(body.permissionKeys) ? body.permissionKeys : []).filter(
        (permissionKey): permissionKey is string => typeof permissionKey === 'string' && permissionKey.trim() !== '',
      ),
    )]);
    const operatorRole = resolveStaffRoleFromPermissions(requestedPermissionKeys);

    if (!isValidOperatorUsername(normalizedUsername)) {
      return jsonResponse(request, { error: operatorUsernameHelpText }, 400);
    }

    if (!isValidPersonName(fullName)) {
      return jsonResponse(request, { error: 'Informe o nome completo do colaborador entre 3 e 100 caracteres.' }, 400);
    }

    if (!password || credentialError) {
      return jsonResponse(request, { error: credentialError || 'Informe o PIN do operador.' }, 400);
    }

    if (!isValidJobTitle(jobTitle)) {
      return jsonResponse(request, { error: 'Informe uma funcao entre 2 e 60 caracteres.' }, 400);
    }

    if (requestedPermissionKeys.length === 0) {
      return jsonResponse(request, { error: 'Selecione ao menos um acesso para o colaborador.' }, 400);
    }

    if (requestedPermissionKeys.some(isEnterpriseOnlyPermissionKey)) {
      return jsonResponse(request, { error: 'Permissoes de RH Enterprise e Portal nao fazem parte do cadastro de colaboradores do HappyCash.' }, 400);
    }

    if (commissionSettings.error) {
      return jsonResponse(request, { error: commissionSettings.error }, 400);
    }

    if (!callerIsAdmin && requestedPermissionKeys.some((permissionKey) => protectedManagerGrantPermissionKeys.has(permissionKey))) {
      return jsonResponse(request, { error: 'Gerente nao pode conceder acessos administrativos sensiveis ou criar outro gerente.' }, 403);
    }

    const adminVerificationError = await verifyStaffAccessAuthorization({
      supabaseUrl,
      supabaseAnonKey,
      serviceClient,
      ownerUserId,
      callerUserId: user.id,
      callerProfile: callerProfile as CallerProfile,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      adminAccessToken: body.adminAccessToken,
    });
    if (adminVerificationError) {
      return jsonResponse(request, { error: adminVerificationError }, 401);
    }

    const { data: permissionCatalog, error: permissionCatalogError } = await serviceClient
      .from('erp_permission_catalog')
      .select('permission_key');
    if (permissionCatalogError) {
      return jsonResponse(request, { error: 'Nao foi possivel validar os acessos selecionados.' }, 500);
    }
    const catalogKeys = new Set((permissionCatalog ?? []).map((permission) => permission.permission_key));
    if (requestedPermissionKeys.some((permissionKey) => !catalogKeys.has(permissionKey))) {
      return jsonResponse(request, { error: 'Um ou mais acessos selecionados sao invalidos.' }, 400);
    }

    const { data: existingOperators, error: existingOperatorsError } = await serviceClient
      .from('profiles')
      .select('user_id, username')
      .eq('owner_user_id', ownerUserId);

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
      password: authPassword,
      email_confirm: true,
      user_metadata: {
        username: normalizedUsername,
        role: operatorRole,
        job_title: jobTitle,
        owner_user_id: ownerUserId,
        created_by_user_id: user.id,
      },
    });

    if (createError || !createdUser.user) {
      const errorMessage = createError?.message?.toLowerCase().includes('already')
        ? 'Esse usuário já está em uso. Escolha outro.'
        : 'Não foi possível criar o operador.';

      return jsonResponse(request, { error: errorMessage }, 400);
    }

    const { error: updateProfileError } = await serviceClient
      .from('profiles')
      .upsert({
        user_id: createdUser.user.id,
        username: normalizedUsername,
        email: generatedEmail,
        role: operatorRole,
        job_title: jobTitle,
        owner_user_id: ownerUserId,
        created_by_user_id: user.id,
        commission_enabled: commissionSettings.enabled,
        commission_rate_pct: commissionSettings.ratePct,
      }, { onConflict: 'user_id' });

    if (updateProfileError) {
      await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      return jsonResponse(request, { error: 'Operador criado, mas o perfil não foi atualizado corretamente.' }, 500);
    }

    const hrSyncError = await syncHrEmployeeForStaffProfile({
      serviceClient,
      ownerUserId,
      profileUserId: createdUser.user.id,
      fullName,
      username: normalizedUsername,
      email: generatedEmail,
      role: operatorRole,
      jobTitle,
      employeeDetails,
      actorUserId: user.id,
    });
    if (hrSyncError) {
      await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      const isDuplicateName = hrSyncError.startsWith('Ja existe colaborador');
      return jsonResponse(
        request,
        { error: isDuplicateName ? hrSyncError : 'Colaborador criado, mas nao foi possivel registrar no RH.' },
        isDuplicateName ? 409 : 500,
      );
    }

    // Sem perfil-base: todas as permissoes recebem uma regra individual
    // explicita. Assim a funcao escolhida nao libera acessos implicitamente.
    const selectedPermissionKeys = new Set(requestedPermissionKeys);
    const permissionOverrides = [...catalogKeys].map((permissionKey) => ({
      owner_user_id: ownerUserId,
      user_id: createdUser.user.id,
      permission_key: permissionKey,
      allowed: selectedPermissionKeys.has(permissionKey),
    }));
    const { error: permissionError } = await serviceClient
      .from('erp_staff_permission_overrides')
      .upsert(permissionOverrides, { onConflict: 'user_id,permission_key' });
    if (permissionError) {
      await serviceClient.auth.admin.deleteUser(createdUser.user.id);
      return jsonResponse(request, { error: 'Nao foi possivel salvar os acessos; o colaborador nao foi criado.' }, 500);
    }

    return jsonResponse(request, {
      success: true,
      operator: {
        user_id: createdUser.user.id,
        username: normalizedUsername,
        role: operatorRole,
        job_title: jobTitle,
        commission_enabled: commissionSettings.enabled,
        commission_rate_pct: commissionSettings.ratePct,
        permission_keys: requestedPermissionKeys,
      },
    });
  }

  if (body.action === 'update_access') {
    const operatorUserId = body.operatorUserId?.trim();
    const fullName = normalizePersonName(body.fullName);
    const jobTitle = normalizeJobTitle(body.jobTitle);
    const employeeDetails = readStaffEmployeeDetails(body);
    const commissionSettings = callerIsAdmin ? normalizeCommissionSettings(body) : null;
    const requestedPermissionKeys = ensureRequiredStaffPermissions([...new Set(
      (Array.isArray(body.permissionKeys) ? body.permissionKeys : []).filter(
        (permissionKey): permissionKey is string => typeof permissionKey === 'string' && permissionKey.trim() !== '',
      ),
    )]);
    const nextStaffRole = resolveStaffRoleFromPermissions(requestedPermissionKeys);

    if (!operatorUserId) {
      return jsonResponse(request, { error: 'Colaborador invalido.' }, 400);
    }

    if (!callerIsAdmin && operatorUserId === user.id) {
      return jsonResponse(request, { error: 'Gerente nao pode alterar o proprio acesso.' }, 403);
    }

    if (!isValidJobTitle(jobTitle)) {
      return jsonResponse(request, { error: 'Informe uma funcao entre 2 e 60 caracteres.' }, 400);
    }

    if (body.fullName !== undefined && !isValidPersonName(fullName)) {
      return jsonResponse(request, { error: 'Informe o nome completo do colaborador entre 3 e 100 caracteres.' }, 400);
    }

    if (requestedPermissionKeys.length === 0) {
      return jsonResponse(request, { error: 'Selecione ao menos um acesso para o colaborador.' }, 400);
    }

    if (requestedPermissionKeys.some(isEnterpriseOnlyPermissionKey)) {
      return jsonResponse(request, { error: 'Permissoes de RH Enterprise e Portal nao fazem parte do cadastro de colaboradores do HappyCash.' }, 400);
    }

    if (commissionSettings?.error) {
      return jsonResponse(request, { error: commissionSettings.error }, 400);
    }

    if (!callerIsAdmin && requestedPermissionKeys.some((permissionKey) => protectedManagerGrantPermissionKeys.has(permissionKey))) {
      return jsonResponse(request, { error: 'Gerente nao pode conceder acessos administrativos sensiveis ou criar outro gerente.' }, 403);
    }

    const adminVerificationError = await verifyStaffAccessAuthorization({
      supabaseUrl,
      supabaseAnonKey,
      serviceClient,
      ownerUserId,
      callerUserId: user.id,
      callerProfile: callerProfile as CallerProfile,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      adminAccessToken: body.adminAccessToken,
    });
    if (adminVerificationError) {
      return jsonResponse(request, { error: adminVerificationError }, 401);
    }

    const [{ data: targetProfile, error: targetProfileError }, { data: permissionCatalog, error: permissionCatalogError }] = await Promise.all([
      serviceClient
        .from('profiles')
        .select('user_id, role, owner_user_id, username, job_title, commission_enabled, commission_rate_pct')
        .eq('user_id', operatorUserId)
        .single(),
      serviceClient.from('erp_permission_catalog').select('permission_key'),
    ]);

    if (targetProfileError || !targetProfile) {
      return jsonResponse(request, { error: 'Colaborador nao encontrado.' }, 404);
    }

    if (!staffRoles.includes(targetProfile.role) || targetProfile.owner_user_id !== ownerUserId) {
      return jsonResponse(request, { error: 'Voce nao pode editar este colaborador.' }, 403);
    }

    if (!callerIsAdmin) {
      const protectedTargetPermissions = await getProtectedManagerPermissions(serviceClient, operatorUserId);
      if (protectedTargetPermissions.length > 0) {
        return jsonResponse(request, { error: 'Gerente nao pode alterar outro gerente ou colaborador com acesso administrativo sensivel.' }, 403);
      }
    }

    if (permissionCatalogError) {
      return jsonResponse(request, { error: 'Nao foi possivel validar os acessos selecionados.' }, 500);
    }

    const catalogKeys = new Set((permissionCatalog ?? []).map((permission) => permission.permission_key));
    if (requestedPermissionKeys.some((permissionKey) => !catalogKeys.has(permissionKey))) {
      return jsonResponse(request, { error: 'Um ou mais acessos selecionados sao invalidos.' }, 400);
    }

    const profileUpdatePayload: Record<string, unknown> = { job_title: jobTitle, role: nextStaffRole };
    if (commissionSettings) {
      profileUpdatePayload.commission_enabled = commissionSettings.enabled;
      profileUpdatePayload.commission_rate_pct = commissionSettings.ratePct;
    }

    const { error: updateProfileError } = await serviceClient
      .from('profiles')
      .update(profileUpdatePayload)
      .eq('user_id', operatorUserId);
    if (updateProfileError) {
      return jsonResponse(request, { error: 'Nao foi possivel atualizar a funcao do colaborador.' }, 500);
    }

    const hrSyncError = await syncHrEmployeeForStaffProfile({
      serviceClient,
      ownerUserId,
      profileUserId: operatorUserId,
      fullName,
      username: targetProfile.username,
      email: null,
      role: nextStaffRole,
      jobTitle,
      employeeDetails,
      actorUserId: user.id,
    });
    if (hrSyncError) {
      await serviceClient
        .from('profiles')
        .update({
          job_title: targetProfile.job_title,
          role: targetProfile.role,
          commission_enabled: targetProfile.commission_enabled ?? false,
          commission_rate_pct: targetProfile.commission_rate_pct ?? 0,
        })
        .eq('user_id', operatorUserId);
      const isDuplicateName = hrSyncError.startsWith('Ja existe colaborador');
      return jsonResponse(
        request,
        { error: isDuplicateName ? hrSyncError : 'Nao foi possivel sincronizar o colaborador com o RH.' },
        isDuplicateName ? 409 : 500,
      );
    }

    const selectedPermissionKeys = new Set(requestedPermissionKeys);
    const permissionOverrides = [...catalogKeys].map((permissionKey) => ({
      owner_user_id: ownerUserId,
      user_id: operatorUserId,
      permission_key: permissionKey,
      allowed: selectedPermissionKeys.has(permissionKey),
    }));
    const { error: permissionError } = await serviceClient
      .from('erp_staff_permission_overrides')
      .upsert(permissionOverrides, { onConflict: 'user_id,permission_key' });

    if (permissionError) {
      await serviceClient
        .from('profiles')
        .update({
          job_title: targetProfile.job_title,
          role: targetProfile.role,
          commission_enabled: targetProfile.commission_enabled ?? false,
          commission_rate_pct: targetProfile.commission_rate_pct ?? 0,
        })
        .eq('user_id', operatorUserId);
      return jsonResponse(request, { error: 'Nao foi possivel salvar os acessos do colaborador.' }, 500);
    }

    return jsonResponse(request, {
      success: true,
      operator: {
        user_id: targetProfile.user_id,
        username: targetProfile.username,
        role: nextStaffRole,
        job_title: jobTitle,
        commission_enabled: commissionSettings?.enabled ?? targetProfile.commission_enabled ?? false,
        commission_rate_pct: commissionSettings?.ratePct ?? targetProfile.commission_rate_pct ?? 0,
        permission_keys: requestedPermissionKeys,
      },
    });
  }

  if (body.action === 'reset_password') {
    const operatorUserId = body.operatorUserId?.trim();
    const password = body.password?.trim();
    const credentialError = getOperatorCredentialError(password || '');

    if (!operatorUserId) {
      return jsonResponse(request, { error: 'Operador inválido.' }, 400);
    }

    if (!callerIsAdmin && operatorUserId === user.id) {
      return jsonResponse(request, { error: 'Gerente nao pode redefinir a propria senha.' }, 403);
    }

    if (!password || credentialError) {
      return jsonResponse(request, { error: credentialError || 'Informe o novo PIN.' }, 400);
    }

    const accessVerificationError = await verifyStaffAccessAuthorization({
      supabaseUrl,
      supabaseAnonKey,
      serviceClient,
      ownerUserId,
      callerUserId: user.id,
      callerProfile: callerProfile as CallerProfile,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
      adminAccessToken: body.adminAccessToken,
    });
    if (accessVerificationError) {
      return jsonResponse(request, { error: accessVerificationError }, 401);
    }

    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id, username')
      .eq('user_id', operatorUserId)
      .single();

    if (targetProfileError || !targetProfile) {
      return jsonResponse(request, { error: 'Operador não encontrado.' }, 404);
    }

    if (!staffRoles.includes(targetProfile.role) || targetProfile.owner_user_id !== ownerUserId) {
      return jsonResponse(request, { error: 'Você não pode redefinir a senha deste operador.' }, 403);
    }

    if (!callerIsAdmin) {
      const protectedTargetPermissions = await getProtectedManagerPermissions(serviceClient, operatorUserId);
      if (protectedTargetPermissions.length > 0) {
        return jsonResponse(request, { error: 'Gerente nao pode redefinir senha de outro gerente ou colaborador com acesso administrativo sensivel.' }, 403);
      }
    }

    const authPassword = resolveOperatorAuthPassword(targetProfile.username ?? '', password || '');
    const { error: resetError } = await serviceClient.auth.admin.updateUserById(operatorUserId, {
      password: authPassword,
    });

    if (resetError) {
      console.error('Erro ao redefinir PIN do colaborador:', resetError.message);
      return jsonResponse(request, { error: 'Não foi possível redefinir o PIN do colaborador.' }, 400);
    }

    return jsonResponse(request, {
      success: true,
      operator: {
        user_id: targetProfile.user_id,
        username: targetProfile.username,
        role: targetProfile.role,
      },
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

    const targetCanOperateCash = await userHasErpPermission(serviceClient, targetProfile.user_id, 'pdv.open_cash');
    if (!targetCanOperateCash) {
      return jsonResponse(request, { error: 'Este colaborador não possui acesso para operar caixa.' }, 403);
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
      return jsonResponse(request, { error: 'Não foi possível abrir o caixa para este operador.' }, 400);
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

    if (!staffRoles.includes(targetProfile.role) || targetProfile.owner_user_id !== ownerUserId) {
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

    await serviceClient
      .from('hr_employees')
      .update({
        status: 'inactive',
        profile_user_id: null,
        updated_by: user.id,
      })
      .eq('owner_user_id', ownerUserId)
      .eq('profile_user_id', operatorUserId);

    const { error: deleteProfileError } = await serviceClient
      .from('profiles')
      .delete()
      .eq('user_id', operatorUserId);

    if (deleteProfileError) {
      return jsonResponse(request, { error: 'Não foi possível remover o perfil do operador.' }, 400);
    }

    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(operatorUserId);
    if (deleteUserError) {
      await serviceClient
        .from('profiles')
        .upsert(targetProfile, { onConflict: 'user_id' });

      return jsonResponse(request, { error: 'Não foi possível excluir o acesso do operador.' }, 400);
    }

    return jsonResponse(request, {
      success: true,
      operator: {
        user_id: targetProfile.user_id,
        username: targetProfile.username,
        role: targetProfile.role,
      },
    });
  }

  if (body.action === 'delete_account') {
    const adminEmail = normalizeEmail(body.adminEmail ?? '');
    const adminPassword = body.adminPassword?.trim() ?? '';

    if (!adminEmail) {
      return jsonResponse(request, { error: 'Informe o email da sua conta.' }, 400);
    }

    if (!adminPassword) {
      return jsonResponse(request, { error: 'Informe a senha da sua conta.' }, 400);
    }

    const verifiedAdminUserId = await verifyAdminPasswordForOwner({
      serviceClient,
      ownerUserId,
      adminEmail,
      adminPassword,
    });

    if (!verifiedAdminUserId) {
      return jsonResponse(request, { error: 'Email ou senha inválidos.' }, 401);
    }

    if (verifiedAdminUserId !== user.id) {
      return jsonResponse(request, { error: 'Você só pode apagar a própria conta logada.' }, 403);
    }

    const { data: verificationProfile, error: verificationProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id')
      .eq('user_id', verifiedAdminUserId)
      .single();

    if (verificationProfileError || !verificationProfile) {
      return jsonResponse(request, { error: 'Cadastro da conta não encontrado.' }, 403);
    }

    if (verificationProfile.role !== 'admin') {
      return jsonResponse(request, { error: 'Somente a conta administradora cadastrada pode apagar a própria conta.' }, 403);
    }

    const verifiedOwnerUserId = verificationProfile.owner_user_id ?? verificationProfile.user_id;
    if (verifiedOwnerUserId !== ownerUserId || ownerUserId !== user.id) {
      return jsonResponse(request, { error: 'Somente o proprietário da loja pode apagar esta conta.' }, 403);
    }

    const { data: operatorProfiles, error: operatorProfilesError } = await serviceClient
      .from('profiles')
      .select('user_id')
      .eq('owner_user_id', ownerUserId)
      .in('role', staffRoles);

    if (operatorProfilesError) {
      return jsonResponse(request, { error: 'Não foi possível preparar a exclusão dos operadores.' }, 500);
    }

    for (const operatorProfile of operatorProfiles ?? []) {
      if (operatorProfile.user_id === user.id) continue;

      const { error: deleteOperatorError } = await serviceClient.auth.admin.deleteUser(operatorProfile.user_id);
      if (deleteOperatorError) {
        return jsonResponse(request, { error: 'Não foi possível excluir os operadores desta conta.' }, 400);
      }
    }

    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      return jsonResponse(request, { error: 'Não foi possível apagar sua conta.' }, 400);
    }

    return jsonResponse(request, {
      success: true,
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

    const verifiedAdminUserId = await verifyAdminPasswordForOwner({
      serviceClient,
      ownerUserId,
      adminEmail,
      adminPassword,
    });

    if (!verifiedAdminUserId) {
      return jsonResponse(request, { error: 'Login ou senha de administrador inválidos.' }, 401);
    }

    const { data: verificationProfile, error: verificationProfileError } = await serviceClient
      .from('profiles')
      .select('user_id, role, owner_user_id')
      .eq('user_id', verifiedAdminUserId)
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
      if ('errorResponse' in financialResult && financialResult.errorResponse) {
        return financialResult.errorResponse;
      }
    }

    if (shouldDeleteReports) {
      reportResult = await deleteReportData();
      if ('errorResponse' in reportResult && reportResult.errorResponse) {
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
