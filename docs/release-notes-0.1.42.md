# HappyCash 0.1.42

Status: preparando publicacao.
Data: 2026-06-24

## PDV / Scanner / Comandas

- Busca unificada no PDV para produto por nome parcial ou codigo de barras e comanda por numero puro ou codigo `HC`.
- Leitor de codigo de barras isolado dos atalhos globais quando modal de pagamento, confirmacao ou produto nao encontrado estiver aberto.
- Modal de produto ou comanda nao encontrada bloqueado ate fechar por `Esc`, `Enter` ou botao `Fechar`.
- Ao abrir uma comanda vazia no PDV, o caixa permite lancar produtos normalmente.
- `Esc` duplo com comanda aberta agora pede confirmacao antes de tirar a comanda da tela.
- Troca de comanda no PDV tambem pede confirmacao antes de sair da comanda atual.
- Double click passou a ser bloqueado no PDV para evitar lancamento duplicado de produto.

## Regras de comandas e produtos

- Comandas passam a usar codigo automatico no formato `HC001` ate `HC9999`, preservando leitura de codigos legados `HC-CMD-0001`.
- Cadastro de comanda simplificado para numero unico, com codigo de barras gerado automaticamente e exibido na tela de comandas.
- Tela de comandas fica apenas para cadastro e consulta; lancamento e fechamento seguem centralizados no PDV.
- Produtos deixam de ser buscados pelo codigo interno digitado no PDV e passam a aceitar nome parcial e codigo de barras cadastrado.
- Cadastro de produto orienta os formatos de codigo de barras suportados: EAN-8, UPC, EAN-13 e ITF-14.

## Clientes e operacao

- Busca de clientes normalizada para maiusculas e sem acento, com persistencia do nome em caixa alta no cadastro e edicao.
- Exibicao de codigo curto de produto padronizada como `P01`, `P02` e assim por diante nas telas auxiliares.

## Banco de dados

- Migracoes novas normalizam os codigos de barras das comandas existentes para o padrao `HC` e ajustam as constraints para numeros de 1 a 9999.

## Mobile / APK

- Codigo mobile alinhado para a versao `0.1.42`.
- Publicacao do APK depende de login no Expo/EAS no ambiente de build.
