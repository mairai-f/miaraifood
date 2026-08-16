# 📚 Guia do Desenvolvedor — HappyCash

> Documentação interna em português para novos membros do time.

---

## 🏗️ Estrutura dos Projetos

O repositório contém **dois projetos**:

| Projeto | Pasta | Tecnologia | Descrição |
|---|---|---|---|
| **ERP Desktop** | `/` (raiz) | Electron + React + Vite | Aplicativo instalável de gestão (PDV, estoque, fiado, financeiro) |
| **Site Institucional** | `happycashsite/` | Next.js 15 + Tailwind | Site público de apresentação e captação de clientes |

---

## 📁 ERP — Estrutura Principal

```
/
├── electron/           # Processo principal do Electron
│   ├── main.ts         # Cria a janela do app e gerencia ciclo de vida
│   ├── preload.ts      # Bridge segura entre Electron (Node) e React (UI)
│   └── updater.ts      # Atualizações automáticas via GitHub Releases
│
├── src/                # Interface React (roda dentro do Electron)
│   ├── main.tsx        # Ponto de entrada React
│   ├── App.tsx         # Rotas (React Router) e contexto global
│   ├── pages/          # Uma pasta por módulo/tela do ERP
│   ├── components/     # Componentes reutilizáveis
│   ├── hooks/          # Custom hooks (useAuth, usePDV, useEstoque...)
│   └── lib/
│       └── supabase.ts # Cliente Supabase — toda query de banco passa aqui
│
└── supabase/
    └── migrations/     # SQL de criação e alteração de tabelas
```

---

## 📁 Site — Estrutura Principal (`happycashsite/src/`)

```
app/                    # Rotas Next.js (App Router)
├── page.tsx            # Página inicial (/)
├── planos/             # /planos — cards de preço + FAQ
├── funcionalidades/    # /funcionalidades — lista de módulos
├── telas/              # /telas — galeria de screenshots
├── termos/             # /termos — política de privacidade
├── cadastro/           # /cadastro — criação de conta
└── (dashboard)/        # Área logada (downloads, dados da conta)

components/
├── layout/
│   ├── Navbar.tsx      # Menu de navegação (desktop + mobile hamburger)
│   └── Footer.tsx      # Rodapé institucional
└── sections/           # Seções da página inicial
    ├── HeroVisual.tsx          # Banner principal com CTA
    ├── AboutSection.tsx        # Módulos com animações de scroll
    ├── PricingSection.tsx      # Cards de planos (Demo, Completo, PRO)
    └── ExpertiseSection.tsx    # Recursos e diferenciais

ui/
├── animated-scroll.tsx             # Scroll parallax "Gestão Inteligente" (desktop only)
├── argent-loop-infinite-slider.tsx # Timeline de funcionalidades (desktop) / cards (mobile)
└── horizontal-timeline.tsx         # Timeline horizontal de módulos (desktop only)

lib/
└── subscriptionPlans.ts    # Define preços e features dos planos

data/
└── portfolio.ts            # Conteúdo do site (textos, links, imagens dos módulos)

messages/
└── pt.json                 # Todas as strings de texto em português (i18n)
```

---

## 🗄️ Banco de Dados — Supabase

> **Importante:** Toda query usa o cliente em `src/lib/supabase.ts`. Nunca conecte diretamente.

### Tabelas principais

| Tabela | O que armazena |
|---|---|
| `empresas` | Dados da loja (nome, CNPJ, chave, plano ativo) |
| `operadores` | Usuários do caixa (PIN, nível de acesso, empresa) |
| `produtos` | Catálogo com preço, custo, estoque e código de barras |
| `vendas` | Cabeçalho de cada venda (data, operador, total, pagamento) |
| `itens_venda` | Linhas de cada venda (produto, qty, preço unitário) |
| `clientes` | Cadastro com limite de crédito e saldo de fiado |
| `fiado` | Transações de crédito/débito de cada cliente |
| `caixa_sessoes` | Abertura/fechamento de caixa com totais |
| `movimentacoes` | Sangrias, suprimentos e ajustes financeiros |
| `assinaturas` | Plano e status de pagamento de cada empresa |
| `estoque_movimentos` | Histórico de entradas e saídas do estoque |

> **RLS ativo em todas as tabelas.** Dados de uma empresa nunca são acessíveis por outra.
> A regra filtra automaticamente por `empresa_id = auth.jwt()->>'empresa_id'`.

---

## 🎨 Padrão de Comentários (use em todos os `.tsx` e `.ts`)

```tsx
// ============================================================
// NOME DO COMPONENTE — caminho/do/arquivo.tsx
// Responsabilidade: O que este componente faz
// Usado em: Onde é importado/renderizado
// ============================================================

// --- Tipos e Interfaces ---
// Define o formato dos dados recebidos via props

// --- Estado (State) ---
// Variáveis reativas que controlam a interface

// --- Efeitos (useEffect) ---
// Executado quando [dependências] mudam

// --- Handlers ---
// Funções que respondem a interações do usuário

// --- Render ---
// O que é exibido na tela
```

---

## ⚠️ Regras Importantes

### ❌ NÃO faça

- **Não adicione `//` comentários em arquivos `.json`** — JSON não suporta comentários e quebra o build
- **Não use `position: sticky` ou scroll-hijacking no mobile** sem um fallback `md:hidden`
- **Não remova as políticas RLS do Supabase** — é a segurança que isola dados por empresa
- **Não coloque variáveis de ambiente no código** — use apenas o arquivo `.env`

### ✅ Sempre faça

- Animações pesadas dentro de `hidden md:block` com fallback estático no mobile
- Verificar `useIsMobile()` antes de ativar ScrollTrigger / GSAP em componentes
- Criar arquivo em `supabase/migrations/` se alterar estrutura do banco
- Testar no mobile (viewport < 768px) antes de fazer PR

---

## 🚀 Scripts

### Site (`happycashsite/`)
```bash
npm run dev      # Servidor local → http://localhost:3000
npm run build    # Build de produção
npm run lint     # Verifica erros
```

### ERP Desktop (raiz `/`)
```bash
npm run dev      # Inicia app Electron em desenvolvimento
npm run build    # Gera executável (.AppImage / .deb)
```

---

## 📋 Checklist para Pull Requests

- [ ] Comentários em português explicando o que o código faz
- [ ] Testado no mobile (< 768px) — sem sobreposição ou scroll travado
- [ ] Animações pesadas dentro de `md:block` ou com `useIsMobile()` check
- [ ] Nenhum comentário em arquivos `.json`
- [ ] Variáveis sensíveis no `.env`, nunca no código
- [ ] Se alterou tabelas do Supabase → criou arquivo em `supabase/migrations/`
