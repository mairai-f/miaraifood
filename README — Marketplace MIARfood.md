# MIARfood — Marketplace / App Cliente

## Visão geral

O **Marketplace MIARfood** é o aplicativo voltado ao cliente final.

É por ele que o usuário poderá descobrir estabelecimentos, visualizar cardápios, conversar com a **MIAR**, receber recomendações, realizar pedidos, acompanhar entregas, acessar benefícios, consultar histórico e utilizar recursos ligados à sua conta.

O Marketplace deve ser tratado separadamente de outros módulos do ecossistema, como:

- QR Menu
- Gestor
- KDS / Cozinha
- Entregador
- Supergestora

Apesar de compartilhar dados e identidade com outros módulos, o Marketplace possui fluxo e experiência próprios.

---

# 1. Fluxo inicial

O fluxo inicial do Marketplace será:

```text
Boas-vindas
   ↓
Apresentação dos benefícios
   ↓
Criar conta / Entrar
   ↓
Cadastro obrigatório
   ↓
Onboarding do cliente
   ↓
Marketplace MIARfood
```

Não haverá utilização completa do Marketplace como usuário anônimo.

O cliente deverá possuir uma conta para utilizar a plataforma.

---

# 2. Tela de Boas-vindas

A primeira tela não deve começar diretamente com um formulário de cadastro.

Ela deve primeiro explicar rapidamente o valor do MIARfood.

Exemplo de comunicação:

> Sua experiência com comida, mais inteligente.

A tela poderá apresentar benefícios como:

- descobrir restaurantes e estabelecimentos;
- receber recomendações personalizadas;
- conversar com a MIAR;
- encontrar pratos de acordo com o momento do cliente;
- realizar pedidos;
- acompanhar entregas;
- salvar favoritos;
- acessar promoções e benefícios;
- consultar histórico de pedidos.

Também deverá existir uma apresentação simples do plano gratuito.

Exemplo:

```text
Comece gratuitamente

20 mensagens com a MIAR por dia
2 uploads por dia
```

### Ações principais

- **Criar minha conta**
- **Já tenho conta**

---

# 3. Cadastro obrigatório

Para utilizar o Marketplace, o cliente deverá possuir uma conta.

Não será adotado como fluxo principal o uso sem cadastro.

Isso é necessário porque o cliente poderá possuir:

- histórico de pedidos;
- endereços;
- favoritos;
- preferências;
- conversas com a MIAR;
- memória personalizada;
- benefícios;
- assinatura;
- pedidos recorrentes;
- acompanhamento nutricional;
- dados relacionados à entrega.

---

# 4. Métodos de cadastro e login

O Marketplace deverá permitir:

### Google

```text
Continuar com Google
```

Deve ser uma das formas principais de cadastro devido à baixa fricção.

### E-mail

```text
Continuar com e-mail
```

Fluxo tradicional com:

- e-mail;
- senha.

### Telefone

```text
Continuar com telefone
```

O número do telefone poderá posteriormente ser utilizado também para recursos ligados a notificações e WhatsApp.

Não deverá ser tratado como uma conta separada de WhatsApp.

---

# 5. Identidade única do cliente

Independentemente da forma utilizada para entrar:

- Google;
- telefone;
- e-mail;

todos representarão a mesma entidade de **Cliente MIAR**.

O sistema não deverá possuir tipos diferentes de cliente dependendo do método de autenticação.

Exemplo conceitual:

```text
Cliente
 ├── login Google
 ├── login por e-mail
 └── login por telefone
```

A autenticação é apenas o método de acesso.

A identidade do cliente permanece única.

---

# 6. MIAR no Marketplace

Todos os clientes terão acesso à **MIAR**.

A MIAR será parte central da experiência do Marketplace.

Ela poderá ajudar o cliente a:

- descobrir restaurantes;
- encontrar pratos;
- escolher refeições;
- interpretar cardápios;
- analisar imagens;
- analisar produtos;
- sugerir combinações;
- encontrar promoções;
- considerar preferências anteriores;
- auxiliar em pedidos recorrentes;
- fornecer informações nutricionais;
- acompanhar hábitos do cliente conforme o plano contratado.

---

# 7. Plano gratuito

Todo novo cliente terá acesso ao plano gratuito.

## Limites

### Mensagens com a MIAR

```text
20 mensagens por dia
```

Cada mensagem enviada pelo cliente para a MIAR consome uma unidade.

A resposta da MIAR não consome uma segunda mensagem.

Exemplo:

```text
Cliente → MIAR
Consome 1 mensagem

MIAR → Cliente
Não consome mensagem
```

Caso ocorra erro técnico antes do processamento correto da solicitação, a mensagem não deverá ser descontada.

---

## Uploads

O plano gratuito terá:

```text
2 uploads por dia
```

Upload poderá incluir, por exemplo:

- foto de comida;
- foto de prato;
- foto de produto;
- foto de embalagem;
- foto de rótulo;
- imagem de cardápio;
- documento suportado pela MIAR.

Os uploads serão analisados pela MIAR conforme as funcionalidades disponíveis.

---

# 8. Renovação das cotas

As cotas do plano gratuito são renovadas diariamente.

Exemplo:

```text
20 mensagens/dia
2 uploads/dia
```

O saldo não utilizado não precisa acumular para o próximo dia.

---

# 9. Estrutura inicial de planos

A estrutura inicial do Marketplace será composta por três níveis:

```text
Gratuito
MIAR+
MIAR Pro
```

Os preços ainda não estão definidos.

A precificação deverá ser definida posteriormente considerando:

- custo de IA;
- custo de armazenamento;
- uploads;
- infraestrutura;
- benefícios;
- frete;
- margem da MIAR.

---

# 10. Plano Gratuito

Inclui inicialmente:

- acesso ao Marketplace;
- acesso à MIAR;
- 20 mensagens por dia;
- 2 uploads por dia;
- realização de pedidos;
- histórico de pedidos;
- favoritos;
- recomendações básicas;
- informações nutricionais básicas relacionadas ao pedido;
- acesso aos estabelecimentos da rede.

---

# 11. MIAR+

Plano intermediário voltado para clientes que utilizam a MIAR com maior frequência.

Estrutura inicial prevista:

```text
100 mensagens/dia
10 uploads/dia
```

Pode incluir:

- recomendações mais personalizadas;
- memória ampliada;
- acompanhamento alimentar;
- nutrição mais detalhada;
- benefícios exclusivos;
- vantagens dentro da rede;
- possíveis benefícios relacionados ao frete.

---

# 12. MIAR Pro

Plano superior do Marketplace.

Estrutura inicial prevista:

```text
300 mensagens/dia
30 uploads/dia
```

Pode incluir:

- personalização avançada;
- memória ampliada da MIAR;
- acompanhamento contínuo;
- recursos nutricionais completos;
- benefícios superiores;
- vantagens especiais na rede MIAR;
- benefícios relacionados ao delivery;
- recursos futuros exclusivos.

---

# 13. IA ilimitada

Inicialmente nenhum plano terá IA completamente ilimitada.

Isso evita consumo imprevisível de infraestrutura e permite controlar:

- custo por usuário;
- abuso;
- automações excessivas;
- consumo de tokens;
- uploads.

Os limites poderão ser ajustados posteriormente com base no uso real da plataforma.

---

# 14. Marketplace e QR Menu

Marketplace e QR Menu não são o mesmo produto de interface.

## Marketplace

O Marketplace é utilizado principalmente para:

```text
Descobrir estabelecimento
        ↓
Escolher produtos
        ↓
Realizar pedido
        ↓
Selecionar entrega/retirada
        ↓
Pagamento
        ↓
Acompanhar pedido
```

---

## QR Menu

O QR Menu começa dentro de um estabelecimento.

Exemplo:

```text
Cliente escaneia QR da mesa
        ↓
Identifica estabelecimento/mesa
        ↓
Abre cardápio
        ↓
Realiza pedido
        ↓
Pedido chega à operação do restaurante
```

A conta MIAR pode ser compartilhada entre Marketplace e QR Menu.

Porém, a experiência e o fluxo devem permanecer separados.

---

# 15. Relação com o ecossistema MIAR

O Marketplace deverá conversar com os demais módulos.

```text
Marketplace
     │
     ├── MIAR
     │
     ├── Gestor
     │
     ├── KDS / Cozinha
     │
     ├── Caixa / Gestor de Pedidos
     │
     ├── Entregador
     │
     └── Supergestora
```

### Exemplo de pedido delivery

```text
Cliente
   ↓
Marketplace
   ↓
Estabelecimento
   ↓
Gestor de Pedidos
   ↓
KDS / Cozinha
   ↓
Pedido pronto
   ↓
Despacho
   ↓
Entregador
   ↓
Cliente
```

---

# 16. Dados principais do cliente

A estrutura deverá ser preparada para armazenar informações como:

- nome;
- e-mail;
- telefone;
- foto;
- métodos de autenticação;
- endereços;
- endereço principal;
- favoritos;
- histórico de pedidos;
- preferências;
- restrições configuradas pelo usuário;
- interações com a MIAR;
- plano atual;
- benefícios;
- pedidos recorrentes;
- dados de fidelidade;
- configurações de notificações.

Dados sensíveis deverão respeitar as regras de privacidade e LGPD.

---

# 17. Pedido recorrente

O Marketplace deverá futuramente permitir pedidos recorrentes.

Exemplo:

```text
Toda segunda-feira
12:00
Pedido X
Restaurante Y
```

O cliente poderá configurar recorrência conforme as regras disponibilizadas pelo estabelecimento.

O recurso poderá trabalhar com:

- pacote fixo;
- escolha livre;
- modelo híbrido;
- frequência configurável;
- substituição de itens;
- sugestão inteligente da MIAR.

A disponibilidade e os descontos de recorrência serão controlados pelo estabelecimento.

---

# 18. Promoções e MIAR

A MIAR poderá apresentar promoções e oportunidades de forma proativa.

Prioridade:

```text
Estabelecimentos da rede MIAR
```

O objetivo é fortalecer o próprio ecossistema.

Ofertas externas não deverão competir normalmente com parceiros MIAR.

Exceções poderão existir para grandes supermercados ou hipermercados quando fizer sentido para determinada funcionalidade.

---

# 19. Objetivo de experiência

O Marketplace não deve ser apenas uma lista de restaurantes.

A visão é transformar a experiência tradicional:

```text
Abrir app
→ procurar comida
→ pedir
```

em:

```text
Abrir MIARfood
        ↓
MIAR entende o que o cliente procura
        ↓
Sugere opções
        ↓
Cliente descobre estabelecimentos
        ↓
Escolhe
        ↓
Pede
        ↓
Acompanha
        ↓
MIAR aprende com a experiência
```

O diferencial principal deverá ser a combinação de:

- Marketplace;
- inteligência artificial;
- personalização;
- estabelecimentos parceiros;
- delivery;
- recorrência;
- nutrição;
- benefícios.

---

# 20. Status das decisões

## Definido

- Marketplace exige cadastro.
- Google será disponibilizado como método de acesso.
- Também haverá telefone e e-mail.
- Todos os métodos representam a mesma identidade de cliente.
- Todos os clientes possuem acesso à MIAR.
- Plano gratuito possui 20 mensagens por dia.
- Plano gratuito possui 2 uploads por dia.
- Respostas da MIAR não descontam uma nova mensagem.
- Erros técnicos não devem consumir cota.
- Cotas são renovadas diariamente.
- Existirão inicialmente três níveis:
  - Gratuito
  - MIAR+
  - MIAR Pro
- Não haverá IA ilimitada inicialmente.
- Marketplace e QR Menu são experiências separadas.

## Ainda pendente

- preço do MIAR+;
- preço do MIAR Pro;
- benefícios exatos de frete;
- limites definitivos dos planos pagos após análise de custos;
- detalhamento completo do onboarding após cadastro;
- regras finais de nutrição;
- definição dos benefícios exclusivos de cada assinatura.

---

# 21. Próximo fluxo a definir

A próxima etapa do Marketplace é definir o que acontece imediatamente após o primeiro cadastro.

Fluxo a detalhar:

```text
Cadastro concluído
        ↓
Onboarding
        ↓
Preferências
        ↓
Localização
        ↓
Primeira interação com a MIAR
        ↓
Home do Marketplace
```

Esse onboarding deverá ser projetado para fornecer contexto suficiente para a MIAR personalizar a experiência sem tornar o cadastro cansativo.