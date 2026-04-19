import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import happyCashLogo from '@/assets/happycash-logo.png';
import {
  applySystemSessionPreference,
  getSystemLoginPreferences,
  saveSystemLoginPreferences,
} from '@/lib/authSessionPreferences';

type LoginMode = 'admin' | 'operator';

export default function Login() {
  const initialPreferences = getSystemLoginPreferences();
  const [loginMode, setLoginMode] = useState<LoginMode>(initialPreferences.loginMode);
  const [email, setEmail] = useState(initialPreferences.rememberAccount ? initialPreferences.adminEmail : '');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [operatorUsername, setOperatorUsername] = useState(
    initialPreferences.rememberAccount ? initialPreferences.operatorUsername : '',
  );
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showOperatorPassword, setShowOperatorPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [keepConnected, setKeepConnected] = useState(initialPreferences.keepConnected);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const { login, loginOperator, resetPassword } = useAuth();

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

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
      const result = await login(email, adminPassword);
      if (result !== true) {
        toast.error(result || 'Email ou senha incorretos.');
        return;
      }

      applySystemSessionPreference(keepConnected);
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

  return (
    <div className="relative h-screen overflow-hidden bg-[#050505] px-4 py-4 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <div className="relative mx-auto flex h-full w-full max-w-md items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, type: 'spring' }}
          className="w-full"
        >
          <div className="mb-6 text-center">
            <motion.img
              src={happyCashLogo}
              alt="HappyCash"
              className="mx-auto h-auto w-full max-w-[220px] object-contain sm:max-w-[250px]"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-yellow-200/80 sm:text-xs">
              Sistema PDV • Vendas • Controle • Gestão
            </p>
          </div>

          <Card className="border-yellow-400/15 bg-black/45 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-3xl font-bold tracking-wide text-yellow-300">Entrar</CardTitle>
              <p className="text-sm text-muted-foreground">
                Administrador entra com email. Operador entra com usuário.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs value={loginMode} onValueChange={value => setLoginMode(value as LoginMode)} className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-2 bg-zinc-900/70">
                  <TabsTrigger value="admin">Administrador</TabsTrigger>
                  <TabsTrigger value="operator">Operador</TabsTrigger>
                </TabsList>

                <TabsContent value="admin">
                  <form onSubmit={handleAdminSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="usuario@happycash.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <div className="relative">
                        <Input
                          type={showAdminPassword ? 'text' : 'password'}
                          value={adminPassword}
                          onChange={e => setAdminPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          minLength={6}
                          autoComplete="current-password"
                          className="pr-10"
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
                    <div className="rounded-xl border border-yellow-400/10 bg-zinc-950/70 p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="remember-admin-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="remember-admin-account" className="cursor-pointer text-sm font-medium text-foreground">
                            Lembrar última conta neste dispositivo
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Preenche seu último email ou usuário no web, no executável e no mobile deste aparelho.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-start gap-3">
                        <Checkbox
                          id="keep-admin-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="keep-admin-connected" className="cursor-pointer text-sm font-medium text-foreground">
                            Manter conectado neste dispositivo
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Se desmarcar, a sessão vale só enquanto esta janela ou app estiver aberto.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-yellow-400 py-5 text-lg font-semibold text-black hover:bg-yellow-300"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar como administrador'
                      )}
                    </Button>
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Administradores acessam com email e senha.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email.trim() || (rememberAccount ? initialPreferences.adminEmail : ''));
                          setResetOpen(true);
                        }}
                        className="text-sm text-muted-foreground transition-colors hover:text-yellow-300"
                      >
                        Esqueci a senha
                      </button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="operator">
                  <form onSubmit={handleOperatorSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Usuário</Label>
                      <Input
                        value={operatorUsername}
                        onChange={e => setOperatorUsername(e.target.value)}
                        required
                        placeholder="Ex: operador.caixa"
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha</Label>
                      <div className="relative">
                        <Input
                          type={showOperatorPassword ? 'text' : 'password'}
                          value={operatorPassword}
                          onChange={e => setOperatorPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          minLength={6}
                          autoComplete="current-password"
                          className="pr-10"
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
                    </div>
                    <div className="rounded-xl border border-yellow-400/10 bg-zinc-950/70 p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="remember-operator-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="remember-operator-account" className="cursor-pointer text-sm font-medium text-foreground">
                            Lembrar última conta neste dispositivo
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Guarda o último usuário para agilizar a entrada do operador neste aparelho.
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-start gap-3">
                        <Checkbox
                          id="keep-operator-connected"
                          checked={keepConnected}
                          onCheckedChange={checked => setKeepConnected(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <div className="space-y-1">
                          <Label htmlFor="keep-operator-connected" className="cursor-pointer text-sm font-medium text-foreground">
                            Manter conectado neste dispositivo
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Desmarcado, o acesso sai sozinho quando esta janela ou app for fechado.
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-yellow-400 py-5 text-lg font-semibold text-black hover:bg-yellow-300"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 animate-spin" />
                          Entrando...
                        </>
                      ) : (
                        'Entrar como operador'
                      )}
                    </Button>
                    <p className="pt-2 text-sm text-muted-foreground">
                      Operadores usam apenas usuário e senha definidos pelo administrador.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
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
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                placeholder="usuario@happycash.com"
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
    </div>
  );
}
