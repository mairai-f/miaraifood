import { useState, useEffect, useMemo, type FocusEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { z } from "zod";
import {
  User,
  Mail,
  Lock,
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

const agendaLoginStorageKeys = {
  loginType: "happycash:agenda:last-login-type",
  rememberAccount: "happycash:agenda:remember-account",
  clientEmail: "happycash:agenda:remembered-client-email",
  barberUsername: "happycash:agenda:remembered-professional-username",
} as const;

const isBrowser = () => typeof window !== "undefined";

const readAgendaStorage = (key: string) => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
};

const normalizeLoginEmail = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");

  if (normalized === "demo.agenda@happycashsite.com") {
    return "demo.agenda@happycashsite.com.br";
  }

  return normalized;
};

const getAgendaLoginPreferences = (): AgendaLoginPreferences => ({
  loginType: readAgendaStorage(agendaLoginStorageKeys.loginType) === "barber" ? "barber" : "client",
  rememberAccount: readAgendaStorage(agendaLoginStorageKeys.rememberAccount) === "1",
  clientEmail: normalizeLoginEmail(readAgendaStorage(agendaLoginStorageKeys.clientEmail) ?? ""),
  barberUsername: readAgendaStorage(agendaLoginStorageKeys.barberUsername) ?? "",
});

const saveAgendaLoginPreferences = (preferences: AgendaLoginPreferences) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(agendaLoginStorageKeys.loginType, preferences.loginType);
  window.localStorage.setItem(agendaLoginStorageKeys.rememberAccount, preferences.rememberAccount ? "1" : "0");

  if (preferences.rememberAccount) {
    const clientEmail = normalizeLoginEmail(preferences.clientEmail);
    const barberUsername = preferences.barberUsername.trim();

    if (clientEmail) {
      window.localStorage.setItem(agendaLoginStorageKeys.clientEmail, clientEmail);
    }

    if (barberUsername) {
      window.localStorage.setItem(agendaLoginStorageKeys.barberUsername, barberUsername);
    }
    return;
  }

  window.localStorage.removeItem(agendaLoginStorageKeys.clientEmail);
  window.localStorage.removeItem(agendaLoginStorageKeys.barberUsername);
};

export default function Login() {
  const [initialPreferences] = useState(getAgendaLoginPreferences);
  const [loginType, setLoginType] = useState<"client" | "barber">(initialPreferences.loginType);
  const [email, setEmail] = useState(initialPreferences.clientEmail);
  const [password, setPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [barberUsername, setBarberUsername] = useState(initialPreferences.barberUsername);
  const [barberPassword, setBarberPassword] = useState("");
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [loading, setLoading] = useState(false);

  const { user, loading: authLoading, signIn, resetPassword } = useAuth();
  const { settings } = useAgendaBranding();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const postLoginHomePath = useMemo(() => {
    const slug = slugFromPathname(location.pathname);
    return `${slug ? `/${slug}` : "/"}${location.search}`;
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!authLoading && user) {
      navigate(postLoginHomePath);
    }
  }, [authLoading, user, navigate, postLoginHomePath]);

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
      navigate(postLoginHomePath);
    }

    setLoading(false);
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
              Entre com seu email e senha.
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
                  <CardTitle className="text-lg">Login de Cliente</CardTitle>
                  <CardDescription className="text-sm [@media(max-height:560px)]:hidden">
                    Entre com o email e senha da conta ja autorizada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="[@media(max-height:640px)]:pt-0">
                  <form onSubmit={handleSubmit} className="space-y-4 [@media(max-height:640px)]:space-y-3">
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

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <PasswordInput
                        id="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={keepFocusedFieldVisible}
                        iconLeft={<Lock className="w-4 h-4" />}
                      />

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
                    </div>

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

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Aguarde...
                        </>
                      ) : (
                        "Entrar"
                      )}
                    </Button>
                  </form>

                  <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                    <DialogContent>
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
            Acesse seus horários, clientes e atendimentos em um só lugar.
          </p>
        </div>
      </div>
    </div>
  );
}
