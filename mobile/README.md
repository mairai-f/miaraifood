# HappyCash Mobile

App Expo do HappyCash para testar Android e iOS sem mexer no frontend web atual.

## Como funciona

- Este app abre o HappyCash dentro de um `WebView`.
- Você pode apontar para uma URL pública ou para o frontend local na mesma rede.
- O caminho mais rápido para iPhone e Android é usar `Expo Go`.

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

## Observações

- Para iPhone via Expo Go, use um projeto compatível com Expo Go em dispositivo físico.
- Se depois quisermos gerar APK/AAB e build iOS nativo, o próximo passo será adicionar EAS Build.
