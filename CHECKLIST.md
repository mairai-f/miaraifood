# HappyCash Checklist de Prontidão Comercial

## 1. Produto e posicionamento
- [ ] Definir público-alvo e proposta de valor clara.
- [ ] Validar os principais fluxos com clientes reais.
- [ ] Confirmar diferenciais comerciais e casos de uso.

## 2. Funcionalidades essenciais
- [ ] Login/autenticação e autorização funcionando.
- [ ] Fluxo de assinatura/pagamento ativo e testado.
- [ ] Funções Supabase publicadas e operando.
- [ ] Envio de relatório de fechamento por e-mail configurado.
- [ ] Offline e sincronização locais estáveis.

## 3. Qualidade técnica
- [ ] `npm run lint` passa sem erros críticos.
- [ ] `npm test` passa e cobre os fluxos principais.
- [ ] `npm run build:all` gera builds web e site.
- [ ] App mobile Expo/WebView testado e documentado.
- [ ] Pipeline de release desktop validada.

## 4. Segurança e dependências
- [ ] Atualizar Electron e dependências críticas.
- [ ] Executar `npm audit` e corrigir vulnerabilidades.
- [ ] Confirmar que não há segredos expostos no código.
- [ ] Revisar CORS, validação de origens e CSP.

## 5. Lançamento e distribuição
- [ ] Validar processo de release desktop com tags e builds.
- [ ] Garantir secrets de release no GitHub Actions.
- [ ] Testar artefatos no diretório `release/`.
- [ ] Documentar instalação/implantação para desktop, web e mobile.

## 6. Mobile - pronto para APK e TestFlight
- [x] App Expo já existe em `mobile/` com `app.json` e `eas.json` configurados.
- [x] `android.package` e `ios.bundleIdentifier` já definidos.
- [x] Scripts de build Expo disponíveis:
  - `npm run build:android:apk`
  - `npm run build:android:store`
  - `npm run build:ios:store`
- [ ] Verificar configurações de Apple Developer e App Store Connect para TestFlight.
- [ ] Configurar credenciais EAS e registrar o projeto Expo em `expo.dev`.
- [ ] Verificar que o App Store Connect tem o app criado com o mesmo bundle identifier.
- [ ] Ter certificados/provisioning profiles iOS configurados no EAS.

## 7. Passo a passo para gerar APK e enviar para TestFlight
### Android APK
1. No diretório `mobile`, instale as dependências:
   - `npm install`
2. Verifique o `EXPO_PUBLIC_HAPPYCASH_WEB_URL` no `mobile/eas.json` ou via env.
3. Faça login no Expo/EAS:
   - `npx expo login`
   - `npx eas login`
4. Rode o build de preview:
   - `npm run build:android:apk`
5. Baixe o APK no painel do Expo e instale em um dispositivo Android para testar.

### Android para loja / AAB
1. Use o perfil de produção:
   - `npm run build:android:store`
2. Faça upload do AAB no Google Play Console para a faixa de teste interna.

### iOS / TestFlight
1. Confirme que o app está cadastrado no App Store Connect com `com.happycash.mobile`.
2. Configure Apple Developer + App Store Connect no EAS:
   - `npx eas credentials` (ou `npx eas build -p ios --profile production`)
3. Rode o build de produção:
   - `npm run build:ios:store`
4. Após o build, envie o binário para TestFlight com:
   - `npx eas submit --platform ios --profile production`
5. No App Store Connect, crie uma versão de TestFlight e convide testadores.

## 8. Próximos passos imediatos para mobile
- [ ] Confirmar que `EXPO_PUBLIC_HAPPYCASH_WEB_URL` está correto para builds de produção.
- [ ] Fazer um build Android APK com `eas build -p android --profile preview`.
- [ ] Fazer um build iOS com `eas build -p ios --profile production` e enviar para TestFlight.
- [ ] Documentar o processo de criação do pacote e distribuição móvel.
