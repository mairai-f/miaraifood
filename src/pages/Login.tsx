import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Fingerprint, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import happyCashLogo from '@/assets/happycash-logo.webp';
import {
  applySystemSessionPreference,
  getSystemLoginPreferences,
  saveSystemLoginPreferences,
} from '@/lib/authSessionPreferences';
import { clearDesktopActivation, readDesktopActivation } from '@/lib/desktopActivation';
import { getPasskeySupportErrorMessage } from '@/lib/passkeys';
import { readOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import { LanguageSwitcher } from '../../shared/locale/LanguageSwitcher';
import type { Database } from '@/integrations/supabase/types';
import { getOperatorCredentialError } from '../../shared/security/operatorCredential';
import { requestTurnstileToken } from '../../shared/security/turnstile';

type LoginMode = 'admin' | 'operator';
type AdminAccessMode = 'online' | 'offline';
type OperatorRecoveryStep = 'email' | 'code' | 'reset';

interface RecoveryOperator {
  user_id: string;
  username: string;
  role: 'operator' | 'waiter';
}

interface OperatorRecoveryResponse {
  success?: boolean;
  operators?: RecoveryOperator[];
  operator?: RecoveryOperator;
  error?: string;
}

const operatorRecoveryClient = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'happycash-operator-recovery',
    },
  },
);

export default function Login() {
  const initialPreferences = getSystemLoginPreferences();
  const desktopActivation = readDesktopActivation();
  const offlineAdminAccess = desktopActivation?.ownerUserId
    ? readOfflineAdminAccess(desktopActivation.ownerUserId)
    : null;
  const offlineAdminAvailable = Boolean(desktopActivation && offlineAdminAccess);
  const initialLoginMode = desktopActivation
    ? (offlineAdminAvailable ? 'operator' : 'admin')
    : initialPreferences.loginMode;
  const [loginMode, setLoginMode] = useState<LoginMode>(initialLoginMode);
  const [adminAccessMode, setAdminAccessMode] = useState<AdminAccessMode>(() => (
    offlineAdminAvailable && typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'
  ));
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [email, setEmail] = useState(initialPreferences.adminEmail);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminOfflineUsername, setAdminOfflineUsername] = useState(offlineAdminAccess?.username ?? '');
  const [adminOfflinePin, setAdminOfflinePin] = useState('');
  const [operatorUsername, setOperatorUsername] = useState(initialPreferences.operatorUsername);
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showOperatorPassword, setShowOperatorPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [keepConnected, setKeepConnected] = useState(initialPreferences.keepConnected);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [passkeySubmitting, setPasskeySubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const { login, signInWithGoogle, signInWithPasskey, loginOfflineAdmin, loginOperator, resetPassword } = useAuth();
  const isDesktop = typeof window !== 'undefined' && Boolean(window.electronAPI);
  const passkeySupportError = getPasskeySupportErrorMessage();
  const canUseGoogleLogin = adminAccessMode === 'online' && typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
  const canUsePasskeyLogin = adminAccessMode === 'online' && !passkeySupportError;

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [operatorRecoveryOpen, setOperatorRecoveryOpen] = useState(false);
  const [operatorRecoveryStep, setOperatorRecoveryStep] = useState<OperatorRecoveryStep>('email');
  const [operatorRecoveryEmail, setOperatorRecoveryEmail] = useState('');
  const [operatorRecoveryCode, setOperatorRecoveryCode] = useState('');
  const [operatorRecoveryList, setOperatorRecoveryList] = useState<RecoveryOperator[]>([]);
  const [operatorRecoveryUserId, setOperatorRecoveryUserId] = useState('');
  const [operatorRecoveryPin, setOperatorRecoveryPin] = useState('');
  const [operatorRecoveryBusy, setOperatorRecoveryBusy] = useState(false);

  useEffect(() => {
    const syncNetworkStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener('online', syncNetworkStatus);
    window.addEventListener('offline', syncNetworkStatus);

    return () => {
      window.removeEventListener('online', syncNetworkStatus);
      window.removeEventListener('offline', syncNetworkStatus);
    };
  }, []);

  useEffect(() => {
    if (offlineAdminAccess?.username) {
      setAdminOfflineUsername(offlineAdminAccess.username);
    }
  }, [offlineAdminAccess?.username]);

  useEffect(() => {
    if (offlineAdminAvailable && !isOnline) {
      setAdminAccessMode('offline');
    }
  }, [isOnline, offlineAdminAvailable]);

  const handleAdminSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    saveSystemLoginPreferences({
      loginMode: 'admin',
      rememberAccount,
      keepConnected,
      adminEmail: email,
      operatorUsername,
    });

    setSubmitting(true);

    try {
      const result = adminAccessMode === 'offline'
        ? await loginOfflineAdmin(adminOfflineUsername, adminOfflinePin)
        : await login(email, adminPassword);
      if (result !== true) {
        toast.error(result || (adminAccessMode === 'offline'
          ? 'Usuario admin ou PIN incorretos.'
          : 'Email ou senha incorretos.'));
        return;
      }

      if (adminAccessMode === 'online') {
        applySystemSessionPreference(keepConnected);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOperatorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    saveSystemLoginPreferences({
      loginMode: 'operator',
      rememberAccount,
      keepConnected,
      adminEmail: email,
      operatorUsername,
    });

    setSubmitting(true);

    try {
      const result = await loginOperator(operatorUsername, operatorPassword);
      if (result !== true) {
        toast.error(result || 'Usuário ou senha incorretos.');
        return;
      }

      applySystemSessionPreference(keepConnected);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (resettingPassword) return;

    if (!resetEmail) {
      toast.error('Digite seu email');
      return;
    }

    setResettingPassword(true);

    try {
      const ok = await resetPassword(resetEmail);
      if (ok) {
        toast.success('Email de redefinição enviado!');
        setResetOpen(false);
        setResetEmail('');
      } else {
        toast.error('Erro ao enviar email de redefinição.');
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (oauthSubmitting || !canUseGoogleLogin) return;

    saveSystemLoginPreferences({
      loginMode: 'admin',
      rememberAccount,
      keepConnected,
      adminEmail: email,
      operatorUsername,
    });

    setOauthSubmitting(true);
    const result = await signInWithGoogle();

    if (result !== true) {
      setOauthSubmitting(false);
      toast.error(result || 'Nao foi possivel iniciar o login com Google.');
    }
  };

  const handlePasskeyLogin = async () => {
    if (passkeySubmitting || !canUsePasskeyLogin) return;

    saveSystemLoginPreferences({
      loginMode: 'admin',
      rememberAccount,
      keepConnected,
      adminEmail: email,
      operatorUsername,
    });

    setPasskeySubmitting(true);

    try {
      const result = await signInWithPasskey();
      if (result !== true) {
        toast.error(result || 'Nao foi possivel iniciar o login com biometria.');
        return;
      }

      applySystemSessionPreference(keepConnected);
    } finally {
      setPasskeySubmitting(false);
    }
  };

  const resetOperatorRecovery = () => {
    setOperatorRecoveryStep('email');
    setOperatorRecoveryEmail('');
    setOperatorRecoveryCode('');
    setOperatorRecoveryList([]);
    setOperatorRecoveryUserId('');
    setOperatorRecoveryPin('');
    setOperatorRecoveryBusy(false);
    void operatorRecoveryClient.auth.signOut();
  };

  const handleOperatorRecoveryOpenChange = (open: boolean) => {
    setOperatorRecoveryOpen(open);
    if (!open) resetOperatorRecovery();
  };

  const handleSendOperatorRecoveryCode = async () => {
    const normalizedEmail = operatorRecoveryEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error('Informe o email do administrador.');
      return;
    }

    setOperatorRecoveryBusy(true);
    let captchaToken: string | undefined;
    try {
      captchaToken = await requestTurnstileToken('app-operator-recovery');
    } catch (error) {
      setOperatorRecoveryBusy(false);
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel concluir a verificacao de seguranca.');
      return;
    }

    const { error } = await operatorRecoveryClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false, captchaToken },
    });
    setOperatorRecoveryBusy(false);

    if (error) {
      toast.error('Nao foi possivel enviar o codigo de recuperacao.');
      return;
    }

    setOperatorRecoveryEmail(normalizedEmail);
    setOperatorRecoveryStep('code');
    toast.success('Codigo enviado ao email do administrador.');
  };

  const handleVerifyOperatorRecoveryCode = async () => {
    const code = operatorRecoveryCode.replace(/\D/g, '');
    if (code.length < 6) {
      toast.error('Informe o codigo recebido por email.');
      return;
    }

    setOperatorRecoveryBusy(true);
    const { data: verification, error: verificationError } = await operatorRecoveryClient.auth.verifyOtp({
      email: operatorRecoveryEmail,
      token: code,
      type: 'email',
    });

    if (verificationError || !verification.session?.access_token) {
      setOperatorRecoveryBusy(false);
      toast.error('Codigo invalido ou expirado.');
      return;
    }

    const { data, error } = await operatorRecoveryClient.functions.invoke<OperatorRecoveryResponse>('manage-operators', {
      headers: { Authorization: `Bearer ${verification.session.access_token}` },
      body: { action: 'list' },
    });
    setOperatorRecoveryBusy(false);

    if (error || !data?.success || !data.operators?.length) {
      toast.error(data?.error || 'Nenhum operador foi encontrado para esta loja.');
      return;
    }

    setOperatorRecoveryList(data.operators);
    setOperatorRecoveryUserId(data.operators[0].user_id);
    setOperatorRecoveryStep('reset');
  };

  const handleResetOperatorCredential = async () => {
    const credentialError = getOperatorCredentialError(operatorRecoveryPin.trim());
    if (credentialError) {
      toast.error(credentialError);
      return;
    }

    const { data: sessionData } = await operatorRecoveryClient.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken || !operatorRecoveryUserId) {
      toast.error('A recuperacao expirou. Solicite um novo codigo.');
      return;
    }

    setOperatorRecoveryBusy(true);
    const { data, error } = await operatorRecoveryClient.functions.invoke<OperatorRecoveryResponse>('manage-operators', {
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        action: 'reset_password',
        operatorUserId: operatorRecoveryUserId,
        password: operatorRecoveryPin.trim(),
      },
    });
    setOperatorRecoveryBusy(false);

    if (error || !data?.success || !data.operator) {
      toast.error(data?.error || 'Nao foi possivel redefinir o PIN.');
      return;
    }

    setOperatorUsername(data.operator.username);
    setOperatorPassword('');
    setOperatorRecoveryOpen(false);
    resetOperatorRecovery();
    toast.success(`Acesso de ${data.operator.username} recuperado. Informe o novo PIN para entrar.`);
  };

  return (
    <div className="relative h-[100svh] overflow-hidden bg-[#050505] px-3 py-2 sm:px-4 sm:py-3">
      <LanguageSwitcher />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <div className="relative mx-auto flex h-full w-full max-w-[23rem] items-center justify-center sm:max-w-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, type: 'spring' }}
          className="w-full"
        >
          <div className="mb-2 text-center">
            <motion.img
              src={happyCashLogo}
              alt="HappyCash"
              className="mx-auto h-auto w-[clamp(4.75rem,18vh,7.75rem)] max-w-full object-contain"
              width={768}
              height={512}
              loading="eager"
              fetchpriority="high"
              decoding="async"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-yellow-200/80 sm:text-[9px]">
              Sistema PDV • Vendas • Controle • Gestão
            </p>
          </div>

          <Card className="border-yellow-400/15 bg-black/45 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <CardHeader className="space-y-1 px-4 pb-2 pt-3 text-center sm:px-5">
              <CardTitle className="text-base font-bold tracking-wide text-yellow-300 sm:text-lg">Entrar</CardTitle>
              <p className="text-[10px] text-muted-foreground sm:text-[11px]">
                Administrador entra com email. Operador e garcom entram com usuario e senha ou PIN.
              </p>
              {desktopActivation && (
                <div className="mt-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-left text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                  <p className="font-semibold text-foreground">{desktopActivation.companyName}</p>
                  {!isDesktop && (
                    <p className="mt-1">
                      {offlineAdminAvailable
                        ? 'Empresa reconhecida nesta maquina. Ao entrar online, o desktop baixa os dados da loja e atualiza a copia local para uso offline.'
                        : 'Empresa reconhecida nesta maquina. No primeiro acesso, entre como administrador com email e senha para cadastrar o usuario admin offline desta maquina.'}
                    </p>
                  )}
                  {isDesktop && (
                    <p className="mt-0.5">
                    {offlineAdminAvailable
                        ? 'Entre online para atualizar os dados locais ou offline se a internet caiu.'
                        : 'Entre como administrador online para configurar usuario, PIN e dados offline.'}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-1 text-primary transition-colors hover:text-primary/80"
                    onClick={() => {
                      clearDesktopActivation();
                      window.location.reload();
                    }}
                  >
                    Trocar chave desta máquina
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="max-h-[calc(100svh-12.75rem)] overflow-y-auto px-4 pb-3 sm:px-5">
              <Tabs value={loginMode} onValueChange={value => setLoginMode(value as LoginMode)} className="w-full">
                <TabsList className="mb-2 grid h-8 w-full grid-cols-2 bg-zinc-900/70 p-1">
                  <TabsTrigger value="admin">Administrador</TabsTrigger>
                  <TabsTrigger value="operator" disabled={Boolean(desktopActivation && !offlineAdminAvailable)}>
                    Operacional
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="admin" className="mt-0">
                  <form onSubmit={handleAdminSubmit} className="space-y-2.5 sm:space-y-3" autoComplete="off">
                    {offlineAdminAvailable && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={adminAccessMode === 'online' ? 'default' : 'outline'}
                            className="h-8 text-xs"
                            onClick={() => setAdminAccessMode('online')}
                          >
                            Email e senha
                          </Button>
                          <Button
                            type="button"
                            variant={adminAccessMode === 'offline' ? 'default' : 'outline'}
                            className="h-8 text-xs"
                            onClick={() => setAdminAccessMode('offline')}
                          >
                            Usuario e PIN
                          </Button>
                        </div>
                        <p className="mt-1.5 px-1 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                          {adminAccessMode === 'offline'
                            ? 'Use o usuario admin local e o PIN desta maquina. Se os dados ainda nao foram baixados, o sistema avisara para conectar a internet.'
                            : 'Use o email e a senha da conta administradora. O desktop vai baixar e salvar os dados locais para o offline.'}
                        </p>
                      </div>
                    )}

                    {!isOnline && !offlineAdminAvailable && (
                      <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        Esta maquina ainda nao tem usuario admin offline configurado. Conecte a internet, entre com email e senha e finalize o cadastro local.
                      </div>
                    )}

                    {adminAccessMode === 'offline' ? (
                      <>
                        <div className="space-y-1.5">
                          <Label>Usuario admin</Label>
                          <Input
                            id="happycash-admin-offline-username"
                            name="happycash-admin-offline-username"
                            value={adminOfflineUsername}
                            onChange={e => setAdminOfflineUsername(e.target.value)}
                            required
                            placeholder="Ex: admin.loja"
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            data-lpignore="true"
                            data-1p-ignore="true"
                            className="h-9 sm:h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>PIN offline</Label>
                          <div className="relative">
                            <Input
                              id="happycash-admin-offline-pin"
                              name="happycash-admin-offline-pin"
                              type={showAdminPassword ? 'text' : 'password'}
                              value={adminOfflinePin}
                              onChange={e => setAdminOfflinePin(e.target.value)}
                              required
                              placeholder="••••"
                              autoComplete="off"
                              inputMode="numeric"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              className="h-9 pr-10 sm:h-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(current => !current)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={showAdminPassword ? 'Ocultar PIN' : 'Mostrar PIN'}
                            >
                              {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <Label>Email</Label>
                          <Input
                            id="happycash-admin-email"
                            name="happycash-admin-email"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="usuario@happycash.com"
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore="true"
                            className="h-9 sm:h-10"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-3">
                            <Label>Senha</Label>
                            <button
                              type="button"
                              onClick={() => {
                                setResetEmail(email.trim());
                                setResetOpen(true);
                              }}
                              className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-yellow-300"
                            >
                              Esqueci a senha
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              id="happycash-admin-password"
                              name="happycash-admin-password"
                              type={showAdminPassword ? 'text' : 'password'}
                              value={adminPassword}
                              onChange={e => setAdminPassword(e.target.value)}
                              required
                              placeholder="••••••••"
                              minLength={6}
                              autoComplete="new-password"
                              data-lpignore="true"
                              data-1p-ignore="true"
                              className="h-9 pr-10 sm:h-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(current => !current)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                              aria-label={showAdminPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            >
                              {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id="remember-admin-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <Label htmlFor="remember-admin-account" className="cursor-pointer text-xs leading-none text-foreground sm:text-sm">
                          Lembrar minha conta
                        </Label>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id="keep-admin-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <Label htmlFor="keep-admin-connected" className="cursor-pointer text-xs leading-none text-foreground sm:text-sm">
                          Manter conectado
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="h-9 w-full px-4 text-center text-sm font-semibold text-black hover:bg-yellow-300 sm:h-10 bg-yellow-400"
                      disabled={submitting || oauthSubmitting || passkeySubmitting || (adminAccessMode === 'offline' && !offlineAdminAvailable)}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                    {canUsePasskeyLogin && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 w-full border-yellow-400/30 bg-transparent text-sm font-semibold text-foreground hover:bg-yellow-400/10 sm:h-10"
                          disabled={submitting || oauthSubmitting || passkeySubmitting}
                          onClick={() => void handlePasskeyLogin()}
                        >
                          {passkeySubmitting ? (
                            <>
                              <Loader2 className="mr-2 animate-spin" />
                              Validando biometria...
                            </>
                          ) : (
                            <>
                              <Fingerprint className="mr-2 h-4 w-4" />
                              Entrar com biometria
                            </>
                          )}
                        </Button>
                        <p className="px-1 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                          Use depois de cadastrar a biometria em Configuracoes &gt; Empresa.
                        </p>
                      </>
                    )}
                    {canUseGoogleLogin && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 w-full border-yellow-400/30 bg-transparent text-sm font-semibold text-foreground hover:bg-yellow-400/10 sm:h-10"
                        disabled={submitting || oauthSubmitting || passkeySubmitting}
                        onClick={() => void handleGoogleLogin()}
                      >
                        {oauthSubmitting ? (
                          <>
                            <Loader2 className="mr-2 animate-spin" />
                            Redirecionando...
                          </>
                        ) : (
                          'Continuar com Google'
                        )}
                      </Button>
                    )}
                  </form>
                </TabsContent>

                <TabsContent value="operator" className="mt-0">
                  <form onSubmit={handleOperatorSubmit} className="space-y-2.5 sm:space-y-3" autoComplete="off">
                    <div className="space-y-1.5">
                      <Label>Usuário</Label>
                      <Input
                        id="happycash-operator-username"
                        name="happycash-operator-username"
                        value={operatorUsername}
                        onChange={e => setOperatorUsername(e.target.value)}
                        required
                        placeholder="Ex: operador.caixa"
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        data-lpignore="true"
                        data-1p-ignore="true"
                        className="h-9 sm:h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Senha ou PIN</Label>
                        <button
                          type="button"
                          onClick={() => setOperatorRecoveryOpen(true)}
                          className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-yellow-300"
                        >
                          Esqueci usuario ou PIN
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="happycash-operator-password"
                          name="happycash-operator-password"
                          type={showOperatorPassword ? 'text' : 'password'}
                          value={operatorPassword}
                          onChange={e => setOperatorPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          autoComplete="new-password"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          className="h-9 pr-10 sm:h-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOperatorPassword(current => !current)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showOperatorPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showOperatorPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                        No primeiro login online, essa credencial fica vinculada ao administrador desta loja e a copia local dos dados e atualizada para operar offline.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id="remember-operator-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <Label htmlFor="remember-operator-account" className="cursor-pointer text-xs leading-none text-foreground sm:text-sm">
                          Lembrar minha conta
                        </Label>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id="keep-operator-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <Label htmlFor="keep-operator-connected" className="cursor-pointer text-xs leading-none text-foreground sm:text-sm">
                          Manter conectado
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="h-9 w-full px-4 text-center text-sm font-semibold text-black hover:bg-yellow-300 sm:h-10 bg-yellow-400"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enviaremos um email com link para redefinir sua senha.
            </p>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                id="happycash-reset-email"
                name="happycash-reset-email"
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="usuario@happycash.com"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleReset} disabled={resettingPassword}>
              {resettingPassword ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={operatorRecoveryOpen} onOpenChange={handleOperatorRecoveryOpenChange}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar acesso operacional</DialogTitle>
          </DialogHeader>

          {operatorRecoveryStep === 'email' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Um codigo sera enviado ao email do administrador da loja.
              </p>
              <div className="space-y-2">
                <Label>Email do administrador</Label>
                <Input
                  type="email"
                  value={operatorRecoveryEmail}
                  onChange={event => setOperatorRecoveryEmail(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                />
              </div>
              <Button className="w-full" onClick={() => void handleSendOperatorRecoveryCode()} disabled={operatorRecoveryBusy}>
                {operatorRecoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enviar codigo
              </Button>
            </div>
          )}

          {operatorRecoveryStep === 'code' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Informe o codigo enviado para {operatorRecoveryEmail}.</p>
              <div className="space-y-2">
                <Label>Codigo</Label>
                <Input
                  inputMode="numeric"
                  value={operatorRecoveryCode}
                  onChange={event => setOperatorRecoveryCode(event.target.value.replace(/\D/g, '').slice(0, 8))}
                  autoComplete="one-time-code"
                />
              </div>
              <Button className="w-full" onClick={() => void handleVerifyOperatorRecoveryCode()} disabled={operatorRecoveryBusy}>
                {operatorRecoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Validar codigo
              </Button>
            </div>
          )}

          {operatorRecoveryStep === 'reset' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Usuario</Label>
                <Select value={operatorRecoveryUserId} onValueChange={setOperatorRecoveryUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o usuario" /></SelectTrigger>
                  <SelectContent>
                    {operatorRecoveryList.map(operator => (
                      <SelectItem key={operator.user_id} value={operator.user_id}>{operator.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Novo PIN ou senha</Label>
                <Input
                  type="password"
                  value={operatorRecoveryPin}
                  onChange={event => setOperatorRecoveryPin(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <Button className="w-full" onClick={() => void handleResetOperatorCredential()} disabled={operatorRecoveryBusy}>
                {operatorRecoveryBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar novo acesso
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
