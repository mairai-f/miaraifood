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
- `DESKTOP_LINUX_OBJECT_PATH`
- `DESKTOP_DOWNLOAD_SIGNED_URL_TTL`
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
