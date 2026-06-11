# HappyCash Site

Esta pasta agora faz parte do repositório principal `HappyCash`.

Pontos importantes:
- O build oficial usa os scripts da raiz do projeto.
- O deploy da landing no Vercel deve usar `Root Directory = happycashsite`.
- A configuracao de deploy da landing fica em [`happycashsite/vercel.json`](/home/celio/Downloads/happycash/happycashsite/vercel.json:1).
- O `vite.config.ts` desta pasta usa `envDir: ".."`, então o ambiente canônico fica em `/.env`.
- O Supabase canônico do projeto fica em `/supabase`.
- A pasta `happycashsite/supabase` foi mantida apenas por compatibilidade, alinhada ao projeto principal para evitar divergências acidentais.
- O download do plano `PRO` agora usa a função `desktop-download` no Supabase, com bucket privado `desktop-downloads` e estas variáveis:
- `DESKTOP_DOWNLOAD_BUCKET`
- `DESKTOP_WINDOWS_OBJECT_PATH`
- `DESKTOP_LINUX_DEB_OBJECT_PATH`
- `DESKTOP_LINUX_APPIMAGE_OBJECT_PATH`
- `DESKTOP_DOWNLOAD_SIGNED_URL_TTL`
- O download do app mobile PRO usa a função `mobile-download` no Supabase e pode ser configurado com:
- `MOBILE_DOWNLOAD_BUCKET`
- `ANDROID_APK_OBJECT_PATH`
- `ANDROID_APK_URL` (alternativa direta ao bucket privado; evite usar URL temporaria do EAS, pois ela pode expirar/remover o artefato e causar erro `NoSuchKey`)
- `IOS_TESTFLIGHT_URL`
- `MOBILE_DOWNLOAD_SIGNED_URL_TTL`
- `MOBILE_RELEASE_PROVIDER=github` para buscar o APK Android do plano PRO direto da release mais recente em `HappyCash-Releases`
- O download do `HappyCashFood Offline` pode usar variaveis separadas:
- `FOOD_MOBILE_DOWNLOAD_BUCKET`
- `FOOD_ANDROID_APK_OBJECT_PATH`
- `FOOD_ANDROID_APK_URL`
- `FOOD_IOS_TESTFLIGHT_URL`
- `FOOD_MOBILE_RELEASE_PROVIDER=github` para buscar o APK direto do repositório `HappyCashFood-Releases`
- Rotas de download protegidas:
  - `/downloads/android` para APK Android
  - `/downloads/ios` para TestFlight iOS
- O fluxo comercial do desktop agora tambem pode usar assets do GitHub Release, com estas variáveis opcionais:
- `DESKTOP_RELEASE_PROVIDER=github`
- `GITHUB_DESKTOP_RELEASE_OWNER`
- `GITHUB_DESKTOP_RELEASE_REPO`
- `GITHUB_DESKTOP_RELEASE_CHANNEL`
- `GITHUB_DESKTOP_RELEASE_TOKEN` opcional para reduzir rate limit da API do GitHub
- O `HappyCashFood Offline` pode usar repo separado para Windows, `.deb` e `AppImage` com:
- `FOOD_DESKTOP_RELEASE_PROVIDER=github`
- `GITHUB_FOOD_RELEASE_OWNER`
- `GITHUB_FOOD_RELEASE_REPO`
- `GITHUB_FOOD_RELEASE_CHANNEL`
- `GITHUB_FOOD_RELEASE_TOKEN`
- A validação de licenca desktop usa a function `desktop-license`, e o app Electron so libera uso com plano `PRO` ativo.
- O fluxo de assinatura com Asaas agora usa:
- `finalize-site-registration` para preparar a conta e abrir o dashboard autenticado
- `create-plan-charge` para gerar cobranca Pix com QR Code ou abrir a fatura de debito / credito
- `asaas-webhook` para ativar o plano automaticamente quando o pagamento for confirmado
- Variáveis obrigatórias no Supabase:
- `ASAAS_ENVIRONMENT`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_AUTH_TOKEN`
- `SITE_EMAIL_CONFIRM_REDIRECT_URL` quando o link de confirmacao precisar voltar para o site publicado
- Para o webhook no Asaas, a URL do projeto deve apontar para:
- `https://<project-ref>.supabase.co/functions/v1/asaas-webhook`
- Eventos recomendados no Asaas:
- `PAYMENT_CREATED`
- `PAYMENT_UPDATED`
- `PAYMENT_OVERDUE`
- `PAYMENT_CONFIRMED`
- `PAYMENT_RECEIVED`
- `PAYMENT_DELETED`

Comandos oficiais:
- `npm run dev:site`
- `npm run build:site`
- `npm run preview:site`

Observacao operacional:
- Se `finalize-site-registration` nao estiver publicada, o navegador pode mostrar erro de CORS em `localhost`, mas a causa real costuma ser `404 Requested function was not found` no preflight do Supabase.
