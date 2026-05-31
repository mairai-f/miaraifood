import { useState, useEffect, useMemo, type FocusEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import {
  User,
  Mail,
  Lock,
  Phone,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { slugFromPathname } from "@/lib/agendaSlug";
import { readAgendaBookingDraft } from "@/lib/agendaBookingDraft";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe seu nome completo"),
    email: z.string().email("Email inválido"),
    phone: z.string().trim().regex(/^\d{10,15}$/, "Telefone deve ter entre 10 e 15 dígitos"),
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirme a senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const emailSchema = z.string().email("Email inválido");

const barberLoginSchema = z.object({
  username: z.string().min(1, "Usuário obrigatório"),
  password: z.string().min(1, "Senha obrigatória"),
});

type AgendaLoginPreferences = {
  loginType: "client" | "barber";
  rememberAccount: boolean;
  clientEmail: string;
  barberUsername: string;
};

type ClientAuthMode = "login" | "signup";

const agendaLoginStorageKeys = {
  loginType: "happycash:agenda:last-login-type",
  rememberAccount: "happycash:agenda:remember-account",
  clientEmail: "happycash:agenda:remembered-client-email",
  barberUsername: "happycash:agenda:remembered-professional-username",
} as const;

const isBrowser = () => typeof window !== "undefined";

const clearAgendaRememberedIdentifiers = () => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(agendaLoginStorageKeys.clientEmail);
  window.localStorage.removeItem(agendaLoginStorageKeys.barberUsername);
};

const readAgendaStorage = (key: string) => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
};

const normalizePhone = (value: string) => value.replace(/\D/g, "").slice(0, 15);

const normalizeLoginEmail = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");

  if (normalized === "demo.agenda@happycashsite.com") {
    return "demo.agenda@happycashsite.com.br";
  }

  return normalized;
};

const getAgendaLoginPreferences = (): AgendaLoginPreferences => {
  clearAgendaRememberedIdentifiers();

  return {
    loginType: readAgendaStorage(agendaLoginStorageKeys.loginType) === "barber" ? "barber" : "client",
    rememberAccount: readAgendaStorage(agendaLoginStorageKeys.rememberAccount) === "1",
    clientEmail: "",
    barberUsername: "",
  };
};

const saveAgendaLoginPreferences = (preferences: AgendaLoginPreferences) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(agendaLoginStorageKeys.loginType, preferences.loginType);
  window.localStorage.setItem(agendaLoginStorageKeys.rememberAccount, preferences.rememberAccount ? "1" : "0");
  void preferences.clientEmail;
  void preferences.barberUsername;
  clearAgendaRememberedIdentifiers();
};

export default function Login() {
  const [initialPreferences] = useState(getAgendaLoginPreferences);
  const [loginType, setLoginType] = useState<"client" | "barber">(initialPreferences.loginType);
  const [clientMode, setClientMode] = useState<ClientAuthMode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialPreferences.clientEmail);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [barberUsername, setBarberUsername] = useState(initialPreferences.barberUsername);
  const [barberPassword, setBarberPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { user, loading: authLoading, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { settings } = useAgendaBranding();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const postLoginTarget = useMemo(() => {
    const bookingDraft = readAgendaBookingDraft();
    if (bookingDraft?.returnPath) {
      return bookingDraft.returnPath;
    }
    const slug = slugFromPathname(location.pathname);
    return `${slug ? `/${slug}` : "/"}${location.search}`;
  }, [location.pathname, location.search]);
  const bookingDraft = useMemo(() => readAgendaBookingDraft(), []);
  const isClientBusy = loading || oauthLoading;

  useEffect(() => {
    if (!authLoading && user) {
      navigate(postLoginTarget, { replace: true });
    }
  }, [authLoading, user, navigate, postLoginTarget]);

  const handleBarberLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = barberLoginSchema.safeParse({
      username: barberUsername,
      password: barberPassword,
    });

    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Authenticate barber using database function
    const { data, error } = await supabase.rpc("authenticate_barber", {
      p_username: barberUsername,
      p_password: barberPassword,
    });

    if (error || !data || data.length === 0) {
      toast({
        title: "Credenciais inválidas",
        description: "Usuário ou senha incorretos.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const barberData = data[0];
    const { data: barberContext } = await supabase
      .from("barbers")
      .select("store_account_id")
      .eq("id", barberData.barber_id)
      .maybeSingle();

    let barberBusinessSlug = "";
    if (barberContext?.store_account_id) {
      const { data: businessSettings } = await supabase
        .from("agenda_business_settings")
        .select("slug")
        .eq("store_account_id", barberContext.store_account_id)
        .maybeSingle();

      barberBusinessSlug = businessSettings?.slug || "";
    }

    // Store barber info in session storage for the dashboard
    sessionStorage.setItem("barber_id", barberData.barber_id);
    sessionStorage.setItem("barber_name", barberData.barber_name);
    sessionStorage.setItem("barber_session_token", barberData.session_token);
    if (barberBusinessSlug) {
      sessionStorage.setItem("barber_business_slug", barberBusinessSlug);
    } else {
      sessionStorage.removeItem("barber_business_slug");
    }
    saveAgendaLoginPreferences({
      loginType: "barber",
      rememberAccount,
      clientEmail: email,
      barberUsername,
    });

    toast({
      title: `Bem-vindo, ${barberData.barber_name}!`,
      description: "Redirecionando para seu painel...",
    });

    navigate(
      barberBusinessSlug
        ? `/painel-profissional?empresa=${encodeURIComponent(barberBusinessSlug)}`
        : "/painel-profissional",
    );
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = normalizeLoginEmail(email);
    const result = loginSchema.safeParse({ email: normalizedEmail, password });
    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (normalizedEmail !== email) {
      setEmail(normalizedEmail);
    }

    setLoading(true);

    const { error } = await signIn(normalizedEmail, password);
    if (error) {
      toast({
        title: "Erro ao entrar",
        description: error.message || "Email ou senha incorretos.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Bem-vindo de volta!",
        description: "Login realizado com sucesso.",
      });
      saveAgendaLoginPreferences({
        loginType: "client",
        rememberAccount,
        clientEmail: normalizedEmail,
        barberUsername,
      });
      navigate(postLoginTarget, { replace: true });
    }

    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = normalizeLoginEmail(email);
    const normalizedPhone = normalizePhone(phone);
    const result = signupSchema.safeParse({
      fullName,
      email: normalizedEmail,
      phone: normalizedPhone,
      password,
      confirmPassword,
    });

    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (normalizedEmail !== email) {
      setEmail(normalizedEmail);
    }

    if (normalizedPhone !== phone) {
      setPhone(normalizedPhone);
    }

    setLoading(true);

    const { error, needsEmailConfirmation } = await signUp({
      fullName: result.data.fullName,
      email: normalizedEmail,
      password: result.data.password,
      phone: normalizedPhone,
    });

    if (error) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    saveAgendaLoginPreferences({
      loginType: "client",
      rememberAccount,
      clientEmail: normalizedEmail,
      barberUsername,
    });

    toast({
      title: needsEmailConfirmation ? "Confirme seu email" : "Conta criada com sucesso",
      description: needsEmailConfirmation
        ? "Enviamos um link de confirmação para o seu email."
        : "Sua conta já está pronta para concluir o agendamento.",
    });

    if (needsEmailConfirmation) {
      setClientMode("login");
      setPassword("");
      setConfirmPassword("");
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setOauthLoading(true);

    saveAgendaLoginPreferences({
      loginType: "client",
      rememberAccount,
      clientEmail: normalizeLoginEmail(email),
      barberUsername,
    });

    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: "Erro ao entrar com Google",
        description: error.message,
        variant: "destructive",
      });
      setOauthLoading(false);
    }
  };

  const handleForgotPassword = () => {
    const normalizedEmail = normalizeLoginEmail(email);
    setEmail(normalizedEmail);
    setForgotEmail(normalizedEmail);
    setForgotOpen(true);
  };

  const keepFocusedFieldVisible = (event: FocusEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    window.setTimeout(() => {
      field.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedEmail = normalizeLoginEmail(forgotEmail);
    const emailResult = emailSchema.safeParse(normalizedEmail);
    if (!emailResult.success) {
      toast({
        title: "Email inválido",
        description: emailResult.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    if (normalizedEmail !== forgotEmail) {
      setForgotEmail(normalizedEmail);
    }

    setResetLoading(true);
    const { error } = await resetPassword(normalizedEmail);
    setResetLoading(false);

    if (error) {
      toast({
        title: "Falha ao enviar link",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Email enviado",
      description:
        "Enviamos um link para redefinir sua senha. Verifique sua caixa de entrada.",
    });
    setForgotOpen(false);
  };

  return (
    <div className="min-h-[100svh] overflow-y-auto bg-background [webkit-overflow-scrolling:touch] lg:flex">
      {/* Left side - Form */}
      <div className="flex min-h-[100svh] touch-pan-y items-start justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] [@media(max-height:640px)]:pt-3 sm:items-center sm:p-8 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-5 text-center [@media(max-height:640px)]:mb-3 sm:mb-8">
            <div className="mb-3 inline-flex max-w-full items-center justify-center gap-2 sm:mb-4">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.displayName}
                  className="max-h-14 max-w-14 rounded object-contain sm:max-h-none sm:max-w-none"
                  style={{ width: settings.logoSize, height: settings.logoSize }}
                />
              ) : (
                <div className="p-2 bg-primary rounded-lg">
                  <CalendarDays className="w-6 h-6 text-primary-foreground" />
                </div>
              )}
              <span className="min-w-0 break-words font-serif text-xl font-semibold sm:text-2xl">
                {settings.displayName}
              </span>
            </div>
            <h1 className="mb-1 font-serif text-2xl font-bold sm:mb-2 sm:text-3xl">
              Acesse sua agenda
            </h1>
            <p className="text-sm text-muted-foreground [@media(max-height:560px)]:hidden sm:text-base">
              {bookingDraft
                ? "Entre ou crie sua conta para confirmar o agendamento."
                : "Entre com seu email e senha."}
            </p>
          </div>

          <Tabs
            value={loginType}
            onValueChange={(v) => setLoginType(v as "client" | "barber")}
            className="mb-4 [@media(max-height:640px)]:mb-2 sm:mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="client">Cliente</TabsTrigger>
              <TabsTrigger value="barber" className="truncate">Sou {settings.professionalLabel}</TabsTrigger>
            </TabsList>

            <TabsContent value="client">
              <Card className="shadow-sm">
                <CardHeader className="space-y-1 pb-3 [@media(max-height:640px)]:pb-2 sm:pb-4">
                  <CardTitle className="text-lg">
                    {clientMode === "signup" ? "Criar conta de cliente" : "Login de Cliente"}
                  </CardTitle>
                  <CardDescription className="text-sm [@media(max-height:560px)]:hidden">
                    {clientMode === "signup"
                      ? "Cadastro leve com nome, email, telefone e senha."
                      : "Entre com o email e senha da sua conta ou use o Google."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="[@media(max-height:640px)]:pt-0">
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={clientMode === "login" ? "default" : "outline"}
                      onClick={() => setClientMode("login")}
                      className="w-full"
                    >
                      Entrar
                    </Button>
                    <Button
                      type="button"
                      variant={clientMode === "signup" ? "default" : "outline"}
                      onClick={() => setClientMode("signup")}
                      className="w-full"
                    >
                      Criar conta
                    </Button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="mb-4 h-11 w-full gap-3"
                    onClick={handleGoogleLogin}
                    disabled={isClientBusy}
                  >
                    {oauthLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirecionando...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-.9 2.5-2 3.3l3.2 2.5c1.9-1.7 3-4.3 3-7.4 0-.7-.1-1.5-.2-2.2H12z" />
                          <path fill="#34A853" d="M12 21c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2 .9-3.5.9-2.7 0-4.9-1.8-5.7-4.2l-3.3 2.6C4.7 18.7 8.1 21 12 21z" />
                          <path fill="#4A90E2" d="M6.3 12.7c0-.7.1-1.4.4-2.1L3.4 8C2.8 9.2 2.5 10.6 2.5 12s.3 2.8.9 4l3.3-2.6c-.3-.7-.4-1.4-.4-2.1z" />
                          <path fill="#FBBC05" d="M12 7.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9C17 4.1 14.7 3 12 3 8.1 3 4.7 5.3 3.4 8l3.3 2.6c.8-2.4 3-4.2 5.7-4.2z" />
                        </svg>
                        Entrar com Google
                      </>
                    )}
                  </Button>

                  <form
                    onSubmit={clientMode === "signup" ? handleSignUp : handleSubmit}
                    className="space-y-4 [@media(max-height:640px)]:space-y-3"
                  >
                    {clientMode === "signup" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Nome completo</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="fullName"
                              type="text"
                              autoComplete="name"
                              placeholder="Seu nome"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              onFocus={keepFocusedFieldVisible}
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onFocus={keepFocusedFieldVisible}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    {clientMode === "signup" && (
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="11999999999"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onFocus={keepFocusedFieldVisible}
                            className="pl-10"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <PasswordInput
                        id="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={keepFocusedFieldVisible}
                        iconLeft={<Lock className="w-4 h-4" />}
                      />

                      {clientMode === "login" && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline focus:outline-none"
                            onClick={handleForgotPassword}
                            disabled={loading || resetLoading}
                          >
                            {resetLoading ? "Enviando..." : "Esqueci minha senha"}
                          </button>
                        </div>
                      )}
                    </div>

                    {clientMode === "signup" && (
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar senha</Label>
                        <PasswordInput
                          id="confirmPassword"
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onFocus={keepFocusedFieldVisible}
                          iconLeft={<Lock className="w-4 h-4" />}
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="agenda-client-remember-account"
                        checked={rememberAccount}
                        onCheckedChange={(checked) => setRememberAccount(checked === true)}
                      />
                      <Label
                        htmlFor="agenda-client-remember-account"
                        className="cursor-pointer text-xs leading-none text-foreground sm:text-sm"
                      >
                        Lembrar minha conta
                      </Label>
                    </div>

                    <Button type="submit" className="w-full" disabled={isClientBusy}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Aguarde...
                        </>
                      ) : (
                        clientMode === "signup" ? "Criar conta" : "Entrar"
                      )}
                    </Button>
                  </form>

                  <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                    <DialogContent className="max-h-[85svh] max-w-[95vw] overflow-y-auto sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Redefinir senha</DialogTitle>
                        <DialogDescription>
                          Informe o email cadastrado para receber o link de
                          redefinição.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSendReset} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="forgotEmail">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="forgotEmail"
                              type="email"
                              inputMode="email"
                              autoComplete="email"
                              autoCapitalize="none"
                              autoCorrect="off"
                              spellCheck={false}
                              placeholder="seu@email.com"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
                              onFocus={keepFocusedFieldVisible}
                              className="pl-10"
                            />
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={resetLoading}
                            className="w-full sm:w-auto"
                          >
                            {resetLoading ? "Enviando..." : "Enviar link"}
                          </Button>
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() => setForgotOpen(false)}
                            className="w-full sm:w-auto"
                          >
                            Cancelar
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="barber">
              <Card className="shadow-sm">
                <CardHeader className="space-y-1 pb-3 [@media(max-height:640px)]:pb-2 sm:pb-4">
                  <CardTitle className="text-lg">Login de {settings.professionalLabel}</CardTitle>
                  <CardDescription className="text-sm [@media(max-height:560px)]:hidden">
                    Entre com as credenciais fornecidas pelo administrador
                  </CardDescription>
                </CardHeader>
                <CardContent className="[@media(max-height:640px)]:pt-0">
                  <form onSubmit={handleBarberLogin} className="space-y-4 [@media(max-height:640px)]:space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="barberUsername">Usuário</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="barberUsername"
                          type="text"
                          autoComplete="username"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          placeholder="seu.usuario"
                          value={barberUsername}
                          onChange={(e) => setBarberUsername(e.target.value)}
                          onFocus={keepFocusedFieldVisible}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="barberPassword">Senha</Label>
                      <PasswordInput
                        id="barberPassword"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={barberPassword}
                        onChange={(e) => setBarberPassword(e.target.value)}
                        onFocus={keepFocusedFieldVisible}
                        iconLeft={<Lock className="w-4 h-4" />}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="agenda-professional-remember-account"
                        checked={rememberAccount}
                        onCheckedChange={(checked) => setRememberAccount(checked === true)}
                      />
                      <Label
                        htmlFor="agenda-professional-remember-account"
                        className="cursor-pointer text-xs leading-none text-foreground sm:text-sm"
                      >
                        Lembrar minha conta
                      </Label>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Aguarde...
                        </>
                      ) : (
                        `Entrar como ${settings.professionalLabel}`
                      )}
                    </Button>
                  </form>

                  <p className="text-center text-xs text-muted-foreground mt-6">
                    Credenciais fornecidas pelo administrador da empresa
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden flex-1 items-center justify-center bg-primary p-12 lg:flex lg:min-h-[100svh]">
        <div className="text-center text-primary-foreground max-w-md">
          <CalendarDays className="w-16 h-16 mx-auto mb-6 opacity-80" />
          <h2 className="font-serif text-4xl font-bold mb-4">
            Agenda e controle
          </h2>
          <p className="text-lg opacity-80">
            Cliente, profissional e administrador com o mesmo padrão no web e no mobile.
          </p>
        </div>
      </div>
    </div>
  );
}
