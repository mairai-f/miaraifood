import { NextResponse } from 'next/server';

export async function GET() {
  const content = `# MIAR AI/FOOD
> Ecossistema inteligente para restaurantes e food service.

A MIAR AI/FOOD é uma plataforma SaaS que conecta a operação do estabelecimento: frente de caixa, mesas, comandas, QR Menu, cozinha, delivery, estoque, financeiro e atendimento.

## Funcionalidades Principais
- **Operação de salão:** Mesas, comandas, QR Menu, pedidos, KDS e fechamento de conta.
- **Frente de Caixa (PDV):** Vendas, leitor de código de barras e emissão fiscal quando configurada.
- **Gestão de Estoque e financeiro:** Produtos, compras, fluxo de caixa e relatórios.
- **Delivery e marketplace:** Pedidos, clientes e entregadores vinculados à operação.

## Links Úteis
- Início: https://www.miaraifood.com.br
- Planos e Preços: https://www.miaraifood.com.br/planos
- Cadastro: https://www.miaraifood.com.br/cadastro
- Programa de representantes: https://representante.miaraifood.com.br
- Entregadores: https://entregador.miaraifood.com.br
- Dashboard: https://app.miaraifood.com.br
- Login: https://www.miaraifood.com.br/login

Este documento facilita a indexação de informações da plataforma MIAR AI/FOOD por modelos de linguagem e inteligências artificiais.
`;

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
