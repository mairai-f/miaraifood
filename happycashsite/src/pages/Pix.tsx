import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-happycash.png";

const plans = [
  { name: "Plano Fiado", display: "R$ 100,00 / 30 dias" },
  { name: "Plano Completo", display: "R$ 230,00 / 30 dias" },
  { name: "Plano PRO", display: "R$ 347,00 / 30 dias" },
];

const Pix = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="rounded-2xl border border-border bg-card p-8 space-y-8">
          <img src={logo} alt="HappyCash" className="h-16 mx-auto" />
          <div className="text-center space-y-3">
            <h1 className="font-heading text-3xl font-bold">Assinatura via Pix</h1>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              O HappyCash está preparado para trabalhar com Pix pelo Asaas. Nesta etapa, o cadastro já cria seu
              cliente de cobrança automaticamente. Os planos pagos têm duração de 30 dias por ciclo.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.name} className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                <p className="text-sm font-medium">{plan.name}</p>
                <p className="mt-2 text-lg font-bold text-primary">{plan.display}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Como funciona agora</h2>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>1. Crie sua conta no HappyCash.</li>
                <li>2. Seu cadastro é criado no Supabase Auth.</li>
                <li>3. O cliente também é criado automaticamente no Asaas.</li>
                <li>4. A cobrança do plano será gerada por Pix com ciclo de 30 dias.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-border p-5">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">Próximo passo</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Entre ou crie sua conta para seguir com a assinatura no fluxo correto do sistema.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full h-12 text-base font-semibold" size="lg">
                  <Link to="/cadastro">Criar conta</Link>
                </Button>
                <Button asChild variant="outline" className="w-full h-12 text-base font-semibold" size="lg">
                  <Link to="/login">Já tenho conta</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pix;
