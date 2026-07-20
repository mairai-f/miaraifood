# HappyCash Android

App Android do HappyCash para instalar por APK ou publicar na Google Play.

## Como funciona

- Por padrão, o app abre `https://app.happycashsite.com.br`.
- O APK inicia direto no HappyCash, sem tela de URL, sem botão de abrir site externo e sem modo de configuração visível para o cliente.
- No plano PRO, o app usa o mesmo preparo local do desktop para permitir contingência offline por até 24 horas depois de uma validação online.

## Instalação

```bash
cd mobile
npm install
```

## Rodando no Android

Da raiz do repositório:

```bash
npm run mobile:start
npm run mobile:android
```

Ou dentro de `mobile/`:

```bash
npm run start
npm run android
```

## URL do sistema

Para apontar uma build de teste para outro ambiente, defina:

```bash
EXPO_PUBLIC_HAPPYCASH_WEB_URL="https://seu-endereco-publico"
```

## Build Android com EAS

As configurações ficam em `mobile/eas.json`.

### Android APK

1. No diretório `mobile`, instale as dependências:
   - `npm install`
2. Verifique o `EXPO_PUBLIC_HAPPYCASH_WEB_URL` no `mobile/eas.json` ou via env.
3. Faça login no Expo/EAS:
   - `npx expo login`
   - `npx eas login`
4. Gere o APK de preview:
   - `npm run build:android:apk`
5. Baixe o APK no painel do Expo e instale em um dispositivo Android para testar.

### Android para loja / AAB

1. Use o perfil de produção:
   - `npm run build:android:store`
2. Faça upload do AAB no Google Play Console para faixa de teste interna ou alfa.

## Offline Android

- O primeiro acesso precisa ser online, com plano PRO ativo.
- Depois do login online, o app valida a licença e prepara os dados locais.
- Se a internet cair, administrador e operadores preparados podem usar o app por até 24 horas.
- Ao reconectar, o HappyCash sincroniza as operações pendentes e renova a validação local.
