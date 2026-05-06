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
import happyCashLogo from '@/assets/happycash-logo.webp';
import {
  applySystemSessionPreference,
  getSystemLoginPreferences,
  saveSystemLoginPreferences,
} from '@/lib/authSessionPreferences';
import { clearDesktopActivation, readDesktopActivation } from '@/lib/desktopActivation';
import { readOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import { LanguageSwitcher } from '../../shared/locale/LanguageSwitcher';

type LoginMode = 'admin' | 'operator';
type AdminAccessMode = 'online' | 'offline';

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
  const [resettingPassword, setResettingPassword] = useState(false);
  const { login, loginOfflineAdmin, loginOperator, resetPassword } = useAuth();

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

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
          <div className="mb-2 text-center sm:mb-3">
            <motion.img
              src={happyCashLogo}
              alt="HappyCash"
              className="mx-auto h-auto w-[clamp(6.25rem,28vw,10rem)] max-w-full object-contain"
              width={768}
              height={512}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-yellow-200/80 sm:mt-2 sm:text-[10px] sm:tracking-[0.24em]">
              Sistema PDV • Vendas • Controle • Gestão
            </p>
          </div>

          <Card className="border-yellow-400/15 bg-black/45 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <CardHeader className="px-4 pb-1 pt-3 text-center sm:px-5 sm:pt-4">
              <CardTitle className="text-lg font-bold tracking-wide text-yellow-300 sm:text-xl">Entrar</CardTitle>
              <p className="text-[11px] text-muted-foreground sm:text-xs">
                Administrador entra com email. Operador entra com usuário e senha ou PIN.
              </p>
              {desktopActivation && (
                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">{desktopActivation.companyName}</p>
                  <p className="mt-1">
                    {offlineAdminAvailable
                      ? 'Empresa reconhecida nesta maquina. Entre com o usuario e senha ou PIN desta loja.'
                      : 'Empresa reconhecida nesta maquina. No primeiro acesso, entre como administrador com email e senha para cadastrar o usuario admin offline desta maquina.'}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-primary transition-colors hover:text-primary/80"
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
            <CardContent className="px-4 pb-3 sm:px-5 sm:pb-4">
              <Tabs value={loginMode} onValueChange={value => setLoginMode(value as LoginMode)} className="w-full">
                <TabsList className="mb-2.5 grid h-9 w-full grid-cols-2 bg-zinc-900/70 p-1">
                  <TabsTrigger value="admin">Administrador</TabsTrigger>
                  <TabsTrigger value="operator" disabled={Boolean(desktopActivation && !offlineAdminAvailable)}>
                    Operador
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="admin">
                  <form onSubmit={handleAdminSubmit} className="space-y-2.5 sm:space-y-3">
                    {offlineAdminAvailable && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={adminAccessMode === 'online' ? 'default' : 'outline'}
                            className="h-9"
                            onClick={() => setAdminAccessMode('online')}
                          >
                            Email e senha
                          </Button>
                          <Button
                            type="button"
                            variant={adminAccessMode === 'offline' ? 'default' : 'outline'}
                            className="h-9"
                            onClick={() => setAdminAccessMode('offline')}
                          >
                            Usuario e PIN
                          </Button>
                        </div>
                        <p className="mt-2 px-1 text-xs text-muted-foreground">
                          {adminAccessMode === 'offline'
                            ? 'Use o usuario admin local e o PIN desta maquina para entrar sem internet.'
                            : 'Use o email e a senha da conta administradora para validar o acesso online.'}
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
                        <div className="space-y-2">
                          <Label>Usuario admin</Label>
                          <Input
                            value={adminOfflineUsername}
                            onChange={e => setAdminOfflineUsername(e.target.value)}
                            required
                            placeholder="Ex: admin.loja"
                            autoCapitalize="none"
                            autoCorrect="off"
                            className="h-10 sm:h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>PIN offline</Label>
                          <div className="relative">
                            <Input
                              type={showAdminPassword ? 'text' : 'password'}
                              value={adminOfflinePin}
                              onChange={e => setAdminOfflinePin(e.target.value)}
                              required
                              placeholder="••••"
                              autoComplete="current-password"
                              inputMode="numeric"
                              className="h-10 pr-10 sm:h-11"
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
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            placeholder="usuario@happycash.com"
                            className="h-10 sm:h-11"
                          />
                        </div>
                        <div className="space-y-2">
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
                              type={showAdminPassword ? 'text' : 'password'}
                              value={adminPassword}
                              onChange={e => setAdminPassword(e.target.value)}
                              required
                              placeholder="••••••••"
                              minLength={6}
                              autoComplete="current-password"
                              className="h-10 pr-10 sm:h-11"
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
                          Lembrar conta
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
                      className="h-10 w-full px-4 text-center text-sm font-semibold text-black hover:bg-yellow-300 sm:h-11 bg-yellow-400"
                      disabled={submitting || (adminAccessMode === 'offline' && !offlineAdminAvailable)}
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

                <TabsContent value="operator">
                  <form onSubmit={handleOperatorSubmit} className="space-y-2.5 sm:space-y-3">
                    <div className="space-y-2">
                      <Label>Usuário</Label>
                      <Input
                        value={operatorUsername}
                        onChange={e => setOperatorUsername(e.target.value)}
                        required
                        placeholder="Ex: operador.caixa"
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="h-10 sm:h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Senha ou PIN</Label>
                      <div className="relative">
                        <Input
                          type={showOperatorPassword ? 'text' : 'password'}
                          value={operatorPassword}
                          onChange={e => setOperatorPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                          minLength={6}
                          autoComplete="current-password"
                          className="h-10 pr-10 sm:h-11"
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
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          id="remember-operator-account"
                          checked={rememberAccount}
                          onCheckedChange={checked => setRememberAccount(checked === true)}
                          className="mt-0.5 border-yellow-400/60 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black"
                        />
                        <Label htmlFor="remember-operator-account" className="cursor-pointer text-xs leading-none text-foreground sm:text-sm">
                          Lembrar conta
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
                      className="h-10 w-full px-4 text-center text-sm font-semibold text-black hover:bg-yellow-300 sm:h-11 bg-yellow-400"
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
