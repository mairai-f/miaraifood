import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { buildProductPhotoPrompt, generateProductImage, imageProvidersConfigured } from './images.ts';

// Contrato de ferramentas da MIAR.
//
// Regra central: ferramentas de LEITURA rodam na hora; ferramentas de ESCRITA
// nunca executam durante a conversa. Elas viram uma proposta pendente que só
// roda depois que uma pessoa com a permissão 'ai.miar.execute' confirma.
// Tudo executa com o JWT do usuário, então o RLS ainda é a última barreira:
// mesmo que o modelo invente um id de outra empresa, o banco recusa.
//
// Estoque e venda passam pelas mesmas funções atômicas do PDV
// (apply_stock_delta, erp_create_sale_atomic): saldo, baixa e auditoria saem
// numa transação só, e o preço vem sempre do cadastro, nunca do modelo.

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  mutates: boolean;
}

// Formas aceitas pela tabela sales. Fiado fica de fora: exige cliente e limite de crédito.
const SALE_PAYMENT_METHODS = ['dinheiro', 'pix', 'credito', 'debito'];
const PROMOTION_TYPES: Record<string, 'percent' | 'amount' | 'fixed_price'> = {
  percentual: 'percent',
  valor: 'amount',
  preco_fixo: 'fixed_price',
};
const IMAGE_MONTHLY_LIMIT = Number(Deno.env.get('MIAR_IMAGE_MONTHLY_LIMIT')) || 30;

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'buscar_produto',
    description:
      'Procura produtos do estabelecimento pelo nome ou parte do nome. Use SEMPRE antes de propor criar um produto, registrar venda, criar promoção ou gerar foto, para usar o nome exato do cadastro.',
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
        quantidade: { type: 'number' },
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
  {
    name: 'registrar_venda',
    description:
      'Propõe registrar uma venda de balcão JÁ PAGA. Baixa o estoque e entra no caixa aberto de quem confirmar, usando o preço cadastrado. Não serve para fechar mesa/comanda, vender fiado ou cancelar venda. Se a forma de pagamento não foi dita, pergunte antes.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        itens: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              produto: { type: 'string', description: 'Nome exato do produto.' },
              quantidade: { type: 'number' },
            },
            required: ['produto', 'quantidade'],
          },
        },
        forma_pagamento: { type: 'string', enum: SALE_PAYMENT_METHODS },
        desconto: { type: 'number', description: 'Desconto total em reais (opcional).' },
      },
      required: ['itens', 'forma_pagamento'],
    },
  },
  {
    name: 'criar_promocao',
    description:
      'Propõe criar uma promoção para um produto. Promoções ativas aparecem automaticamente nas telas de TV do estabelecimento. O preço cobrado no PDV não muda sozinho.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        produto: { type: 'string', description: 'Nome exato do produto.' },
        titulo: { type: 'string', description: 'Chamada curta, ex.: "Terça do Burguer".' },
        tipo: { type: 'string', enum: Object.keys(PROMOTION_TYPES) },
        valor: { type: 'number', description: 'Percentual (tipo percentual), reais de desconto (valor) ou preço promocional (preco_fixo).' },
        inicio: { type: 'string', description: 'Data inicial AAAA-MM-DD (padrão hoje).' },
        fim: { type: 'string', description: 'Data final AAAA-MM-DD (opcional).' },
        observacao: { type: 'string' },
      },
      required: ['produto', 'tipo', 'valor'],
    },
  },
  {
    name: 'gerar_foto_produto',
    description:
      'Propõe gerar com IA uma foto ilustrativa de um produto e salvá-la no cardápio digital (QR Menu e TV). A foto é salva sem publicar o item.',
    mutates: true,
    parameters: {
      type: 'object',
      properties: {
        produto: { type: 'string', description: 'Nome exato do produto.' },
        descricao_visual: { type: 'string', description: 'Como o prato deve aparecer (opcional).' },
      },
      required: ['produto'],
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
const round2 = (value: number) => Math.round(value * 100) / 100;
const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const isoDate = (value: unknown) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;

type ProductRow = {
  id: string; name: string; price: number; cost_price: number;
  stock: number; min_stock: number; category: string;
};

async function findProduct(supabase: SupabaseClient, term: string): Promise<ProductRow[]> {
  const { data } = await supabase
    .from('products')
    .select('id,name,price,cost_price,stock,min_stock,category')
    .eq('deleted', false)
    .ilike('name', `%${term}%`)
    .limit(10);
  return (data ?? []) as ProductRow[];
}

const promotionLabel = (type: unknown, value: number) =>
  type === 'percentual' || type === 'percent'
    ? `${value}% de desconto`
    : type === 'preco_fixo' || type === 'fixed_price' ? `por ${brl(value)}` : `${brl(value)} de desconto`;

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
    // Somado no banco: só o total atravessa a rede.
    const { data, error } = await supabase.rpc('get_miar_product_sales', { p_term: term, p_days: days });
    if (error) return `Não consegui consultar as vendas: ${error.message}`;
    const result = (data ?? {}) as { quantity?: number; revenue?: number; cost?: number };
    const quantity = Number(result.quantity ?? 0);
    const revenue = Number(result.revenue ?? 0);
    const cost = Number(result.cost ?? 0);
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
    case 'registrar_venda': {
      const items = Array.isArray(args.itens) ? (args.itens as Array<Record<string, unknown>>) : [];
      const list = items.map((item) => `${Number(item.quantidade ?? 0)}x ${item.produto}`).join(', ');
      const discount = Number(args.desconto ?? 0);
      return `Registrar venda: ${list || 'sem itens'}, pagamento ${args.forma_pagamento}` +
        (discount > 0 ? `, desconto ${brl(discount)}` : '') + '. Valores pelo preço cadastrado.';
    }
    case 'criar_promocao':
      return `Criar promoção "${args.titulo || args.produto}" para "${args.produto}": ${promotionLabel(args.tipo, Number(args.valor))}` +
        (args.fim ? `, até ${args.fim}` : '') + '. Aparece nas TVs.';
    case 'gerar_foto_produto':
      return `Gerar foto com IA para "${args.produto}" e salvar no cardápio (sem publicar).`;
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
  actorUserId: string,
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
    const type = String(args.tipo ?? 'entrada') === 'saida' ? 'saida' : 'entrada';
    const quantity = Math.abs(Number(args.quantidade ?? 0));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Quantidade inválida.');

    // Saldo e movimentação na mesma transação, com trava na linha do produto.
    const { data, error } = await supabase.rpc('apply_stock_delta', {
      p_movement_id: crypto.randomUUID(),
      p_product_id: product.id,
      p_delta: type === 'saida' ? -quantity : quantity,
      p_movement_type: type,
      p_reason: `MIAR: ${String(args.motivo ?? '').trim() || 'ajuste sugerido'}`.slice(0, 200),
      p_source: 'manual',
      p_reference_id: null,
    });
    if (error) throw new Error(error.message);
    const movement = data as { balance_before?: number; balance_after?: number } | null;
    return { produto: product.name, estoque_anterior: movement?.balance_before, estoque_novo: movement?.balance_after };
  }

  if (name === 'criar_pedido_compra') {
    const rawItems = Array.isArray(args.itens) ? args.itens : [];
    if (!rawItems.length) throw new Error('O pedido precisa de pelo menos um item.');

    const resolved: Array<{ id: string | null; name: string; quantity: number; unitCost: number }> = [];
    for (const raw of rawItems as Array<Record<string, unknown>>) {
      const term = String(raw.produto ?? '').trim();
      const quantity = Number(raw.quantidade ?? 0);
      if (!term || !(quantity > 0)) throw new Error('Item de pedido inválido.');
      let product: ProductRow | null = null;
      try {
        product = await resolveOne(term);
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

  if (name === 'registrar_venda') {
    const rawItems = Array.isArray(args.itens) ? (args.itens as Array<Record<string, unknown>>) : [];
    if (!rawItems.length || rawItems.length > 50) throw new Error('A venda precisa ter de 1 a 50 itens.');
    const paymentMethod = String(args.forma_pagamento ?? '');
    if (!SALE_PAYMENT_METHODS.includes(paymentMethod)) {
      throw new Error(`Forma de pagamento inválida. Use: ${SALE_PAYMENT_METHODS.join(', ')}.`);
    }

    // Mesma regra do PDV: a venda entra no caixa aberto de quem está vendendo.
    const { data: cashSession } = await supabase
      .from('cash_sessions')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .eq('operator_user_id', actorUserId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cashSession) throw new Error('Abra o seu caixa no PDV antes de confirmar esta venda.');

    const items = [];
    for (const raw of rawItems) {
      const product = await resolveOne(String(raw.produto ?? '').trim());
      const quantity = Number(raw.quantidade ?? 0);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Quantidade inválida para "${product.name}".`);
      const unitPrice = Number(product.price);
      const unitCost = Number(product.cost_price ?? 0);
      const total = round2(unitPrice * quantity);
      items.push({
        id: crypto.randomUUID(),
        product_id: product.id,
        quantity,
        unit_price: unitPrice,
        cost_price: unitCost,
        total,
        discount_amount: 0,
        net_total: total,
        unit_profit: round2(unitPrice - unitCost),
        total_profit: round2((unitPrice - unitCost) * quantity),
        markup_pct: unitCost > 0 ? round2(((unitPrice - unitCost) / unitCost) * 100) : 0,
        margin_pct: unitPrice > 0 ? round2(((unitPrice - unitCost) / unitPrice) * 100) : 0,
      });
    }

    const subtotal = round2(items.reduce((acc, item) => acc + item.total, 0));
    const discount = round2(Math.min(Math.max(Number(args.desconto ?? 0) || 0, 0), subtotal));
    const total = round2(subtotal - discount);

    const { data, error } = await supabase.rpc('erp_create_sale_atomic', {
      p_sale: {
        id: crypto.randomUUID(),
        cash_session_id: cashSession.id,
        operator_user_id: actorUserId,
        status: 'completed',
        total,
        discount,
        payment_method: paymentMethod,
        cash_received: paymentMethod === 'dinheiro' ? total : 0,
        change_amount: 0,
      },
      p_items: items,
    });
    if (error) throw new Error(error.message);
    const sale = (data as { sale?: { id: string } } | null)?.sale;
    return { venda: sale?.id, total, desconto: discount, forma_pagamento: paymentMethod, itens: items.length };
  }

  if (name === 'criar_promocao') {
    const product = await resolveOne(String(args.produto ?? '').trim());
    const discountType = PROMOTION_TYPES[String(args.tipo ?? '')];
    if (!discountType) throw new Error('Tipo de promoção inválido.');
    const value = round2(Number(args.valor ?? 0));
    const price = Number(product.price);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Valor da promoção inválido.');
    if (discountType === 'percent' && value >= 100) throw new Error('O desconto percentual deve ser menor que 100%.');
    if (discountType !== 'percent' && price > 0 && value >= price) {
      throw new Error(`O valor precisa ficar abaixo do preço atual de ${brl(price)}.`);
    }

    const startsAt = isoDate(args.inicio) ?? localToday();
    const endsAt = isoDate(args.fim);
    if (endsAt && endsAt < startsAt) throw new Error('A data final é anterior à inicial.');

    const title = String(args.titulo ?? '').trim().slice(0, 80) || `Promoção ${product.name}`;
    const { data, error } = await supabase
      .from('product_promotions')
      .insert({
        owner_user_id: ownerUserId,
        product_id: product.id,
        product_name: product.name,
        title,
        discount_type: discountType,
        discount_value: value,
        starts_at: startsAt,
        ends_at: endsAt,
        notes: String(args.observacao ?? 'Criada pela MIAR Gestora IA').trim().slice(0, 300),
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    const promoPrice = discountType === 'fixed_price'
      ? value
      : discountType === 'percent' ? round2(price * (1 - value / 100)) : round2(price - value);
    return { promocao: data.id, produto: product.name, titulo: title, preco_atual: price, preco_promocional: promoPrice };
  }

  if (name === 'gerar_foto_produto') {
    if (!imageProvidersConfigured()) {
      throw new Error('A geração de fotos ainda não foi ativada neste sistema.');
    }

    // Teto mensal por loja. A ação atual já está como 'confirmed', por isso ">".
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { count } = await supabase
      .from('ai_assistant_actions')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', ownerUserId)
      .eq('tool_name', 'gerar_foto_produto')
      .eq('status', 'confirmed')
      .gte('created_at', monthStart);
    if ((count ?? 0) > IMAGE_MONTHLY_LIMIT) {
      throw new Error(`Limite de ${IMAGE_MONTHLY_LIMIT} fotos geradas por mês atingido.`);
    }

    const product = await resolveOne(String(args.produto ?? '').trim());
    const image = await generateProductImage(buildProductPhotoPrompt(product.name, args.descricao_visual, product.category));

    // A imagem vai direto da função para o Storage: não passa pelo navegador.
    const path = `${actorUserId}/${product.id}-miar-${Date.now()}.${image.extension}`;
    const bucket = supabase.storage.from('food-menu-images');
    const { error: uploadError } = await bucket.upload(path, image.bytes, {
      contentType: image.contentType,
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) throw new Error(`Não consegui salvar a foto: ${uploadError.message}`);
    const imageUrl = bucket.getPublicUrl(path).data.publicUrl;

    const { data: entry } = await supabase
      .from('food_menu_products')
      .select('id,active')
      .eq('product_id', product.id)
      .limit(1)
      .maybeSingle();

    const { error: entryError } = entry
      ? await supabase.from('food_menu_products').update({ image_url: imageUrl }).eq('id', entry.id)
      : await supabase.from('food_menu_products').insert({ owner_user_id: ownerUserId, product_id: product.id, image_url: imageUrl });
    if (entryError) {
      await bucket.remove([path]);
      throw new Error(`Foto gerada, mas não consegui ligá-la ao cardápio: ${entryError.message}`);
    }

    return { produto: product.name, image_url: imageUrl, publicado: Boolean(entry?.active), provedor: image.provider };
  }

  throw new Error(`Ação desconhecida: ${name}`);
}
