import { useState } from 'react';
import { TrendingUp, Award, AlertCircle, ShoppingCart, Sparkles, CheckCircle2 } from 'lucide-react';

interface MenuItemBCG {
  id: string;
  name: string;
  category: string;
  salePrice: number;
  recipeCost: number;
  marginPercent: number;
  monthlySalesVolume: number;
  classification: 'estrela' | 'cavalo' | 'quebra_cabeca' | 'abacaxi';
  aiRecommendation: string;
}

export function EngenhariaCardapioPage() {
  const [activeFilter, setActiveFilter] = useState<'todos' | 'estrela' | 'cavalo' | 'quebra_cabeca' | 'abacaxi'>('todos');
  const [supplierOrderGenerated, setSupplierOrderGenerated] = useState(false);

  // Mock de Itens para Matriz BCG com Ficha Técnica
  const items: MenuItemBCG[] = [
    {
      id: '1',
      name: 'Pizza Calabresa Especial',
      category: 'Pizzas',
      salePrice: 45.0,
      recipeCost: 12.5,
      marginPercent: 72.2,
      monthlySalesVolume: 420,
      classification: 'estrela',
      aiRecommendation: 'Item campeão! Mantenha em destaque na primeira página do cardapio web e combos.'
    },
    {
      id: '2',
      name: 'Burger Smash Double',
      category: 'Hambúrgueres',
      salePrice: 34.0,
      recipeCost: 9.8,
      marginPercent: 71.1,
      monthlySalesVolume: 380,
      classification: 'estrela',
      aiRecommendation: 'Excelente margem e volume. Promova como sugestão do chef.'
    },
    {
      id: '3',
      name: 'Coca-Cola 2L',
      category: 'Bebidas',
      salePrice: 14.0,
      recipeCost: 9.5,
      marginPercent: 32.1,
      monthlySalesVolume: 610,
      classification: 'cavalo',
      aiRecommendation: 'Alto volume mas baixa margem. Crie combos com itens Estrela para elevar ticket.'
    },
    {
      id: '4',
      name: 'Petit Gâteau de Pistache',
      category: 'Sobremesas',
      salePrice: 29.0,
      recipeCost: 7.2,
      marginPercent: 75.1,
      monthlySalesVolume: 45,
      classification: 'quebra_cabeca',
      aiRecommendation: 'Alta margem mas poucos pedidos. Melhore a foto no cardápio e adicione banner.'
    },
    {
      id: '5',
      name: 'Salada Fit Tropical',
      category: 'Saladas',
      salePrice: 22.0,
      recipeCost: 15.0,
      marginPercent: 31.8,
      monthlySalesVolume: 28,
      classification: 'abacaxi',
      aiRecommendation: 'Baixa margem e baixo volume. Considere reformular ingredientes ou substituir.'
    }
  ];

  const filteredItems = activeFilter === 'todos' ? items : items.filter(i => i.classification === activeFilter);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            📊 Engenharia de Cardápio & Matriz BCG
          </span>
          <h1 className="mt-1 text-2xl font-bold text-slate-100">Rentabilidade de Pratos & Previsão IA</h1>
          <p className="text-sm text-slate-400">Compare o preço de venda com o custo real da ficha técnica para maximizar seus lucros.</p>
        </div>
      </div>

      {/* Alerta de Previsão de Compras IA */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 backdrop-blur">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-amber-500/20 p-3 text-amber-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-300">Alerta de Previsão de Compras IA (Fim de Semana)</h3>
            <p className="mt-1 text-sm text-slate-300">
              Com base no histórico dos últimos 3 fins de semana, a previsão de consumo de <strong>Mussarela Fatiada</strong> é de <strong>45 kg</strong>. Seu estoque atual é de apenas <strong>12 kg</strong>.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => setSupplierOrderGenerated(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
              >
                <ShoppingCart className="h-4 w-4" />
                {supplierOrderGenerated ? 'Pedido Gerado ✅' : 'Gerar Pedido Automático de 35 kg ao Fornecedor'}
              </button>
              {supplierOrderGenerated && (
                <span className="text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="inline h-4 w-4 mr-1" /> Pedido enviado ao fornecedor via WhatsApp!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Classificação Matriz BCG */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => setActiveFilter('estrela')}
          className={`cursor-pointer rounded-2xl border p-4 transition ${activeFilter === 'estrela' ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">⭐</span>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400">Estrelas</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Alta Margem • Alto Volume</p>
          <p className="mt-1 text-xl font-bold text-slate-100">2 Produtos</p>
        </div>

        <div
          onClick={() => setActiveFilter('cavalo')}
          className={`cursor-pointer rounded-2xl border p-4 transition ${activeFilter === 'cavalo' ? 'border-blue-500 bg-blue-500/10' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">🐎</span>
            <span className="rounded-full bg-blue-500/20 px-2.5 py-1 text-xs font-bold text-blue-400">Cavalos de Carga</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Baixa Margem • Alto Volume</p>
          <p className="mt-1 text-xl font-bold text-slate-100">1 Produto</p>
        </div>

        <div
          onClick={() => setActiveFilter('quebra_cabeca')}
          className={`cursor-pointer rounded-2xl border p-4 transition ${activeFilter === 'quebra_cabeca' ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">🧩</span>
            <span className="rounded-full bg-purple-500/20 px-2.5 py-1 text-xs font-bold text-purple-400">Quebra-Cabeça</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Alta Margem • Baixo Volume</p>
          <p className="mt-1 text-xl font-bold text-slate-100">1 Produto</p>
        </div>

        <div
          onClick={() => setActiveFilter('abacaxi')}
          className={`cursor-pointer rounded-2xl border p-4 transition ${activeFilter === 'abacaxi' ? 'border-red-500 bg-red-500/10' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">🍍</span>
            <span className="rounded-full bg-red-500/20 px-2.5 py-1 text-xs font-bold text-red-400">Abacaxis</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">Baixa Margem • Baixo Volume</p>
          <p className="mt-1 text-xl font-bold text-slate-100">1 Produto</p>
        </div>
      </div>

      {/* Tabela de Engenharia de Cardápio */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Análise de Lucratividade por Item (Ficha Técnica)</h3>
          {activeFilter !== 'todos' && (
            <button onClick={() => setActiveFilter('todos')} className="text-xs font-medium text-emerald-400 underline">
              Ver todos os pratos
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">Prato / Produto</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-right">Custo (Ficha)</th>
                <th className="p-3 text-right">Preço Venda</th>
                <th className="p-3 text-right">Margem %</th>
                <th className="p-3 text-center">Vendas/Mês</th>
                <th className="p-3">Classificação</th>
                <th className="p-3">Recomendação IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-semibold text-slate-100">{item.name}</td>
                  <td className="p-3 text-slate-400">{item.category}</td>
                  <td className="p-3 text-right text-red-400 font-mono">R$ {item.recipeCost.toFixed(2)}</td>
                  <td className="p-3 text-right text-emerald-400 font-mono font-bold">R$ {item.salePrice.toFixed(2)}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-100">{item.marginPercent}%</td>
                  <td className="p-3 text-center font-mono">{item.monthlySalesVolume} un</td>
                  <td className="p-3">
                    {item.classification === 'estrela' && <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-400">⭐ Estrela</span>}
                    {item.classification === 'cavalo' && <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs font-bold text-blue-400">🐎 Cavalo</span>}
                    {item.classification === 'quebra_cabeca' && <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs font-bold text-purple-400">🧩 Quebra-Cabeça</span>}
                    {item.classification === 'abacaxi' && <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-bold text-red-400">🍍 Abacaxi</span>}
                  </td>
                  <td className="p-3 text-xs text-slate-400 max-w-xs">{item.aiRecommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
export default EngenhariaCardapioPage;
