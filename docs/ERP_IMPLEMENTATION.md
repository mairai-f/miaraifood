# Evolucao do HappyCash para ERP

## Objetivo

Transformar o HappyCash em um ERP modular sem transformar o aplicativo Desktop em um backoffice pesado.

O produto passa a ter tres controles independentes:

1. **Plano comercial:** informa se a empresa contratou o modulo.
2. **Permissao RBAC:** informa se o colaborador pode visualizar ou executar a acao.
3. **Runtime:** informa se o codigo pode rodar no Web, Desktop ou nos dois.

Uma permissao nunca substitui o plano. Por exemplo: liberar `reports.view` para um operador nao libera Relatorios se o plano da loja nao possuir `reports.view`.

## Divisao Web e Desktop

### Desktop e Web

- PDV, abertura e fechamento de caixa;
- comandas;
- clientes e produtos;
- estoque operacional;
- recebimento de compras;
- financeiro essencial;
- impressao e NFC-e;
- cache e fila offline.

### Somente Web

- matriz de permissoes e grupos;
- monitor de acessos e auditoria central;
- conciliacao de adquirentes/PSPs;
- gestao multi-loja e consolidacao;
- configuracao de relogio de ponto;
- gestao de totens;
- operacoes fiscais pesadas ou em lote.

O Desktop continua usando `React.lazy`. Paginas Web nao sao pre-carregadas no Electron e a matriz RBAC e importada apenas quando a pagina Web de configuracoes a renderiza.

## Fase 1 — fundacao RBAC

Status: **implementada e aplicada ao Supabase vinculado em 29/06/2026.**

### Banco de dados

Arquivo: `supabase/migrations/20260629153000_add_erp_rbac_foundation.sql`

- `erp_permission_catalog`: lista cada capacidade e seu runtime.
- `erp_permission_groups`: grupos reutilizaveis por empresa.
- `erp_permission_group_rules`: permissoes herdadas pelo grupo.
- `erp_staff_group_memberships`: liga colaborador e grupo.
- `erp_staff_permission_overrides`: excecao individual que prevalece sobre o grupo.
- `erp_user_has_permission`: resolve administrador, excecao, grupo e padrao da funcao, nessa ordem.
- `get_my_erp_permissions`: entrega ao usuario somente seu conjunto efetivo.
- `get_staff_erp_permissions`: permite ao administrador Web montar a matriz de configuracao.
- `set_staff_erp_permission_override`: grava ou remove uma excecao individual.
- RLS: impede que um administrador altere colaboradores de outra empresa.
- Grupos `operator_default` e `waiter_default`: sao criados e associados automaticamente.

As mutacoes de cliente, abertura de caixa, sangria e cancelamento de venda passam a consultar RBAC no servidor. A atualizacao de estoque por venda ainda usa o fluxo legado; ela sera movida para uma RPC transacional antes de endurecer a policy de produtos.

### Frontend

Arquivo: `src/lib/permissions.ts`

- declara chaves tipadas;
- define os acessos de emergencia para login offline;
- decide se um recurso pertence ao Web, Desktop ou ambos.

Arquivo: `src/contexts/PermissionsContext.tsx`

- consulta as permissoes efetivas no Supabase;
- guarda a ultima versao valida no `localStorage` por empresa e colaborador;
- usa o cache validado quando o Desktop entra offline;
- nunca transforma falha de internet em liberacao total.

Arquivo: `src/routes/AuthenticatedArea.tsx`

- exige simultaneamente plano, permissao e runtime;
- bloqueia URL digitada manualmente;
- nao pre-carrega Monitor de Acessos e Auditoria no Desktop.

Arquivo: `src/components/AppLayout.tsx`

- esconde itens sem permissao;
- esconde recursos Web no Desktop;
- preserva os atalhos somente para itens realmente disponiveis.

Arquivo: `src/components/PermissionsManagementPanel.tsx`

- permite selecionar operador ou garcom;
- mostra permissoes agrupadas por modulo;
- identifica regras personalizadas;
- restaura heranca do grupo;
- existe apenas no bundle Web carregado sob demanda.

Arquivo: `src/pages/PDV.tsx`

- verifica permissao para abrir/fechar caixa, sangria, cancelamento, edicao de preco e venda sem estoque;
- mantem credencial administrativa onde ela ja era obrigatoria;
- nao exibe botoes de acoes negadas.

Arquivo: `src/pages/Products.tsx`

- separa consulta (`products.view`) de edicao (`products.manage`).

## Testes obrigatorios da Fase 1

### Antes de testar

1. Fazer backup do banco de homologacao.
2. Aplicar a migracao em homologacao, nunca primeiro em producao.
3. Reiniciar a aplicacao Web para limpar chunks antigos.
4. Entrar uma vez online no Desktop com cada operador antes do teste offline; isso prepara o cache de permissoes.

### Administrador Web

1. Abrir **Configuracoes**.
2. Confirmar que aparece **Permissoes por colaborador — Somente Web**.
3. Selecionar um operador.
4. Desligar `Cancelar venda`, sair e entrar novamente como operador.
5. Confirmar que o botao Cancelar desapareceu e uma chamada direta ao banco foi recusada.
6. Restaurar a permissao pelo botao de seta e confirmar que aparece `Personalizado` somente quando existe excecao.

### Operador Web

1. Confirmar acesso inicial a Painel, PDV, Comandas, Clientes e Produtos.
2. Confirmar Produtos em modo consulta quando `products.manage` estiver desligada.
3. Desligar `clients.manage`: consulta deve continuar; cadastro/edicao deve ser negado pelo banco.
4. Desligar `pdv.cash_out`: o botao de sangria deve desaparecer e o atalho nao deve abrir a janela.
5. Desligar `pdv.open_cash`: um operador sem caixa aberto deve receber bloqueio explicito.

### Desktop online e offline

1. Confirmar que Monitor de Acessos, Auditoria e Matriz RBAC nao aparecem.
2. Abrir o Desktop online e aguardar carregar as permissoes.
3. Fechar, desconectar a internet e entrar com o operador offline.
4. Confirmar que o mesmo menu e as mesmas restricoes permanecem.
5. Confirmar abertura, venda, sangria e fechamento para um operador com permissoes padrao.

### Regressao

- administrador continua com acesso total;
- garcom continua limitado a Comandas;
- venda atualiza estoque;
- cancelamento devolve estoque;
- venda offline entra na fila e sincroniza;
- NFC-e e impressao continuam funcionando;
- plano continua bloqueando modulo nao contratado.

## Roadmap do ERP completo

### Fase 2 — empresa, filial e terminal

Status: **implementada e aplicada ao Supabase vinculado em 29/06/2026.**

Decisao arquitetural: `store_accounts` representa a empresa, o contrato e a assinatura. Nao sera duplicada para cada filial. A estrutura operacional fica abaixo dela:

- `store_locations`: Matriz, filiais e depositos;
- `pos_terminals`: Web, Desktop, Mobile e Totem;
- `location_inventory`: saldo, minimo e reserva por produto/filial;
- `desktop_machine_activations.terminal_id`: liga cada instalacao Electron ao seu terminal;
- `location_id`: adicionado a caixa, venda, despesa, estoque, compra, financeiro, comanda e documento fiscal;
- `terminal_id`: adicionado a caixa e venda;
- trigger de compatibilidade: novos registros sem escopo continuam na Matriz/terminal LEGACY;
- RLS: somente administrador da propria empresa com `multi_store.manage` altera filiais e terminais.

Arquivo principal: `supabase/migrations/20260629173000_add_store_locations_and_terminals.sql`.

Painel Web: `src/components/LocationsTerminalsPanel.tsx`.

O painel permite criar filiais/depositos, criar terminais e ativar/desativar registros. A Matriz e o terminal LEGACY ficam protegidos contra desativacao pela interface. O Desktop nao importa esse componente.

#### Testes manuais da Fase 2

1. Aplicar Fase 1 e depois Fase 2 em banco de homologacao com backup.
2. Confirmar uma unica Matriz por empresa e um terminal LEGACY.
3. Confirmar que produtos existentes foram copiados para `location_inventory` com o mesmo saldo.
4. Abrir Configuracoes Web e cadastrar uma filial `CENTRO`.
5. Cadastrar terminais Desktop, Web, Mobile e Totem nessa filial.
6. Desativar e reativar uma filial nao principal e um terminal manual.
7. Reativar uma instalacao Desktop e confirmar terminal automatico `DESK-*` com `installation_id`.
8. Criar venda, sangria, caixa, compra e comanda pelo fluxo atual; confirmar `location_id` da Matriz.
9. Confirmar que venda, cancelamento, estoque, NFC-e e sincronizacao offline continuam funcionando.

#### Escopo operacional implementado

- `OperationalScopeProvider` resolve a filial/terminal ativo;
- no Desktop, o escopo vem do `installation_id` ativado e fica fixo;
- no Web, o seletor aparece no menu lateral;
- a troca Web e bloqueada enquanto houver caixa aberto;
- vendas, caixas, despesas, comandas, compras, financeiro e movimentos novos recebem `location_id`;
- vendas e caixas tambem recebem `terminal_id`;
- consultas de vendas, comandas, estoque, despesas, compras e contas sao filtradas pela filial;
- o catalogo global recebe o saldo local de `location_inventory` antes de ser exibido;
- movimentos atualizam o saldo da filial na mesma transacao;
- recebimento de compra atualiza somente a filial do pedido;
- `products.stock` permanece como espelho de compatibilidade exclusivo da Matriz.

Arquivos principais:

- `src/contexts/OperationalScopeContext.tsx`;
- `src/contexts/DataContext.tsx`;
- `src/components/AppLayout.tsx`;
- `src/pages/PDV.tsx`;
- `src/pages/Operations.tsx`.

Teste adicional: abra duas sessoes Web, selecione filiais diferentes e confirme que vendas, comandas, despesas, compras e saldos exibidos nao se misturam. No Desktop, confirme que a filial aparece como informacao fixa no cabecalho do PDV.

Limitacao de transicao: terminais Desktop criados automaticamente continuam vinculados inicialmente a Matriz. A movimentacao administrativa de uma instalacao para outra filial deve ser feita somente depois de validar snapshot e fila offline dessa maquina.

### Fase 3 — catalogo e precificacao

Status: **implementada e aplicada ao Supabase vinculado em 29/06/2026.**

Arquivo de banco: `supabase/migrations/20260629210000_add_advanced_product_catalog.sql`.

#### Estrutura implementada

- `product_departments`: setores do catalogo;
- `product_brands`: marcas;
- `product_groups` e `product_subgroups`: classificacao hierarquica validada;
- `measurement_units`: unidade, simbolo e precisao de zero a seis casas;
- `measurement_unit_conversions`: conversoes com fator positivo entre unidades da mesma empresa;
- `product_price_tables`: tabelas comerciais, incluindo `VAREJO` criada automaticamente;
- `product_price_table_items`: preco por produto, tabela e quantidade minima;
- `replace_product_price_table_items`: substitui as faixas em uma transacao e sempre recompõe o VAREJO;
- `transport_companies`: cadastro de transportadoras;
- produtos recebem setor, marca, grupo, subgrupo, unidade, referencia, desconto maximo, comissao e transportadora preferencial;
- fornecedores e pedidos de compra passam a aceitar transportadora vinculada;
- triggers rejeitam vinculos cruzados entre empresas e subgrupo fora do grupo;
- RLS separa empresas e exige `products.manage`, `pricing.manage` ou `purchases.manage` conforme o cadastro.

#### Compatibilidade e migracao de dados

- `products.category` continua existindo para busca, PDV offline e versoes anteriores;
- cada categoria textual existente vira um grupo sem alterar a categoria original;
- toda empresa recebe a unidade `UN` e seus produtos existentes sao associados a ela;
- toda empresa recebe a tabela `VAREJO`;
- o preco atual de cada produto vira a faixa `VAREJO`, quantidade minima 1;
- um trigger mantem `products.price` e a faixa principal sincronizados;
- o saldo continua em `location_inventory`; classificacao e preco sao globais para a empresa.

#### Web e Desktop

Arquivo Web: `src/components/CatalogConfigurationPanel.tsx`.

O painel em **Configuracoes > Catalogo avancado** cria, ativa e desativa estruturas, unidades, conversoes, tabelas de preco e transportadoras. Ele e carregado com `React.lazy`; o build validado gerou um chunk independente e o componente nao e renderizado no Electron.

Arquivo operacional: `src/pages/Products.tsx`.

Web e Desktop podem associar ao produto os cadastros ativos. Somente o Web com `pricing.manage` edita tabelas e faixas; o Desktop usa o preco principal e nao consulta os itens de tabela, evitando trabalho administrativo no caixa.

Arquivo de regras: `src/lib/catalog.ts`.

Centraliza normalizacao de codigo, validacao/calculo de comissao e filtro seguro de subgrupos. A busca compartilhada de produtos tambem passou a considerar `reference`.

#### O Desktop depende do site Web estar aberto?

Nao. O aplicativo instalado leva seus proprios arquivos de interface. Se o site Web estiver fora do ar, mas Supabase/API estiver acessivel, o Desktop continua online normalmente. Se a API ou a internet cair, os fluxos que ja suportam modo offline continuam usando snapshot e fila local; configuracoes Web, novos cadastros administrativos e sincronizacao aguardam a conexao voltar.

Isso significa que “Web funcionando” e “Desktop funcionando” sao verificacoes diferentes. Ambos compartilham banco e autenticacao, mas o executavel Desktop nao carrega a pagina publicada do site em producao.

#### Testes obrigatorios da Fase 3

Antes de testar:

1. Fazer backup do banco de homologacao.
2. Aplicar, nesta ordem, as migracoes `20260629153000`, `20260629173000` e `20260629210000`.
3. Atualizar os tipos Supabase gerados somente depois de a migracao existir no ambiente.
4. Reiniciar o Web e o Desktop para descartar chunks/cache de uma versao anterior.

Banco e backfill:

1. Confirmar exatamente uma tabela padrao ativa por empresa e codigo `VAREJO`.
2. Confirmar unidade `UN` para todos os produtos existentes.
3. Confirmar que produtos com categoria antiga receberam `product_group_id`, sem perder `category`.
4. Confirmar uma faixa VAREJO de quantidade 1 com o mesmo valor de `products.price`.
5. Tentar vincular subgrupo de outro grupo e transportadora de outra empresa; ambas as operacoes devem ser recusadas.
6. Entrar como operador sem permissao e tentar inserir diretamente em uma tabela de catalogo; a RLS deve recusar.

Administrador Web:

1. Abrir **Configuracoes > Catalogo avancado**.
2. Criar setor `LOJA`, marca `ACME`, grupo `BEBIDAS` e subgrupo `REFRIGERANTES`.
3. Criar unidade `CX` e conversao de `CX` para `UN` com fator 12.
4. Criar tabela `ATACADO` e transportadora de homologacao.
5. Desativar e reativar cada cadastro e confirmar que itens inativos deixam de aparecer no formulario do produto.
6. Cadastrar um produto com todos os vinculos, desconto de 10% e comissao de 5%.
7. Adicionar faixas VAREJO a partir de 6 unidades e ATACADO a partir de 12 unidades.
8. Editar preco/custo, aprovar com gerente e confirmar que classificacao e faixas foram preservadas.
9. Pesquisar o produto pela referencia e confirmar o resultado.

Desktop:

1. Confirmar que **Catalogo avancado** nao aparece nas Configuracoes.
2. Abrir Produto e confirmar setor, marca, grupo, subgrupo, unidade e transportadora ativos.
3. Confirmar que a secao de faixas de preco nao aparece no Desktop.
4. Vender o produto no PDV e confirmar uso de `products.price` como preco principal.
5. Ficar offline, realizar venda, fechar e reabrir o Desktop; a venda deve permanecer na fila.
6. Voltar online e confirmar sincronizacao sem perda do escopo de filial.

Regressao multi-loja:

- trocar a filial Web e confirmar que o catalogo e igual, mas o saldo continua diferente;
- criar venda nas duas filiais e confirmar `location_id` e estoque local;
- recebimento de compra continua alterando apenas `location_inventory` da filial;
- produtos antigos sem novos campos continuam visiveis no PDV;
- cancelamento de venda devolve o saldo na filial correta.

#### Consultas de conferencia em homologacao

Execute no SQL Editor usando uma empresa de teste:

```sql
-- Nenhum produto HappyCash deve ficar sem unidade depois do backfill.
select count(*) as products_without_unit
from public.products product
join public.store_accounts account
  on account.owner_user_id = product.user_id
 and account.product_context = 'happycash'
where product.measurement_unit_id is null;

-- Deve retornar uma linha por empresa e total_default = 1.
select store_account_id, count(*) filter (where is_default) as total_default
from public.product_price_tables
group by store_account_id;

-- O preco principal e a faixa VAREJO de quantidade 1 devem coincidir.
select product.id, product.name, product.price, item.price as table_price
from public.products product
join public.product_price_table_items item on item.product_id = product.id
join public.product_price_tables price_table on price_table.id = item.price_table_id
where price_table.code = 'VAREJO'
  and item.min_quantity = 1
  and product.price is distinct from item.price;
```

A primeira deve mostrar `products_without_unit = 0`; a segunda deve mostrar `1` em todas as empresas; a terceira deve retornar zero linhas.

#### Validacao executada em 29/06/2026

- `git diff --check`: aprovado;
- ESLint dos arquivos alterados na Fase 3: aprovado, sem erros ou avisos;
- Vitest completo: 26 arquivos e 95 testes aprovados;
- build Vite de producao: aprovado, com o painel Web em chunk lazy separado;
- avisos nao bloqueantes do build: base `caniuse-lite` desatualizada e chunk-base maior que 500 kB;
- `supabase db lint --local`: nao executou porque nao existe PostgreSQL local acessivel nesta maquina.

Portanto, TypeScript, React, regras puras, regressao automatizada e empacotamento foram validados. A validacao local nao tinha PostgreSQL; depois disso as migracoes foram aplicadas ao Supabase vinculado e o lint remoto terminou sem erros. O roteiro funcional continua obrigatorio antes de liberar a versao aos caixas.

### Fase 3.1 — disciplina operacional

Status: **implementada e aplicada ao Supabase vinculado em 29/06/2026.**

Migrações:

- `20260630100000_add_operational_integrity.sql`;
- `20260630103000_fix_operational_integrity_functions.sql`.

Entregas:

- venda, fiado, cancelamento e fechamento usam RPCs transacionais;
- toda venda e fiado novo exige `product_id`; nome e código são copiados do cadastro oficial;
- `Controlar estoque` decide se o saldo deve ser baixado e impede saldo negativo;
- estoque máximo e média de vendas dos últimos 30 dias alimentam a sugestão de compra;
- Curva ABC usa receita por `product_id` dos últimos 90 dias;
- movimentações mostram código, origem, usuário, saldo anterior/posterior e exportam CSV;
- fechamento guarda calculado, contado, diferença e justificativa obrigatória;
- alterações comerciais de produto registram antes/depois na auditoria.

Validação executada:

- build Vite aprovado;
- testes direcionados de estoque, previsão e Curva ABC aprovados;
- `supabase db lint --linked --level warning`: nenhum erro de schema;
- todas as migrações locais aparecem aplicadas no histórico remoto.

Teste manual obrigatório: em uma empresa de teste, crie um produto controlado com saldo 1, tente vender 2 e confirme rollback total; depois desative o controle e confirme venda sem baixa. Feche um caixa com diferença e confirme a exigência de justificativa. Exporte as movimentações e confira usuário, origem e saldos.

### Cadastro de colaborador com acesso explícito

- não existe perfil-base no modal;
- o administrador escolhe somente a função operacional e marca cada acesso;
- a mesma permissão vale para Web, Desktop e Mobile onde o recurso estiver disponível;
- dependências como `products.manage` → `products.view` são aplicadas automaticamente;
- desktop usa modal largo com dados e matriz lado a lado;
- mobile usa as etapas Dados, Acessos e Revisão;
- criação do usuário e gravação das permissões possuem compensação: falha ao salvar acessos remove o usuário recém-criado;
- operadores antigos têm o acesso efetivo convertido para regras explícitas pela migração `20260630120000`.

### Fase 4 — pagamentos e conciliacao

- `payment_methods`, `payment_providers` e configuracao por terminal;
- pagamentos mistos por venda;
- PIX dinamico, TEF/SmartPOS e webhooks idempotentes;
- conciliacao Web de taxas, parcelas e recebiveis.

### Fase 5 — compras, estoque e financeiro avancado

- cotacao, pedido, recebimento parcial e devolucao;
- inventario, transferencia entre depositos e custo medio;
- contas a pagar/receber, plano de contas e centros de custo;
- fechamento contabil exportavel.

### Fase 6 — operacoes verticais

- PDV Mobile;
- delivery e expedicao;
- totem de autoatendimento;
- relogio de ponto;
- dashboards consolidados Web.

### Fase 7 — fiscal

- estabilizar NFC-e em producao;
- NF-e de venda/devolucao;
- CT-e, MDF-e e manifestacao MD-e por provedor homologado;
- contingencia, certificados, eventos e auditoria fiscal.

## Regra para novas funcionalidades

Todo modulo novo deve declarar:

- feature do plano;
- permissao de visualizacao;
- permissoes de mutacao;
- runtime (`web`, `desktop` ou `both`);
- policy/RPC no servidor;
- comportamento offline;
- teste unitario e roteiro E2E.
