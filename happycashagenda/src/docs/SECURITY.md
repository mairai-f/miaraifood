# 🔒 Segurança do Sistema

## Visão Geral

Este documento descreve as medidas de segurança implementadas no BarberPro.

---

## Autenticação

### Requisitos de Senha

O sistema exige senhas fortes para cadastro:

- **Mínimo 8 caracteres**
- **1 letra maiúscula** obrigatória
- **1 símbolo** obrigatório: `!@#$%^&*()_+-=[]{};'\:"|<>?,./\`~`

### Validação de Telefone

- Formato: 8-15 dígitos (com ou sem prefixo +)
- Telefone deve ser único no sistema (evita duplicatas)

### Métodos de Login

1. **Email/Senha**: Tradicional com validação
2. **Google OAuth**: Login social

---

## Row Level Security (RLS)

Todas as tabelas utilizam RLS para controle de acesso granular.

### Princípios

1. **Negação por padrão**: Sem política = sem acesso
2. **Mínimo privilégio**: Usuários só acessam o necessário
3. **Verificação server-side**: RLS é aplicado no banco de dados

### Políticas por Tabela

#### appointments

- Usuários: Ver/editar próprios agendamentos
- Barbeiros: Ver agendamentos atribuídos
- Admins: Acesso total

#### barbers

- Público: Ver barbeiros ativos
- Barbeiro: Ver próprios dados
- Admins: Gerenciar tudo

#### profiles

- Usuários: Ver/editar próprio perfil
- Sem acesso entre usuários

#### user_roles

- Usuários: Ver próprias permissões
- Admins: Gerenciar todas as permissões

---

## Validação de Entrada

### Client-side (Frontend)

Usando Zod para validação de schemas:

```typescript
const bookingSchema = z.object({
  clientName: z.string().trim().min(2).max(100),
  clientPhone: z.string().regex(/^\+?[0-9]{8,15}$/),
});
```

### Server-side (Database)

Trigger de validação no banco de dados:

```sql
CREATE TRIGGER validate_appointment_input_trigger
BEFORE INSERT OR UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION validate_appointment_input();
```

Validações aplicadas:

- Nome: 2-100 caracteres
- Telefone: Formato válido se fornecido

---

## Proteção de Dados

### Dados Sensíveis

- **Senhas**: Hash seguro via Supabase Auth
- **Tokens**: Gerenciados pelo Supabase
- **Logs**: Sem PII (informações pessoais identificáveis)

### Edge Functions

As funções serverless seguem boas práticas:

```typescript
// ❌ ERRADO: Logar dados sensíveis
console.log("Cliente:", clientName, "Phone:", clientPhone);

// ✅ CORRETO: Log mínimo necessário
console.log("Notification prepared for appointment:", appointmentId);
```

---

## Controle de Acesso

### Roles do Sistema

| Role   | Descrição     | Acessos                        |
| ------ | ------------- | ------------------------------ |
| admin  | Administrador | Acesso total                   |
| client | Cliente       | Próprios agendamentos          |
| barber | Barbeiro      | Próprios agendamentos + painel |

### Verificação de Permissões

```typescript
// Frontend (useAuth hook)
const { isAdmin, user } = useAuth();

// Backend (função has_role)
has_role(auth.uid(), "admin");
```

---

## CORS e Headers

### Edge Functions

⚠️ **Não use `'*'` em produção; especifique origens confiáveis.**

```typescript
const allowedOrigins = new Set([
  process.env.DEFAULT_ORIGIN,
  ...(process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
]);

function getCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}
```

---

## Armazenamento Seguro

### Secrets

Configurados via Lovable Cloud:

- `STRIPE_SECRET_KEY`: Chave da API Stripe
- `GOOGLE_CLIENT_SECRET`: OAuth Google

### Storage Buckets

Buckets públicos (intencionalmente):

- `barber-photos`: Fotos de barbeiros
- `product-images`: Imagens de produtos

> Nota: Estes são públicos pois exibem conteúdo na vitrine pública.

---

## Checklist de Segurança

### ✅ Implementado

- [x] RLS em todas as tabelas
- [x] Validação de entrada (client + server)
- [x] Senhas fortes obrigatórias
- [x] Logs sem dados sensíveis
- [x] CORS configurado
- [x] Verificação de roles server-side

### ⚠️ Requer Ação Manual

- [ ] Habilitar Leaked Password Protection no backend
- [x] Configurar rate limiting (serverless / edge functions)
- [ ] Revisar políticas de retenção de logs

---

## Recomendações

1. **Mantenha os secrets seguros**: Nunca compartilhe ou exponha chaves de API
2. **Monitore os logs**: Verifique periodicamente por atividades suspeitas
3. **Atualize dependências**: Mantenha as bibliotecas atualizadas
4. **Revise RLS regularmente**: Ao adicionar features, verifique as políticas
