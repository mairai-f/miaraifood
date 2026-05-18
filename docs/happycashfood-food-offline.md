# HappyCashFood Offline

## Objetivo

Este documento registra as mudancas feitas para separar o `HappyCashFood` do `HappyCash` principal no fluxo comercial, nos downloads protegidos e nas releases desktop/mobile.

## O que foi alterado

### `happycashfood`

- o menu interno nao mostra mais `Downloads` nem `QR menu`
- clicar na mesa abre a comanda em modal
- o botao `Adicionar produtos` fica dentro do modal da comanda
- o caixa agora abre o fechamento por mesa em modal
- a gestao foi separada por menus menores
- foi adicionado `Esqueci minha senha`
- a marca visivel ficou apenas como `HappyCashFood`
- o ranking automatico mostra os 5 produtos que mais saem

Arquivos principais:

- `happycashfood/src/components/AppShell.tsx`
- `happycashfood/src/components/TableBoard.tsx`
- `happycashfood/src/components/CheckoutPanel.tsx`
- `happycashfood/src/components/AdminPanel.tsx`
- `happycashfood/src/components/LoginScreen.tsx`
- `happycashfood/src/lib/foodAuth.ts`

Arquivos removidos:

- `happycashfood/src/components/MenuQrPanel.tsx`
- `happycashfood/src/components/OfflineDownloadsPanel.tsx`

### `happycashsite`

- o dashboard abre `HappyCashFood` quando o plano ativo e `food` ou `food_offline`
- os downloads continuam no site, nao dentro do sistema food
- quando o plano ativo e `food_offline`, os textos e botoes passam a tratar as releases do `HappyCashFood`
- o APK do food aparece separado no dashboard

Arquivos principais:

- `happycashsite/src/pages/Dashboard.tsx`
- `happycashsite/src/pages/HappyCashFood.tsx`
- `happycashsite/src/lib/subscriptionPlans.ts`
- `happycashsite/src/components/landing/Pricing.tsx`

### `Supabase`

- `desktop-download` ja reconhece `food_offline` e busca os arquivos do contexto `happycashfood`
- `mobile-download` agora tambem reconhece `food_offline`
- o APK Android do food pode vir de URL direta, storage privado ou GitHub Release
- foi criada migration para remover `restaurant.qr_menu` e restaurar o e-mail de teste do Celio ao `HappyCash` principal

Arquivos principais:

- `supabase/functions/desktop-download/index.ts`
- `supabase/functions/mobile-download/index.ts`
- `supabase/functions/_shared/githubRelease.ts`
- `supabase/migrations/20260514173000_remove_food_qr_and_restore_celio_happycash_access.sql`

## Releases separadas

### Desktop

Foi criada a configuracao:

- `electron-builder.food.json`

Ela publica no repositorio:

- `celioantonio7/HappyCashFood-Releases`

Scripts novos:

```bash
npm run build:food:desktop:renderer
npm run electron:build:food:win
npm run electron:build:food:win:portable
npm run electron:build:food:linux
npm run electron:build:food:linux:deb
npm run electron:build:food:linux:appimage
npm run electron:publish:food:win
npm run electron:publish:food:linux
```

O Electron agora separa:

- nome do app
- `AppUserModelId`
- arquivo do banco offline local
- diretorio do renderer

Arquivo principal:

- `electron/main.cjs`

### Android APK

O app mobile agora aceita contexto `happycashfood` com:

- nome separado
- `slug` separado
- `scheme` separado
- `bundle/package id` separado
- URL padrao do `HappyCashFood`

Arquivos principais:

- `mobile/app.config.js`
- `mobile/App.tsx`
- `mobile/eas.json`
- `mobile/package.json`

Scripts novos:

```bash
npm run mobile:start:food
npm run mobile:android:food
npm run mobile:build:android:apk:food
npm run mobile:build:android:store:food
```

## Variaveis de ambiente novas

### Desktop Food

```bash
FOOD_DESKTOP_RELEASE_PROVIDER=github
GITHUB_FOOD_RELEASE_OWNER=celioantonio7
GITHUB_FOOD_RELEASE_REPO=HappyCashFood-Releases
GITHUB_FOOD_RELEASE_CHANNEL=latest
GITHUB_FOOD_RELEASE_TOKEN=

FOOD_DOWNLOAD_BUCKET=happycashfood-downloads
FOOD_WINDOWS_OBJECT_PATH=
FOOD_LINUX_DEB_OBJECT_PATH=
FOOD_LINUX_APPIMAGE_OBJECT_PATH=
```

### Mobile Food

```bash
FOOD_MOBILE_RELEASE_PROVIDER=github
FOOD_MOBILE_DOWNLOAD_BUCKET=happycashfood-mobile-downloads
FOOD_ANDROID_APK_OBJECT_PATH=
FOOD_ANDROID_APK_URL=
FOOD_IOS_TESTFLIGHT_URL=
```

### EAS do app mobile food

```bash
HAPPYCASH_MOBILE_CONTEXT=happycashfood
EXPO_PUBLIC_HAPPYCASH_CONTEXT=happycashfood
EXPO_PUBLIC_HAPPYCASH_WEB_URL=https://food.happycashsite.com.br
HAPPYCASH_FOOD_MOBILE_EAS_PROJECT_ID=
```

## Pagamento e liberacao

Depois que o pagamento do plano `food_offline` for confirmado no Asaas:

1. o banco libera o plano da conta
2. o botao principal do dashboard passa a abrir o `HappyCashFood`
3. a rota protegida de download passa a entregar os arquivos do contexto `happycashfood`
4. o sistema food continua sem expor downloads dentro dele

## Status atual do offline

### Ja implementado

- desktop Windows/Linux com separacao de release
- `.deb` e `AppImage` separados para `HappyCashFood`
- APK Android separado no fluxo comercial e no build
- fallback de download por GitHub Release ou storage
- banco local desktop separado para nao misturar `HappyCash` e `HappyCashFood`

### Ainda depende de proxima etapa tecnica

- operacao `100% offline` real no Android
- envio online de pedidos do APK para balcao/chapa/caixa com fila local nativa
- cardapio da mesa com sincronizacao offline-first fora do navegador

Motivo:

O app Android atual ainda e um `WebView` da versao web. Ele ja pode ter release separada do `HappyCashFood`, mas para cumprir `100% offline` de verdade precisa de armazenamento local e fila de sincronizacao nativos no app mobile.

## HappyCash Menu

Foi iniciado um app separado em `happycashmenu/` para o dominio:

- `menu.happycashsite.com.br`

Objetivo:

- permitir que a empresa assinante do plano `food` ou `food_offline` monte o cardapio digital com o proprio nome comercial
- manter a marca `HappyCashFood` no rodape, na vitrine e no cupom do pedido
- publicar cardapio publico por slug da empresa
- aceitar pedidos por QR de mesa e por delivery
- cadastrar categorias, produtos, fotos, preco, disponibilidade, destaque, promocoes e mesas
- permitir cadastro do cliente com email, senha, telefone e endereco sem bloquear pedido sem login
- manter login administrador no padrao HappyCashFood com email, senha, perfil `admin` e assinatura ativa
- usar modal interno para confirmacoes do carrinho, sem alerta nativo do navegador
- adaptar o visual ao tema claro/escuro do dispositivo com cores do HappyCashFood
- gravar pedidos reais nas tabelas `restaurant_orders`, `restaurant_order_items` e `restaurant_delivery_orders`

Arquivos principais:

- `happycashmenu/`
- `supabase/functions/public-menu/index.ts`
- `supabase/functions/create-public-menu-order/index.ts`
- `supabase/migrations/20260518122000_create_happycash_menu_public_ordering.sql`

O nome exibido deve vir de `store_accounts.nome_estabelecimento` quando o cliente assinar/criar a empresa. Enquanto nao houver empresa real carregada, o app usa `Cantina Bella Mesa` apenas como fallback visual local.

## Repositorio remoto de release

O codigo ja foi preparado para usar:

- `HappyCashFood-Releases`

Se o repositório ainda nao existir no GitHub, ele precisa ser criado na conta `celioantonio7` antes da primeira publicacao automatica.
