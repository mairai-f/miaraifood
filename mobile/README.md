# HappyCash Mobile

Container Cordova do app principal do HappyCash.

## Como funciona

- O frontend usado no mobile e o mesmo `dist` gerado pelo app web principal.
- O script `prepare:web` recompila o projeto raiz e sincroniza o resultado para `mobile/www`.
- O build mobile fica isolado aqui para nao mexer no deploy web, no Electron nem na Vercel.

## Primeira configuracao

```bash
cd mobile
npm install
npx cordova platform add android
npx cordova platform add ios
```

## Comandos principais

Rodando da raiz do repositorio:

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

Ou rodando dentro de `mobile/`:

```bash
npm run prepare:web
npm run build:android
npm run build:ios
```

## Observacoes

- Android exige Android Studio e SDK configurados.
- iOS exige macOS com Xcode instalado.
- Links externos como WhatsApp e paginas web usam `cordova-plugin-inappbrowser`.
