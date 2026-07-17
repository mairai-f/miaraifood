import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { supabase } from '@/integrations/supabase/client';
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
import happyCashLogo from '../../../src/assets/login/happycash.svg';
import loginPdvRapido from '../../../src/assets/login/pdvrapido.svg';
import loginRelatorios from '../../../src/assets/login/relatorios.svg';
import loginErp from '../../../src/assets/login/erp.svg';
import loginEstoque from '../../../src/assets/login/estoque.svg';
import { getPublicAuthErrorMessage } from '../../../shared/security/redaction';
import { getPasswordPolicyError, passwordPolicyHint } from '../../../shared/security/passwordPolicy';
import { requestTurnstileToken } from '../../../shared/security/turnstile';

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
  session?: {
    access_token?: string;
    refresh_token?: string;
  };
  error?: string;
}

const Login = () => {
  const [initialPreferences] = useState(getSiteLoginPreferences);
  const [email, setEmail] = useState(initialPreferences.email);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [keepConnected, setKeepConnected] = useState(initialPreferences.keepConnected);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const clearPasswordState = () => {
    setPassword('');
    setShowPassword(false);
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
          captchaToken,
        },
      }).catch((error) => ({ data: null, error }));

      if (error || !data?.success || !data.session?.access_token || !data.session?.refresh_token) {
        let functionErrorMessage = data?.error || 'Email ou senha incorretos.';

        if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
          try {
            const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
            functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
          } catch {
            functionErrorMessage = 'Email ou senha incorretos.';
          }
        }

        const resolvedError = resolveLoginErrorMessage(functionErrorMessage);
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
      applySiteSessionPreference(keepConnected);
      toast({ title: 'Bem-vindo de volta!' });
      navigate(nextPath || (selectedPlanQuery ? `/dashboard?${selectedPlanQuery}` : '/dashboard'));
    } catch (error) {
      const resolvedError = getPublicAuthErrorMessage(error, 'Nao foi possivel concluir a verificacao de seguranca.');
      setLoginError(resolvedError);
      toast({ title: 'Erro ao entrar', description: resolvedError, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openResetDialog = (emailValue: string) => {
    setResetEmail(normalizeEmail(emailValue));
    setResetStep('email');
    setResetCode('');
    setResetPassword('');
    setResetConfirmPassword('');
    setShowResetPassword(false);
    setShowResetConfirmPassword(false);
    setResetOpen(true);
  };

  useEffect(() => {
    if (searchParams.get('recovery') === '1') {
      openResetDialog(email);
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

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedResetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
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
      const { error: verifyError } = await supabase.auth.verifyOtp({
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

  const handleGoogleLogin = async () => {
    if (loading || oauthLoading) return;

    const normalizedEmail = normalizeEmail(email);
    saveSiteLoginPreferences({
      rememberAccount,
      keepConnected,
      email: normalizedEmail,
    });

    setOauthLoading(true);
    setLoginError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback${googleRedirectSearch}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        const resolvedError = resolveLoginErrorMessage(error);
        setLoginError(resolvedError);
        toast({ title: 'Erro ao entrar com Google', description: resolvedError, variant: 'destructive' });
        setOauthLoading(false);
      }
    } catch (error) {
      const resolvedError = resolveLoginErrorMessage(error instanceof Error ? error : 'Nao foi possivel iniciar o login com Google.');
      setLoginError(resolvedError);
      toast({ title: 'Erro ao entrar com Google', description: resolvedError, variant: 'destructive' });
      setOauthLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#eef3fb]">
      <div className="grid h-full lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)]">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(180deg,#5e79ff_0%,#5571f4_48%,#4d69e8_100%)] px-8 py-8 text-white lg:flex lg:items-start lg:justify-center xl:px-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(23,37,84,0.16),_transparent_40%)]" />
          <div className="relative flex w-full max-w-[32rem] flex-col items-center pt-6 text-center xl:pt-8">
            <motion.img
              src={happyCashLogo}
              alt="HappyCash"
              className="h-auto w-full max-w-[22rem] object-contain xl:max-w-[25rem]"
              loading="eager"
              decoding="async"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <p className="mt-3 max-w-[18rem] text-sm font-semibold tracking-[-0.02em] text-white/90 xl:text-[15px]">
              Tecnologia simples para sua empresa.
            </p>
            <div className="mt-10 grid w-full max-w-[29rem] grid-cols-2 gap-x-10 gap-y-8">
              {loginFeatureCards.map((feature) => (
                <div key={feature.label} className="flex flex-col items-center gap-1 text-center">
                  <div className="flex h-[7.5rem] w-[10rem] items-center justify-center overflow-visible">
                    <img
                      src={feature.image}
                      alt={feature.label}
                      className={`h-auto max-w-none object-contain drop-shadow-[0_18px_30px_rgba(21,41,113,0.22)] ${feature.imageClassName}`}
                      loading="eager"
                      decoding="async"
                    />
                  </div>
                  <span className="w-[10rem] -mt-1 text-center text-[1.34rem] font-medium leading-tight tracking-[-0.02em] text-white/96">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <main className="relative flex h-full items-center justify-center overflow-hidden bg-[#f8fbff] px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8 xl:px-16">
          <div className="absolute inset-y-0 left-0 hidden w-px bg-[linear-gradient(180deg,rgba(77,105,232,0.16),rgba(77,105,232,0.05),transparent)] lg:block" />
          <div className="w-full max-w-[28rem] max-[360px]:origin-center max-[360px]:scale-[0.94]">
            <div className="rounded-[28px] border border-[#d7e0ef] bg-white/88 px-4 py-3 shadow-[0_26px_70px_rgba(29,78,216,0.12)] backdrop-blur-xl sm:p-6">
              <div className="space-y-1.5 text-center lg:hidden">
                <motion.img
                  src={happyCashLogo}
                  alt="HappyCash"
                  className="mx-auto h-auto w-full max-w-[15.25rem] object-contain sm:max-w-[16rem]"
                  loading="eager"
                  decoding="async"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <p className="mx-auto max-w-[17rem] text-[14px] font-semibold leading-snug tracking-[-0.02em] text-[#1f56a5] sm:max-w-[17rem] sm:text-[15px]">
                  Tecnologia simples para sua empresa.
                </p>
              </div>

              <div className="mt-2.5 sm:mt-3">
                <h1 className="text-[1.68rem] font-bold leading-none tracking-[-0.04em] text-[#1f56a5] sm:text-[2.2rem]">
                  Bem-vindo de volta
                </h1>
                <p className="mt-1 text-[14px] text-[#64748b] sm:mt-1.5 sm:text-base">
                  Faça login para continuar
                </p>
                {selectedPlan ? (
                  <p className="mt-2 max-w-[24rem] text-[13px] leading-5 text-[#687991] sm:text-sm sm:leading-6">
                    Depois do login, voce pode ativar o {selectedPlan.name}.
                  </p>
                ) : null}
              </div>

              <form onSubmit={handleLogin} className="mt-4 space-y-3 sm:space-y-4">
                {loginError && (
                  <Alert variant="destructive">
                    <AlertTitle>Falha ao entrar</AlertTitle>
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[15px] font-medium text-[#24324a]">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Digite seu e-mail"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    required
                    className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password" className="text-[15px] font-medium text-[#24324a]">Senha</Label>
                    <button
                      type="button"
                      onClick={() => openResetDialog(email)}
                      className="shrink-0 text-sm font-medium text-[#64748b] transition-colors hover:text-[#1f56a5]"
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        if (loginError) setLoginError(null);
                      }}
                      required
                      className="h-10 rounded-2xl border-[#d8e1ef] bg-white px-4 pr-12 text-[15px] text-[#24324a] placeholder:text-[#9aa6b8] focus-visible:ring-[#1f56a5]/25 focus-visible:ring-offset-0 sm:h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(current => !current)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7f8ea5] transition-colors hover:text-[#24324a]"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 pt-0.5 sm:gap-2.5 sm:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Checkbox
                      id="site-remember-account"
                      checked={rememberAccount}
                      onCheckedChange={checked => setRememberAccount(checked === true)}
                      className="h-5 w-5 rounded-md border-[#a7b3c7] data-[state=checked]:border-[#1f56a5] data-[state=checked]:bg-[#1f56a5] data-[state=checked]:text-white"
                    />
                    <Label
                      htmlFor="site-remember-account"
                      className="cursor-pointer text-[13px] leading-none text-[#334155] sm:text-sm"
                    >
                      Lembrar minha conta
                    </Label>
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Checkbox
                      id="site-keep-connected"
                      checked={keepConnected}
                      onCheckedChange={checked => setKeepConnected(checked === true)}
                      className="h-5 w-5 rounded-md border-[#a7b3c7] data-[state=checked]:border-[#1f56a5] data-[state=checked]:bg-[#1f56a5] data-[state=checked]:text-white"
                    />
                    <Label
                      htmlFor="site-keep-connected"
                      className="cursor-pointer text-[13px] leading-none text-[#334155] sm:text-sm"
                    >
                      Manter conectado
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || oauthLoading}
                  className="h-10 w-full rounded-2xl bg-[#1f56a5] px-4 text-base font-semibold text-white hover:bg-[#194788] sm:h-11"
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

                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || oauthLoading}
                  onClick={() => void handleGoogleLogin()}
                  className="h-10 w-full rounded-2xl border-[#d6deec] bg-white text-sm font-semibold text-[#1f56a5] hover:bg-[#edf4ff] sm:h-11"
                >
                  {oauthLoading ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" />
                      Redirecionando...
                    </>
                  ) : (
                    'Continuar com Google'
                  )}
                </Button>
              </form>

              <div className="mt-3 space-y-1.5 text-center text-xs sm:mt-4 sm:text-sm">
                <p className="text-[#64748b]">
                  Nao tem conta?{' '}
                  <Link
                    to={selectedPlanQuery ? `/cadastro?${selectedPlanQuery}` : '/cadastro'}
                    className="font-medium text-[#1f56a5] hover:underline"
                  >
                    Criar conta
                  </Link>
                </p>
                <Link to="/paginainicial" className="text-[#64748b] transition-colors hover:text-[#1f56a5]">
                  Voltar ao site
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={resetOpen} onOpenChange={handleResetDialogOpenChange}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border border-[#d7e0ef] bg-white text-foreground shadow-[0_26px_70px_rgba(29,78,216,0.12)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>

          {resetStep === 'email' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enviaremos um codigo para seu e-mail. Depois voce digita o codigo aqui e cria uma nova senha.
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
                  className="border-[#d8e1ef] bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Digite o codigo de 8 numeros enviado para <strong>{resetEmail}</strong> e escolha sua nova senha.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reset-code">Codigo recebido</Label>
                <Input
                  id="reset-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={resetCode}
                  onChange={e => setResetCode(normalizeRecoveryCode(e.target.value))}
                  placeholder="00000000"
                  className="border-[#d8e1ef] bg-white text-center text-lg font-bold tracking-[0.35em]"
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
                    className="border-[#d8e1ef] bg-white pr-10"
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
                    className="border-[#d8e1ef] bg-white pr-10"
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
              className="bg-[#1f56a5] text-white hover:bg-[#194788]"
            >
              {resettingPassword ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : resetStep === 'email' ? 'Enviar codigo' : 'Salvar nova senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
