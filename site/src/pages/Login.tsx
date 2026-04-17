import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { isPublicPlanId, publicPlanContent } from "@/lib/subscriptionPlans";
import logo from "@/assets/logo-happycash.png";
import { Eye, EyeOff, LogIn } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bem-vindo de volta!" });
      navigate(selectedPlanId ? `/dashboard?plan=${selectedPlanId}` : "/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <img src={logo} alt="HappyCash" className="h-24 mx-auto" />
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
            Sistema PDV • Vendas • Controle • Gestão
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedPlan
              ? `Depois do login, voce pode ativar o ${selectedPlan.name} por ${selectedPlanId === "demo" ? "3 horas" : "30 dias"}.`
              : "Use o mesmo email e senha para entrar no site e no HappyCash."}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 space-y-6">
          <h1 className="font-heading text-3xl font-bold text-center text-primary">Entrar</h1>
          <p className="text-sm text-muted-foreground text-center">
            {selectedPlan
              ? "Acesse com seu email e senha para seguir no plano que voce escolheu."
              : "Acesse com seu email e senha. Depois voce pode escolher ou renovar seu plano de 30 dias."}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@happycash.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-muted/50 border-border"
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
                  className="h-12 bg-muted/50 border-border pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold bg-primary text-primary-foreground">
              {loading ? "Entrando..." : <><LogIn size={18} className="mr-2" /> Entrar</>}
            </Button>
          </form>

          <div className="text-center text-sm space-y-2">
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
