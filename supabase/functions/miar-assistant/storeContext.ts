import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { getRedisConfig, runRedisPipeline } from '../_shared/rateLimit.ts';

// O retrato é apurado no Postgres (get_miar_store_snapshot) e chega pronto,
// em poucos KB. A função roda com o JWT do usuário, então o RLS do ERP continua
// sendo a barreira entre estabelecimentos.
//
// Conversa costuma vir em rajada e os números de alguns minutos atrás ainda
// servem. O cache evita refazer as somas a cada pergunta e é descartado quando
// uma ação confirmada muda os dados.
const SNAPSHOT_TTL_SECONDS = 300;
const snapshotKey = (userId: string) => `miar-snapshot:v1:${userId}`;

const brl = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

type Row = Record<string, unknown>;
const num = (value: unknown) => Number(value ?? 0) || 0;
const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);
const obj = (value: unknown) => (value && typeof value === 'object' ? (value as Row) : {});

export interface StoreSnapshot {
  text: string;
  generatedAt: string;
}

/** Transforma o JSON de get_miar_store_snapshot no texto do system prompt. */
export function formatSnapshot(data: Row): string {
  const sales = obj(data.sales);
  const lines: string[] = [];

  // ── Faturamento ───────────────────────────────────────────────────────────
  const revenue30 = num(sales.revenue30);
  const count30 = num(sales.count30);
  const revenue7 = num(sales.revenue7);
  const count7 = num(sales.count7);

  lines.push('## Faturamento');
  lines.push(`- Últimos 30 dias: ${brl(revenue30)} em ${count30} vendas. Ticket médio ${brl(count30 ? revenue30 / count30 : 0)}.`);
  lines.push(`- Últimos 7 dias: ${brl(revenue7)} em ${count7} vendas. Ticket médio ${brl(count7 ? revenue7 / count7 : 0)}.`);
  lines.push(`- Descontos concedidos em 30 dias: ${brl(num(sales.discount30))}.`);

  const byPayment = rows(data.by_payment);
  if (byPayment.length) {
    lines.push(`- Por forma de pagamento (30 dias): ${byPayment.map((row) => `${row.method} ${brl(num(row.total))}`).join(', ')}.`);
  }

  // ── Horários ──────────────────────────────────────────────────────────────
  const bestHours = rows(data.best_hours);
  if (bestHours.length) {
    lines.push('');
    lines.push('## Melhores horários (30 dias)');
    for (const row of bestHours) {
      lines.push(`- ${String(num(row.hour)).padStart(2, '0')}h: ${brl(num(row.revenue))} em ${num(row.count)} vendas.`);
    }
  }

  // ── Produtos, margem e giro ───────────────────────────────────────────────
  const top = rows(data.top_products);
  if (top.length) {
    lines.push('');
    lines.push('## Mais vendidos (30 dias)');
    for (const row of top) {
      const revenue = num(row.revenue);
      const margin = revenue > 0 ? (revenue - num(row.cost)) / revenue : 0;
      lines.push(`- ${row.name}: ${num(row.qty)} un, ${brl(revenue)}, margem ${pct(margin)}.`);
    }
  }

  const least = rows(data.least_sold7);
  if (least.length) {
    lines.push('');
    lines.push('## Venderam MENOS nos últimos 7 dias');
    for (const row of least) {
      lines.push(`- ${row.name}: apenas ${num(row.qty)} un, ${brl(num(row.revenue))}.`);
    }
  }

  const stagnant = rows(data.stagnant);
  if (stagnant.length) {
    lines.push('');
    lines.push(`## Sem nenhuma venda em 30 dias (${num(data.stagnant_count)} itens)`);
    for (const row of stagnant) {
      lines.push(`- ${row.name} (estoque ${num(row.stock)}, preço ${brl(num(row.price))}).`);
    }
  }

  // ── Margem baixa ──────────────────────────────────────────────────────────
  const lowMargin = rows(data.low_margin);
  if (lowMargin.length) {
    lines.push('');
    lines.push('## Menores margens do catálogo');
    for (const row of lowMargin) {
      lines.push(`- ${row.name}: preço ${brl(num(row.price))}, custo ${brl(num(row.cost_price))}, margem ${pct(num(row.margin))}.`);
    }
  }

  // ── Estoque e compras ─────────────────────────────────────────────────────
  const lowStock = rows(data.low_stock);
  lines.push('');
  lines.push(`## Estoque (${num(data.product_count)} produtos ativos)`);
  if (lowStock.length) {
    lines.push(`- ${num(data.low_stock_count)} produto(s) no ou abaixo do mínimo:`);
    for (const row of lowStock) {
      const velocity = num(row.qty30) / 30;
      const daysLeft = velocity > 0 ? (num(row.stock) / velocity).toFixed(1) : 'sem giro';
      lines.push(`- ${row.name}: estoque ${num(row.stock)}, mínimo ${num(row.min_stock)}, saída ${velocity.toFixed(2)} un/dia, cobertura ${daysLeft} dias.`);
    }
  } else {
    lines.push('- Nenhum produto abaixo do estoque mínimo.');
  }
  lines.push(`- Capital parado em estoque (a custo): ${brl(num(data.stock_value))}.`);

  // ── Perdas ────────────────────────────────────────────────────────────────
  const losses = obj(data.losses);
  if (num(losses.count) > 0) {
    lines.push('');
    lines.push('## Perdas e desperdício (30 dias)');
    lines.push(`- ${num(losses.count)} lançamento(s), custo estimado ${brl(num(losses.value))}.`);
    for (const row of rows(losses.by_reason)) {
      lines.push(`- ${row.reason}: ${num(row.qty)} un.`);
    }
  }

  // ── Despesas ──────────────────────────────────────────────────────────────
  const expenses = obj(data.expenses);
  const byCategory = rows(expenses.by_category);
  if (byCategory.length) {
    const totalExpenses = num(expenses.total);
    lines.push('');
    lines.push('## Despesas (30 dias)');
    lines.push(`- Total ${brl(totalExpenses)}. Resultado bruto aproximado: ${brl(revenue30 - totalExpenses)}.`);
    for (const row of byCategory) {
      lines.push(`- ${row.category}: ${brl(num(row.total))}.`);
    }
  }

  // ── Equipe ────────────────────────────────────────────────────────────────
  const operators = rows(data.operators);
  if (operators.length > 1) {
    lines.push('');
    lines.push('## Vendas por operador (30 dias)');
    for (const row of operators) {
      const count = num(row.count);
      lines.push(`- ${row.name}: ${brl(num(row.revenue))} em ${count} vendas, ticket ${brl(count ? num(row.revenue) / count : 0)}.`);
    }
  }

  // ── Promoções ─────────────────────────────────────────────────────────────
  const promotions = rows(data.promotions);
  if (promotions.length) {
    lines.push('');
    lines.push('## Promoções ativas (aparecem nas TVs)');
    for (const row of promotions) {
      const value = num(row.discount_value);
      const label = row.discount_type === 'percent'
        ? `${value}% de desconto`
        : row.discount_type === 'fixed_price' ? `por ${brl(value)}` : `${brl(value)} de desconto`;
      lines.push(`- ${row.title || row.product_name} (${row.product_name}): ${label}${row.ends_at ? `, até ${row.ends_at}` : ''}.`);
    }
  }

  if (count30 === 0 && num(data.product_count) === 0) {
    lines.push('');
    lines.push('> Ainda não há vendas nem produtos cadastrados neste estabelecimento.');
  }

  return lines.join('\n');
}

async function readCachedSnapshot(userId: string): Promise<StoreSnapshot | null> {
  const config = getRedisConfig();
  if (!config) return null;
  try {
    const [reply] = await runRedisPipeline(config, [['GET', snapshotKey(userId)]]);
    return typeof reply?.result === 'string' ? JSON.parse(reply.result) as StoreSnapshot : null;
  } catch {
    return null;
  }
}

async function writeCachedSnapshot(userId: string, snapshot: StoreSnapshot) {
  const config = getRedisConfig();
  if (!config) return;
  try {
    await runRedisPipeline(config, [['SET', snapshotKey(userId), JSON.stringify(snapshot), 'EX', SNAPSHOT_TTL_SECONDS]]);
  } catch {
    // Cache é otimização: sem Redis, a próxima pergunta só recalcula.
  }
}

/** Descarta o retrato em cache depois de uma ação que altera os dados. */
export async function invalidateStoreSnapshot(userId: string) {
  const config = getRedisConfig();
  if (!config) return;
  try {
    await runRedisPipeline(config, [['DEL', snapshotKey(userId)]]);
  } catch {
    // Na pior hipótese o retrato fica até 5 minutos desatualizado.
  }
}

export async function buildStoreSnapshot(supabase: SupabaseClient, userId: string): Promise<StoreSnapshot> {
  const cached = await readCachedSnapshot(userId);
  if (cached) return cached;

  const { data, error } = await supabase.rpc('get_miar_store_snapshot');
  if (error) throw new Error(`Retrato da loja indisponível: ${error.message}`);

  const payload = obj(data);
  const snapshot = {
    text: formatSnapshot(payload),
    generatedAt: String(payload.generated_at ?? new Date().toISOString()),
  };
  await writeCachedSnapshot(userId, snapshot);
  return snapshot;
}
