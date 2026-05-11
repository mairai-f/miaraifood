import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/logo-happycash.webp";

const plans = [
  { name: "Plano Fiado", display: "R$ 100,00 / 30 dias" },
  { name: "Plano Completo", display: "R$ 189,00 / 30 dias" },
  { name: "Plano PRO", display: "R$ 250,00 / 30 dias" },
];

const Pix = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <Link to="/paginainicial" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <div className="space-y-6 rounded-2xl border border-border bg-card p-5 sm:space-y-8 sm:p-8">
          <img src={logo} alt="HappyCash" className="mx-auto h-12 sm:h-16" />
          <div className="text-center space-y-3">
            <h1 className="font-heading text-2xl font-bold sm:text-3xl">Assinatura via Pix e cartao</h1>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground">
              O HappyCash gera a cobranca do plano pelo Asaas. No painel voce escolhe entre Pix ou debito / credito,
              acompanha a cobranca e o plano libera automaticamente assim que o pagamento for confirmado. Os planos pagos
              tem duracao de 30 dias por ciclo.
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
                <li>4. O painel permite gerar Pix com QR Code ou abrir a fatura de debito / credito.</li>
                <li>5. O webhook do Asaas ativa o plano automaticamente apos a confirmacao do pagamento.</li>
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
