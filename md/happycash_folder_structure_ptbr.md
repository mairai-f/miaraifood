# Estrutura de Pastas do HappyCash (PT‑BR)

```text
HappyCash/
├─ .git/                     # Repositório Git
├─ .github/                  # Workflows CI/CD
├─ .expo/                    # Configurações do Expo (se houver)
├─ .vercel/                  # Configurações de deploy Vercel
├─ node_modules/             # Dependências npm
├─ public/                   # Arquivos estáticos (favicon, imagens)
├─ scripts/                  # Scripts de automação (link‑skills, build, etc.)
├─ docs/                     # Documentação geral do projeto
│   └─ ...
├─ happycashsite/            # Front‑end web (Vite/React) – código principal
│   ├─ src/                  # Código fonte da aplicação React
│   │   ├─ assets/           # Imagens, ícones, fontes
│   │   ├─ components/       # Componentes UI reutilizáveis
│   │   │   ├─ ui/            # Componentes visuais (Botões, Cards, etc.)
│   │   │   ├─ operations/   # Telas de operação (PDV, Vendas, etc.)
│   │   │   ├─ reports/      # Relatórios e dashboards
│   │   │   └─ ...
│   │   ├─ contexts/         # React Contexts (AuthContext, ThemeContext, DataContext)
│   │   ├─ hooks/            # Custom hooks (useLogin, useFetch, useTheme, ...)
│   │   ├─ integrations/     # Integrações com serviços externos (Supabase, APIs)
│   │   ├─ lib/              # Funções utilitárias e helpers
│   │   ├─ pages/            # Rotas da aplicação (Login.tsx, Dashboard.tsx, ...)
│   │   ├─ routes/           # Definições do React Router (arquivo routes.tsx)
│   │   ├─ App.tsx           # Componente raiz da UI React
│   │   ├─ index.css         # Estilos globais (Tailwind, CSS custom)
│   │   ├─ main.tsx          # Ponto de entrada (ReactDOM.render)
│   │   └─ vite-env.d.ts     # Tipagens do Vite
│   ├─ electron/             # Código do wrapper Electron
│   │   ├─ main/              # Processo principal (main.ts)
│   │   ├─ preload/           # Scripts de pré‑carregamento (ex.: ipcBridge.ts)
│   │   └─ ...
│   ├─ package.json          # Dependências e scripts npm
│   ├─ vite.config.ts        # Configurações do Vite
│   ├─ tailwind.config.ts    # Configurações do Tailwind CSS
│   └─ ...
├─ happycashagenda/          # Módulo de agenda (separado)
├─ happycashfood/            # Módulo de cardápio/food
├─ happycashmenu/            # Módulo de menu
├─ mobile/                   # Código / assets específicos para mobile (if any)
├─ native/                   # Código nativo (ex.: Android/iOS builds)
├─ build/                    # Artefatos de build (gerados)
├─ dist/                     # Distribuição final (gerada pelo Vite/Electron)
├─ .env, .env.example       # Variáveis de ambiente
├─ .gitignore                # Arquivos a serem ignorados pelo Git
├─ README.md                 # Documentação principal do projeto
└─ ...                       # Outros arquivos de configuração (eslint, tsconfig, etc.)
```

### Como utilizar
- **Navegação**: Cada pasta tem um propósito bem definido – siga a estrutura ao criar novos recursos.
- **Extensibilidade**: Para novos módulos (ex.: `happycashorders`), crie um diretório ao nível da raiz e siga a mesma organização interna (`src/pages`, `src/components`, etc.).
- **Electron**: Qualquer comunicação entre o processo principal e o renderer deve passar por `electron/preload` usando IPC.

---

> **Dica**: Mantendo essa árvore atualizada no `README.md` ajuda novos desenvolvedores a entender rapidamente o layout do repositório.
