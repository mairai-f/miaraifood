# HappyCash 0.1.35

Status: publicado.
Data: 2026-06-18

## PDV / Fiado

- Modo caixa em tela cheia com alternancia por F11.
- Leitura rapida do caixa com prioridade para produto e fallback para comanda.
- Atalhos de operador: F1 bip, F2 finalizar, F3 dinheiro, F4 Pix, F5 debito, F6 credito, F7 fiado, F8 preco, F9 confirmar, F10 fechar caixa e F12 buscar vendas.
- Checkout atualizado para exibir os atalhos numericos e F.

## Relatorios

- Totais principais passam a ignorar vendas canceladas.
- Novos indicadores de dono: ticket medio, margem, fiado aberto e itens por venda.
- Grafico por horario de maior movimento.
- Ranking de clientes por receita e produtos sem venda no periodo.

## HappyCash Agenda

- Visao geral com ticket medio, taxa de cancelamento, Pix pendente e estoque baixo.
- Cartoes operacionais para conferir Pix, repor estoque e acompanhar proximos horarios.

## Tutorial / Desktop

- Tutorial guiado corrigido para nao iniciar por cima do modal de configuracao offline do desktop.
- Passo "Abrir caixa" passa a apontar para o modal correto do PDV.
- Tutorial pula automaticamente os passos detalhados do PDV quando o caixa ainda esta bloqueado pela abertura.
- Rotas internas ajustadas para remover aviso do React Router e preservar restauracao de sessao.

## Mobile / APK

- Versao mobile preparada como 0.1.35.
- APK mantido na versao 0.1.35; publicacao desktop atualizada nesta rodada.
