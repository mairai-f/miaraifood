# MIAR — Chat Interno + MIAR Empresarial

## Visão geral

O módulo **Chat Interno + MIAR Empresarial** será a central de comunicação e inteligência interna de cada empresa cadastrada no ecossistema MIAR.

O objetivo é permitir que:

- dono converse com funcionários;
- funcionários conversem entre si;
- equipes criem grupos;
- setores tenham canais próprios;
- mensagens sejam recebidas em tempo real;
- a MIAR participe da operação;
- a MIAR consulte dados da empresa;
- a MIAR sugira ações;
- a MIAR cadastre e altere informações autorizadas;
- cada empresa possua contexto próprio;
- dados de uma empresa nunca sejam misturados com outra.

O módulo será multi-tenant e totalmente integrado ao Gestor.

---

# 1. Princípio central

Cada empresa possuirá seu próprio ambiente.

Exemplo:

```text
EMPRESA A
│
├── Dono
├── Gerente
├── Caixa
├── Cozinha
├── Garçons
├── Estoque
├── Entregadores
│
├── Chat interno
│
└── MIAR Empresarial
```

Outra empresa terá ambiente separado:

```text
EMPRESA B
│
├── Funcionários próprios
├── Conversas próprias
├── Grupos próprios
└── MIAR Empresarial própria
```

A separação será feita por:

```text
tenant_id
```

ou pela entidade equivalente utilizada no Core da MIAR, como:

```text
store_account_id
```

Nenhuma conversa, memória, sugestão ou informação operacional poderá atravessar tenants.

---

# 2. Chat Interno

O Chat Interno será utilizado exclusivamente pelos usuários vinculados à empresa.

Ele ficará integrado ao Gestor MIAR.

Exemplo de menu:

```text
Comunicação

💬 Conversas
👥 Grupos
🏢 Setores
✨ MIAR
🔔 Notificações
```

---

# 3. Conversas individuais

Será possível iniciar conversa direta entre funcionários cadastrados.

Exemplo:

```text
Dono
  ↓
João - Cozinha
```

Mensagem:

```text
Dono:

"João, prioriza o pedido 342."
```

Somente os participantes da conversa poderão consultar o conteúdo.

---

# 4. Lista de funcionários

O Chat não terá cadastro próprio de usuários.

Ele utilizará os funcionários já cadastrados no Gestor.

Exemplo:

```text
Funcionários

Maria Santos
Gerente
🟢 Online

João Silva
Cozinha
🟢 Online

Carlos Souza
Caixa
⚫ Offline
```

O vínculo deverá considerar:

```text
tenant
+
usuário
+
função
+
permissões
+
loja/filial
```

---

# 5. Grupos

Usuários autorizados poderão criar grupos.

Exemplo:

```text
Grupo:
Operação Sexta-feira
```

Participantes:

```text
Dono
Gerente
Caixa
Cozinha
Despachante
```

O grupo poderá possuir:

- nome;
- descrição;
- foto/ícone;
- criador;
- administradores;
- membros;
- permissões;
- data de criação.

---

# 6. Grupos por setor

O sistema também poderá criar canais baseados nos setores da empresa.

Exemplos:

```text
# Geral

# Gestão

# Caixa

# Cozinha

# Garçons

# Estoque

# Delivery

# Financeiro
```

Funcionários poderão ser adicionados automaticamente de acordo com suas funções.

Exemplo:

```text
Cargo: Cozinha

Entrada automática:
# Geral
# Cozinha
```

Um gerente poderá participar de vários grupos.

---

# 7. Permissões dos grupos

Nem todo usuário poderá criar ou alterar grupos.

Exemplo:

### Dono

Pode:

- criar grupo;
- excluir grupo;
- adicionar membros;
- remover membros;
- definir administradores;
- configurar canais.

### Gerente

Pode receber permissões para:

- criar grupos;
- adicionar membros;
- administrar determinados canais.

### Funcionário

Normalmente poderá:

- visualizar os grupos dos quais participa;
- enviar mensagens;
- receber mensagens;
- responder;
- reagir.

As permissões serão configuráveis pelo RBAC do Gestor.

---

# 8. Mensagens em tempo real

As mensagens deverão chegar imediatamente aos destinatários.

Fluxo:

```text
Usuário envia mensagem
        ↓
Backend valida usuário
        ↓
Valida tenant
        ↓
Valida participação
        ↓
Mensagem é salva
        ↓
Realtime distribui
        ↓
Destinatários recebem
```

O banco de dados continuará sendo a fonte oficial.

Realtime será utilizado para entrega imediata da atualização.

---

# 9. Usuários offline

Caso o funcionário esteja offline:

```text
Mensagem
  ↓
salva no banco
  ↓
usuário fica offline
  ↓
entra novamente
  ↓
carrega mensagens pendentes
```

Nenhuma mensagem poderá depender exclusivamente da conexão Realtime.

---

# 10. Status de leitura

O sistema deverá suportar:

```text
✓ Enviada

✓✓ Entregue

✓✓ Lida
```

Também deverá existir contador de mensagens não lidas.

Exemplo:

```text
# Cozinha       4

Maria           2

# Delivery      7
```

---

# 11. Presença

O Chat poderá exibir status:

```text
🟢 Online

⚫ Offline
```

E futuramente:

```text
Maria está digitando...
```

A presença é apenas informativa.

---

# 12. Tipos de mensagem

Inicialmente o sistema deverá permitir:

- texto;
- imagem;
- arquivo;
- áudio futuramente;
- resposta a mensagem;
- reação;
- mensagem do sistema;
- mensagem gerada pela MIAR.

Exemplo de tipos:

```text
text

image

file

system

ai
```

---

# 13. Estrutura de conversas

As conversas poderão ser:

```text
DIRECT
```

Conversa entre usuários.

```text
GROUP
```

Grupo criado manualmente.

```text
DEPARTMENT
```

Canal vinculado a setor.

```text
SYSTEM
```

Canal gerado automaticamente pelo sistema.

A conversa privada com a MIAR deverá utilizar estrutura separada.

---

# 14. Estrutura inicial de banco

Exemplo conceitual:

## chat_conversations

```text
id
tenant_id
store_location_id
type
name
created_by
created_at
updated_at
```

---

## chat_members

```text
id
tenant_id
conversation_id
user_id
role
joined_at
```

---

## chat_messages

```text
id
tenant_id
conversation_id
sender_user_id
message_type
content
reply_to_message_id
created_at
edited_at
deleted_at
```

---

## chat_message_reads

```text
message_id
user_id
read_at
```

---

## chat_attachments

```text
id
tenant_id
message_id
file_url
file_type
file_size
created_at
```

---

# 15. Segurança do Chat

Não será suficiente esconder mensagens no frontend.

O backend e o banco deverão garantir que:

```text
Usuário A
+
Tenant A
+
Conversa A
```

só tenha acesso caso esteja autorizado.

A regra deverá considerar:

```text
tenant_id
+
conversation_id
+
chat_members
```

Toda leitura e escrita deverá passar por validação.

---

# 16. MIAR Empresarial

Além do Chat Interno, cada empresa possuirá acesso à **MIAR Empresarial**.

Ela será a inteligência operacional daquele negócio.

Não será necessário criar um modelo de IA fisicamente separado para cada empresa.

O mesmo serviço de IA poderá atender toda a plataforma, porém toda requisição deverá carregar contexto de segurança.

Exemplo:

```text
tenant_id
user_id
store_location_id
permissions
```

---

# 17. Uma MIAR para cada empresa

Conceitualmente:

```text
Empresa A
   ↓
MIAR Empresa A
```

```text
Empresa B
   ↓
MIAR Empresa B
```

Porém a infraestrutura poderá compartilhar o mesmo serviço.

A separação será lógica e obrigatória.

---

# 18. Conversa individual com MIAR

Cada funcionário poderá possuir sua própria conversa com a MIAR.

Exemplo:

```text
Dono
  ↓
MIAR
```

```text
Gerente
  ↓
MIAR
```

```text
Funcionário
  ↓
MIAR
```

As conversas não precisam ser compartilhadas entre funcionários.

---

# 19. Conhecimento compartilhado da empresa

Embora as conversas sejam privadas, a MIAR poderá consultar o contexto operacional autorizado da empresa.

Exemplo:

```text
Empresa
│
├── produtos
├── estoque
├── pedidos
├── cardápio
├── financeiro
├── clientes
├── funcionários
├── delivery
├── fornecedores
└── histórico operacional
       ↓
      MIAR
```

Assim vários funcionários podem utilizar a mesma inteligência do negócio respeitando suas permissões.

---

# 20. Memória da MIAR

A memória será dividida em níveis.

## Memória global

Conhecimento geral da MIAR.

Não contém informações privadas de empresas.

```text
GLOBAL
```

---

## Memória da empresa

Contexto específico do estabelecimento.

Exemplo:

```text
tenant_id = EMPRESA_A
```

Pode armazenar conhecimento autorizado sobre:

- produtos;
- preferências operacionais;
- regras;
- processos;
- histórico;
- características da empresa.

---

## Memória do usuário

Contexto individual de um funcionário dentro daquela empresa.

Exemplo:

```text
tenant_id = EMPRESA_A
user_id = USER_32
```

Essa memória não deverá ser compartilhada automaticamente com outro funcionário.

---

# 21. Isolamento da memória

Nunca deverá existir consulta de memória sem tenant.

Errado:

```text
buscar memórias similares
```

Correto:

```text
buscar memórias similares
WHERE tenant_id = tenant_atual
```

Para memória privada:

```text
WHERE tenant_id = tenant_atual
AND user_id = usuario_atual
```

---

# 22. O que a MIAR poderá fazer

A MIAR não será apenas um chat de perguntas e respostas.

Ela poderá utilizar ferramentas internas do Gestor.

Exemplos:

```text
createProduct()

updateProduct()

getProducts()

getStock()

getSales()

getOrders()

getProductMargin()

getSuppliers()

createPurchaseSuggestion()

createPromotion()

getCustomers()

getTables()

getEmployees()
```

---

# 23. Cadastro de produtos pela MIAR

Exemplo:

```text
Dono:

"MIAR, cadastre um X-Bacon por R$29,90.
Vai pão, carne, bacon, queijo e molho."
```

A MIAR interpreta:

```text
Produto:
X-Bacon

Preço:
R$29,90

Categoria:
Lanches
```

Antes de executar, o sistema verifica a permissão.

Fluxo:

```text
Usuário
  ↓
MIAR
  ↓
interpreta intenção
  ↓
verifica tenant
  ↓
verifica permissão
  ↓
createProduct()
  ↓
API
  ↓
Banco
```

---

# 24. MIAR não escreve SQL diretamente

A MIAR não deverá receber permissão para executar comandos arbitrários no banco.

Errado:

```text
MIAR
 ↓
SQL direto
 ↓
Banco
```

Correto:

```text
MIAR
 ↓
Tool autorizada
 ↓
API / Service
 ↓
Validação
 ↓
Banco
```

Isso permite:

- controlar ações;
- aplicar permissões;
- gerar auditoria;
- evitar alterações indevidas;
- proteger tenants.

---

# 25. Confirmação de ações críticas

Ações simples poderão ser executadas diretamente conforme configuração.

Exemplo:

```text
"Cadastre uma Coca-Cola 2L por R$12."
```

Ações de maior impacto deverão pedir confirmação.

Exemplos:

- excluir produto;
- alterar vários preços;
- aplicar promoção em massa;
- cancelar vendas;
- realizar ajuste financeiro;
- alterar funcionário;
- alterar permissão.

Exemplo:

```text
MIAR:

Você está prestes a alterar o preço de
34 produtos.

Preço atual médio: R$22,40
Novo preço médio: R$25,10

Confirmar alteração?
```

---

# 26. Permissão da MIAR por funcionário

A MIAR deverá respeitar as mesmas permissões do sistema.

Exemplo:

| Função | Dados disponíveis |
|---|---|
| Dono | Todos |
| Gerente | Conforme configuração |
| Caixa | Caixa, pedidos e produtos autorizados |
| Cozinha | Pedidos, insumos e cozinha |
| Garçom | Mesas, comandas, pedidos e cardápio |
| Estoquista | Estoque, compras e fornecedores |
| Entregador | Entregas atribuídas |

---

# 27. Exemplo de bloqueio

Funcionário:

```text
"MIAR, quanto faturamos esse mês?"
```

Caso não tenha permissão financeira:

```text
MIAR:

Você não possui permissão para acessar
as informações financeiras da empresa.
```

A MIAR não deve revelar a informação mesmo que seu serviço interno seja capaz de consultá-la.

---

# 28. Regra de autorização da MIAR

Toda ação deverá considerar:

```text
Tenant correto
        +
Usuário correto
        +
Permissão do usuário
        +
Permissão da ferramenta
        +
Escopo da loja
```

Exemplo:

```text
tenant_id
store_location_id
user_id
permission
tool
```

---

# 29. Sugestões do próprio negócio

A MIAR poderá analisar dados da empresa e gerar sugestões específicas.

Exemplo:

```text
MIAR:

O X-Bacon vende 38% mais às sextas-feiras.

Quando comprado junto com batata,
o ticket médio aumenta R$8,70.

Sugestão:
criar um combo de sexta-feira.
```

---

# 30. Sugestões de estoque

Exemplo:

```text
MIAR:

⚠️ Estoque de bacon em risco.

Estoque atual:
4,2 kg

Consumo previsto até sexta:
7,1 kg

Sugestão:
comprar pelo menos mais 4 kg.
```

---

# 31. Sugestões financeiras

Para usuários autorizados:

```text
MIAR:

O custo médio do prato executivo aumentou
8% nas últimas quatro semanas.

Principal causa:
aumento de 17% no custo da carne.

Sugestão:
revisar ficha técnica ou preço.
```

---

# 32. Sugestões de vendas

Exemplo:

```text
MIAR:

O movimento entre 13:30 e 14:30 está
28% abaixo do horário anterior.

Sugestão:
criar uma promoção específica para
esse período.
```

---

# 33. Sugestões de cardápio

A MIAR poderá analisar:

- produtos mais vendidos;
- produtos menos vendidos;
- margem;
- estoque;
- horário;
- frequência de pedidos;
- combinações;
- cancelamentos;
- avaliações.

E sugerir:

- combos;
- alterações de preço;
- destaques;
- remoção temporária;
- substituição de ingrediente;
- criação de novo produto.

---

# 34. Nunca compartilhar inteligência privada entre empresas

A MIAR nunca poderá fazer algo como:

```text
Empresa A vende X por R$28.

↓

MIAR conta isso para Empresa B.
```

Informações privadas de uma empresa não podem se tornar contexto operacional de outra.

A MIAR pode utilizar conhecimento geral do modelo, mas não informações comerciais privadas de tenants diferentes.

---

# 35. MIAR nos grupos

A MIAR poderá ser mencionada dentro de grupos.

Exemplo:

```text
# Estoque

João:
@MIAR quanto temos de bacon?
```

Resposta:

```text
MIAR:

Estoque atual:
4,2 kg.

Pelo consumo médio recente,
isso representa aproximadamente 2 dias.
```

---

# 36. MIAR na cozinha

Exemplo:

```text
# Cozinha

@MIAR quais pedidos estão atrasados?
```

Resposta:

```text
MIAR:

3 pedidos estão acima do tempo esperado:

#142 - 8 min de atraso
#147 - 6 min
#151 - 4 min
```

---

# 37. MIAR na gestão

Exemplo:

```text
# Gestão

@MIAR faça um resumo do dia.
```

Resposta:

```text
MIAR:

Pedidos:
182

Faturamento:
R$8.420

Ticket médio:
R$46,26

Produto mais vendido:
X-Bacon

Movimento:
11% acima da média das últimas quartas.
```

Somente usuários autorizados no grupo poderão consultar informações restritas.

---

# 38. Permissão da MIAR dentro dos grupos

A menção dentro de um grupo não elimina as permissões.

Fluxo:

```text
Usuário chama @MIAR
        ↓
MIAR identifica usuário
        ↓
Identifica grupo
        ↓
Identifica tenant
        ↓
Verifica permissão
        ↓
Consulta dados
        ↓
Responde
```

---

# 39. MIAR poderá iniciar mensagens

A MIAR poderá enviar alertas proativos.

Exemplo:

```text
MIAR → # Estoque

⚠️ Estoque crítico

Mussarela:
2,1 kg

Estoque mínimo:
3 kg
```

---

# 40. Destinatário correto para cada alerta

A MIAR não deverá mandar todas as informações para todos.

Exemplo:

### Estoque

```text
# Estoque
# Gestão
```

### Pedido atrasado

```text
# Cozinha
# Caixa
```

### Delivery

```text
# Delivery
# Despacho
```

### Financeiro

```text
Dono
# Gestão autorizada
```

### Funcionários

```text
Dono
Gerente autorizado
```

---

# 41. Central de sugestões

Além das mensagens, o Gestor poderá possuir uma área:

```text
✨ Sugestões MIAR
```

Categorias:

```text
Vendas

Estoque

Financeiro

Cardápio

Clientes

Delivery

Equipe

Compras
```

Cada sugestão poderá possuir:

```text
Título
Descrição
Motivo
Dados utilizados
Impacto estimado
Data
Status
```

---

# 42. Status das sugestões

Exemplo:

```text
Nova

Visualizada

Aceita

Ignorada

Aplicada
```

Isso permitirá saber quais recomendações realmente produziram ação.

---

# 43. Ações diretamente pela sugestão

Exemplo:

```text
MIAR:

Sugestão:
Criar Combo Sexta

X-Bacon
Batata
Refrigerante

Preço sugerido:
R$39,90
```

Botões:

```text
[ Criar promoção ]

[ Ajustar ]

[ Ignorar ]
```

A ação continua passando pelas regras de autorização.

---

# 44. Auditoria

Toda ação realizada pela MIAR deverá gerar log.

Exemplo:

```text
AI ACTION

Tenant:
Restaurante ABC

Usuário:
Carlos

Ação:
createProduct

Produto:
X-Bacon

Horário:
14:32

Status:
Executado
```

Também deverão ser registradas ações negadas quando relevante.

---

# 45. Estrutura inicial da MIAR

## ai_threads

```text
id
tenant_id
store_location_id
user_id
title
created_at
updated_at
```

---

## ai_messages

```text
id
tenant_id
thread_id
user_id
role
content
created_at
```

---

## ai_actions

```text
id
tenant_id
user_id
thread_id
tool_name
input
result
status
created_at
```

---

## ai_suggestions

```text
id
tenant_id
store_location_id
category
title
description
priority
status
created_at
```

---

# 46. Separação Chat x MIAR

As mensagens humanas e as mensagens privadas da MIAR não deverão ser tratadas exatamente da mesma forma.

```text
CHAT HUMANO
↓
chat_messages
```

```text
MIAR PRIVADA
↓
ai_messages
```

Quando a MIAR participar de um grupo humano, a resposta poderá aparecer em `chat_messages` como mensagem de origem AI.

---

# 47. Motivo da separação

Chat humano e IA possuem necessidades diferentes.

### Chat humano

Prioriza:

- participantes;
- leitura;
- grupos;
- entrega;
- anexos;
- Realtime.

### MIAR

Prioriza:

- memória;
- contexto;
- tools;
- tokens;
- permissões;
- auditoria;
- sugestões.

Separar as estruturas evita problemas futuros.

---

# 48. Relação com filiais

Caso uma empresa possua múltiplas lojas:

```text
Empresa
│
├── Loja Centro
├── Loja Shopping
└── Loja Norte
```

O Chat poderá possuir:

```text
grupos globais da empresa
```

e:

```text
grupos específicos da loja
```

Exemplo:

```text
# Gestão Geral

# Cozinha - Centro

# Cozinha - Shopping
```

A MIAR também deverá respeitar o escopo da filial quando necessário.

---

# 49. Funcionários em múltiplas lojas

Um gerente poderá possuir:

```text
tenant_id = empresa A

lojas:
Centro
Shopping
```

Enquanto um caixa poderá possuir acesso apenas:

```text
Loja Centro
```

As consultas da MIAR deverão respeitar essa limitação.

---

# 50. Arquitetura geral

```text
                     EMPRESA / TENANT
                           │
             ┌─────────────┴─────────────┐
             │                           │
        CHAT INTERNO                 MIAR AI
             │                           │
     ┌───────┼────────┐         ┌────────┼────────┐
     │       │        │         │        │        │
    DMs    Grupos   Setores   Conversa  Tools  Sugestões
     │       │        │         │        │        │
     └───────┴────────┘         └────────┴────────┘
             │                           │
             └─────────────┬─────────────┘
                           │
                    AUTH + PERMISSÕES
                           │
                        TENANT
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
     Produtos           Estoque           Pedidos
        │                  │                  │
     Cardápio           Compras           Vendas
        │                  │                  │
     Clientes        Fornecedores       Financeiro
        │                                     │
      Mesas                              Funcionários
```

---

# 51. Objetivo final

O objetivo não é criar apenas um mensageiro interno.

O objetivo é transformar esse módulo na central operacional de comunicação da empresa.

Fluxo tradicional:

```text
Funcionário
  ↓
manda mensagem
  ↓
outro funcionário responde
```

Com MIAR:

```text
Funcionário
        ↓
Chat / Grupo
        ↓
Equipe + MIAR
        ↓
Dados reais da operação
        ↓
Informação
        ↓
Sugestão
        ↓
Ação
        ↓
Auditoria
```

A MIAR deverá funcionar como uma participante inteligente da operação.

---

# 52. Decisões definidas

Fica definido:

- haverá Chat Interno no Gestor;
- somente usuários cadastrados da empresa participarão;
- haverá conversas individuais;
- haverá grupos;
- haverá canais por setores;
- mensagens serão recebidas em tempo real;
- mensagens continuarão persistidas no banco;
- haverá indicador de leitura;
- haverá presença online;
- tudo será separado por tenant;
- cada empresa possuirá contexto próprio da MIAR;
- cada funcionário poderá conversar individualmente com a MIAR;
- a MIAR respeitará as permissões do funcionário;
- a MIAR poderá consultar dados operacionais;
- a MIAR poderá cadastrar produtos;
- a MIAR poderá alterar dados mediante permissão;
- ações críticas poderão exigir confirmação;
- a MIAR não executará SQL diretamente;
- ações serão realizadas através de tools controladas;
- ações da MIAR possuirão auditoria;
- haverá sugestões inteligentes baseadas no próprio negócio;
- informações de uma empresa nunca serão utilizadas como contexto privado de outra;
- a MIAR poderá participar dos grupos usando `@MIAR`;
- a MIAR poderá enviar alertas proativos;
- alertas deverão chegar ao setor correto;
- conversas humanas e conversas privadas com MIAR ficarão logicamente separadas;
- o módulo será preparado para múltiplas filiais.

---

# 53. Próximas etapas de implementação

Ordem recomendada:

```text
1. Modelagem das tabelas do Chat

2. RLS e isolamento por tenant

3. Conversa individual

4. Grupos

5. Canais por setor

6. Realtime

7. Leitura e presença

8. Chat privado MIAR

9. Sistema de tools da MIAR

10. Permissões das tools

11. Cadastro de produto via MIAR

12. Consultas operacionais

13. Sugestões MIAR

14. @MIAR nos grupos

15. Alertas proativos

16. Auditoria completa
```

A prioridade deve ser garantir primeiro **isolamento de tenant, autenticação e permissões** antes de liberar a MIAR para executar qualquer alteração na operação.