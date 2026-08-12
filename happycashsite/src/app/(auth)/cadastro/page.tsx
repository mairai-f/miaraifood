"use client";

import { motion } from 'framer-motion';

import { useEffect, useState, Suspense } from "react";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";
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
const logo = "/happycash-logo.svg";
import { Eye, EyeOff, Loader2, PlayCircle, UserPlus } from "lucide-react";
import { getPasswordPolicyError, passwordPolicyHint } from "@/shared/security/passwordPolicy";
import { requestTurnstileToken } from "@/shared/security/turnstile";
import {
  LEGAL_ACCEPTANCE_SOURCES,
  LEGAL_LGPD_VERSION,
  LEGAL_PATHS,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  LEGAL_UPDATED_AT_LABEL,
} from "@/shared/legal/legalAcceptance";
import { LEGAL_MODAL_DOCUMENTS } from "@/shared/legal/legalModalDocuments";

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
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Document Recovery
  const [duplicateDocumentModalOpen, setDuplicateDocumentModalOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [sendingRecovery, setSendingRecovery] = useState(false);

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
      const msg = error instanceof Error ? error.message : "Nao foi possivel concluir o cadastro.";
      if (msg.includes("CPF ou CNPJ")) {
        setRecoveryEmail("");
        setDuplicateDocumentModalOpen(true);
      } else {
        toast({
          title: "Erro ao criar conta",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecovery = async () => {
    if (!recoveryEmail) return;
    setSendingRecovery(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
        redirectTo: createSiteUrl("/auth/callback?plan=demo"),
      });

      if (error) {
        throw error;
      }

      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para recuperar o acesso.",
      });
      setDuplicateDocumentModalOpen(false);
    } catch (error) {
      toast({
        title: "Erro ao enviar e-mail",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao enviar a recuperação.",
        variant: "destructive",
      });
    } finally {
      setSendingRecovery(false);
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
                onClick={() => router.push(demoDashboardPath)}
              >
                <PlayCircle size={18} className="mr-2" />
                Abrir demo do sistema
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 sm:col-span-2"
                onClick={() => router.push(selectedPlanQuery ? `/login?${selectedPlanQuery}` : "/login")}
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
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0b64d3] via-[#054397] to-[#011c47] flex flex-col items-center justify-center py-8 overflow-hidden">
      {/* Background 3D/Glass Blobs (CSS Simulation) */}
      <div className="absolute top-[10%] left-[20%] w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[20%] right-[15%] w-80 h-80 bg-blue-500/30 rounded-full blur-3xl mix-blend-screen pointer-events-none" />
      <div className="absolute top-[40%] right-[30%] w-32 h-32 border-[16px] border-white/10 rounded-full backdrop-blur-sm pointer-events-none" />
      <div className="absolute bottom-[30%] left-[25%] w-48 h-48 border-[24px] border-white/5 rounded-full backdrop-blur-md pointer-events-none" />

      <div className="w-full max-w-[32rem] space-y-6 relative z-10 px-0 sm:px-4">
        <div className="text-center space-y-1 mb-6">
          <div className="flex flex-col items-center justify-center">
            <motion.img 
              src={logo} 
              alt="HappyCash" 
              className="h-auto w-full max-w-[15.25rem] object-contain sm:max-w-[16rem] brightness-0 invert" 
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <p className="text-[18px] font-medium text-white/80 tracking-wide mt-4">
              Gestão inteligente, negócios mais simples.
            </p> 
          </div>
          <h1 className="text-[1.68rem] font-bold leading-none tracking-[-0.04em] text-white sm:text-[2.2rem] mt-6 pt-2">
            Crie sua conta
          </h1>
          <p className="text-sm text-white/70 mt-2 px-4">
            {selectedPlan
              ? `${selectedPlan.name} selecionado. Depois do cadastro, voce pode voltar ao site ou ativar esse plano no painel.`
              : "Preencha seus dados para iniciar seu acesso ao HappyCash."}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {stepTitles.map((title, i) => (
            <div key={title} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step > i + 1 ? "bg-white text-[#0b64d3] shadow-lg shadow-white/25" :
                step === i + 1 ? "bg-white text-[#0b64d3] shadow-lg shadow-white/25" :
                "bg-white/10 border border-white/20 text-white/50"
              }`}>
                {i + 1}
              </div>
              <span className={`text-xs hidden sm:inline ${step === i + 1 ? "text-white font-medium" : "text-white/50"}`}>
                {title}
              </span>
              {i < stepTitles.length - 1 && <div className="w-8 h-px bg-white/20" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="rounded-none sm:rounded-3xl border-y border-x-0 sm:border-x border-white/20 bg-white/10 backdrop-blur-xl px-4 py-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] sm:px-10 sm:py-8 space-y-4 w-full">
          {selectedPlan && (
            <div className="rounded-xl border border-white/30 bg-white/10 p-4">
              <p className="text-sm font-semibold text-white">
                {selectedPlan.name}
                {selectedPlanId === "demo" ? " · 3 dias" : " · 30 dias"}
              </p>
              <p className="mt-1 text-sm text-white/70">{selectedPlan.summary}</p>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Email</Label>
                <Input type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Senha</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Use uma senha forte" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} className="h-12 rounded-xl border-white/20 bg-white/10 px-4 pr-12 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-label="Nivel de seguranca da senha">
                  <div
                    className={`h-full rounded-full transition-all ${passwordStrength.className}`}
                    style={{ width: `${passwordStrength.percent}%` }}
                  />
                </div>
                <p className="text-xs text-white/60">{passwordPolicyHint}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Confirmar senha</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={10}
                    className="h-12 rounded-xl border-white/20 bg-white/10 px-4 pr-12 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                    aria-label={showConfirmPassword ? "Ocultar confirmacao de senha" : "Mostrar confirmacao de senha"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
                <Label className="text-[14px] font-medium text-white/90">Nome completo</Label>
                <Input placeholder="Seu nome" value={nomeCliente} onChange={e => setNomeCliente(e.target.value)} required className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Telefone</Label>
                <Input placeholder="(00) 00000-0000" value={telefone} onChange={e => setTelefone(e.target.value)} required className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">CPF ou CNPJ</Label>
                <Input
                  placeholder="Digite o CPF ou CNPJ do responsável"
                  value={cnpj}
                  onChange={e => setCnpj(e.target.value)}
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
                />
                <p className="text-xs text-white/60">
                  Esse dado ja deixa seu cadastro preparado para cobranca no Asaas.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Nome do estabelecimento</Label>
                <Input placeholder="Ex: Mercearia do João" value={nomeEstabelecimento} onChange={e => setNomeEstabelecimento(e.target.value)} required className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Tipo de estabelecimento</Label>
                <Select value={tipoEstabelecimento} onValueChange={setTipoEstabelecimento} required>
                  <SelectTrigger className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20">
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
                <Label className="text-[14px] font-medium text-white/90">CEP</Label>
                <Input placeholder="00000-000" value={cep} onChange={e => fetchCep(e.target.value)} required className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-2">
                  <Label className="text-[14px] font-medium text-white/90">Rua</Label>
                  <Input value={nomeRua} onChange={e => setNomeRua(e.target.value)} required className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-white/90">Nº</Label>
                  <Input value={numero} onChange={e => setNumero(e.target.value)} className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Complemento <span className="text-white/60 text-xs">(opcional)</span></Label>
                <Input value={complemento} onChange={e => setComplemento(e.target.value)} className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-white/90">Bairro</Label>
                  <Input value={bairro} onChange={e => setBairro(e.target.value)} className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[14px] font-medium text-white/90">Cidade</Label>
                  <Input value={cidade} onChange={e => setCidade(e.target.value)} required className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[14px] font-medium text-white/90">Estado</Label>
                <Select value={estado} onValueChange={setEstado} required>
                  <SelectTrigger className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20">
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

          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-12 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-md transition-colors" disabled={loading}>
                Voltar
              </Button>
            )}
            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-xl bg-[#09223e] border border-white/5 px-4 text-base font-semibold text-white hover:bg-[#09223e]/80 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] transition-all">
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

          <div className="mt-8 space-y-1.5 text-center text-[13px] sm:text-sm pt-2">
            <p className="text-white/60">
              Já tem conta?{" "}
              <Link href={selectedPlanQuery ? `/login?${selectedPlanQuery}` : "/login"} className="font-bold text-white hover:underline decoration-white/50 underline-offset-4">
                Entrar
              </Link>
            </p>
            <div className="mt-4 pt-4 border-t border-white/10">
              <Link href="/" className="text-xs text-white/40 transition-colors hover:text-white/80">
                &larr; Voltar ao site
              </Link>
            </div>
          </div>
        </form>
      </div>

      <Dialog open={legalModalOpen} onOpenChange={setLegalModalOpen}>
        <DialogContent className="grid max-h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-white/20 bg-[#061830]/90 backdrop-blur-xl p-0 text-white shadow-[0_28px_80px_rgba(0,0,0,0.5)] sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-3xl">
          <DialogHeader className="border-b border-white/10 px-4 pb-3 pt-5 text-left sm:px-6 sm:pb-4 sm:pt-6">
            <DialogTitle className="font-heading text-2xl text-white">Etapa 2: Termos, Privacidade e LGPD</DialogTitle>
            <DialogDescription className="leading-6 text-white/70">
              Revise os documentos legais do HappyCash e escolha se concorda ou não concorda com esta versão do cadastro.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-6 pr-0 sm:pr-3">
              {registrationLegalDocuments.map((document) => (
                <section key={document.title} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-heading text-lg font-semibold text-white">{document.title}</h3>
                      <Link href={document.path} target="_blank" rel="noreferrer" className="text-sm font-medium text-white/80 hover:text-white underline decoration-white/30 underline-offset-4">
                        Abrir página completa
                      </Link>
                    </div>
                    <p className="text-sm leading-6 text-white/60">{document.description}</p>
                  </div>

                  <div className="space-y-4">
                    {document.sections.map((section) => (
                      <div key={section.title} className="space-y-1.5">
                        <p className="text-sm font-semibold text-white/90">{section.title}</p>
                        <p className="text-sm leading-6 text-white/60">{section.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>

          <div className="grid shrink-0 gap-3 border-t border-white/10 bg-white/5 px-4 py-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6 sm:py-4">
            <span className="order-3 text-xs text-white/50 sm:order-1">Última atualização: {LEGAL_UPDATED_AT_LABEL}</span>
            <Button
              type="button"
              className="order-2 min-h-11 w-full sm:w-auto bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/30"
              onClick={() => {
                setLegalDecision("declined");
                setLegalModalOpen(false);
              }}
            >
              Não concordo
            </Button>
            <Button
              type="button"
              className="order-1 min-h-11 w-full sm:order-3 sm:w-auto bg-[#09223e] border border-white/5 text-white hover:bg-[#09223e]/80 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] transition-all"
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

      <Dialog open={duplicateDocumentModalOpen} onOpenChange={setDuplicateDocumentModalOpen}>
        <DialogContent className="grid max-h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.75rem)] max-w-[calc(100vw-0.75rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-white/20 bg-[#061830]/90 backdrop-blur-xl p-0 text-white shadow-[0_28px_80px_rgba(0,0,0,0.5)] sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:max-w-md">
          <DialogHeader className="border-b border-white/10 px-4 pb-3 pt-5 text-left sm:px-6 sm:pb-4 sm:pt-6">
            <DialogTitle className="font-heading text-xl text-white">CPF ou CNPJ já cadastrado</DialogTitle>
            <DialogDescription className="leading-6 text-white/70">
              Esqueceu sua senha? Digite o e-mail associado a este documento para enviarmos um link de recuperação.
            </DialogDescription>
          </DialogHeader>

          <div className="px-4 py-6 sm:px-6 sm:py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[14px] font-medium text-white/90">Email de recuperação</Label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={recoveryEmail}
                onChange={e => setRecoveryEmail(e.target.value)}
                required
                className="h-12 rounded-xl border-white/20 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-white/30 focus-visible:ring-offset-0 sm:h-12 backdrop-blur-md transition-colors hover:bg-white/20"
              />
            </div>
          </div>

          <div className="grid shrink-0 gap-3 border-t border-white/10 bg-white/5 px-4 py-3 sm:grid-cols-2 sm:px-6 sm:py-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-md transition-colors"
              onClick={() => setDuplicateDocumentModalOpen(false)}
              disabled={sendingRecovery}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl bg-[#09223e] border border-white/5 text-white hover:bg-[#09223e]/80 shadow-[0_4px_14px_0_rgba(0,0,0,0.39)] transition-all"
              onClick={handleSendRecovery}
              disabled={sendingRecovery || !recoveryEmail.trim()}
            >
              {sendingRecovery ? (
                <>
                  <Loader2 className="mr-2 animate-spin h-4 w-4" />
                  Enviando...
                </>
              ) : (
                "Recuperar acesso"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function CadastroPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <Cadastro />
    </Suspense>
  )
}

