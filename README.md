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
📧 Relatório de fechamento por e-mail :

Sempre que o caixa for fechado no PDV, o sistema agora tenta enviar o recibo de fechamento por e-mail.

Para ativar o envio, publique a função do Supabase e configure os secrets abaixo:

```bash
supabase functions deploy send-cash-close-report

supabase secrets set RESEND_API_KEY="sua-chave-resend"
supabase secrets set CASH_CLOSE_REPORT_FROM_EMAIL="HappyCash <no-reply@seudominio.com>"
```

Secrets opcionais:

```bash
supabase secrets set CASH_CLOSE_REPORT_RECIPIENTS="financeiro@empresa.com,gestor@empresa.com"
supabase secrets set CASH_CLOSE_REPORT_TIMEZONE="America/Sao_Paulo"
supabase secrets set CASH_CLOSE_REPORT_SUBJECT_PREFIX="[HappyCash]"
```

Comportamento:

- O sistema envia primeiro para o e-mail do usuário autenticado que fechou o caixa.
- Se o usuário autenticado não tiver e-mail disponível, ele usa `CASH_CLOSE_REPORT_RECIPIENTS` como fallback.
- O fechamento do caixa continua normalmente mesmo se o envio falhar, e o status aparece no recibo de fechamento.

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
- Para testar no celular pela rede local, rode o frontend principal com `npm run dev` e informe no app uma URL como `http://SEU-IP:8080`.
- Se depois quisermos gerar builds nativos para loja, a próxima etapa será adicionar EAS Build.
