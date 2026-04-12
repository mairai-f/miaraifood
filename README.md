🍻 HappyCash - Sistema de Cobranças

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
