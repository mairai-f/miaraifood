# Diagramas UML do HappyCash (PT‑BR)

## Diagrama de Classes

![Diagrama de Classes](/home/celio/.gemini/antigravity/brain/d03d9d85-ef02-40a8-ac5e-0bc1d5b01576/happycash_class_diagram_1787061286787.png)

> **Descrição** – Representa as principais classes do sistema (User, Admin, Operator, Product, Order, Payment, Invoice, Inventory, Supplier, Store, AuthContext, SupabaseClient, ElectronMainProcess) com atributos e métodos relevantes, além das relações de herança, associação e agregação.

---

## Diagrama de Casos de Uso

![Diagrama de Casos de Uso](/home/celio/.gemini/antigravity/brain/d03d9d85-ef02-40a8-ac5e-0bc1d5b01576/happycash_usecase_diagram_1787061303316.png)

> **Descrição** – Mostra as interações entre os atores (Administrador, Operador, Cliente) e os casos de uso do sistema, incluindo login, gerenciamento de usuários, produtos, vendas, emissão de nota fiscal, relatórios e sincronização offline.

---

## Diagrama de Sequência (Criação de Pedido)

![Diagrama de Sequência](/home/celio/.gemini/antigravity/brain/d03d9d85-ef02-40a8-ac5e-0bc1d5b01576/happycash_sequence_diagram_1787061323318.png)

> **Descrição** – Detalha o fluxo de criação de um pedido desde a interação do cliente na UI, passando pelo hook `useCreateOrder`, comunicação com `SupabaseClient`, uso do `AuthContext` e sincronização via `ElectronMainProcess`, concluindo com a geração da fatura.

---

## Diagrama de Componentes

![Diagrama de Componentes](/home/celio/.gemini/antigravity/brain/d03d9d85-ef02-40a8-ac5e-0bc1d5b01576/happycash_component_diagram_1787061341838.png)

> **Descrição** – Visão dos principais blocos de arquitetura: Frontend Web (React App com Pages, Components, Contexts, Hooks, Integrations), Electron Wrapper (Main Process, Preload, Renderer) e Supabase Backend (Auth, Database, Storage), e as dependências entre eles.

---

## Como usar
- **Referência rápida**: Abra este arquivo para ter todos os diagramas organizados em um único lugar.
- **Desenvolvimento**: Use os diagramas para orientar a implementação de novas funcionalidades ou a refatoração de componentes existentes.
- **Documentação**: Inclua este arquivo no `README.md` ou na pasta de documentação para fácil acesso da equipe.
