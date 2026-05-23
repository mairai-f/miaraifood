import { useState, useEffect } from "react";
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

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

const emailSchema = z.string().email("Email inválido");

const barberLoginSchema = z.object({
  username: z.string().min(1, "Usuário obrigatório"),
  password: z.string().min(1, "Senha obrigatória"),
});

export default function Login() {
  const [loginType, setLoginType] = useState<"client" | "barber">("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [barberUsername, setBarberUsername] = useState("");
  const [barberPassword, setBarberPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { user, signIn, resetPassword } = useAuth();
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

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      toast({
        title: "Dados inválidos",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await signIn(email, password);
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
      navigate(postLoginPath);
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
                {settings.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt={settings.displayName}
                    className="h-6 w-6 rounded object-cover"
                  />
                ) : (
                  <CalendarDays className="w-6 h-6 text-primary-foreground" />
                )}
              </div>
              <span className="font-serif text-2xl font-semibold">
                {settings.displayName}
              </span>
            </div>
            <h1 className="font-serif text-3xl font-bold mb-2">
              Acesse sua agenda
            </h1>
            <p className="text-muted-foreground">
              Entre com seu email e senha.
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
                  <CardTitle className="text-lg">Login de Cliente</CardTitle>
                  <CardDescription>
                    Entre com o email e senha da conta ja autorizada.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
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
