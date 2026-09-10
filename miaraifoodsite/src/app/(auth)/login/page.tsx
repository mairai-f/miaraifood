"use client";

import { useEffect, useState, type FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import GhostFibers from '@/components/ui/GhostFibers';

import { supabase } from '@/utils/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  applySiteSessionPreference,
  getSiteLoginPreferences,
  saveSiteLoginPreferences,
} from '@/lib/authSessionPreferences';
import { isPublicPlanId, publicPlanContent } from '@/lib/subscriptionPlans';
const loginPdvRapido = '/login/pdvrapido.webp';
const loginRelatorios = '/login/relatorios.webp';
const loginErp = '/login/erp.webp';
const loginEstoque = '/login/estoque.webp';
import { getPublicAuthErrorMessage } from '@/shared/security/redaction';
import { getPasswordPolicyError, passwordPolicyHint } from '@/shared/security/passwordPolicy';
import { requestTurnstileToken } from '@/shared/security/turnstile';

const resolveLoginErrorMessage = (error: unknown) => {
  const message = getPublicAuthErrorMessage(error, 'Nao foi possivel entrar agora.');
  return /email not confirmed/i.test(message)
    ? 'Confirme seu email primeiro. Depois volte para entrar e liberar sua conta.'
    : message;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeRecoveryCode = (value: string) => value.replace(/\D/g, '').slice(0, 8);
const resolveSafeNextPath = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
};

const loginFeatureCards = [
  { label: 'PDV Rápido', image: loginPdvRapido, imageClassName: 'w-full scale-[1.6]' },
  { label: 'Relatórios', image: loginRelatorios, imageClassName: 'w-full scale-[1.6]' },
  { label: 'ERP', image: loginErp, imageClassName: 'relative left-4 w-full scale-[1.6]' },
  { label: 'Estoque', image: loginEstoque, imageClassName: 'w-full scale-[1.6]' },
];

interface AdminLoginResponse {
  success?: boolean;
  verificationRequired?: boolean;
  code?: string;
  retryAfterSeconds?: number | null;
  remainingAttempts?: number | null;
  maxFailedAttempts?: number | null;
  session?: {
    access_token?: string;
    refresh_token?: string;
  };
  error?: string;
}

const Login = () => {
  // The server cannot read localStorage. Loading these preferences during the
  // first render made the browser markup differ from the server markup when a
  // saved preference existed, causing a React hydration error (#418).
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [loginVerificationRequired, setLoginVerificationRequired] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [keepConnected, setKeepConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'code'>('email');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const clearPasswordState = () => {
    setPassword('');
    setShowPassword(false);
  };

  const resetLoginVerification = () => {
    setAccessCode('');
    setLoginVerificationRequired(false);
  };

  const selectedPlanId = (() => {
    const value = searchParams.get('plan');
    return isPublicPlanId(value) ? value : null;
  })();
  const selectedBillingPeriod = searchParams.get('period') === 'annual' ? 'annual' : 'monthly';
  const selectedPlanQuery = selectedPlanId
    ? `plan=${selectedPlanId}${selectedBillingPeriod === 'annual' ? '&period=annual' : ''}`
    : selectedBillingPeriod === 'annual'
    ? 'period=annual'
    : '';
  const nextPath = resolveSafeNextPath(searchParams.get('next'));
  const googleRedirectSearch = (() => {
    const params = new URLSearchParams();
    if (selectedPlanId) {
      params.set('plan', selectedPlanId);
    }
    if (selectedBillingPeriod === 'annual') {
      params.set('period', 'annual');
    }
    if (nextPath) {
      params.set('next', nextPath);
    }
    const query = params.toString();
    return query ? `?${query}` : '';
  })();

  const selectedPlan = selectedPlanId ? publicPlanContent[selectedPlanId] : null;

  useEffect(() => {
    const preferences = getSiteLoginPreferences();
    setRememberAccount(preferences.rememberAccount);
    setKeepConnected(preferences.keepConnected);
    setEmail((currentEmail) => currentEmail || preferences.email);
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const normalizedEmail = normalizeEmail(email);

    saveSiteLoginPreferences({
      rememberAccount,
      keepConnected,
      email: normalizedEmail,
    });

    setLoading(true);
    setLoginError(null);

    try {
      const captchaToken = await requestTurnstileToken('site-login');
      const { data, error } = await supabase.functions.invoke<AdminLoginResponse>('admin-login', {
        body: {
          email: normalizedEmail,
          password,
          accessCode: loginVerificationRequired ? accessCode : null,
          loginSurface: 'miaraifoodsite',
          captchaToken,
        },
      }).catch((error) => ({ data: null, error }));

      if (error || !data?.success || !data.session?.access_token || !data.session?.refresh_token) {
        let functionErrorMessage = data?.error || 'Email ou senha incorretos.';
        let errorPayload: (AdminLoginResponse & { message?: string }) | null = data ?? null;

        if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
          try {
            errorPayload = await error.context.clone().json() as AdminLoginResponse & { message?: string };
            functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
          } catch {
            functionErrorMessage = 'Email ou senha incorretos.';
          }
        }

        const resolvedError = errorPayload?.remainingAttempts === 1 && !errorPayload?.verificationRequired
          ? 'Voce tem apenas mais uma tentativa de login.'
          : resolveLoginErrorMessage(functionErrorMessage);
        if (errorPayload?.verificationRequired || errorPayload?.code === 'LOGIN_VERIFICATION_REQUIRED') {
          setLoginVerificationRequired(true);
          setAccessCode('');
        }
        clearPasswordState();
        setLoginError(resolvedError);
        toast({ title: 'Erro ao entrar', description: resolvedError, variant: 'destructive' });
        return;
      }

      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (setSessionError) {
        const resolvedError = resolveLoginErrorMessage(setSessionError);
        clearPasswordState();
        setLoginError(resolvedError);
        toast({ title: 'Erro ao entrar', description: resolvedError, variant: 'destructive' });
        return;
      }

      setEmail(normalizedEmail);
      clearPasswordState();
      resetLoginVerification();
      applySiteSessionPreference(keepConnected);
      toast({ title: 'Bem-vindo de volta!' });
      router.push(nextPath || (selectedPlanQuery ? `/dashboard?${selectedPlanQuery}` : '/dashboard'));
    } catch (error) {
      const resolvedError = getPublicAuthErrorMessage(error, 'Nao foi possivel concluir a verificacao de seguranca.');
      setLoginError(resolvedError);
      toast({ title: 'Erro ao entrar', description: resolvedError, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openResetDialog = (emailValue: string, options?: { step?: 'email' | 'code' }) => {
    const normalizedEmail = normalizeEmail(emailValue);
    setResetEmail(normalizedEmail);
    setResetStep(options?.step === 'code' && normalizedEmail ? 'code' : 'email');
    setResetCode('');
    setResetPassword('');
    setResetConfirmPassword('');
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
    setResetOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('recovery') === '1') {
      const recoveryEmail = searchParams.get('email')?.replace(/\s/g, '+') ?? '';
      const recoveryStep = searchParams.get('step') === 'email' ? 'email' : 'code';
      openResetDialog(recoveryEmail || email, { step: recoveryStep });
    }
    // Abre apenas na primeira renderizacao quando a URL pede recuperacao.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetDialogOpenChange = (open: boolean) => {
    if (resettingPassword) return;

    setResetOpen(open);
    if (!open) {
      setResetStep('email');
      setResetCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      setShowResetPassword(false);
      setShowResetConfirmPassword(false);
    }
  };

  const handleSendResetCode = async () => {
    if (resettingPassword) return;

    if (!resetEmail.trim()) {
      toast({ title: 'Digite seu email', variant: 'destructive' });
      return;
    }

    setResettingPassword(true);

    try {
      const normalizedResetEmail = normalizeEmail(resetEmail);
      const captchaToken = await requestTurnstileToken('site-password-reset', { visible: true });

      if (!captchaToken) {
        toast({
          title: 'Verificacao de seguranca indisponivel',
          description: 'Recarregue a pagina e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      const recoveryRedirectUrl = new URL('/login', window.location.origin);
      recoveryRedirectUrl.searchParams.set('recovery', '1');
      recoveryRedirectUrl.searchParams.set('email', normalizedResetEmail);

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedResetEmail, {
        redirectTo: recoveryRedirectUrl.toString(),
        captchaToken,
      });

      if (error) {
        const resolvedError = getPublicAuthErrorMessage(error, 'Nao foi possivel enviar o email agora.');
        toast({
          title: 'Erro ao enviar email',
          description: resolvedError,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Codigo enviado',
        description: 'Digite o codigo recebido por e-mail para criar a nova senha.',
      });
      setResetEmail(normalizedResetEmail);
      setResetCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      setResetStep('code');
    } catch (error) {
      const resolvedError = getPublicAuthErrorMessage(error, 'Nao foi possivel concluir a verificacao de seguranca.');
      toast({ title: 'Erro ao enviar email', description: resolvedError, variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleConfirmResetCode = async () => {
    if (resettingPassword) return;

    const normalizedResetEmail = normalizeEmail(resetEmail);
    const code = normalizeRecoveryCode(resetCode);

    if (!normalizedResetEmail) {
      toast({ title: 'Digite seu email', variant: 'destructive' });
      setResetStep('email');
      return;
    }

    if (code.length !== 8) {
      toast({
        title: 'Codigo invalido',
        description: 'Digite os 8 numeros enviados por e-mail.',
        variant: 'destructive',
      });
      return;
    }

    const passwordError = getPasswordPolicyError(resetPassword);
    if (passwordError) {
      toast({
        title: 'Senha invalida',
        description: passwordError,
        variant: 'destructive',
      });
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      toast({
        title: 'As senhas nao conferem',
        description: 'Revise os dois campos e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    setResettingPassword(true);

    try {
      const { data: verificationData, error: verifyError } = await supabase.auth.verifyOtp({
        email: normalizedResetEmail,
        token: code,
        type: 'recovery',
      });

      if (verifyError) {
        toast({
          title: 'Codigo invalido ou expirado',
          description: getPublicAuthErrorMessage(verifyError, 'Solicite um novo codigo e tente novamente.'),
          variant: 'destructive',
        });
        return;
      }

      const recoverySession = verificationData.session;
      if (!recoverySession?.access_token || !recoverySession.refresh_token) {
        toast({
          title: 'Sessao de recuperacao indisponivel',
          description: 'O codigo foi aceito, mas a sessao nao foi criada. Solicite um novo codigo.',
          variant: 'destructive',
        });
        return;
      }

      const { error: recoverySessionError } = await supabase.auth.setSession({
        access_token: recoverySession.access_token,
        refresh_token: recoverySession.refresh_token,
      });

      if (recoverySessionError) {
        toast({
          title: 'Sessao de recuperacao indisponivel',
          description: 'Nao foi possivel preparar a alteracao segura da senha. Solicite um novo codigo.',
          variant: 'destructive',
        });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: resetPassword });

      if (updateError) {
        toast({
          title: 'Nao foi possivel alterar a senha',
          description: getPublicAuthErrorMessage(updateError, 'Tente novamente em instantes.'),
          variant: 'destructive',
        });
        return;
      }

      await supabase.auth.signOut({ scope: 'local' });
      setPassword('');
      setResetOpen(false);
      setResetStep('email');
      setResetCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      setShowResetPassword(false);
      setShowResetConfirmPassword(false);
      setEmail(normalizedResetEmail);

      toast({
        title: 'Senha atualizada',
        description: 'Agora voce ja pode entrar com a nova senha.',
      });
    } catch (error) {
      const resolvedError = getPublicAuthErrorMessage(error, 'Nao foi possivel redefinir sua senha agora.');
      toast({ title: 'Erro ao redefinir senha', description: resolvedError, variant: 'destructive' });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
      {/* Background Shader */}
      <div className="absolute inset-0 z-0 bg-black opacity-80">
        <GhostFibers
          lineColor="#06100A"
          glowColor="#70E000"
          speed={0.2}
          scale={2}
          rotation={0}
          rotationSpeed={0.25}
          layers={4}
          waveAmplitude={0.015}
          waveFrequency={3}
          waveSpeed={0.15}
          layerSpeed={0.08}
          twist={0.1}
          twistFrequency={5}
          twistSpeed={1.2}
          lineFrequency={5}
          lineSpacing={2}
          lineSharpness={16}
          glowFalloff={10}
          glowIntensity={1.6}
          brightness={2}
          blueBoost={1.25}
          vignette={0.8}
          grain={0.05}
          dpr={1}
        />
      </div>

      <div className="w-full max-w-[32rem] relative z-10 max-[360px]:origin-center max-[360px]:scale-[0.94] px-0 sm:px-4">
        <div className="rounded-none sm:rounded-3xl border-y border-x-0 sm:border-x border-white/20 bg-white/10 backdrop-blur-xl px-4 py-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] sm:px-10 sm:py-8 w-full">
          <div className="space-y-1 text-center mb-6">
            <div className="flex flex-col items-center justify-center">
              <motion.img
                src="/miar-collapsed-icon-white.svg"
                alt="MIAR AI/FOOD"
                className="h-16 w-auto object-contain sm:h-20"
                loading="eager"
                decoding="async"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-3">
                MIAR AI / FOOD
              </h1>
            </div>
            

            {selectedPlan ? (
              <p className="mt-2 mx-auto max-w-[24rem] text-[13px] leading-5 text-white/60 sm:text-sm sm:leading-6">
                Depois do login, você pode ativar o {selectedPlan.name}.
              </p>
            ) : null}
          </div>

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            {loginError && (
              <Alert variant="destructive" className="bg-red-500/20 text-red-100 border-none backdrop-blur-md">
                <AlertTitle>Falha ao entrar</AlertTitle>
                <AlertDescription>{loginError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[14px] font-medium text-white/90">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (loginError) setLoginError(null);
                  resetLoginVerification();
                }}
                required
                className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password" className="text-[14px] font-medium text-white/90">Senha</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/10 px-4 pr-12 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(current => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 transition-colors hover:text-white"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex justify-start mt-1.5">
                <button
                  type="button"
                  onClick={() => openResetDialog(email)}
                  className="text-xs font-medium text-white/60 transition-colors hover:text-white"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </div>

            {loginVerificationRequired && (
              <div className="space-y-2">
                <Label htmlFor="login-access-code" className="text-[14px] font-medium text-white/90">Chave de acesso</Label>
                <Input
                  id="login-access-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="00000000"
                  value={accessCode}
                  onChange={e => {
                    setAccessCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                    if (loginError) setLoginError(null);
                  }}
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-center text-[15px] font-bold tracking-[0.35em] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md"
                />
                <p className="text-xs leading-5 text-white/60">
                  Enviamos uma chave para reconhecer esta tentativa de entrada.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full mt-4 rounded-xl bg-[#09223e] border border-white/5 px-4 text-base font-semibold text-white hover:bg-[#09223e]/80 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] transition-all sm:h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>

            <div className="grid gap-2 pt-0.5 sm:gap-2.5 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <Checkbox
                  id="site-remember-account"
                  checked={rememberAccount}
                  onCheckedChange={checked => setRememberAccount(checked === true)}
                  className="h-5 w-5 rounded-md border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                <Label
                  htmlFor="site-remember-account"
                  className="cursor-pointer text-[13px] leading-none text-white/60 sm:text-sm transition-colors hover:text-white"
                >
                  Lembrar minha conta
                </Label>
              </div>
              <div className="flex min-w-0 items-center gap-2.5">
                <Checkbox
                  id="site-keep-connected"
                  checked={keepConnected}
                  onCheckedChange={checked => setKeepConnected(checked === true)}
                  className="h-5 w-5 rounded-md border-white/20 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                <Label
                  htmlFor="site-keep-connected"
                  className="cursor-pointer text-[13px] leading-none text-white/60 sm:text-sm transition-colors hover:text-white"
                >
                  Manter conectado
                </Label>
              </div>
            </div>

          </form>

          <div className="mt-6 space-y-1.5 text-center text-[13px] sm:text-sm">
            <p className="text-white/60">
              Ainda não tem conta?{' '}
              <Link
                href={selectedPlanQuery ? `/cadastro?${selectedPlanQuery}` : '/cadastro'}
                className="font-bold text-white hover:underline decoration-white/50 underline-offset-4"
              >
                Crie grátis
              </Link>
            </p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link href="/" className="text-xs text-white/40 transition-colors hover:text-white/80">
                &larr; Voltar ao site
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={handleResetDialogOpenChange}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border border-border glass text-foreground shadow-[0_26px_70px_rgba(0,0,0,0.12)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>

          {resetStep === 'email' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enviaremos um código para seu e-mail. Depois você digita o código aqui e cria uma nova senha.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder="Digite seu e-mail"
                  className="border-border bg-background/50"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Digite o código de 8 números enviado para <strong>{resetEmail}</strong> e escolha sua nova senha.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reset-code">Código recebido</Label>
                <Input
                  id="reset-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={resetCode}
                  onChange={e => setResetCode(normalizeRecoveryCode(e.target.value))}
                  placeholder="00000000"
                  className="border-border bg-background/50 text-center text-lg font-bold tracking-[0.35em]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-new-password">Nova senha</Label>
                <div className="relative">
                  <Input
                    id="reset-new-password"
                    type={showResetPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    placeholder="Use uma senha forte"
                    className="border-border bg-background/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(current => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showResetPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{passwordPolicyHint}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    id="reset-confirm-password"
                    type={showResetConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={resetConfirmPassword}
                    onChange={e => setResetConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="border-border bg-background/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmPassword(current => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showResetConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {resetStep === 'code' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetStep('email')}
                disabled={resettingPassword}
              >
                Voltar
              </Button>
            )}
            <Button
              type="button"
              onClick={resetStep === 'email' ? handleSendResetCode : handleConfirmResetCode}
              disabled={resettingPassword}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {resettingPassword ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : resetStep === 'email' ? 'Enviar código' : 'Salvar nova senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#eef3fb]"><Loader2 className="h-8 w-8 animate-spin text-[#1f56a5]" /></div>}>
      <Login />
    </Suspense>
  )
}
