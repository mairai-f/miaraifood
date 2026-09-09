"use client";

import { motion } from 'framer-motion';
import { useEffect, useState, Suspense } from "react";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/utils/supabase/client";
import GhostFibers from "@/components/ui/GhostFibers";
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
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  PlayCircle,
  UserPlus,
  Search,
  Utensils,
  Pizza,
  Beer,
  Coffee,
  Fish,
  Store,
  CheckSquare,
  Sparkles,
  MapPin,
  Building2,
  Smartphone,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { getPasswordPolicyError, passwordPolicyHint } from "@/shared/security/passwordPolicy";
import {
  LEGAL_ACCEPTANCE_SOURCES,
  LEGAL_LGPD_VERSION,
  LEGAL_PATHS,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
  LEGAL_UPDATED_AT_LABEL,
} from "@/shared/legal/legalAcceptance";
import { LEGAL_MODAL_DOCUMENTS } from "@/shared/legal/legalModalDocuments";

const estados = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const segmentosComercio = [
  {
    id: "restaurante",
    title: "Restaurante / À la carte",
    desc: "Atendimento por mesa, comanda e pratos feitos",
    icon: Utensils,
  },
  {
    id: "pizzaria",
    title: "Pizzaria & Forno",
    desc: "Venda por frações (metades), bordas recheadas e entregas",
    icon: Pizza,
  },
  {
    id: "hamburgueria",
    title: "Hamburgueria & Artesanal",
    desc: "Combos, adicionais (bacon, queijo extra) e embalagens",
    icon: Store,
  },
  {
    id: "bar",
    title: "Bar & Choperia / Pub",
    desc: "Comandas individuais, controle de mesas e balcão",
    icon: Beer,
  },
  {
    id: "sushi",
    title: "Culinária Japonesa / Sushi",
    desc: "Rodízio, combinados, peças individuais e embalagens térmicas",
    icon: Fish,
  },
  {
    id: "cafeteria",
    title: "Cafeteria & Confeitaria",
    desc: "Atendimento rápido no balcão, doces e bebidas quentes",
    icon: Coffee,
  },
];

const defaultPreCatalog: Record<string, { name: string; price: string; category: string }[]> = {
  restaurante: [
    { name: "Prato Feito Executivo", price: "29,90", category: "Pratos Principais" },
    { name: "Filé Mignon à Parmegiana", price: "58,00", category: "Especiais" },
    { name: "Suco Natural 500ml", price: "9,90", category: "Bebidas" },
    { name: "Pudim de Leite Moça", price: "14,00", category: "Sobremesas" },
  ],
  pizzaria: [
    { name: "Pizza Calabresa Especial", price: "49,90", category: "Pizzas Salgadas" },
    { name: "Pizza 4 Queijos Gourmet", price: "54,90", category: "Pizzas Salgadas" },
    { name: "Borda Recheada Catupiry", price: "12,00", category: "Adicionais" },
    { name: "Guaraná 2L", price: "12,90", category: "Bebidas" },
  ],
  hamburgueria: [
    { name: "Smash Burger Duplo Bacon", price: "34,90", category: "Hamburgueres" },
    { name: "Batata Rústica Cheddar", price: "22,00", category: "Porções" },
    { name: "Milkshake Ninho Nutella", price: "24,90", category: "Bebidas & Doces" },
    { name: "Burger Vegetariano", price: "32,90", category: "Hamburgueres" },
  ],
  bar: [
    { name: "Chopp Artesanal 500ml", price: "16,00", category: "Bebidas" },
    { name: "Porção de Torresmo Crocante", price: "38,00", category: "Petiscos" },
    { name: "Caipirinha Tradicional", price: "22,00", category: "Drinks" },
    { name: "Isca de Peixe c/ Tártaro", price: "45,00", category: "Petiscos" },
  ],
  sushi: [
    { name: "Combinado Chef 30 Peças", price: "89,90", category: "Combinados" },
    { name: "Temaki Salmão Completo", price: "28,00", category: "Temakis" },
    { name: "Hot Roll Couve Crocante", price: "32,00", category: "Especiais" },
    { name: "Harumaki Legumes 4un", price: "18,00", category: "Entradas" },
  ],
  cafeteria: [
    { name: "Cappuccino Italiano c/ Canela", price: "12,90", category: "Cafés Quentes" },
    { name: "Croissant Presunto e Queijo", price: "16,50", category: "Salgados" },
    { name: "Slice Cake Red Velvet", price: "18,00", category: "Doces & Bolos" },
    { name: "Café Espresso Duplo", price: "8,50", category: "Cafés Quentes" },
  ],
};

const getPasswordStrength = (value: string) => {
  const score = [
    value.length >= 10,
    /[A-Z]/.test(value),
    /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  if (!value) return { className: "bg-transparent", percent: 0 };
  if (score <= 2) return { className: "bg-rose-500", percent: 33 };
  if (score <= 4) return { className: "bg-amber-500", percent: 66 };
  return { className: "bg-emerald-500", percent: 100 };
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

  // Step 1 - Proprietário / Master Account
  const [nomeCliente, setNomeCliente] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  // Step 2 - Perfil do Estabelecimento
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cep, setCep] = useState("");
  const [nomeRua, setNomeRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("SP");
  const [segmento, setSegmento] = useState("restaurante");
  const [quantidadeMesas, setQuantidadeMesas] = useState(10);

  // Checkbox resources
  const [modalidades, setModalidades] = useState<string[]>([
    "Atendimento por Mesas",
    "Venda Direta no Balcão (PDV)",
    "Retirada / Takeaway",
    "Delivery Próprio com Taxa",
    "Drive-Thru",
    "Cardápio Digital por QR Code"
  ]);
  const [cobrancas, setCobrancas] = useState<string[]>([
    "Rodízio / Valor Fixo por Pessoa",
    "Self-Service por KG",
    "Comanda Individual por Cliente",
    "Couvert Artístico Automático"
  ]);
  const [pagamentos, setPagamentos] = useState<string[]>([
    "PIX Automático no PDV",
    "Cartão de Crédito",
    "Cartão de Débito",
    "Dinheiro com Troco",
    "Emissão Fiscal NFC-e / SAT"
  ]);

  // Step 3 - Cardápio
  const [skipCatalog, setSkipCatalog] = useState(false);

  // Step 4 - Legal Terms
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalDecision, setLegalDecision] = useState<"accepted" | "declined" | null>(null);

  // Incomplete Data Warning Modal
  const [incompleteModalOpen, setIncompleteModalOpen] = useState(false);
  const [incompleteMessage, setIncompleteMessage] = useState("Por favor, preencha Nome, E-mail e Senha Master do Proprietário.");

  const passwordStrength = getPasswordStrength(password);

  const getFunctionErrorMessage = async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = await error.context.clone().json() as { error?: string; message?: string };
        return payload.error || payload.message || "Não foi possível concluir o cadastro.";
      } catch {
        return "Não foi possível concluir o cadastro.";
      }
    }
    return error instanceof Error && error.message ? error.message : "Não foi possível concluir o cadastro.";
  };

  const toggleItem = (list: string[], setList: (val: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

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
          setEstado(data.uf || "SP");
          toast({ title: "CEP Encontrado!", description: `${data.logradouro}, ${data.bairro} - ${data.localidade}/${data.uf}` });
        }
      } catch { /* ignore */ }
    }
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (!nomeCliente.trim() || !email.trim() || !password.trim()) {
        setIncompleteMessage("Por favor, preencha Nome, E-mail e Senha Master do Proprietário.");
        setIncompleteModalOpen(true);
        return;
      }
      const passwordError = getPasswordPolicyError(password);
      if (passwordError) {
        toast({ title: "Senha fraca", description: passwordError, variant: "destructive" });
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: "Senhas divergentes", description: "As senhas digitadas não conferem.", variant: "destructive" });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!nomeEstabelecimento.trim()) {
        setIncompleteMessage("Por favor, informe o Nome Fantasia do Estabelecimento.");
        setIncompleteModalOpen(true);
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
      setLegalModalOpen(true);
    } else if (step === 4) {
      if (legalDecision !== "accepted") {
        setLegalModalOpen(true);
        return;
      }
      setStep(5);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean;
        error?: string;
        email?: string;
        resumeExistingRegistration?: boolean;
      }>("register-account", {
        body: {
          email: email.trim(),
          password,
          nomeCliente: nomeCliente.trim(),
          telefone: telefone.trim(),
          cnpj: cnpj.trim(),
          nomeEstabelecimento: nomeEstabelecimento.trim(),
          tipoEstabelecimento: segmento,
          cep,
          endereco: `${nomeRua}, ${numero} - ${bairro}, ${cidade}/${estado}`,
          nomeRua,
          numero,
          complemento,
          bairro,
          cidade,
          estado,
          planId: selectedPlanId,
          redirectTo: `${window.location.origin}/auth/callback`,
          termsAccepted: legalDecision === "accepted",
          termsVersion: LEGAL_TERMS_VERSION,
          privacyAccepted: legalDecision === "accepted",
          privacyVersion: LEGAL_PRIVACY_VERSION,
          lgpdAccepted: legalDecision === "accepted",
          lgpdVersion: LEGAL_LGPD_VERSION,
          legalAcceptanceSource: LEGAL_ACCEPTANCE_SOURCES.siteSignup,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || await getFunctionErrorMessage(error));
      }

      if (data.resumeExistingRegistration) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;

        router.replace("/dashboard");
        return;
      }

      setConfirmationEmail(data.email || email);
      toast({ title: "Confirme seu e-mail", description: "Após a confirmação, sua empresa e o teste de 30 dias serão ativados." });
    } catch (err) {
      toast({ title: "Não foi possível concluir", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    "Proprietário",
    "Estabelecimento",
    "Cardápio",
    "Termos",
    "Ativação",
  ];

  const registrationLegalDocuments = [
    LEGAL_MODAL_DOCUMENTS.terms,
    LEGAL_MODAL_DOCUMENTS.privacy,
    LEGAL_MODAL_DOCUMENTS.lgpd,
  ];

  if (confirmationEmail) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-6 text-center">
          <h1 className="text-3xl font-bold text-white">Parabéns! Conta Ativada com Sucesso</h1>
          <p className="text-zinc-300">
            Seu teste de <span className="text-[#70E000] font-bold">1 mês grátis</span> foi liberado para <span className="font-bold text-white">{nomeEstabelecimento || email}</span>.
          </p>
          <div className="rounded-2xl border border-emerald-500/30 bg-[#06190e]/90 p-8 space-y-4 shadow-2xl">
            <p className="text-sm text-zinc-300">
              Você já pode acessar o painel de controle e começar a operar seu PDV, cardápio digital e mesas.
            </p>
            <Button
              type="button"
              className="w-full h-14 bg-[#70E000] hover:bg-[#9EF01A] text-black font-extrabold text-lg rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
              onClick={() => router.push(demoDashboardPath)}
            >
              <PlayCircle size={20} className="mr-2" />
              Acessar Meu Sistema MIAR
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen min-h-screen max-h-screen overflow-hidden flex flex-col items-center justify-center bg-black px-3 sm:px-6 py-2">
      {/* Light Emerald / Green Shader Background */}
      <div className="absolute inset-0 z-0 bg-black pointer-events-none opacity-80">
        <GhostFibers
          lineColor="#06100A"
          glowColor="#70E000"
          speed={0.2}
          scale={2}
          rotation={0}
          rotationSpeed={0.25}
          layers={4}
          waveAmplitude={0.015}
          waveFrequency={3}
          waveSpeed={0.15}
          layerSpeed={0.08}
          twist={0.1}
          twistFrequency={5}
          twistSpeed={1.2}
          lineFrequency={5}
          lineSpacing={2}
          lineSharpness={16}
          glowFalloff={10}
          glowIntensity={1.6}
          brightness={2}
          blueBoost={1.25}
          vignette={0.8}
          grain={0.05}
          dpr={1}
        />
      </div>

      {/* Main Expanded Raised Container (Fits Viewport Completely) */}
      <div className="w-full max-w-5xl relative z-10 flex flex-col items-center justify-center my-auto">
        
        {/* Compact Header (MIAR AI/FOOD logo removed completely) */}
        <div className="text-center space-y-1 mb-2">
          <div className="inline-flex items-center gap-1.5 bg-[#70E000]/10 border border-[#70E000]/30 px-3 py-1 rounded-full text-[11px] font-bold text-[#70E000] shadow-md">
            <Sparkles className="h-3.5 w-3.5" /> 1 MÊS GRÁTIS DISPONÍVEL
          </div>

          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            Crie sua conta no MIAR AI/FOOD
          </h1>
          <p className="text-xs sm:text-sm text-zinc-300 max-w-xl mx-auto font-medium">
            A MIAR AI/FOOD oferece <span className="text-[#70E000] font-bold">1 mês grátis</span> e depois paga o valor do plano que escolheu.
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center justify-between w-full max-w-xl mx-auto mb-3 px-2">
          {stepTitles.map((title, i) => (
            <div key={title} className="flex items-center gap-1.5">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step > i + 1 ? "bg-[#70E000] text-black shadow-md shadow-[#70E000]/30" :
                step === i + 1 ? "bg-[#70E000] text-black ring-2 ring-[#70E000]/30 shadow-md shadow-[#70E000]/40" :
                "bg-white/10 border border-white/20 text-zinc-400"
              }`}>
                {step > i + 1 ? <Check className="h-4 w-4 stroke-[3]" /> : i + 1}
              </div>
              <span className={`text-[11px] hidden md:inline font-bold ${step === i + 1 ? "text-[#70E000]" : "text-zinc-400"}`}>
                {title}
              </span>
              {i < stepTitles.length - 1 && <div className="w-4 sm:w-8 h-0.5 bg-white/10 mx-0.5" />}
            </div>
          ))}
        </div>

        {/* Main Step Form Container (Compact & Vertically Scrollable Content if Needed) */}
        <form onSubmit={handleSubmit} className="rounded-2xl sm:rounded-3xl border border-emerald-500/20 bg-[#06190e]/90 backdrop-blur-xl p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.8)] space-y-4 w-full text-white max-h-[calc(100vh-155px)] overflow-y-auto">
          
          {/* PASSO 1: CONTA MASTER DO PROPRIETÁRIO */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-b border-emerald-500/20 pb-2">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="bg-[#70E000]/20 text-[#70E000] px-2.5 py-0.5 rounded-lg text-xs font-black">Passo 1</span> 
                  Conta Master do Proprietário
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Crie a credencial principal de administração do seu sistema MIAR.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-semibold text-zinc-200">Nome Completo *</Label>
                  <Input 
                    placeholder="Seu nome completo" 
                    value={nomeCliente} 
                    onChange={e => setNomeCliente(e.target.value)} 
                    required 
                    className="h-10 sm:h-11 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-200">E-mail Corporativo (Login Master) *</Label>
                  <Input 
                    type="email" 
                    autoComplete="email" 
                    placeholder="seu@restaurante.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required 
                    className="h-10 sm:h-11 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-200">WhatsApp / Telefone</Label>
                  <Input 
                    placeholder="(11) 99999-9999" 
                    value={telefone} 
                    onChange={e => setTelefone(e.target.value)} 
                    className="h-10 sm:h-11 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-200">Senha de Acesso *</Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"} 
                      autoComplete="new-password" 
                      placeholder="Use uma senha forte" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      required 
                      minLength={10} 
                      className="h-10 sm:h-11 rounded-xl border-white/20 bg-white/10 px-3 pr-10 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10 mt-1">
                    <div className={`h-full transition-all ${passwordStrength.className}`} style={{ width: `${passwordStrength.percent}%` }} />
                  </div>
                  <p className="text-[11px] text-zinc-400">{passwordPolicyHint}</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-200">Confirmar Senha *</Label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Digite a senha novamente"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={10}
                      className="h-10 sm:h-11 rounded-xl border-white/20 bg-white/10 px-3 pr-10 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 2: PERFIL DO ESTABELECIMENTO */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="border-b border-emerald-500/20 pb-2">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="bg-[#70E000]/20 text-[#70E000] px-2.5 py-0.5 rounded-lg text-xs font-black">Passo 2</span> 
                  Perfil do Estabelecimento
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Selecione seu segmento e os recursos operacionais que sua loja utiliza.
                </p>
              </div>

              {/* Dados Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-200">Nome Fantasia do Estabelecimento *</Label>
                  <Input 
                    placeholder="Ex: Cantina Bella Italia" 
                    value={nomeEstabelecimento} 
                    onChange={e => setNomeEstabelecimento(e.target.value)} 
                    required 
                    className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-200">CNPJ / CPF do Estabelecimento</Label>
                  <Input 
                    placeholder="00.000.000/0001-00" 
                    value={cnpj} 
                    onChange={e => setCnpj(e.target.value)} 
                    className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold text-[#70E000] flex items-center gap-1 border-b border-white/10 pb-1">
                  <MapPin className="h-3.5 w-3.5" /> Endereço da Loja
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-200">CEP</Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="00000-000" 
                        value={cep} 
                        onChange={e => fetchCep(e.target.value)} 
                        className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                      />
                      <Button type="button" onClick={() => fetchCep(cep)} className="h-10 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3">
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-zinc-200">Endereço / Logradouro</Label>
                    <Input 
                      placeholder="Rua, Avenida..." 
                      value={nomeRua} 
                      onChange={e => setNomeRua(e.target.value)} 
                      className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white placeholder:text-zinc-400 focus-visible:ring-[#70E000]" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-200">Número</Label>
                    <Input placeholder="123" value={numero} onChange={e => setNumero(e.target.value)} className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white focus-visible:ring-[#70E000]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-200">Bairro</Label>
                    <Input placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white focus-visible:ring-[#70E000]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-200">Cidade</Label>
                    <Input placeholder="Cidade" value={cidade} onChange={e => setCidade(e.target.value)} className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white focus-visible:ring-[#70E000]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-200">UF</Label>
                    <Select value={estado} onValueChange={setEstado}>
                      <SelectTrigger className="h-10 rounded-xl border-white/20 bg-white/10 px-3 text-sm text-white focus-visible:ring-[#70E000]">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {estados.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Segmento Selector */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-[#70E000] border-b border-white/10 pb-1">
                  Qual é o segmento do seu comércio?
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {segmentosComercio.map((seg) => {
                    const IconComp = seg.icon;
                    const isSelected = segmento === seg.id;
                    return (
                      <div
                        key={seg.id}
                        onClick={() => setSegmento(seg.id)}
                        className={`cursor-pointer rounded-xl p-3 border transition-all duration-300 flex items-start gap-3 ${
                          isSelected
                            ? "border-[#70E000] bg-[#70E000]/15 shadow-[0_0_15px_rgba(112,224,0,0.2)]"
                            : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${isSelected ? "bg-[#70E000] text-black" : "bg-white/10 text-white"}`}>
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-xs">{seg.title}</h4>
                          <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">{seg.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recursos & Modos de Atendimento */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-[#70E000] border-b border-white/10 pb-1">
                  Recursos & Modos de Atendimento
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Modalidades */}
                  <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Modalidades de Atendimento</h4>
                    {["Atendimento por Mesas", "Venda Direta no Balcão (PDV)", "Retirada / Takeaway", "Delivery Próprio com Taxa", "Drive-Thru", "Cardápio Digital por QR Code"].map(item => (
                      <label key={item} className="flex items-center gap-2 text-[11px] font-medium text-zinc-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={modalidades.includes(item)}
                          onChange={() => toggleItem(modalidades, setModalidades, item)}
                          className="rounded text-[#70E000] focus:ring-[#70E000] bg-black/40 border-white/30"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>

                  {/* Modelos de Cobrança */}
                  <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Modelos de Cobrança</h4>
                    {["Rodízio / Valor Fixo por Pessoa", "Self-Service por KG", "Comanda Individual por Cliente", "Couvert Artístico Automático"].map(item => (
                      <label key={item} className="flex items-center gap-2 text-[11px] font-medium text-zinc-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={cobrancas.includes(item)}
                          onChange={() => toggleItem(cobrancas, setCobrancas, item)}
                          className="rounded text-[#70E000] focus:ring-[#70E000] bg-black/40 border-white/30"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>

                  {/* Formas de Pagamento & Fiscal */}
                  <div className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Formas de Pagamento & Fiscal</h4>
                    {["PIX Automático no PDV", "Cartão de Crédito", "Cartão de Débito", "Dinheiro com Troco", "Emissão Fiscal NFC-e / SAT"].map(item => (
                      <label key={item} className="flex items-center gap-2 text-[11px] font-medium text-zinc-300 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={pagamentos.includes(item)}
                          onChange={() => toggleItem(pagamentos, setPagamentos, item)}
                          className="rounded text-[#70E000] focus:ring-[#70E000] bg-black/40 border-white/30"
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quantidade de Mesas */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 sm:p-4 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <Label className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                    🪑 Quantidade de Mesas no Salão
                  </Label>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    Criará automaticamente <span className="font-bold text-[#70E000]">{quantidadeMesas} mesas</span> com QR Codes para impressão no seu Gestor.
                  </p>
                </div>
                <Input 
                  type="number" 
                  min={1} 
                  max={100} 
                  value={quantidadeMesas} 
                  onChange={e => setQuantidadeMesas(parseInt(e.target.value) || 1)} 
                  className="w-20 h-10 text-center text-base font-bold bg-black/60 border-[#70E000]/40 text-[#70E000] shrink-0" 
                />
              </div>
            </div>
          )}

          {/* PASSO 3: CARDÁPIO PRÉ-CATALOGADO (OPCIONAL) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border-b border-emerald-500/20 pb-2">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="bg-[#70E000]/20 text-[#70E000] px-2.5 py-0.5 rounded-lg text-xs font-black">Passo 3</span> 
                  Cardápio Pré-catalogado
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Cada segmento possui um cardápio padrão com itens sugeridos prontos para serem usados.
                </p>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Etapa Opcional:</span> Você pode pular a criação do cardápio padrão agora e cadastrar seus pratos mais tarde se preferir.
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-white">
                  Itens sugeridos para o seu segmento (<span className="text-[#70E000] uppercase font-mono">{segmento}</span>):
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(defaultPreCatalog[segmento] || defaultPreCatalog.restaurante).map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
                      <div>
                        <h4 className="font-bold text-white text-xs">{item.name}</h4>
                        <span className="text-[11px] text-zinc-400">{item.category}</span>
                      </div>
                      <span className="text-xs font-extrabold text-[#70E000]">R$ {item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PASSO 4: TERMOS E PRIVACIDADE */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="border-b border-emerald-500/20 pb-2">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="bg-[#70E000]/20 text-[#70E000] px-2.5 py-0.5 rounded-lg text-xs font-black">Passo 4</span> 
                  Termos de Uso e LGPD
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Revise os termos de uso e política de segurança dos dados.
                </p>
              </div>

              <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Para continuar a utilização do sistema MIAR AI/FOOD, você concorda com nossos termos de licença, privacidade e tratamento seguro de dados da empresa e clientes conforme a LGPD.
                </p>
                <Badge variant={legalDecision === "accepted" ? "default" : "outline"} className="bg-[#70E000] text-black font-bold">
                  {legalDecision === "accepted" ? "Termos Aceitos" : "Aguardando Leitura"}
                </Badge>
                <div>
                  <Button type="button" variant="outline" className="h-10 text-xs border-white/20 text-white hover:bg-white/10" onClick={() => setLegalModalOpen(true)}>
                    Reabrir Documento de Termos Legal
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PASSO 5: CONFIRMAÇÃO & ATIVAÇÃO */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="border-b border-emerald-500/20 pb-2">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="bg-[#70E000]/20 text-[#70E000] px-2.5 py-0.5 rounded-lg text-xs font-black">Passo 5</span> 
                  Ativação de 1 Mês Grátis
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Revise os dados antes de finalizar o seu cadastro no MIAR AI/FOOD.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <div>
                  <h4 className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Responsável Master</h4>
                  <p className="text-sm font-bold text-white mt-0.5">{nomeCliente}</p>
                  <p className="text-xs text-zinc-300">{email}</p>
                  <p className="text-xs text-zinc-300">{telefone}</p>
                </div>

                <div>
                  <h4 className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider">Estabelecimento</h4>
                  <p className="text-sm font-bold text-white mt-0.5">{nomeEstabelecimento}</p>
                  <p className="text-xs text-zinc-300">{cidade} - {estado}</p>
                  <p className="text-xs text-[#70E000] font-bold mt-0.5">{quantidadeMesas} Mesas com QR Code Geradas</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/10">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="w-full sm:w-auto h-10 sm:h-11 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 px-5 font-bold text-xs"
                disabled={loading}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
              </Button>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto ml-auto">
              {step === 3 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSkipCatalog(true);
                    setStep(4);
                    setLegalModalOpen(true);
                  }}
                  className="w-full sm:w-auto h-10 text-zinc-400 hover:text-white font-bold text-xs"
                >
                  Pular Cardápio
                </Button>
              )}

              {step < 5 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="w-full sm:w-auto min-w-[140px] h-10 sm:h-11 rounded-xl bg-[#70E000] hover:bg-[#9EF01A] text-black font-extrabold text-sm shadow-[0_4px_20px_rgba(112,224,0,0.3)] transition-transform hover:scale-[1.02]"
                >
                  Próximo <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto min-w-[220px] h-11 sm:h-12 rounded-xl bg-[#70E000] hover:bg-[#9EF01A] text-black font-black text-base shadow-[0_4px_30px_rgba(112,224,0,0.4)] transition-transform hover:scale-[1.03]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 animate-spin h-4 w-4" />
                      Criando Conta...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} className="mr-2" />
                      Ativar 1 Mês Grátis
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="text-center text-[11px] text-zinc-400 pt-1">
            Já possui uma conta master?{" "}
            <Link href={selectedPlanQuery ? `/login?${selectedPlanQuery}` : "/login"} className="font-bold text-white hover:underline">
              Fazer Login
            </Link>
          </div>
        </form>
      </div>

      {/* POPUP MODAL: DADOS INCOMPLETOS */}
      <Dialog open={incompleteModalOpen} onOpenChange={setIncompleteModalOpen}>
        <DialogContent className="border border-white/20 bg-[#06190e] p-6 text-center text-white rounded-3xl max-w-md backdrop-blur-2xl shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>

          <DialogTitle className="text-2xl font-extrabold text-white mb-2">
            Dados Incompletos
          </DialogTitle>

          <DialogDescription className="text-zinc-300 text-sm leading-relaxed mb-6">
            {incompleteMessage}
          </DialogDescription>

          <Button
            type="button"
            className="w-full h-12 bg-[#70E000] hover:bg-[#9EF01A] text-black font-extrabold text-base rounded-xl shadow-lg transition-transform hover:scale-[1.02]"
            onClick={() => setIncompleteModalOpen(false)}
          >
            Entendido
          </Button>
        </DialogContent>
      </Dialog>

      {/* MODAL LEGAL: TERMOS DE USO */}
      <Dialog open={legalModalOpen} onOpenChange={setLegalModalOpen}>
        <DialogContent className="grid max-h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.75rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-emerald-500/30 bg-[#06190e] p-0 text-white shadow-2xl rounded-3xl">
          <DialogHeader className="border-b border-white/10 px-6 pb-4 pt-6 text-left">
            <DialogTitle className="font-heading text-2xl font-bold text-white">Termos de Uso, Privacidade e LGPD</DialogTitle>
            <DialogDescription className="leading-6 text-zinc-300">
              Revise os documentos legais do MIAR AI/FOOD para prosseguir com o seu cadastro.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 px-6 py-5">
            <div className="space-y-6">
              {registrationLegalDocuments.map((document) => (
                <section key={document.title} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-lg font-bold text-[#70E000]">{document.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{document.description}</p>
                </section>
              ))}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-white/5 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
              onClick={() => {
                setLegalDecision("declined");
                setLegalModalOpen(false);
              }}
            >
              Não concordo
            </Button>
            <Button
              type="button"
              className="h-11 bg-[#70E000] hover:bg-[#9EF01A] text-black font-extrabold px-6"
              onClick={() => {
                setLegalDecision("accepted");
                setLegalModalOpen(false);
                setStep(5);
              }}
            >
              Aceitar e Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function CadastroPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-8 w-8 animate-spin text-[#70E000]" /></div>}>
      <Cadastro />
    </Suspense>
  )
}
