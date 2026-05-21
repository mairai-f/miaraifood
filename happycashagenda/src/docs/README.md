# BarberPro - Sistema de Agendamento para Barbearias

## 📋 Documentação Completa

Este documento serve como guia para entender, configurar e vender o sistema BarberPro.

### 📚 Documentação Adicional

- [Configuração de Administradores](./ADMIN_CONFIG.md)
- [Esquema do Banco de Dados](./DATABASE_SCHEMA.md)
- [Painel do Barbeiro](./BARBER_PANEL.md)
- [Sistema de Produtos](./PRODUCTS.md)
- [Segurança do Sistema](./SECURITY.md)

---

## 🎯 Visão Geral do Sistema

O BarberPro é um sistema completo de agendamento para barbearias que inclui:

- **Página inicial** com apresentação da barbearia
- **Sistema de agendamento** em 4 etapas
- **Área do cliente** para visualizar agendamentos
- **Dashboard administrativo** completo
- **Integração com pagamentos** (Stripe)
- **Notificações via WhatsApp** (pré-configurado)
- **Tema claro e escuro**

---

## 🏗️ Estrutura do Projeto

```
src/
├── components/          # Componentes reutilizáveis
│   ├── layout/         # Componentes de layout (Header, Layout)
│   └── ui/             # Componentes de interface (shadcn/ui)
├── hooks/              # React Hooks customizados
│   ├── useAuth.tsx     # Autenticação e gerenciamento de usuários
│   ├── useTheme.tsx    # Alternância de tema claro/escuro
│   └── useBusinessHours.tsx  # Horários de funcionamento
├── pages/              # Páginas da aplicação
│   ├── Index.tsx       # Página inicial
│   ├── Auth.tsx        # Login e cadastro
│   ├── Booking.tsx     # Sistema de agendamento
│   ├── MyAppointments.tsx  # Agendamentos do cliente
│   └── AdminDashboard.tsx  # Painel administrativo
├── integrations/       # Integrações externas
│   └── supabase/       # Cliente e tipos do Supabase
├── lib/                # Utilitários
└── assets/             # Imagens e recursos

supabase/
└── functions/          # Edge Functions (backend serverless)
    ├── create-payment/     # Processamento de pagamentos Stripe
    └── send-whatsapp-notification/  # Notificações WhatsApp
```

---

## 🔐 Sistema de Autenticação

### Arquivo: `src/hooks/useAuth.tsx`

Este hook gerencia toda a autenticação do sistema:

- **signIn**: Login com email/senha
- **signUp**: Cadastro de novos usuários (inclui telefone obrigatório)
- **signInWithGoogle**: Login social com Google
- **signOut**: Logout do sistema
- **isAdmin**: Verifica se o usuário é administrador

### Como tornar um usuário Administrador

Execute o seguinte SQL no banco de dados:

```sql
-- Substitua 'email@exemplo.com' pelo email do novo admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'email@exemplo.com';
```

---

## 📅 Sistema de Agendamento

### Arquivo: `src/pages/Booking.tsx`

O agendamento segue 4 etapas:

1. **Seleção de Serviço**: Cliente escolhe o serviço desejado
2. **Seleção de Barbeiro**: Cliente escolhe o profissional
3. **Data e Horário**: Seleção de data e horário disponível
4. **Confirmação**: Revisão e confirmação do agendamento

### Regras de Negócio

- **Domingos bloqueados**: Não é possível agendar aos domingos
- **Buffer de 45 minutos**: Intervalo mínimo entre agendamentos
- **Agendamento único por barbeiro**: Cliente não pode ter dois agendamentos ativos com o mesmo barbeiro

---

## 💳 Sistema de Pagamentos

### Arquivo: `supabase/functions/create-payment/index.ts`

Integração com Stripe para pagamentos online.

### Configuração Necessária

1. Acesse https://dashboard.stripe.com/apikeys
2. Copie a chave secreta (sk_live_xxx ou sk_test_xxx)
3. Adicione como secret `STRIPE_SECRET_KEY` no backend

### Opções de Pagamento

- **Online**: Redirecionamento para checkout do Stripe
- **Presencial**: Pagamento na hora do atendimento

---

## 📱 Notificações WhatsApp

### Arquivo: `supabase/functions/send-whatsapp-notification/index.ts`

Sistema pré-configurado para envio de notificações via WhatsApp.

### Configuração Necessária

1. Escolha um provedor de API WhatsApp (ex: Twilio, MessageBird)
2. Configure os secrets:
   - `WHATSAPP_API_URL`: URL da API do provedor
   - `WHATSAPP_API_KEY`: Chave de autenticação

---

## 🎨 Personalização Visual

### Arquivo: `src/index.css`

Todas as cores e estilos são configurados através de variáveis CSS:

```css
:root {
  --primary: 220 60% 25%;      /* Cor principal */
  --accent: 38 80% 55%;        /* Cor de destaque */
  --background: 220 20% 97%;   /* Fundo */
  /* ... outras variáveis */
}
```

### Para mudar o esquema de cores:

1. Identifique a variável desejada (ex: `--primary`)
2. Altere o valor HSL (Hue, Saturation, Lightness)
3. As mudanças são aplicadas automaticamente em todo o sistema

---

## 📊 Dashboard Administrativo

### Arquivo: `src/pages/AdminDashboard.tsx`

Funcionalidades disponíveis:

- **Visão Geral**: Estatísticas diárias, semanais e mensais
- **Agendamentos**: Lista completa com filtros e busca
- **Barbeiros**: CRUD completo + upload de foto
- **Serviços**: Gerenciamento de serviços e preços
- **Gráficos**: Visualização de dados (faturamento, agendamentos)

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| profiles | Dados dos usuários |
| barbers | Cadastro de barbeiros |
| services | Serviços oferecidos |
| appointments | Agendamentos |
| business_hours | Horários de funcionamento |
| user_roles | Permissões de usuário |

### Políticas de Segurança (RLS)

Todas as tabelas possuem políticas de Row Level Security configuradas para garantir que:
- Usuários só acessem seus próprios dados
- Administradores tenham acesso total
- Dados públicos (barbeiros, serviços) sejam visíveis para todos

---

## 🚀 Implantação

### Pré-requisitos

1. Conta no Lovable (https://lovable.dev)
2. Projeto com Lovable Cloud ativo

### Passos para Deploy

1. Faça as customizações necessárias
2. Configure os secrets (Stripe, WhatsApp)
3. Clique em "Publish" no canto superior direito
4. Escolha um domínio ou use o subdomínio .lovable.app

---

## 💰 Licenciamento e Venda

Este sistema pode ser vendido como:

1. **Produto único**: Venda a instalação personalizada
2. **SaaS**: Ofereça como serviço mensal
3. **White-label**: Remova a marca e venda como seu

### Pontos de Valor

- Sistema completo e funcional
- Código limpo e documentado
- Fácil personalização
- Integrações modernas (Stripe, WhatsApp)
- Design responsivo e elegante

---

## 📞 Suporte

Para dúvidas sobre a implementação ou customização, consulte:
- Documentação do Lovable: https://docs.lovable.dev
- Documentação do Supabase: https://supabase.com/docs
- Documentação do Stripe: https://stripe.com/docs
