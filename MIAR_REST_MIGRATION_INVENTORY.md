# Inventário de REST legado

> Varredura realizada em 08/09/2026 com `fetch`, `axios`, `VITE_API_URL`,
> `API_URL` e caminhos `/api/`, ignorando `node_modules`, `dist` e service
> workers. Este documento é a fonte de verdade para remover o backend REST:
> frontend → Supabase Auth, PostgREST/RPC, Realtime, Storage ou Edge Function.
> Nenhuma tela nova deve introduzir `fetch('/api/...')`.

## Estado desta passagem

- **Migrado e aplicado:** catálogo público, resolução de QR, sessão de cliente
  QR, envio de pedidos QR, pedido Marketplace autenticado, acompanhamento de
  pedido, reclamação, avaliação e pedido de conta do Cliente.
- **Migrado de compilação:** Cliente e Entregador agora usam diretivas
  Tailwind 3 compatíveis com o PostCSS do monorepo; o erro `@layer base` não
  impede mais os dois builds.
- **Ainda legado:** módulos administrativos extensos do Gestor/Supergestora,
  painel completo de representante e módulos acessórios. Eles seguem abaixo
  para impedir que sejam esquecidos ou tratados como funcionais sem banco.

## 1. Representante

1. `gestor-representante/src/App.tsx` — **parcial:** login em Supabase; carteira, equipe, links e comissões ainda chamam `/api`.

## 2. Supergestora

2. `supergestora/src/App.tsx` — cliente REST central, CSRF e ações administrativas.
3. `supergestora/src/components/LojaSwitcher.tsx` — lojas e filiais.
4. `supergestora/src/components/ForgotPassword.tsx` — recuperação de senha.
5. `supergestora/src/components/operational-views.tsx` — pedidos operacionais e login legado.
6. `supergestora/src/components/new-modules.tsx` — visão, onboarding, código de barras e marketing.
7. `supergestora/src/components/FloatingChat.tsx` — chat legado.
8. `supergestora/src/i18n/IdiomaContext.tsx` — idioma padrão.

## 3. Entregador

9. `entregador/src/components/operational-views.tsx` — pedidos operacionais e login legado.
10. `entregador/src/components/RealLeafletMap.tsx` — **migrado:** removida rota REST; mapa recebe o trajeto e a posição via estado/Realtime. Roteamento viário pode virar Edge Function própria no futuro, sem expor API externa.
11. `entregador/src/components/EmployeePasskeyPrompt.tsx` — passkeys REST.
12. `entregador/src/components/new-modules.tsx` — visão, onboarding, código de barras e marketing.
13. `entregador/src/i18n/IdiomaContext.tsx` — idioma padrão.

## 4. Marketplace / Cliente

14. `cliente/src/App.tsx` — **migrado:** catálogo em `miaifood_public_menu`, QR em `food-qrmenu`; fidelidade permanece local até existir programa por estabelecimento.
15. `cliente/src/views/ProfileTab.tsx` — perfil, pets, agendamentos, chat, análise e endereços.
16. `cliente/src/views/Tracking.tsx` — **parcial:** status, reclamações, feedback e pedido de conta migrados; chat/estimativa de IA foi substituído por texto local até existir função MIAR IA no Supabase.
17. `cliente/src/views/OrdersView.tsx` — restauração de restaurantes.
18. `cliente/src/views/AIChat.tsx` — **migrado:** recomendações determinísticas sobre o catálogo publicado; nenhuma API REST/IA externa é chamada pelo navegador.
19. `cliente/src/views/Menu.tsx` — **migrado:** QR usa `food-qrmenu`; Marketplace usa `submit_marketplace_food_order`; tema publicado ainda precisa de tabela pública própria.
20. `cliente/src/views/EspacoArtista.tsx` — eventos e consumo.
21. `cliente/src/views/Onboarding.tsx` — recuperação de senha.
22. `cliente/src/views/SearchView.tsx` — **migrado:** busca no catálogo público e sinal em `marketplace_search_signals`; tendências em `marketplace_demand_trends`.
23. `cliente/src/views/ProfileSetup.tsx` — **migrado:** preferências básicas no `user_metadata` do Supabase Auth.
24. `cliente/src/components/WaiterCallButton.tsx` — chamados legados.
25. `cliente/src/components/PagamentoPix.tsx` — cobrança/status Pix legado.
26. `cliente/src/components/DeliveryTrackingView.tsx` — oferta ativa e SSE.
27. `cliente/src/components/PasskeyPrompt.tsx` — passkeys REST.

## 5. Dependências externas que não são REST do ecossistema

28. ViaCEP/Nominatim: validação de endereço, manter somente se necessário.
29. Service worker: `fetch` interno do navegador, não migrar.

## Ordem de migração

1. Autenticação e sessão do Representante/Supergestora.
2. LojaSwitcher e permissões administrativas.
3. Entregador: módulos operacionais legados e mapas.
4. Cliente: restaurantes, mesa, pedidos e tracking antigos.
5. Recursos acessórios: pets, marketing, chat, passkeys e IA.

Cada item só será marcado como migrado após persistir no Supabase, aplicar RLS e remover a chamada `/api` correspondente.

## Segunda varredura — Gestor legado (aplicativo separado)

O diretório `gestor/` possui outra implementação do painel. Seus pontos REST
não podem ser confundidos com o Gestor principal em `src/`:

1. `gestor/src/App.tsx` — sessão, sincronização e navegação de conta.
2. `gestor/src/pages/mesas.tsx` — mesas, QR e consumo antigo.
3. `gestor/src/components/LiveKitchenView.tsx` — fila KDS em polling REST.
4. `gestor/src/pages/funcionarios.tsx` — colaboradores e permissões.
5. `gestor/src/pages/configuracoes.tsx` — configurações e pagamentos.
6. `gestor/src/pages/chat-equipe.tsx` — chat operacional.
7. `gestor/src/pages/{estoque,compras,fornecedores,catalogo,ficha-tecnica}.tsx` — ERP legado.
8. `gestor/src/components/{operational-views,new-modules,LojaSwitcher,FloatingChat,PasskeyPrompt}.tsx` — módulos genéricos legados.

## Regras de encerramento

1. Cada substituição deve preservar RLS por estabelecimento, usuário e papel.
2. Mutações que exigem segredo (aprovar cadastro, criar convite, cobrar PIX,
   integrar provedor) ficam em Edge Function/RPC `SECURITY DEFINER`, nunca no
   navegador.
3. API de terceiros não entra no frontend: integrações futuras usam Edge
   Functions com secrets do Supabase.
