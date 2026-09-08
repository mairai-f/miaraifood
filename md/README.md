🍻 HappyCash - Sistema de gestao,frente de caixa,caderneta fiado,estoque.

Sistema completo de gestão e cobranças para adegas e pequenos comércios.
Simples, intuitivo e rápido para uso no dia a dia.
_______________________________________________________________________________

🚀 Tecnologias : 
⚛️ React
🟢 Supabase
🗄️ SQL
________________________________________________________________________________
📦 Funcionalidades :
👤 Cadastro de clientes
🛒 Cadastro de produtos
💰 Controle de cobranças
📲 Mensagens prontas para envio via WhatsApp (Web ou celular)
🎁 Sistema de recompensas
🗑️ Histórico de excluídos
📊 Painel de controle completo
🔍 Busca rápida e interface intuitiva
_________________________________________________________________________________
🖼️ Preview do Sistema :
👥 Clientes
🛒 Produtos
🎁 Recompensas
🗑️ Excluídos
🔐 Login
_________________________________________________________________________________
⚡ Objetivo : 

Facilitar o controle financeiro e organização de vendas para pequenos negócios, com foco em praticidade e agilidade.
_________________________________________________________________________________
📌 Status : 

🚧 Em desenvolvimento / melhorias contínuas
__________________________________________________________________________________
💡 Autor : CÉLIO ANTONIO DA SILVA JUNIOR

__________________________________________________________________________________
🆕 Release 0.1.14 :

- Pagamento de conta do fiado continua exigindo login e senha do administrador da mesma loja antes da confirmação.
- Pagamento acima da dívida agora é bloqueado antes de confirmar, inclusive quando a soma do valor com desconto ultrapassa o saldo.
- O download manual de atualização no desktop agora abre o HappyCash Site, sem expor a página de releases do GitHub para o cliente final.
- Operadores agora validam a licença desktop e mobile pela conta dona da loja, evitando bloqueio indevido ao entrar com usuário de operador.
- Quando a release ainda está sendo publicada no GitHub, o desktop trata a ausência temporária de `latest-linux.yml` ou `latest.yml` como publicação em andamento e tenta novamente sozinho, sem cair em erro definitivo.
- Campos de autorização e da tela de login agora abrem vazios, sem preenchimento automático.
- Modal de pagamento foi ajustado para não quebrar botões por espaçamento em celular e computador.

__________________________________________________________________________________
📧 E-mails HappyCash pelo Resend :

Os e-mails transacionais usam identidade HappyCash e remetente padrão:

```text
HappyCash <no-reply@auth.happycashsite.com.br>
```

Fluxos cobertos:

- Supabase Auth: confirmacao de conta, recuperacao de senha, magic link, convite, troca de e-mail, reautenticacao e notificacoes de seguranca.
- Edge Functions: boas-vindas, fechamento de caixa e envio de NFC-e por e-mail com DANFE HTML anexado.

Para ativar em producao, verifique o dominio no Resend, publique as funcoes e configure a API key:

```bash
npx supabase functions deploy finalize-site-registration send-cash-close-report send-fiscal-document-email --project-ref ymffclntmynwfdiarlaw

npx supabase secrets set --project-ref ymffclntmynwfdiarlaw RESEND_API_KEY="sua-chave-resend"
npx supabase config push --project-ref ymffclntmynwfdiarlaw
```

Secrets opcionais para sobrescrever remetente/fallbacks:

```bash
npx supabase secrets set --project-ref ymffclntmynwfdiarlaw \
  HAPPYCASH_FROM_EMAIL="HappyCash <no-reply@auth.happycashsite.com.br>" \
  CASH_CLOSE_REPORT_FROM_EMAIL="HappyCash <no-reply@auth.happycashsite.com.br>" \
  FISCAL_DOCUMENT_FROM_EMAIL="HappyCash <no-reply@auth.happycashsite.com.br>" \
  WELCOME_FROM_EMAIL="HappyCash <no-reply@auth.happycashsite.com.br>" \
  CASH_CLOSE_REPORT_RECIPIENTS="financeiro@empresa.com,gestor@empresa.com" \
  CASH_CLOSE_REPORT_TIMEZONE="America/Sao_Paulo" \
  CASH_CLOSE_REPORT_SUBJECT_PREFIX="[HappyCash]"
```

Comportamento:

- O fechamento de caixa envia para o destinatario informado, e usa o e-mail da loja como fallback.
- A tela Notas permite enviar NFC-e por e-mail e anexa um DANFE HTML simplificado.
- A boas-vindas e enviada ao finalizar o cadastro confirmado no site.
- O fechamento do caixa continua normalmente mesmo se o envio falhar, e o status aparece no recibo de fechamento.

__________________________________________________________________________________
🌐 HappyCash Site e pagamentos do plano :

O painel autenticado do site depende destas edge functions publicadas no Supabase:

```bash
supabase functions deploy finalize-site-registration
supabase functions deploy create-plan-charge
supabase functions deploy asaas-webhook
supabase functions deploy desktop-download
supabase functions deploy desktop-license
supabase functions deploy authorize-store-admin
```

Secrets obrigatórios para o fluxo de assinatura via Pix e cartao:

```bash
supabase secrets set ASAAS_ENVIRONMENT="production"
supabase secrets set ASAAS_API_KEY="sua-chave-asaas"
supabase secrets set ASAAS_WEBHOOK_AUTH_TOKEN="seu-token-webhook"
```

Secret recomendado para o fluxo de confirmação por email:

```bash
supabase secrets set SITE_EMAIL_CONFIRM_REDIRECT_URL="https://www.happycashsite.com.br/auth/callback?plan=demo"
```

Secrets opcionais para liberar download via GitHub Release no plano PRO:

```bash
supabase secrets set DESKTOP_RELEASE_PROVIDER="github"
supabase secrets set GITHUB_DESKTOP_RELEASE_OWNER="celioantonio7"
supabase secrets set GITHUB_DESKTOP_RELEASE_REPO="HappyCash-Releases"
supabase secrets set GITHUB_DESKTOP_RELEASE_CHANNEL="latest"
```

Observação:

- Se `finalize-site-registration` não estiver publicada, o navegador pode acusar erro de CORS no `localhost`, mas a causa real tende a ser `Requested function was not found` no preflight do Supabase.
- Se quiser fallback para storage privado em vez de GitHub Release, mantenha `desktop-download` configurada com `DESKTOP_DOWNLOAD_BUCKET`, `DESKTOP_WINDOWS_OBJECT_PATH`, `DESKTOP_LINUX_OBJECT_PATH` e `DESKTOP_DOWNLOAD_SIGNED_URL_TTL`.

__________________________________________________________________________________
🖥️ Versão Desktop (Electron) :

O projeto agora está preparado para rodar e empacotar como aplicativo desktop.

```bash
# rodar desktop em desenvolvimento
npm run electron:dev

# gerar executável/instalador da plataforma atual
npm run electron:build
```

O arquivo final será gerado na pasta `release/`.

Publicação comercial via GitHub Release:

```bash
# a tag precisa bater com a versão do package.json
git tag v0.1.14
git push origin v0.1.14
```

Também é possível publicar manualmente pelo GitHub:

1. Abra `Actions` no repositório.
2. Selecione `Desktop Release`.
3. Clique em `Run workflow`.
4. Deixe a versão vazia para usar a versão do `package.json`, ou informe a mesma versão sem o `v`.

O workflow `Desktop Release` valida versão, roda `lint`, `test` e `build:all` antes de publicar os assets de Windows e Linux.

Comandos úteis para empacotar esta atualização:

```bash
npm run build
npm run electron:build:win
npm run electron:build:linux
npm run electron:build:linux:deb
```

__________________________________________________________________________________
📱 Versão Mobile (Expo) :

O projeto agora também está preparado para testar Android e iOS com um app Expo separado em `mobile/`.

```bash
# iniciar o app mobile
npm run mobile:start
npm run mobile:android
npm run mobile:ios
```

Fluxo inicial:

```bash
cd mobile
npm install
```

Observações:

- O app mobile usa um `WebView` para carregar o HappyCash sem mexer no deploy web nem no Electron.
- Como o mobile abre o mesmo frontend autenticado, a nova exigência de login e senha do administrador no pagamento do fiado também vale para Android e iOS assim que o deploy web for atualizado.
- Para testar no celular pela rede local, rode o frontend principal com `npm run dev` e informe no app uma URL como `http://SEU-IP:8080`.
- Se depois quisermos gerar builds nativos para loja, a próxima etapa será adicionar EAS Build.
