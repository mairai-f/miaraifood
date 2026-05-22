import { useState, useEffect } from "react";
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
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAgendaBranding } from "@/hooks/useAgendaBranding";

// Regex para senha forte: mínimo 8 caracteres, 1 maiúscula, 1 símbolo especial
const passwordRegex =
  /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

const emailSchema = z.string().email("Email inválido");

const phoneSchema = z
  .string()
  .min(1, "Telefone obrigatório")
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length === 10 || digits.length === 11;
    },
    {
      message: "Telefone inválido",
    },
  );

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "tempmail.com",
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "maildrop.cc",
  "yopmail.com",
  "trashmail.com",
  "dispostable.com",
  "getnada.com",
  "mail.tm",
]);

const isGeneratedEmail = (email: string) => {
  const [localPart, domain] = email.toLowerCase().split("@");
  if (!localPart || !domain) return true;

  // Não permitir e-mails internos ou que usam + para geração.
  if (domain === "barberpro.app") return true;
  if (localPart.startsWith("user+")) return true;
  if (localPart.includes("+")) return true; // evita e-mails tipo nome+algo@dominio

  // Bloqueia domínios temporários conhecidos
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  return false;
};

const signupSchema = z
  .object({
    email: z.string().email("Email inválido"),
    phone: phoneSchema,
    password: z
      .string()
      .min(8, "Senha deve ter no mínimo 8 caracteres")
      .regex(
        passwordRegex,
        "Senha deve ter pelo menos 1 letra maiúscula e 1 símbolo especial (!@#$%^&*()_+-=[]{};':\"|<>?,./`~)",
      ),
    fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  })
  .refine((data) => !isGeneratedEmail(data.email), {
    message: "Email inválido ou gerado", // manter mensagem genérica para não expor padrões
    path: ["email"],
  });

const barberLoginSchema = z.object({
  username: z.string().min(1, "Usuário obrigatório"),
  password: z.string().min(1, "Senha obrigatória"),
});

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginType, setLoginType] = useState<"client" | "barber">("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [barberUsername, setBarberUsername] = useState("");
  const [barberPassword, setBarberPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { user, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { settings } = useAgendaBranding();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const hasPublicAgendaContext = new URLSearchParams(location.search).has("empresa")
    || new URLSearchParams(location.search).has("agenda");
  const postLoginPath = hasPublicAgendaContext ? `/agendamento${location.search}` : "/";

  useEffect(() => {
    if (user) {
      navigate(postLoginPath);
    }
  }, [user, navigate, postLoginPath]);

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        title: "Erro ao entrar com Google",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    if (numbers.length <= 11)
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const checkPhoneExists = async (phoneNumber: string): Promise<boolean> => {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    if (!cleanPhone) return false;

    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", cleanPhone)
      .limit(1);

    return !!(data && data.length > 0);
  };

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

    // Store barber info in session storage for the dashboard
    sessionStorage.setItem("barber_id", barberData.barber_id);
    sessionStorage.setItem("barber_name", barberData.barber_name);

    toast({
      title: `Bem-vindo, ${barberData.barber_name}!`,
      description: "Redirecionando para seu painel...",
    });

    navigate("/painel-profissional");
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLogin) {
      const result = loginSchema.safeParse({ email, password });
      if (!result.success) {
        toast({
          title: "Dados inválidos",
          description: result.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    } else {
      if (password !== confirmPassword) {
        toast({
          title: "Senhas não conferem",
          description: "A senha e a confirmação devem ser iguais.",
          variant: "destructive",
        });
        return;
      }
      const result = signupSchema.safeParse({
        email,
        password,
        fullName,
        phone,
      });
      if (!result.success) {
        toast({
          title: "Dados inválidos",
          description: result.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Erro ao entrar",
          description: "Email ou senha incorretos.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Bem-vindo de volta!",
          description: "Login realizado com sucesso.",
        });
        navigate(postLoginPath);
      }
    } else {
      // Clean phone digits for checking/storing
      const cleanPhone = phone ? phone.replace(/\D/g, "") : "";

      if (cleanPhone) {
        const phoneExists = await checkPhoneExists(cleanPhone);
        if (phoneExists) {
          toast({
            title: "Telefone já cadastrado",
            description:
              "Este número de telefone já está vinculado a outra conta.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const { error } = await signUp(email, password, fullName, cleanPhone);
      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Email já cadastrado",
            description: "Este email já possui uma conta. Tente fazer login.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao criar conta",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Conta criada!",
          description: "Sua conta foi criada com sucesso.",
        });
        navigate(postLoginPath);
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = () => {
    setForgotEmail(email);
    setForgotOpen(true);
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(forgotEmail);
    if (!emailResult.success) {
      toast({
        title: "Email inválido",
        description: emailResult.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    const { error } = await resetPassword(forgotEmail);
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
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="p-2 bg-primary rounded-lg">
                <CalendarDays className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-serif text-2xl font-semibold">
                {settings.displayName}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold mb-2">
              {isLogin ? "Bem-vindo de volta!" : "Crie sua conta"}
            </h1>
            <p className="text-muted-foreground">
              {isLogin
                ? "Entre para acessar sua conta"
                : "Cadastre-se para agendar"}
            </p>
          </div>

          <Tabs
            value={loginType}
            onValueChange={(v) => setLoginType(v as "client" | "barber")}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="client">Cliente</TabsTrigger>
              <TabsTrigger value="barber">Sou {settings.professionalLabel}</TabsTrigger>
            </TabsList>

            <TabsContent value="client">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">
                    {isLogin ? "Login de Cliente" : "Cadastro de Cliente"}
                  </CardTitle>
                  <CardDescription>
                    {isLogin
                      ? "Entre com seu email e senha"
                      : "Preencha seus dados para criar uma conta"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Nome completo</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="fullName"
                              type="text"
                              placeholder="Seu nome"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="phone"
                              type="tel"
                              placeholder="(00) 00000-0000"
                              value={phone}
                              onChange={(e) =>
                                setPhone(formatPhone(e.target.value))
                              }
                              className="pl-10"
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Obrigatório: você deve informar um telefone válido.
                          </p>
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
                          placeholder="seu@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      {!isLogin && (
                        <p className="text-xs text-muted-foreground">
                          Obrigatório: você deve informar um email válido.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <PasswordInput
                        id="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        iconLeft={<Lock className="w-4 h-4" />}
                      />

                      {isLogin && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="text-sm text-primary hover:underline focus:outline-none"
                            onClick={handleForgotPassword}
                            disabled={loading || resetLoading}
                          >
                            {resetLoading
                              ? "Enviando..."
                              : "Esqueci minha senha"}
                          </button>
                        </div>
                      )}

                      {!isLogin && (
                        <p className="text-xs text-muted-foreground">
                          Mínimo 8 caracteres, 1 maiúscula e 1 símbolo especial
                        </p>
                      )}
                    </div>

                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                        <PasswordInput
                          id="confirmPassword"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          iconLeft={<Lock className="w-4 h-4" />}
                        />
                        {confirmPassword.length > 0 && (
                          <div className="flex items-center gap-1.5 text-xs">
                            {password === confirmPassword ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                <span className="text-green-500 font-medium">
                                  Senhas coincidem
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                                <span className="text-destructive font-medium">
                                  Senhas não coincidem
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Aguarde...
                        </>
                      ) : isLogin ? (
                        "Entrar"
                      ) : (
                        "Criar conta"
                      )}
                    </Button>
                  </form>

                  <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Redefinir senha</DialogTitle>
                        <DialogDescription>
                          Informe o email cadastrado e o número de telefone para
                          receber o link de redefinição.
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
                              placeholder="seu@email.com"
                              value={forgotEmail}
                              onChange={(e) => setForgotEmail(e.target.value)}
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

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        ou continue com
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogle}
                    disabled={loading}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Google
                  </Button>

                  <p className="text-center text-sm text-muted-foreground mt-6">
                    {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{" "}
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-primary hover:underline font-medium"
                    >
                      {isLogin ? "Cadastre-se" : "Entrar"}
                    </button>
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="barber">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Login de {settings.professionalLabel}</CardTitle>
                  <CardDescription>
                    Entre com as credenciais fornecidas pelo administrador
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleBarberLogin} className="space-y-4">
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
                        iconLeft={<Lock className="w-4 h-4" />}
                      />
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
      <div className="hidden lg:flex flex-1 bg-primary items-center justify-center p-12">
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
