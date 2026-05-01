import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  applySiteSessionPreference,
  saveSiteLoginPreferences,
} from '@/lib/authSessionPreferences';
import { isPublicPlanId, publicPlanContent } from '@/lib/subscriptionPlans';
import logo from '@/assets/logo-happycash.png';
import { LanguageSwitcher } from '../../../shared/locale/LanguageSwitcher';

const resolveLoginErrorMessage = (message: string) =>
  /email not confirmed/i.test(message)
    ? 'Confirme seu email primeiro. Depois volte para entrar e liberar sua conta.'
    : message;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(false);
  const [keepConnected, setKeepConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
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
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        const resolvedError = resolveLoginErrorMessage(error.message);
        clearPasswordState();
        setLoginError(resolvedError);
        toast({ title: 'Erro ao entrar', description: resolvedError, variant: 'destructive' });
        return;
      }

      setEmail(normalizedEmail);
      clearPasswordState();
      applySiteSessionPreference(keepConnected);
      toast({ title: 'Bem-vindo de volta!' });
      navigate(selectedPlanId ? `/dashboard?plan=${selectedPlanId}` : '/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (resettingPassword) return;

    if (!resetEmail.trim()) {
      toast({ title: 'Digite seu email', variant: 'destructive' });
      return;
    }

    setResettingPassword(true);

    try {
      const normalizedResetEmail = normalizeEmail(resetEmail);
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedResetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast({
          title: 'Erro ao enviar email',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Email enviado',
        description: 'Enviamos o link para redefinir sua senha.',
      });
      setResetOpen(false);
      setResetEmail(normalizedResetEmail);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="relative h-[100svh] overflow-hidden bg-[#050505] px-3 py-2 sm:px-4 sm:py-3">
      <LanguageSwitcher />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <div className="relative mx-auto flex h-full w-full max-w-[23rem] items-center justify-center sm:max-w-sm">
        <div className="w-full">
          <div className="mb-2 text-center sm:mb-3">
            <img
              src={logo}
              alt="HappyCash"
              className="mx-auto h-auto w-[clamp(6.25rem,28vw,10rem)] max-w-full object-contain"
            />
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-yellow-200/80 sm:mt-2 sm:text-[10px] sm:tracking-[0.24em]">
              Sistema PDV • Vendas • Controle • Gestao
            </p>
            <p className="mx-auto mt-1 max-w-[18rem] text-[11px] text-muted-foreground sm:text-xs">
              {selectedPlan
                ? `Depois do login, voce pode ativar o ${selectedPlan.name}.`
                : 'Use o mesmo email e senha para entrar no site e no HappyCash.'}
            </p>
          </div>

          <Card className="border-yellow-400/15 bg-black/45 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <CardHeader className="px-4 pb-1 pt-3 text-center sm:px-5 sm:pt-4">
              <CardTitle className="text-lg font-bold tracking-wide text-yellow-300 sm:text-xl">Entrar</CardTitle>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                {selectedPlan
                  ? 'Acesse com seu email e senha para seguir com o plano escolhido.'
                  : 'Acesse com seu email e senha para entrar na sua conta.'}
              </p>
            </CardHeader>
            <CardContent className="px-4 pb-3 sm:px-5 sm:pb-4">
              <form onSubmit={handleLogin} className="space-y-2.5 sm:space-y-3">
                {loginError && (
                  <Alert variant="destructive">
                    <AlertTitle>Falha no Supabase Auth</AlertTitle>
                    <AlertDescription>{loginError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@happycash.com"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    required
                    className="h-10 border-border/70 bg-zinc-950/70 sm:h-11"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password">Senha</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(normalizeEmail(email));
                        setResetOpen(true);
                      }}
                      className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-yellow-300"
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value);
                        if (loginError) setLoginError(null);
                      }}
                      required
                      className="h-10 border-border/70 bg-zinc-950/70 pr-10 sm:h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(current => !current)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      id="site-remember-account"
                      checked={rememberAccount}
                      onCheckedChange={checked => setRememberAccount(checked === true)}
                      className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                    />
                    <Label
                      htmlFor="site-remember-account"
                      className="cursor-pointer text-xs leading-none text-foreground sm:text-sm"
                    >
                      Lembrar conta
                    </Label>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      id="site-keep-connected"
                      checked={keepConnected}
                      onCheckedChange={checked => setKeepConnected(checked === true)}
                      className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                    />
                    <Label
                      htmlFor="site-keep-connected"
                      className="cursor-pointer text-xs leading-none text-foreground sm:text-sm"
                    >
                      Manter conectado
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-10 w-full bg-yellow-400 px-4 text-sm font-semibold text-black hover:bg-yellow-300 sm:h-11"
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
              </form>

              <div className="mt-3 space-y-1.5 text-center text-xs sm:mt-4 sm:text-sm">
                <p className="text-muted-foreground">
                  Nao tem conta?{' '}
                  <Link
                    to={selectedPlanId ? `/cadastro?plan=${selectedPlanId}` : '/cadastro'}
                    className="font-medium text-yellow-300 hover:underline"
                  >
                    Criar conta
                  </Link>
                </p>
                <Link to="/paginainicial" className="text-muted-foreground transition-colors hover:text-yellow-300">
                  Voltar ao site
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border-yellow-400/15 bg-zinc-950 text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enviaremos um email com o link para redefinir sua senha.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="usuario@happycash.com"
                className="border-border/70 bg-zinc-950/70"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={handleReset}
              disabled={resettingPassword}
              className="bg-yellow-400 text-black hover:bg-yellow-300"
            >
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
    </div>
  );
};

export default Login;
