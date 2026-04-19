import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { applySiteSessionPreference, getSiteLoginPreferences, saveSiteLoginPreferences } from "@/lib/authSessionPreferences";
import { isPublicPlanId, publicPlanContent } from "@/lib/subscriptionPlans";
import logo from "@/assets/logo-happycash.png";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

const Login = () => {
  const initialPreferences = getSiteLoginPreferences();
  const [email, setEmail] = useState(initialPreferences.rememberAccount ? initialPreferences.email : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [keepConnected, setKeepConnected] = useState(initialPreferences.keepConnected);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const selectedPlanId = (() => {
    const value = searchParams.get("plan");
    return isPublicPlanId(value) ? value : null;
  })();
  const selectedPlan = selectedPlanId ? publicPlanContent[selectedPlanId] : null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    saveSiteLoginPreferences({
      rememberAccount,
      keepConnected,
      email,
    });

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
        return;
      }

      applySiteSessionPreference(keepConnected);
      toast({ title: "Bem-vindo de volta!" });
      navigate(selectedPlanId ? `/dashboard?plan=${selectedPlanId}` : "/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[100svh] flex-col items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      <div className="w-full max-w-md space-y-4 sm:space-y-6">
        <div className="space-y-2 text-center sm:space-y-3">
          <img
            src={logo}
            alt="HappyCash"
            className="mx-auto h-auto w-[clamp(7.5rem,36vw,11.5rem)] max-w-full object-contain"
          />
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px] sm:tracking-[0.28em]">
            Sistema PDV • Vendas • Controle • Gestão
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {selectedPlan
              ? `Depois do login, voce pode ativar o ${selectedPlan.name} por ${selectedPlanId === "demo" ? "3 horas" : "30 dias"}.`
              : "Use o mesmo email e senha para entrar no site e no HappyCash."}
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-card/80 p-5 backdrop-blur-sm sm:space-y-5 sm:p-6">
          <h1 className="text-center font-heading text-xl font-bold text-primary sm:text-2xl">Entrar</h1>
          <p className="text-center text-xs text-muted-foreground sm:text-sm">
            {selectedPlan
              ? "Acesse com seu email e senha para seguir no plano que voce escolheu."
              : "Acesse com seu email e senha. Depois voce pode escolher ou renovar seu plano de 30 dias."}
          </p>

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@happycash.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-border bg-muted/50 sm:h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 border-border bg-muted/50 pr-12 sm:h-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="site-remember-account"
                  checked={rememberAccount}
                  onCheckedChange={(checked) => setRememberAccount(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="site-remember-account" className="cursor-pointer text-sm">
                  Lembrar conta
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="site-keep-connected"
                  checked={keepConnected}
                  onCheckedChange={(checked) => setKeepConnected(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="site-keep-connected" className="cursor-pointer text-sm">
                  Manter conectado
                </Label>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full px-4 text-sm font-semibold text-primary-foreground sm:h-12 sm:text-base bg-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn size={18} className="mr-2" />
                  <span>Entrar</span>
                </>
              )}
            </Button>
          </form>

          <div className="space-y-2 text-center text-sm">
            <p className="text-muted-foreground">
              Não tem conta?{" "}
              <Link to={selectedPlanId ? `/cadastro?plan=${selectedPlanId}` : "/cadastro"} className="text-primary hover:underline font-medium">
                Criar conta
              </Link>
            </p>
            <Link to="/" className="text-muted-foreground hover:text-primary text-xs transition-colors">
              ← Voltar ao site
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
