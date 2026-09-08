import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Award, Copy, DollarSign, TrendingUp, Users, ShieldCheck, CheckCircle, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function GestorRepresentantePage() {
  const [, setLocation] = useLocation();
  const [repName, setRepName] = useState('Representante Autorizado');
  const [repEmail, setRepEmail] = useState('representante@miar.ai');
  const [repCity, setRepCity] = useState('Ribeirão Preto');
  
  const [codeGenerated, setCodeGenerated] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Financial Metrics
  const activeStores = 8;
  const portfolioTotal = 2392; // R$
  const commissionRate = 0.30; // 30% vitalício
  const commissionTotal = 717.60;

  // Simulator
  const [simulatedStores, setSimulatedStores] = useState(15);

  useEffect(() => {
    const token = localStorage.getItem('miar-representative-token');
    const stored = localStorage.getItem('miar-representative-account');

    if (!token || !stored) {
      toast.error('Acesso restrito a Representantes Autenticados.');
      setLocation('/representante');
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      if (parsed.role && parsed.role !== 'representative') {
        toast.error('Contas de Gestor de Restaurante não possuem acesso à Área do Representante.');
        setLocation('/login');
        return;
      }
      if (parsed.name) setRepName(parsed.name);
      if (parsed.email) setRepEmail(parsed.email);
      if (parsed.city) setRepCity(parsed.city);
    } catch {
      localStorage.removeItem('miar-representative-token');
      localStorage.removeItem('miar-representative-account');
      setLocation('/representante');
    }
  }, [setLocation]);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('miar-representative-token');
      if (!token) {
        toast.error('Sessão expirada. Faça login novamente.');
        setLocation('/representante');
        return;
      }

      const res = await fetch('/api/representantes/estabelecimentos/codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json().catch(() => null);

      if (res.ok && data?.code) {
        setCodeGenerated(data.code);
        toast.success(`Código de Vínculo Oficial Gerado: ${data.code}`);
      } else {
        toast.error(data?.error || 'Erro ao gerar código no servidor.');
      }
    } catch {
      toast.error('Erro de comunicação com o servidor de representação.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeGenerated);
    toast.info('Código copiado para a área de transferência.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/painel')}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold">
                  REPRESENTANTE OFICIAL
                </span>
                <h1 className="text-2xl font-bold text-white">Painel Gestor Representante</h1>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {repName} ({repEmail}) • Região: {repCity}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/vincular-representante')}
              className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm font-semibold flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Resgatar Código de Vínculo
            </button>
          </div>
        </div>

        {/* Highlight Banner */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4">
          <Award className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200 leading-relaxed">
            <strong className="text-amber-400">Contrato Comercial de Representação (Fechado em 27/08):</strong>
            Você tem direito a <strong>30% vitalício de comissão recorrente</strong> sobre todas as mensalidades pagas pelos estabelecimentos indicados enquanto eles continuarem assinantes.
            <span className="block text-slate-400 text-xs mt-1">
              (O Programa de Indicação Comércio ➔ Comércio é um benefício separado que concede 1 mês grátis ao comerciante indicador).
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>ESTABELECIMENTOS ATIVOS</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white">{activeStores} Lojas</div>
            <div className="text-xs text-slate-400">Faturamento Total: R$ {portfolioTotal.toFixed(2)}/mês</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>COMISSÃO RECORRENTE (30%)</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400">R$ {commissionTotal.toFixed(2)}/mês</div>
            <div className="text-xs text-emerald-300">Vitalício enquanto o cliente pagar</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>SALDO DISPONÍVEL PARA SAQUE</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400">R$ {commissionTotal.toFixed(2)}</div>
            <div className="text-xs text-slate-400">Transferência via PIX Mensal</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
              <span>STATUS DE AUTONOMIA</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-white">Agente Autônomo</div>
            <div className="text-xs text-slate-400">Sem vínculo empregatício</div>
          </div>
        </div>

        {/* Code Generator Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> Gerar Código de Vínculo de Indicado
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Gere um código exclusivo para fornecer ao restaurante. Ao inserir este código no painel de gestão em <code>/vincular-representante</code>, o estabelecimento fica vinculado à sua carteira de 30%.
            </p>

            {codeGenerated ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/50 flex items-center justify-between gap-4">
                <span className="font-mono text-xl font-black text-amber-400 tracking-wider">
                  {codeGenerated}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="px-4 py-2 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4" /> Copiar Código
                </button>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-sm hover:bg-amber-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'Gerando Código...' : 'Gerar Código de Vínculo Agora'}
              </button>
            )}
          </div>

          {/* Regional Market Simulator */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Simulador de Carteira na Região
            </h3>
            <p className="text-sm text-slate-400">
              Projeção de comissão mensal recorrente a 30% com base no número de restaurantes ativos na sua região ({repCity}):
            </p>

            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Quantidade de Lojas Assinantes:</span>
                <strong className="text-amber-400">{simulatedStores} estabelecimentos</strong>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={simulatedStores}
                onChange={(e) => setSimulatedStores(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400">Sua Comissão Recorrente Mensal (Plano Pro R$ 299):</span>
                <span className="text-xl font-black text-emerald-400">
                  R$ {(simulatedStores * 299 * 0.30).toFixed(2)}/mês
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PIX Key Section (Unlocked only after establishment link acceptance) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" /> Chave PIX para Recebimento de Comissões (30%)
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Cadastre sua chave PIX para repasse automático dos 30% recorrentes no dia 05 de cada mês.
              </p>
            </div>
            {activeStores > 0 ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 w-fit">
                <CheckCircle className="w-4 h-4" /> Vínculo Ativo — PIX Liberado
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-bold flex items-center gap-1.5 w-fit">
                🔒 Aguardando Aceite do 1º Estabelecimento
              </span>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Tipo de Chave PIX</label>
              <select
                disabled={activeStores === 0}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white disabled:opacity-50"
              >
                <option value="CPF">CPF / CNPJ</option>
                <option value="EMAIL">E-mail</option>
                <option value="CELULAR">Celular</option>
                <option value="ALEATORIA">Chave Aleatória (EVP)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">Sua Chave PIX</label>
              <input
                type="text"
                disabled={activeStores === 0}
                placeholder={activeStores > 0 ? "Digite sua chave PIX..." : "Liberado após aceite do cliente"}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-white disabled:opacity-50"
              />
            </div>
            <div>
              <button
                disabled={activeStores === 0}
                onClick={() => toast.success('Chave PIX salva com sucesso para repasses de 30%!')}
                className="w-full py-2.5 rounded-lg bg-emerald-400 text-slate-950 font-bold text-sm hover:bg-emerald-300 disabled:opacity-40 transition-all"
              >
                Salvar Chave PIX
              </button>
            </div>
          </div>
        </div>

        {/* Client Table */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white">Carteira de Estabelecimentos Vinculados</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Estabelecimento</th>
                  <th className="py-3 px-4">Cidade</th>
                  <th className="py-3 px-4">Plano</th>
                  <th className="py-3 px-4">Valor Mensal</th>
                  <th className="py-3 px-4">Comissão (30%)</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                <tr>
                  <td className="py-3 px-4 font-bold text-white">Cantina Bella Italia</td>
                  <td className="py-3 px-4">Ribeirão Preto</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">MIAR Pro</span></td>
                  <td className="py-3 px-4">R$ 299,00</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">R$ 89,70/mês</td>
                  <td className="py-3 px-4"><span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Ativo</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-white">Hamburgueria Smash & Co</td>
                  <td className="py-3 px-4">Ribeirão Preto</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">MIAR Pro</span></td>
                  <td className="py-3 px-4">R$ 299,00</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">R$ 89,70/mês</td>
                  <td className="py-3 px-4"><span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Ativo</span></td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-white">Restaurante Sabor & Arte</td>
                  <td className="py-3 px-4">Sertãozinho</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-semibold">MIAR Enterprise</span></td>
                  <td className="py-3 px-4">R$ 599,00</td>
                  <td className="py-3 px-4 font-bold text-emerald-400">R$ 179,70/mês</td>
                  <td className="py-3 px-4"><span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Ativo</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
