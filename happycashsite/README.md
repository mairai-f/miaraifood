<div align="center">

<img src="public/logo.svg" alt="HappyCash Logo" width="90" />

# HappyCash ERP

### Gestão inteligente para negócios mais simples

Sistema ERP desenvolvido para empresas que precisam controlar vendas, estoque, clientes e financeiro em uma única plataforma.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)

</div>

---

# Sobre o Projeto

O **HappyCash ERP** é uma plataforma de gestão comercial criada para simplificar a rotina de pequenos e médios negócios.

O sistema centraliza as principais operações da empresa:

- Frente de Caixa (PDV)
- Controle de Estoque
- Cadastro de Produtos
- Gestão de Clientes
- Caderneta Fiado Digital
- Controle Financeiro
- Relatórios Gerenciais
- Integrações de Pagamento

A proposta é substituir controles manuais, planilhas e cadernetas por uma solução moderna, rápida e organizada.

---

# Principais Funcionalidades

## 🖥️ PDV Inteligente

Controle completo das vendas:

- Registro rápido de produtos
- Leitura de código de barras
- Diversas formas de pagamento
- Fechamento de caixa
- Histórico de vendas


## 📦 Controle de Estoque

Gerenciamento dos produtos:

- Entrada e saída de mercadorias
- Controle de quantidade
- Ajustes de estoque
- Histórico de movimentações


## 👥 Clientes e Fiado Digital

Organize vendas a prazo:

- Cadastro de clientes
- Histórico de compras
- Controle de valores pendentes
- Acompanhamento de pagamentos


## 📊 Relatórios Gerenciais

Informações para melhores decisões:

- Vendas por período
- Produtos mais vendidos
- Desempenho financeiro
- Indicadores do negócio


## 🔌 Funcionamento Offline

Arquitetura preparada para operação contínua:

- Funcionamento mesmo com conexão limitada
- Sincronização de dados
- Maior disponibilidade operacional


---

# Arquitetura da Plataforma

HappyCash ERP

├── Frontend
│ ├── Next.js
│ ├── React
│ ├── TypeScript
│ └── Tailwind CSS
│
├── Backend / Serviços
│ ├── Supabase
│ ├── PostgreSQL
│ └── APIs REST
│
├── Integrações
│ ├── Pagamentos
│ ├── Relatórios
│ └── Serviços externos
│
└── Aplicações
├── Web
├── Desktop
└── Mobile


---

# Tecnologias Utilizadas

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Framer Motion
- GSAP


### Backend

- Supabase
- PostgreSQL
- Edge Functions


### Desenvolvimento

- Git
- Docker
- VS Code
- Linux


---

# Estrutura do Projeto


happycashsite/

├── src/
│
│── app/
│ ├── pages
│ ├── layouts
│ └── api
│
├── components/
│ ├── sections
│ ├── ui
│ └── layout
│
├── messages/
│ ├── pt.json
│ └── en.json
│
├── public/
│ ├── images
│ └── assets
│
└── package.json


---

# Instalação Local

## Requisitos

- Node.js 20+
- npm


## Clonar projeto

```bash
git clone https://github.com/celioantonio7/happycash-site.git

cd happycash-site
Instalar dependências
npm install
Executar ambiente de desenvolvimento
npm run dev

Acesse:

http://localhost:3000
Roadmap
Em desenvolvimento
 Landing Page HappyCash
 Apresentação dos módulos
 Sistema multilíngue
 Design responsivo
Próximas versões
 Área do cliente
 Dashboard público
 Documentação da API
 Integrações adicionais
 Aplicativo Mobile
Sobre o HappyCash

O HappyCash nasceu com o objetivo de tornar a gestão empresarial mais simples.

Tecnologia, organização e dados trabalhando juntos para ajudar empresas a vender melhor e crescer.

<div align="center">

HappyCash ERP

Gestão inteligente. Negócios mais simples.

</div> ```

Também recomendo depois trocar:

public/Arfazrll_light.svg → pelo logo do HappyCash
PersonalBlog → happycash-site
links do GitHub antigo → seu repositório