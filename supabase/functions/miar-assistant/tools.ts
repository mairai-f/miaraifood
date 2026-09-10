import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Contrato de ferramentas da MIAR.
//
// Regra central: ferramentas de LEITURA rodam na hora; ferramentas de ESCRITA
// nunca executam durante a conversa. Elas viram uma proposta pendente que só
// roda depois que uma pessoa com a permissão 'ai.miar.execute' confirma.
// Tudo executa com o JWT do usuário, então o RLS ainda é a última barreira:
// mesmo que o modelo invente um id de outra empresa, o banco recusa.

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mutates: boolean;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'buscar_produto',
    description:
      'Procura produtos do estabelecimento pelo nome ou parte do nome. Use SEMPRE antes de propor criar um produto, para não duplicar item já cadastrado.',
    mutates: false,
    parameters: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'Nome ou parte do nome do produto.' },
      },
      required: ['termo'],
    },
  },
  {
    name: 'consultar_vendas_produto',
    description:
      'Retorna quanto um produto vendeu nos últimos N dias, com receita e margem. Use para embasar decisão de preço ou promoção.',
    mutates: false,
    parameters: {
      type: 'object',
      properties: {
        produto: { type: 'string', description: 'Nome do produto.' },
        dias: { type: 'integer', description: 'Janela em dias (padrão 30).' },
      },
      required: ['produto'],
    },
  },
  {
    name: 'criar_produto',
    description:
      'Propõe cadastrar um novo produto. Só proponha depois de conferir com buscar_produto que ele ainda não existe.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        preco: { type: 'number', description: 'Preço de venda em reais.' },
        custo: { type: 'number', description: 'Preço de custo em reais.' },
        estoque: { type: 'integer', description: 'Estoque inicial.' },
        estoque_minimo: { type: 'integer' },
        categoria: { type: 'string' },
      },
      required: ['nome', 'preco'],
    },
  },
  {
    name: 'alterar_preco',
    description: 'Propõe alterar o preço de venda de um produto existente.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        produto: { type: 'string', description: 'Nome exato do produto.' },
        novo_preco: { type: 'number' },
        motivo: { type: 'string', description: 'Por que o preço deve mudar.' },
      },
      required: ['produto', 'novo_preco'],
    },
  },
  {
    name: 'ajustar_estoque',
    description: 'Propõe uma entrada ou baixa de estoque, incluindo registro de perda ou desperdício.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        produto: { type: 'string' },
        tipo: { type: 'string', enum: ['entrada', 'saida'] },
        quantidade: { type: 'integer' },
        motivo: { type: 'string' },
      },
      required: ['produto', 'tipo', 'quantidade'],
    },
  },
  {
    name: 'criar_pedido_compra',
    description: 'Propõe um pedido de compra para repor estoque, com fornecedor e itens.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        fornecedor: { type: 'string' },
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              produto: { type: 'string' },
              quantidade: { type: 'number' },
              custo_unitario: { type: 'number' },
            },
            required: ['produto', 'quantidade'],
          },
        },
        observacao: { type: 'string' },
      },
      required: ['fornecedor', 'itens'],
    },
  },
];

export const readOnlyToolNames = new Set(
  toolDefinitions.filter((tool) => !tool.mutates).map((tool) => tool.name),
);
export const mutatingToolNames = new Set(
  toolDefinitions.filter((tool) => tool.mutates).map((tool) => tool.name),
);

const brl = (value: number) => `R$ ${Number(value).toFixed(2).replace('.', ',')}`;

async function findProduct(supabase: SupabaseClient, term: string) {
  const { data } = await supabase
    .from('products')
    .select('id,name,price,cost_price,stock,min_stock,category')
    .eq('deleted', false)
    .ilike('name', `%${term}%`)
    .limit(10);
  return data ?? [];
}

/** Executa uma ferramenta de leitura durante a conversa. */
export async function runReadTool(
  supabase: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (name === 'buscar_produto') {
    const term = String(args.termo ?? '').trim();
    if (!term) return 'Termo de busca vazio.';
    const rows = await findProduct(supabase, term);
    if (!rows.length) return `Nenhum produto encontrado com "${term}". Ele ainda NÃO está cadastrado.`;
    return rows
      .map((row) =>
        `- ${row.name}: preço ${brl(row.price)}, custo ${brl(row.cost_price)}, estoque ${row.stock}, mínimo ${row.min_stock}, categoria ${row.category || 'sem categoria'}.`)
      .join('\n');
  }

  if (name === 'consultar_vendas_produto') {
    const term = String(args.produto ?? '').trim();
    const days = Math.min(Math.max(Number(args.dias ?? 30) || 30, 1), 365);
    if (!term) return 'Informe o produto.';
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: sales } = await supabase.from('sales').select('id').gte('date', since).limit(4000);
    const saleIds = (sales ?? []).map((sale: { id: string }) => sale.id);
    if (!saleIds.length) return `Nenhuma venda registrada nos últimos ${days} dias.`;

    let quantity = 0;
    let revenue = 0;
    let cost = 0;
    for (let index = 0; index < saleIds.length; index += 500) {
      const { data } = await supabase
        .from('sale_items')
        .select('quantity,total,cost_price,product_name')
        .in('sale_id', saleIds.slice(index, index + 500))
        .ilike('product_name', `%${term}%`);
      for (const item of (data ?? []) as Array<{ quantity: number; total: number; cost_price: number }>) {
        quantity += item.quantity;
        revenue += item.total;
        cost += item.cost_price * item.quantity;
      }
    }
    if (quantity === 0) return `"${term}" não teve nenhuma venda nos últimos ${days} dias.`;
    const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
    return `"${term}" nos últimos ${days} dias: ${quantity} unidades, receita ${brl(revenue)}, custo ${brl(cost)}, margem ${margin.toFixed(1)}%.`;
  }

  return `Ferramenta de leitura desconhecida: ${name}`;
}

/** Texto curto mostrado ao usuário no cartão de confirmação. */
export function describeAction(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'criar_produto':
      return `Cadastrar "${args.nome}" a ${brl(Number(args.preco))}` +
        (args.custo ? `, custo ${brl(Number(args.custo))}` : '') +
        (args.estoque ? `, estoque inicial ${args.estoque}` : '') + '.';
    case 'alterar_preco':
      return `Alterar o preço de "${args.produto}" para ${brl(Number(args.novo_preco))}` +
        (args.motivo ? ` (${args.motivo})` : '') + '.';
    case 'ajustar_estoque':
      return `Lançar ${args.tipo} de ${args.quantidade} un de "${args.produto}"` +
        (args.motivo ? ` (${args.motivo})` : '') + '.';
    case 'criar_pedido_compra': {
      const items = Array.isArray(args.itens) ? args.itens.length : 0;
      return `Criar pedido de compra para "${args.fornecedor}" com ${items} item(ns).`;
    }
    default:
      return `Executar ${name}.`;
  }
}

/**
 * Executa uma ação já confirmada por uma pessoa. Roda com o JWT do usuário,
 * então toda escrita ainda passa pelas policies do ERP.
 */
export async function runConfirmedAction(
  supabase: SupabaseClient,
  ownerUserId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resolveOne = async (term: string) => {
    const rows = await findProduct(supabase, term);
    const exact = rows.filter((row) => row.name.toLowerCase() === term.toLowerCase());
    const candidates = exact.length ? exact : rows;
    if (!candidates.length) throw new Error(`Produto "${term}" não encontrado.`);
    if (candidates.length > 1) {
      throw new Error(
        `"${term}" corresponde a ${candidates.length} produtos (${candidates.map((row) => row.name).join(', ')}). Seja mais específico.`,
      );
    }
    return candidates[0];
  };

  if (name === 'criar_produto') {
    const productName = String(args.nome ?? '').trim();
    if (!productName) throw new Error('Nome do produto é obrigatório.');
    const existing = await findProduct(supabase, productName);
    if (existing.some((row) => row.name.toLowerCase() === productName.toLowerCase())) {
      throw new Error(`"${productName}" já está cadastrado.`);
    }
    const { data, error } = await supabase
      .from('products')
      .insert({
        user_id: ownerUserId,
        name: productName,
        price: Number(args.preco ?? 0),
        cost_price: Number(args.custo ?? 0),
        stock: Number(args.estoque ?? 0),
        min_stock: Number(args.estoque_minimo ?? 0),
        category: String(args.categoria ?? ''),
      })
      .select('id,name,price')
      .single();
    if (error) throw new Error(error.message);
    return { criado: data };
  }

  if (name === 'alterar_preco') {
    const product = await resolveOne(String(args.produto ?? '').trim());
    const newPrice = Number(args.novo_preco);
    if (!Number.isFinite(newPrice) || newPrice < 0) throw new Error('Preço inválido.');
    const { error } = await supabase.from('products').update({ price: newPrice }).eq('id', product.id);
    if (error) throw new Error(error.message);
    return { produto: product.name, preco_anterior: product.price, preco_novo: newPrice };
  }

  if (name === 'ajustar_estoque') {
    const product = await resolveOne(String(args.produto ?? '').trim());
    const type = String(args.tipo ?? 'entrada');
    const quantity = Math.abs(Number(args.quantidade ?? 0));
    if (!quantity) throw new Error('Quantidade inválida.');
    const delta = type === 'saida' ? -quantity : quantity;
    const nextStock = Number(product.stock) + delta;
    if (nextStock < 0) throw new Error(`Estoque de "${product.name}" ficaria negativo (${nextStock}).`);

    const { error: movementError } = await supabase.from('stock_movements').insert({
      product_id: product.id,
      user_id: ownerUserId,
      type,
      quantity,
      reason: String(args.motivo ?? 'Ajuste sugerido pela MIAR'),
    });
    if (movementError) throw new Error(movementError.message);

    const { error: stockError } = await supabase.from('products').update({ stock: nextStock }).eq('id', product.id);
    if (stockError) throw new Error(stockError.message);
    return { produto: product.name, estoque_anterior: product.stock, estoque_novo: nextStock };
  }

  if (name === 'criar_pedido_compra') {
    const rawItems = Array.isArray(args.itens) ? args.itens : [];
    if (!rawItems.length) throw new Error('O pedido precisa de pelo menos um item.');

    const resolved: Array<{ id: string | null; name: string; quantity: number; unitCost: number }> = [];
    for (const raw of rawItems as Array<Record<string, unknown>>) {
      const term = String(raw.produto ?? '').trim();
      const quantity = Number(raw.quantidade ?? 0);
      if (!term || !(quantity > 0)) throw new Error('Item de pedido inválido.');
      let product: { id: string; name: string; cost_price: number } | null = null;
      try {
        product = await resolveOne(term) as { id: string; name: string; cost_price: number };
      } catch {
        product = null; // item novo, ainda sem cadastro
      }
      resolved.push({
        id: product?.id ?? null,
        name: product?.name ?? term,
        quantity,
        unitCost: Number(raw.custo_unitario ?? product?.cost_price ?? 0),
      });
    }

    const subtotal = resolved.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);
    const { data: order, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        owner_user_id: ownerUserId,
        supplier_name: String(args.fornecedor ?? ''),
        notes: String(args.observacao ?? 'Pedido sugerido pela MIAR Gestora IA'),
        subtotal,
        total_amount: subtotal,
      })
      .select('id,supplier_name,total_amount')
      .single();
    if (orderError) throw new Error(orderError.message);

    const { error: itemsError } = await supabase.from('purchase_order_items').insert(
      resolved.map((item) => ({
        owner_user_id: ownerUserId,
        purchase_order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total_cost: item.quantity * item.unitCost,
      })),
    );
    if (itemsError) throw new Error(itemsError.message);
    return { pedido: order, itens: resolved.length };
  }

  throw new Error(`Ação desconhecida: ${name}`);
}
