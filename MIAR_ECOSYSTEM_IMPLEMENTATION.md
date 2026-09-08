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

- [ ] Cliente e Entregador usam `supabase.auth`.
- [ ] Sessão persistida e restauração automática.
- [ ] Cabeçalho `Authorization: Bearer <access_token>` nas funções.
- [ ] Tratamento único de sessão expirada.
- [ ] Cliente Supabase compartilhado sem service role.

### Fase 2 — Marketplace

- [ ] Listar estabelecimentos públicos.
- [ ] Listar categorias e produtos publicados.
- [ ] Exibir fotos armazenadas no bucket público/assinado.
- [ ] Resolver QR token de mesa.
- [ ] Criar sessão de mesa/cliente.
- [ ] Criar pedido com itens e adicionais.
- [ ] Consultar pedidos do cliente.
- [ ] Realtime do status do pedido.

### Fase 3 — Entregador

- [ ] Login Supabase e validação de perfil aprovado.
- [ ] Alternar disponibilidade.
- [ ] Consultar ofertas elegíveis.
- [ ] Aceitar uma oferta atomicamente.
- [ ] Atualizar estados da entrega.
- [ ] Enviar localização somente durante entrega ativa.
- [ ] Registrar PIN e ocorrências.
- [ ] Realtime para novas ofertas e alterações.

### Fase 4 — operação integrada

- [ ] Pedido aceito chega ao KDS.
- [ ] KDS marca pronto.
- [ ] Estabelecimento despacha pedido.
- [ ] Entregador aceita e cliente acompanha.
- [ ] Entrega concluída fecha o ciclo.
- [ ] Auditoria de cada transição.

## Critério de aceite ponta a ponta

`cliente autenticado → estabelecimento → produto → pedido → KDS → pronto → oferta → entregador aceita → rota/status → entrega concluída`.

Qualquer etapa que retornar 404, usar mock, aceitar usuário não autorizado ou não persistir no Supabase fica marcada como pendente.
