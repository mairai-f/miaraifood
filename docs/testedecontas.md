# Videos de demonstracao dos planos

Este guia prepara tres contas de teste para gravar videos comerciais do HappyCash:

- Plano Fiado: `teste-fiado@happycashsite.com.br`
- Plano Completo: `teste-completo@happycashsite.com.br`
- Plano PRO: `teste-pro@happycashsite.com.br`
- Senha padrao: `happycash@123`
    
## Criar contas

O script cria usuarios confirmados no Supabase Auth, loja, assinatura ativa do plano e dados falsos de demonstracao.

Ele precisa da service role do Supabase. Nao salve essa chave no `.env` se ela nao estiver la; rode passando a variavel apenas no terminal:

```bash
SUPABASE_SERVICE_ROLE_KEY="sua-service-role" npm run demo:create-accounts
```

Por padrao, as tres contas usam a senha `happycash@123`. Se precisar trocar temporariamente, defina outra senha para as tres contas:

```bash
SUPABASE_SERVICE_ROLE_KEY="sua-service-role" DEMO_ACCOUNT_PASSWORD=<senha-forte-gerada> npm run demo:create-accounts
```

Se `DEMO_ACCOUNT_PASSWORD` nao for informado, o script aplica `happycash@123` e mostra a senha no final.

## Dados criados

Cada conta recebe:

- Uma loja com nome de demonstracao.
- Assinatura ativa por 90 dias no plano correspondente.
- Clientes: Maria Oliveira, Joao Santos e Ana Costa.
- Produtos: Arroz 5kg, Cafe 500g, Leite 1L e Pao Frances kg.
- Fiados pendentes, pagamento parcial e um fiado quitado.

As contas Completo e PRO tambem recebem venda e despesa de exemplo. A conta PRO recebe ainda uma sessao de caixa fechada.

## Roteiro Plano Fiado

Objetivo: mostrar controle de fiado sem parecer sistema grande demais.

1. Entrar em `teste-fiado@happycashsite.com.br`.
2. Abrir clientes e mostrar Maria, Joao e Ana.
3. Abrir Maria Oliveira e mostrar dividas pendentes.
4. Registrar ou mostrar pagamento parcial.
5. Abrir Ana Costa e mostrar fiado quitado.
6. Fechar mostrando que o saldo pendente fica claro.

Frase guia: "O Plano Fiado troca o caderno por um controle simples de clientes, dividas, pagamentos e historico."

## Roteiro Plano Completo

Objetivo: mostrar operacao diaria com venda, estoque e caixa.

1. Entrar em `teste-completo@happycashsite.com.br`.
2. Mostrar dashboard.
3. Abrir produtos e destacar estoque baixo do Cafe 500g.
4. Abrir PDV e mostrar uma venda.
5. Abrir financeiro/relatorios se estiver disponivel.
6. Fechar mostrando estoque, venda e fiado no mesmo sistema.

Frase guia: "O Plano Completo junta fiado, PDV, estoque, caixa e relatorios para a rotina da loja."

## Roteiro Plano PRO

Objetivo: mostrar o pacote mais forte e preparado para operacao profissional.

1. Entrar em `teste-pro@happycashsite.com.br`.
2. Mostrar recursos do Completo rapidamente.
3. Mostrar caixa/sessao fechada ou area operacional.
4. Mostrar configuracoes, operadores, desktop/mobile ou offline quando estiverem prontos no ambiente.
5. Fechar reforcando que e o plano para quem quer operar com mais controle.

Frase guia: "O Plano PRO e para quem quer o HappyCash completo com recursos premium, desktop, mobile e operacao mais robusta."

## Gravacao

Use OBS Studio:

- Resolucao: 1920x1080.
- Navegador em zoom 100%.
- Video curto: 1 a 3 minutos por plano.
- Comece logado para video comercial.
- Evite mostrar chaves, painel Supabase, dados reais ou URL interna de admin.
# Contas de teste
teste-fiado@happycashsite.com.br
teste-completo@happycashsite.com.br
teste-pro@happycashsite.com.br

Senha padrao: `happycash@123`
