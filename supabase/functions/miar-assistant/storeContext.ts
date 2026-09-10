import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Todas as consultas aqui rodam com o JWT do próprio usuário, então as
// políticas RLS do ERP já limitam as linhas ao estabelecimento dele. Nenhum
// filtro manual de tenant é aplicado de propósito: duplicar a regra no código
// criaria uma segunda fonte de verdade que pode divergir da do banco.

const DAY_MS = 24 * 60 * 60 * 1000;
const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

type SaleRow = { id: string; total: number; discount: number; payment_method: string; date: string; user_id: string };
type SaleItemRow = {
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
};
type ProductRow = {
  id: string; name: string; price: number; cost_price: number;
  stock: number; min_stock: number; category: string;
};

export interface StoreSnapshot {
  text: string;
  generatedAt: string;
}

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

/**
 * Monta um retrato compacto da operação para o system prompt. É o "R" do RAG:
 * em vez de deixar o modelo adivinhar, ele recebe números já apurados.
 */
export async function buildStoreSnapshot(supabase: SupabaseClient): Promise<StoreSnapshot> {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const since7 = new Date(now.getTime() - 7 * DAY_MS).toISOString();

  const [salesResult, productsResult, expensesResult, movementsResult] = await Promise.all([
    supabase.from('sales').select('id,total,discount,payment_method,date,user_id')
      .gte('date', since30).order('date', { ascending: false }).limit(4000),
    supabase.from('products').select('id,name,price,cost_price,stock,min_stock,category')
      .eq('deleted', false).limit(2000),
    supabase.from('expenses').select('description,amount,category,date').gte('date', since30).limit(1000),
    supabase.from('stock_movements').select('product_id,type,quantity,reason,date').gte('date', since30).limit(2000),
  ]);

  const sales = (salesResult.data ?? []) as SaleRow[];
  const products = (productsResult.data ?? []) as ProductRow[];
  const expenses = (expensesResult.data ?? []) as Array<{ description: string; amount: number; category: string; date: string }>;
  const movements = (movementsResult.data ?? []) as Array<{ product_id: string; type: string; quantity: number; reason: string; date: string }>;

  // Itens só das vendas que o RLS já liberou acima.
  const saleIds = sales.map((sale) => sale.id);
  let items: SaleItemRow[] = [];
  for (let index = 0; index < saleIds.length; index += 500) {
    const chunk = saleIds.slice(index, index + 500);
    const { data } = await supabase
      .from('sale_items')
      .select('sale_id,product_id,product_name,quantity,unit_price,cost_price,total')
      .in('sale_id', chunk);
    items = items.concat((data ?? []) as SaleItemRow[]);
  }

  const lines: string[] = [];
  const fmtDate = (value: string) => new Date(value).toLocaleDateString('pt-BR');

  // ── Faturamento ───────────────────────────────────────────────────────────
  const sales7 = sales.filter((sale) => sale.date >= since7);
  const revenue30 = sum(sales.map((sale) => sale.total));
  const revenue7 = sum(sales7.map((sale) => sale.total));
  const ticket30 = sales.length ? revenue30 / sales.length : 0;
  const ticket7 = sales7.length ? revenue7 / sales7.length : 0;

  lines.push('## Faturamento');
  lines.push(`- Últimos 30 dias: ${brl(revenue30)} em ${sales.length} vendas. Ticket médio ${brl(ticket30)}.`);
  lines.push(`- Últimos 7 dias: ${brl(revenue7)} em ${sales7.length} vendas. Ticket médio ${brl(ticket7)}.`);
  lines.push(`- Descontos concedidos em 30 dias: ${brl(sum(sales.map((sale) => sale.discount)))}.`);

  const byPayment = new Map<string, number>();
  for (const sale of sales) byPayment.set(sale.payment_method, (byPayment.get(sale.payment_method) ?? 0) + sale.total);
  if (byPayment.size) {
    const formatted = [...byPayment.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([method, total]) => `${method} ${brl(total)}`)
      .join(', ');
    lines.push(`- Por forma de pagamento (30 dias): ${formatted}.`);
  }

  // ── Horários ──────────────────────────────────────────────────────────────
  const byHour = new Map<number, { revenue: number; count: number }>();
  for (const sale of sales) {
    const hour = new Date(sale.date).getHours();
    const bucket = byHour.get(hour) ?? { revenue: 0, count: 0 };
    bucket.revenue += sale.total;
    bucket.count += 1;
    byHour.set(hour, bucket);
  }
  const bestHours = [...byHour.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  if (bestHours.length) {
    lines.push('');
    lines.push('## Melhores horários (30 dias)');
    for (const [hour, bucket] of bestHours) {
      lines.push(`- ${String(hour).padStart(2, '0')}h: ${brl(bucket.revenue)} em ${bucket.count} vendas.`);
    }
  }

  // ── Produtos, margem e giro ───────────────────────────────────────────────
  type Agg = { name: string; qty: number; revenue: number; cost: number };
  const aggregate = (rows: SaleItemRow[]) => {
    const map = new Map<string, Agg>();
    for (const item of rows) {
      const key = item.product_id ?? item.product_name;
      const bucket = map.get(key) ?? { name: item.product_name, qty: 0, revenue: 0, cost: 0 };
      bucket.qty += item.quantity;
      bucket.revenue += item.total;
      bucket.cost += item.cost_price * item.quantity;
      map.set(key, bucket);
    }
    return map;
  };

  const sales7Ids = new Set(sales7.map((sale) => sale.id));
  const agg30 = aggregate(items);
  const agg7 = aggregate(items.filter((item) => sales7Ids.has(item.sale_id)));

  const ranked30 = [...agg30.values()].sort((a, b) => b.revenue - a.revenue);
  if (ranked30.length) {
    lines.push('');
    lines.push('## Mais vendidos (30 dias)');
    for (const row of ranked30.slice(0, 10)) {
      const margin = row.revenue > 0 ? (row.revenue - row.cost) / row.revenue : 0;
      lines.push(`- ${row.name}: ${row.qty} un, ${brl(row.revenue)}, margem ${pct(margin)}.`);
    }
  }

  const ranked7 = [...agg7.values()].sort((a, b) => a.qty - b.qty);
  if (ranked7.length) {
    lines.push('');
    lines.push('## Venderam MENOS nos últimos 7 dias');
    for (const row of ranked7.slice(0, 10)) {
      lines.push(`- ${row.name}: apenas ${row.qty} un, ${brl(row.revenue)}.`);
    }
  }

  // Produtos do catálogo sem nenhuma venda no período.
  const soldNames = new Set([...agg30.values()].map((row) => row.name.toLowerCase()));
  const stagnant = products.filter((product) => !soldNames.has(product.name.toLowerCase()));
  if (stagnant.length) {
    lines.push('');
    lines.push(`## Sem nenhuma venda em 30 dias (${stagnant.length} itens)`);
    for (const product of stagnant.slice(0, 15)) {
      lines.push(`- ${product.name} (estoque ${product.stock}, preço ${brl(product.price)}).`);
    }
  }

  // ── Margem baixa ──────────────────────────────────────────────────────────
  const withMargin = products
    .filter((product) => product.price > 0 && product.cost_price > 0)
    .map((product) => ({ ...product, margin: (product.price - product.cost_price) / product.price }))
    .sort((a, b) => a.margin - b.margin);
  if (withMargin.length) {
    lines.push('');
    lines.push('## Menores margens do catálogo');
    for (const product of withMargin.slice(0, 10)) {
      lines.push(`- ${product.name}: preço ${brl(product.price)}, custo ${brl(product.cost_price)}, margem ${pct(product.margin)}.`);
    }
  }

  // ── Estoque e compras ─────────────────────────────────────────────────────
  const lowStock = products.filter((product) => product.stock <= product.min_stock);
  lines.push('');
  lines.push(`## Estoque (${products.length} produtos ativos)`);
  if (lowStock.length) {
    lines.push(`- ${lowStock.length} produto(s) no ou abaixo do mínimo:`);
    for (const product of lowStock.slice(0, 20)) {
      const velocity = (agg30.get(product.id)?.qty ?? 0) / 30;
      const daysLeft = velocity > 0 ? (product.stock / velocity).toFixed(1) : 'sem giro';
      lines.push(`- ${product.name}: estoque ${product.stock}, mínimo ${product.min_stock}, saída ${velocity.toFixed(2)} un/dia, cobertura ${daysLeft} dias.`);
    }
  } else {
    lines.push('- Nenhum produto abaixo do estoque mínimo.');
  }
  const stockValue = sum(products.map((product) => product.stock * product.cost_price));
  lines.push(`- Capital parado em estoque (a custo): ${brl(stockValue)}.`);

  // ── Perdas ────────────────────────────────────────────────────────────────
  const losses = movements.filter((movement) => /perda|quebra|desperd|vencid|avaria/i.test(`${movement.type} ${movement.reason}`));
  if (losses.length) {
    const productById = new Map(products.map((product) => [product.id, product]));
    const lossValue = sum(losses.map((movement) => Math.abs(movement.quantity) * (productById.get(movement.product_id)?.cost_price ?? 0)));
    lines.push('');
    lines.push('## Perdas e desperdício (30 dias)');
    lines.push(`- ${losses.length} lançamento(s), custo estimado ${brl(lossValue)}.`);
    const byReason = new Map<string, number>();
    for (const movement of losses) {
      const reason = movement.reason || movement.type;
      byReason.set(reason, (byReason.get(reason) ?? 0) + Math.abs(movement.quantity));
    }
    for (const [reason, qty] of [...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      lines.push(`- ${reason}: ${qty} un.`);
    }
  }

  // ── Despesas ──────────────────────────────────────────────────────────────
  if (expenses.length) {
    const totalExpenses = sum(expenses.map((expense) => expense.amount));
    lines.push('');
    lines.push('## Despesas (30 dias)');
    lines.push(`- Total ${brl(totalExpenses)}. Resultado bruto aproximado: ${brl(revenue30 - totalExpenses)}.`);
    const byCategory = new Map<string, number>();
    for (const expense of expenses) {
      const category = expense.category || 'sem categoria';
      byCategory.set(category, (byCategory.get(category) ?? 0) + expense.amount);
    }
    for (const [category, total] of [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      lines.push(`- ${category}: ${brl(total)}.`);
    }
  }

  // ── Equipe ────────────────────────────────────────────────────────────────
  const byOperator = new Map<string, { revenue: number; count: number }>();
  for (const sale of sales) {
    const bucket = byOperator.get(sale.user_id) ?? { revenue: 0, count: 0 };
    bucket.revenue += sale.total;
    bucket.count += 1;
    byOperator.set(sale.user_id, bucket);
  }
  if (byOperator.size > 1) {
    lines.push('');
    lines.push('## Vendas por operador (30 dias)');
    for (const [userId, bucket] of [...byOperator.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10)) {
      lines.push(`- Operador ${userId.slice(0, 8)}: ${brl(bucket.revenue)} em ${bucket.count} vendas, ticket ${brl(bucket.revenue / bucket.count)}.`);
    }
  }

  if (sales.length === 0 && products.length === 0) {
    lines.push('');
    lines.push('> Ainda não há vendas nem produtos cadastrados neste estabelecimento.');
  }

  return {
    text: lines.join('\n'),
    generatedAt: now.toISOString(),
  };
}
