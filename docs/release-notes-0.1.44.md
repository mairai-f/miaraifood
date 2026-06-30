# HappyCash 0.1.44

Status: produção.
Data: 2026-06-30

## ERP e operação

- Fundação ERP modular com permissões explícitas por colaborador, sem funções predefinidas.
- Central administrativa separada do menu operacional e navegação compacta.
- Venda, fiado, cancelamento e fechamento de caixa protegidos por operações transacionais.
- Identificação obrigatória dos itens por `product_id` e exibição do código oficial.

## Estoque e gestão

- Opção `Controlar estoque` com bloqueio de saldo insuficiente.
- Movimentações com usuário, origem, saldo anterior, saldo posterior e exportação CSV.
- Estoque máximo, previsão de compra, sugestão baseada nas vendas e Curva ABC.
- Fechamento contado versus calculado, diferença e justificativa.
- Auditoria detalhada de alterações comerciais.

## Embalagens comerciais

- Cadastro de fardos, caixas e pacotes vinculados ao mesmo produto.
- Estoque mantido na unidade-base, sem duplicar produtos.
- Preço e custo próprios por embalagem, com aplicação automática configurável.
- Mesma busca por nome e código de barras no PDV e no fiado.
- Cupom e histórico preservam a embalagem usada na operação.
- Bloqueio de códigos de barras ambíguos entre unidade e embalagem.

## Validação

- 102 testes automatizados aprovados.
- 7 testes de navegador aprovados, incluindo o modal responsivo de embalagens.
- Build Web aprovado.
- Migrações aplicadas e banco remoto validado sem erros de schema.
