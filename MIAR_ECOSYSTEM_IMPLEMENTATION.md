# MIAR AI/FOOD — Plano de implementação executável

Este arquivo é a referência de engenharia para concluir a migração do Cliente/Marketplace e do Entregador para Supabase. Nenhuma tela deve ser considerada funcional apenas por abrir: cada item precisa passar pelo critério de aceite indicado.

## Regras

- Supabase é a fonte de dados e autenticação.
- Edge Functions são a camada de operações que exigem validação server-side.
- RLS deve isolar estabelecimento, cliente, funcionário e entregador.
- Nenhum token privilegiado pode chegar ao navegador.
- APIs antigas só permanecem enquanto existir um fluxo ainda não migrado.
- Não usar dados fictícios para mascarar falhas de integração.

## Fases

### Fase 1 — fundação compartilhada

- [x] Cliente e Entregador usam `supabase.auth`.
- [x] Sessão persistida e restauração automática.
- [x] Cabeçalho `Authorization: Bearer <access_token>` nas funções.
- [x] Tratamento único de sessão expirada.
- [x] Cliente Supabase compartilhado sem service role.

### Fase 2 — Marketplace

- [x] Listar estabelecimentos públicos.
- [x] Listar categorias e produtos publicados.
- [x] Exibir fotos armazenadas no bucket público/assinado.
- [x] Resolver QR token de mesa.
- [x] Criar sessão de mesa/cliente.
- [x] Criar pedido com itens e adicionais.
- [x] Consultar pedidos do cliente.
- [x] Realtime do status do pedido.

### Fase 3 — Entregador

- [x] Login Supabase e validação de perfil aprovado.
- [x] Alternar disponibilidade.
- [x] Consultar ofertas elegíveis.
- [x] Aceitar uma oferta atomicamente.
- [x] Atualizar estados da entrega.
- [x] Enviar localização somente durante entrega ativa.
- [x] Registrar PIN e ocorrências.
- [x] Realtime para novas ofertas e alterações.

### Fase 4 — operação integrada

- [x] Pedido aceito chega ao KDS.
- [x] KDS marca pronto.
- [x] Estabelecimento despacha pedido.
- [x] Entregador aceita e cliente acompanha.
- [x] Entrega concluída fecha o ciclo.
- [x] Auditoria de cada transição.

## Critério de aceite ponta a ponta

`cliente autenticado → estabelecimento → produto → pedido → KDS → pronto → oferta → entregador aceita → rota/status → entrega concluída`.

Qualquer etapa que retornar 404, usar mock, aceitar usuário não autorizado ou não persistir no Supabase fica marcada como pendente.
