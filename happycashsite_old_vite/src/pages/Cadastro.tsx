import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createSiteUrl } from "@/lib/siteSeo";
import { isPublicPlanId, publicPlanContent } from "@/lib/subscriptionPlans";
import logo from "../../../src/assets/login/happycash.webp";
import { Eye, EyeOff, Loader2, PlayCircle, UserPlus } from "lucide-react";
import { getPasswordPolicyError, passwordPolicyHint } from "../../../shared/security/passwordPolicy";
import { requestTurnstileToken } from "../../../shared/security/turnstile";
import {
  LEGAL_ACCEPTANCE_SOURCES,
  LEGAL_LGPD_VERSION,
  LEGAL_PATHS,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  LEGAL_UPDATED_AT_LABEL,
} from "../../../shared/legal/legalAcceptance";
import { LEGAL_MODAL_DOCUMENTS } from "../../../shared/legal/legalModalDocuments";

interface RegisterAccountResponse {
  success?: boolean;
  requiresEmailConfirmation?: boolean;
  existingAccountEmailSent?: boolean;
  existingAccountRecoverySent?: boolean;
  email?: string;
  message?: string;
  error?: string;
}

const tiposEstabelecimento = [
  "Mercearia", "Padaria", "Loja de Roupas", "Bar", "Restaurante",
  "Lanchonete", "Farmácia", "Papelaria", "Pet Shop", "Açougue",
  "Feira / Hortifruti", "Conveniência", "Salão de Beleza", "Oficina", "Outro",
];

const estados = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const registrationLegalHighlights = [
  "Coletamos dados do responsável e da empresa, como nome, email, telefone, CPF ou CNPJ e endereço do estabelecimento.",
  "Também podemos tratar os dados inseridos no sistema pela loja, como nome, CPF, CNPJ, telefone, endereço, vendas, fiado, pagamentos, produtos, estoque, despesas e observações.",
  "O sistema mantém regras de acesso, separação de dados por empresa, registros de segurança e atendimento de correção ou exclusão quando possível.",
];

const getPasswordStrength = (value: string) => {
  const score = [
    value.length >= 10,
    /[A-Z]/.test(value),
    /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  if (!value) return { className: "bg-transparent", percent: 0 };
  if (score <= 2) return { className: "bg-red-500", percent: 33 };
  if (score <= 4) return { className: "bg-orange-500", percent: 66 };
  return { className: "bg-green-500", percent: 100 };
};

const resolveFunctionErrorMessage = async (error: unknown, fallbackMessage: string) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
      return errorPayload.error || errorPayload.message || fallbackMessage;
    } catch {
      return error.context.status === 404
        ? "A funcao de cadastro nao esta publicada neste projeto."
        : fallbackMessage;
    }
  }

  return error instanceof Error && error.message.trim() ? error.message : fallbackMessage;
};

const Cadastro = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const selectedPlanId = (() => {
    const value = searchParams.get("plan");
    return isPublicPlanId(value) ? value : null;
  })();
  const selectedBillingPeriod = searchParams.get("period") === "annual" ? "annual" : "monthly";
  const selectedPlanQuery = selectedPlanId
    ? `plan=${selectedPlanId}${selectedBillingPeriod === "annual" ? "&period=annual" : ""}`
    : selectedBillingPeriod === "annual"
    ? "period=annual"
    : "";
  const selectedPlan = selectedPlanId ? publicPlanContent[selectedPlanId] : null;
  const demoDashboardPath = "/dashboard?plan=demo";
  const emailConfirmPath = `/auth/callback?${selectedPlanQuery || "plan=demo"}`;

  // Step 1 - Account
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [website, setWebsite] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [confirmationMode, setConfirmationMode] = useState<"new" | "existing">("new");

  // Step 2 - Terms
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalDecision, setLegalDecision] = useState<"accepted" | "declined" | null>(null);

  // Step 3 - Business
  const [nomeCliente, setNomeCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("");
  const [tipoEstabelecimento, setTipoEstabelecimento] = useState("");

  // Step 4 - Address
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [nomeRua, setNomeRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    if (step === 2 && legalDecision !== "accepted") {
      setLegalModalOpen(true);
    }
  }, [legalDecision, step]);

  const fetchCep = async (value: string) => {
    setCep(value);
    const clean = value.replace(/\D/g, "");
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setNomeRua(data.logradouro || "");
          setBairro(data.bairro || "");
          setCidade(data.localidade || "");
          setEstado(data.uf || "");
          setEndereco(`${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`);
        }
      } catch { /* ignore */ }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const passwordError = getPasswordPolicyError(password);
    if (passwordError) {
      toast({
        title: "Senha fraca",
        description: passwordError,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Confirme sua senha",
        description: "As senhas digitadas nao conferem.",
        variant: "destructive",
      });
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      if (legalDecision !== "accepted") {
        setLegalModalOpen(true);
        toast({
          title: "Aceite obrigatório",
          description: "Concorde com os Termos de Uso, a Politica de Privacidade e a LGPD para continuar o cadastro.",
          variant: "destructive",
        });
        return;
      }

      setStep(3);
      return;
    }

    if (step === 3) {
      setStep(4);
      return;
    }

    if (legalDecision !== "accepted") {
      setStep(2);
      setLegalModalOpen(true);
      toast({
        title: "Aceite obrigatório",
        description: "Concorde com os Termos de Uso, a Politica de Privacidade e a LGPD para concluir o cadastro.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const captchaToken = await requestTurnstileToken("site-signup");
      const { data, error } = await supabase.functions.invoke<RegisterAccountResponse>("register-account", {
        body: {
          email,
          password,
          planId: selectedPlanId,
          nomeCliente,
          telefone,
          cnpj,
          nomeEstabelecimento,
          tipoEstabelecimento,
          cep,
          endereco,
          nomeRua,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          redirectTo: createSiteUrl(emailConfirmPath),
          website,
          captchaToken,
          legalAcceptanceSource: LEGAL_ACCEPTANCE_SOURCES.siteSignup,
          termsAccepted: true,
          termsVersion: LEGAL_TERMS_VERSION,
          privacyAccepted: true,
          privacyVersion: LEGAL_PRIVACY_VERSION,
          lgpdAccepted: true,
          lgpdVersion: LEGAL_LGPD_VERSION,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || await resolveFunctionErrorMessage(error, "Nao foi possivel criar sua conta."));
      }

      const isExistingAccountFlow = Boolean(data.existingAccountEmailSent || data.existingAccountRecoverySent);
      toast({
        title: "Verifique seu email",
        description: data.message || "Enviamos um link para continuar com seguranca.",
      });
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setConfirmationMode(isExistingAccountFlow ? "existing" : "new");
      setConfirmationEmail(data.email || email.trim());
    } catch (error) {
      toast({
        title: "Erro ao criar conta",
        description: error instanceof Error ? error.message : "Nao foi possivel concluir o cadastro.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = ["Conta", "Termos", "Empresa", "Endereço"];
  const registrationLegalDocuments = [
    LEGAL_MODAL_DOCUMENTS.terms,
    LEGAL_MODAL_DOCUMENTS.privacy,
    LEGAL_MODAL_DOCUMENTS.lgpd,
  ];

  if (confirmationEmail) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-3">
            <img src={logo} alt="HappyCash" className="mx-auto h-auto w-full max-w-[15rem] object-contain" />
            <h1 className="font-heading text-2xl font-bold">
              {confirmationMode === "existing" ? "Verifique seu email" : "Confirme seu email"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {confirmationMode === "existing"
                ? "Enviamos instrucoes para continuar com seguranca em "
                : "Enviamos o link de confirmacao para "}
              <span className="font-medium text-foreground">{confirmationEmail}</span>.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 space-y-4">
            <p className="text-sm text-muted-foreground">
              {confirmationMode === "existing"
                ? "Se esse email ja tiver cadastro no HappyCash, o link recebido permite recuperar o acesso ou concluir a confirmacao pendente."
                : "Depois de confirmar, sua conta sera finalizada no produto escolhido e a demo sera liberada no primeiro acesso."}
            </p>
            {selectedPlan && selectedPlanId !== "demo" && (
              <p className="text-sm text-muted-foreground">
                O plano <span className="font-medium text-foreground">{selectedPlan.name}</span> continuara selecionado quando voce entrar no painel.
              </p>
            )}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setConfirmationEmail(null)}>
                Voltar
              </Button>
              <Button
                type="button"
                className="flex-1 h-12 bg-primary text-primary-foreground font-semibold text-base"
                onClick={() => navigate(demoDashboardPath)}
              >
                <PlayCircle size={18} className="mr-2" />
                Abrir demo do sistema
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 sm:col-span-2"
                onClick={() => navigate(selectedPlanQuery ? `/login?${selectedPlanQuery}` : "/login")}
              >
                Ir para o login
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-3">
          <img src={logo} alt="HappyCash" className="mx-auto h-auto w-full max-w-[15rem] object-contain" />
          <h1 className="font-heading text-2xl font-bold">Crie sua conta</h1>
          <p className="text-sm text-muted-foreground">
            {selectedPlan
              ? `${selectedPlan.name} selecionado. Depois do cadastro, voce pode voltar ao site ou ativar esse plano no painel.`
              : "Preencha seus dados para iniciar seu acesso ao HappyCash."}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {stepTitles.map((title, i) => (
            <div key={title} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step > i + 1 ? "bg-primary text-primary-foreground" :
                step === i + 1 ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${step === i + 1 ? "text-primary font-medium" : "text-muted-foreground"}`}>
                {title}
              </span>
              {i < stepTitles.length - 1 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-8 space-y-4">
          {selectedPlan && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-primary">
                {selectedPlan.name}
                {selectedPlanId === "demo" ? " · 3 dias" : " · 30 dias"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedPlan.summary}</p>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Use uma senha forte" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} className="h-12 bg-muted/50 pr-12" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-label="Nivel de seguranca da senha">
                  <div
                    className={`h-full rounded-full transition-all ${passwordStrength.className}`}
                    style={{ width: `${passwordStrength.percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{passwordPolicyHint}</p>
              </div>
              <div className="space-y-2">
                <Label>Confirmar senha</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={10}
                    className="h-12 bg-muted/50 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    aria-label={showConfirmPassword ? "Ocultar confirmacao de senha" : "Mostrar confirmacao de senha"}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Termos de Uso, Política de Privacidade e LGPD</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Esta etapa abre automaticamente o modal com os documentos legais. Leia no próprio modal e use o botão de aceite para seguir.
                    Última atualização: {LEGAL_UPDATED_AT_LABEL}.
                  </p>
                </div>
                <Badge variant={legalDecision === "accepted" ? "default" : legalDecision === "declined" ? "destructive" : "outline"}>
                  {legalDecision === "accepted" ? "Aceite registrado" : legalDecision === "declined" ? "Aceite recusado" : "Leitura obrigatória"}
                </Badge>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">O que os documentos deixam claro</p>
                <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                  {registrationLegalHighlights.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
                Se você fechar o modal sem aceitar, esta etapa continuará pendente até clicar em <span className="font-medium text-foreground">Aceitar e continuar</span>.
              </div>

              <Button type="button" variant="outline" className="w-full h-12" onClick={() => setLegalModalOpen(true)}>
                Reabrir termos
              </Button>

              {legalDecision === "declined" && (
                <p className="text-xs text-destructive">
                  Sem o aceite legal, o cadastro não pode seguir para as próximas etapas.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input placeholder="Seu nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} required className="h-12 bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(00) 00000-0000" value={telefone} onChange={e => setTelefone(e.target.value)} required className="h-12 bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label>CPF ou CNPJ</Label>
                <Input
                  placeholder="Digite o CPF ou CNPJ do responsável"
                  value={cnpj}
                  onChange={e => setCnpj(e.target.value)}
                  required
                  className="h-12 bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">
                  Esse dado ja deixa seu cadastro preparado para cobranca no Asaas.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nome do estabelecimento</Label>
                <Input placeholder="Ex: Mercearia do João" value={nomeEstabelecimento} onChange={e => setNomeEstabelecimento(e.target.value)} required className="h-12 bg-muted/50" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de estabelecimento</Label>
                <Select value={tipoEstabelecimento} onValueChange={setTipoEstabelecimento} required>
                  <SelectTrigger className="h-12 bg-muted/50">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposEstabelecimento.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input placeholder="00000-000" value={cep} onChange={e => fetchCep(e.target.value)} required className="h-12 bg-muted/50" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label>Rua</Label>
                  <Input value={nomeRua} onChange={e => setNomeRua(e.target.value)} required className="h-12 bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Nº</Label>
                  <Input value={numero} onChange={e => setNumero(e.target.value)} className="h-12 bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Complemento <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input value={complemento} onChange={e => setComplemento(e.target.value)} className="h-12 bg-muted/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Bairro</Label>
                  <Input value={bairro} onChange={e => setBairro(e.target.value)} className="h-12 bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={cidade} onChange={e => setCidade(e.target.value)} required className="h-12 bg-muted/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={estado} onValueChange={setEstado} required>
                  <SelectTrigger className="h-12 bg-muted/50">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {estados.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden opacity-0" aria-hidden="true">
            <Label htmlFor="cadastro-website">Website</Label>
            <Input
              id="cadastro-website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={e => setWebsite(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-12" disabled={loading}>
                Voltar
              </Button>
            )}
            <Button type="submit" disabled={loading} className="flex-1 h-12 bg-primary text-primary-foreground font-semibold text-base">
              {loading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Criando...
                </>
              ) : step < 4 ? (
                "Próximo"
              ) : (
                <>
                  <UserPlus size={18} className="mr-2" />
                  Criar Conta
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground pt-2">
            Já tem conta?{" "}
            <Link to={selectedPlanQuery ? `/login?${selectedPlanQuery}` : "/login"} className="text-primary hover:underline font-medium">Entrar</Link>
            {" · "}
            <Link to="/paginainicial" className="text-muted-foreground hover:text-primary text-xs">Voltar ao site</Link>
          </p>
        </form>
      </div>

      <Dialog open={legalModalOpen} onOpenChange={setLegalModalOpen}>
        <DialogContent className="grid max-h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-border bg-card p-0 text-card-foreground shadow-[0_28px_80px_rgba(15,23,42,0.22)] sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-4 pb-3 pt-5 text-left sm:px-6 sm:pb-4 sm:pt-6">
            <DialogTitle className="font-heading text-2xl">Etapa 2: Termos, Privacidade e LGPD</DialogTitle>
            <DialogDescription className="leading-6">
              Revise os documentos legais do HappyCash e escolha se concorda ou não concorda com esta versão do cadastro.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-6 pr-0 sm:pr-3">
              {registrationLegalDocuments.map((document) => (
                <section key={document.title} className="space-y-4 rounded-xl border border-border/70 bg-background/70 p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-heading text-lg font-semibold text-foreground">{document.title}</h3>
                      <Link to={document.path} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                        Abrir página completa
                      </Link>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{document.description}</p>
                  </div>

                  <div className="space-y-4">
                    {document.sections.map((section) => (
                      <div key={section.title} className="space-y-1.5">
                        <p className="text-sm font-semibold text-foreground">{section.title}</p>
                        <p className="text-sm leading-6 text-muted-foreground">{section.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>

          <div className="grid shrink-0 gap-3 border-t border-border bg-card px-4 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6 sm:py-4">
            <span className="order-3 text-xs text-muted-foreground sm:order-1">Última atualização: {LEGAL_UPDATED_AT_LABEL}</span>
            <Button
              type="button"
              variant="destructive"
              className="order-2 min-h-11 w-full sm:w-auto"
              onClick={() => {
                setLegalDecision("declined");
                setLegalModalOpen(false);
              }}
            >
              Não concordo
            </Button>
            <Button
              type="button"
              className="order-1 min-h-11 w-full sm:order-3 sm:w-auto"
              onClick={() => {
                setLegalDecision("accepted");
                setLegalModalOpen(false);
                setStep(3);
              }}
            >
              Aceitar e continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cadastro;
