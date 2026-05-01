# HappyCash Mobile

App Expo do HappyCash para testar Android e iOS sem mexer no frontend web atual.

## Como funciona

- Este app abre o sistema HappyCash dentro de um `WebView`.
- Você pode apontar para uma URL pública ou para o frontend local na mesma rede.
- O caminho mais rápido para iPhone e Android é usar `Expo Go`.

Por padrão, o app abre `https://happycash.vercel.app`.

## Instalação

```bash
cd mobile
npm install
```

## Rodando

Da raiz do repositório:

```bash
npm run mobile:start
npm run mobile:android
npm run mobile:ios
```

Ou dentro de `mobile/`:

```bash
npm run start
npm run android
npm run ios
```

## Teste local no celular

1. Rode o frontend principal do HappyCash na raiz com `npm run dev`.
2. Descubra o IP da máquina na rede local.
3. Abra o Expo Go no celular e escaneie o QR code do Expo.
4. No app, informe uma URL como `http://SEU-IP:8080`.

Você também pode definir essas variáveis antes de iniciar o Expo:

```bash
EXPO_PUBLIC_HAPPYCASH_WEB_URL="https://seu-endereco-publico"
EXPO_PUBLIC_HAPPYCASH_DEV_URL="http://SEU-IP:8080"
```

## Build Android e iOS com EAS

Este app já tem suporte a builds nativos via EAS, com configurações em `mobile/eas.json`.

### Android APK
1. No diretório `mobile`, instale as dependências:
   - `npm install`
2. Verifique o `EXPO_PUBLIC_HAPPYCASH_WEB_URL` no `mobile/eas.json` ou via env.
3. Faça login no Expo/EAS:
   - `npx expo login`
   - `npx eas login`
4. Faça o build de preview:
   - `npm run build:android:apk`
5. Baixe o APK no painel do Expo e instale em um dispositivo Android para testar.

### Android para loja / AAB
1. Use o perfil de produção:
   - `npm run build:android:store`
2. Faça upload do AAB no Google Play Console para faixa de teste interna ou alfa.

### iOS / TestFlight
1. Confirme que o app está cadastrado no App Store Connect com `com.happycash.mobile`.
2. Configure a conta Apple Developer e as credenciais no EAS:
   - `npx eas credentials`
3. Faça o build de produção:
   - `npm run build:ios:store`
4. Envie o app para TestFlight:
   - `npx eas submit --platform ios --profile production`
5. No App Store Connect, crie uma build de TestFlight e convide testadores.

### Observações sobre TestFlight
- O `bundleIdentifier` já está definido como `com.happycash.mobile`.
- Para usar TestFlight, você precisa cadastrar o app no App Store Connect e adicionar certificados/perfis de provisionamento.
- Se preferir, use `eas submit --platform ios --profile production` após o build.

## Observações

- Para iPhone via Expo Go, use um projeto compatível com Expo Go em dispositivo físico.
- Como o app mobile é um `WebView`, a exigência de login e senha do administrador para pagamento do fiado entra automaticamente nas builds Android/iOS quando a URL web publicada estiver atualizada.
- O mobile já está preparado para gerar APK e builds iOS nativos, mas precisa do fluxo Apple/credentials para TestFlight.
