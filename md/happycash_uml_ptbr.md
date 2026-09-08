# Diagramas da Arquitetura HappyCash (PT‑BR)

## Diagrama estático (componentes)

![Diagrama estático](/home/celio/.gemini/antigravity/brain/d03d9d85-ef02-40a8-ac5e-0bc1d5b01576/happycash_architecture_uml_1787059834235.png)

> **Descrição**: Visão geral dos principais blocos da aplicação HappyCash – frontend web (React + Vite), wrapper Electron e backend Supabase – e como eles se relacionam via contextos, hooks e IPC.

---

## Diagrama dinâmico (sequência de autenticação)

![Diagrama dinâmico](/home/celio/.gemini/antigravity/brain/d03d9d85-ef02-40a8-ac5e-0bc1d5b01576/happycash_login_sequence_1787059925231.png)

> **Descrição**: Fluxo de autenticação passo a passo, partindo da inserção das credenciais pelo usuário até a navegação para o Dashboard, envolvendo o hook `useLogin`, o cliente Supabase, o `AuthContext` e, quando houver, o processo principal do Electron via IPC.

---

### Como usar
- **Frontend**: Consulte o diagrama estático para entender a estrutura de pastas e as dependências entre componentes.
- **Autenticação**: O diagrama dinâmico detalha a ordem de chamadas e onde cada camada (hook, contexto, Electron) atua. Útil para depuração ou para implementar novos fluxos de login.

---

**Observação**: Caso deseje ampliar algum detalhe (por exemplo, fluxo de logout ou atualização de token), basta solicitar que eu gere diagramas adicionais.
