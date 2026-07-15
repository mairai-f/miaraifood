import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders, handleCorsPreflight } from '../_shared/cors.ts';
import { checkRedisRateLimit, readRateLimitEnv } from '../_shared/rateLimit.ts';

type ReminderRequest = {
  limit?: number;
};

type ReminderRow = {
  reminder_id: string;
  reminder_type: '24h' | '2h' | '30m';
  due_at: string;
  appointment_id: string;
  store_account_id: string;
  owner_user_id: string;
  business_name: string;
  client_name: string;
  client_phone: string;
  professional_name: string;
  service_names: string[];
  appointment_date: string;
  appointment_time: string;
  admin_whatsapp: string | null;
  public_whatsapp: string | null;
};

type CallerProfile = {
  role: string | null;
  owner_user_id: string | null;
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

const extractAccessToken = (authorization: string | null) => {
  if (!authorization) return null;
  const matchedToken = authorization.match(/^Bearer\s+(.+)$/i);
  return matchedToken?.[1]?.trim() || null;
};

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
};

const formatReminderLabel = (type: ReminderRow['reminder_type']) => {
  switch (type) {
    case '24h':
      return 'em 24 horas';
    case '2h':
      return 'em 2 horas';
    default:
      return 'em 30 minutos';
  }
};

const buildReminderMessage = (reminder: ReminderRow) => {
  const dateLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${reminder.appointment_date}T12:00:00`));
  const timeLabel = reminder.appointment_time.slice(0, 5);
  const services = reminder.service_names.join(', ');

  return [
    `Ola, ${reminder.client_name}!`,
    '',
    `Lembrete da *${reminder.business_name}*: seu atendimento acontece ${formatReminderLabel(reminder.reminder_type)}.`,
    `Profissional: ${reminder.professional_name}`,
    `Servicos: ${services}`,
    `Data: ${dateLabel}`,
    `Horario: ${timeLabel}`,
    '',
    'Se precisar remarcar, fale com a equipe com antecedencia.',
  ].join('\n');
};

const sendWhatsAppMessage = async (to: string, message: string) => {
  const apiUrl = Deno.env.get('WHATSAPP_API_URL');
  const apiKey = Deno.env.get('WHATSAPP_API_KEY');
  const authHeader = Deno.env.get('WHATSAPP_API_AUTH_HEADER') || 'Authorization';
  const authScheme = Deno.env.get('WHATSAPP_API_AUTH_SCHEME') || 'Bearer';

  if (!apiUrl || !apiKey) {
    throw new Error('WHATSAPP_API_URL e WHATSAPP_API_KEY precisam estar configurados.');
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
  });
  headers.set(authHeader, authScheme ? `${authScheme} ${apiKey}` : apiKey);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to,
      message,
    }),
  });

  const rawBody = await response.text();
  let payload: unknown = rawBody;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = rawBody;
  }

  if (!response.ok) {
    throw new Error(typeof payload === 'string' ? payload : `Falha ao enviar mensagem (${response.status}).`);
  }

  return payload;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return handleCorsPreflight(request, {
      allowedMethods: ['POST', 'OPTIONS'],
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Metodo nao suportado.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('AGENDA_REMINDER_CRON_SECRET');
  const accessToken = extractAccessToken(request.headers.get('Authorization'));
  const requestCronSecret = request.headers.get('x-cron-secret');
  const isAuthorizedCron = Boolean(cronSecret && requestCronSecret && requestCronSecret === cronSecret);

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(request, { error: 'Configuracao do Supabase invalida.' }, 500);
  }

  if (!isAuthorizedCron) {
    const endpointRateLimit = await checkRedisRateLimit(request, {
      namespace: 'send-agenda-reminders',
      limit: readRateLimitEnv('SEND_AGENDA_REMINDERS_RATE_LIMIT_PER_MINUTE', 20),
      windowSeconds: 60,
    });

    if (!endpointRateLimit.allowed) {
      return jsonResponse(
        request,
        {
          error: 'Muitas tentativas de envio de lembretes em pouco tempo. Aguarde alguns instantes e tente novamente.',
          retryAfterSeconds: endpointRateLimit.retryAfterSeconds,
        },
        429,
      );
    }
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let storeAccountId: string | null = null;
  let allowGlobalProcessing = false;

  if (isAuthorizedCron) {
    allowGlobalProcessing = true;
  } else {
    if (!accessToken) {
      return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
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

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonResponse(request, { error: 'Sessao invalida. Faca login novamente.' }, 401);
    }

    const { data: profileData, error: profileError } = await serviceClient
      .from('profiles')
      .select('role, owner_user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !profileData) {
      return jsonResponse(request, { error: 'Perfil do usuario nao encontrado.' }, 403);
    }

    const profile = profileData as CallerProfile;
    if (profile.role !== 'admin') {
      return jsonResponse(request, { error: 'Somente administradores podem processar lembretes.' }, 403);
    }

    const ownerUserId = profile.owner_user_id ?? user.id;
    const { data: settingsRow, error: settingsError } = await serviceClient
      .from('agenda_business_settings')
      .select('store_account_id')
      .eq('owner_user_id', ownerUserId)
      .maybeSingle();

    if (settingsError || !settingsRow?.store_account_id) {
      return jsonResponse(request, { error: 'Empresa da agenda nao encontrada para este administrador.' }, 404);
    }

    storeAccountId = settingsRow.store_account_id;
  }

  let body: ReminderRequest | null = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const limit = Math.min(Math.max(Number(body?.limit || 25), 1), 100);
  const { data, error } = await serviceClient.rpc('claim_due_agenda_appointment_reminders', {
    p_limit: limit,
    p_store_account_id: allowGlobalProcessing ? null : storeAccountId,
  });

  if (error) {
    return jsonResponse(request, { error: error.message }, 500);
  }

  const reminders = (data as ReminderRow[] | null) ?? [];
  let sentCount = 0;
  let failedCount = 0;

  for (const reminder of reminders) {
    try {
      const destination = normalizePhone(reminder.client_phone || '');
      if (!destination) {
        throw new Error('Telefone do cliente nao encontrado.');
      }

      const providerPayload = await sendWhatsAppMessage(
        destination,
        buildReminderMessage(reminder),
      );

      await serviceClient.rpc('finish_agenda_appointment_reminder', {
        p_reminder_id: reminder.reminder_id,
        p_status: 'sent',
        p_last_error: null,
        p_provider_payload: providerPayload ?? {},
      });
      sentCount += 1;
    } catch (reminderError) {
      const message = reminderError instanceof Error ? reminderError.message : 'Falha desconhecida ao enviar lembrete.';
      await serviceClient.rpc('finish_agenda_appointment_reminder', {
        p_reminder_id: reminder.reminder_id,
        p_status: 'failed',
        p_last_error: message,
        p_provider_payload: {},
      });
      failedCount += 1;
    }
  }

  return jsonResponse(request, {
    success: true,
    processedCount: reminders.length,
    sentCount,
    failedCount,
    scope: allowGlobalProcessing ? 'all' : storeAccountId,
  });
});
