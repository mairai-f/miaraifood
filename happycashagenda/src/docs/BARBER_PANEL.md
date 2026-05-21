# 💈 Painel do Barbeiro

## Visão Geral

O Painel do Barbeiro é uma área exclusiva onde cada barbeiro pode visualizar seus agendamentos e acompanhar seus ganhos com comissões.

---

## Acesso

**Rota:** `/barber`

**Quem pode acessar:**
- Usuários com role `barber` na tabela user_roles
- Administradores (role `admin`)

---

## Funcionalidades

### 📊 Resumo de Ganhos

O painel exibe:
- **Total Faturado (Mês)**: Soma do preço de todos os serviços concluídos
- **Comissão Acumulada (Mês)**: Total de comissões baseado nos serviços concluídos
- **Agendamentos do Mês**: Quantidade de agendamentos realizados

### 📅 Agendamentos

Lista completa de agendamentos do barbeiro, organizada por:
1. **Agendados** - Próximos atendimentos
2. **Concluídos** - Atendimentos finalizados
3. **Cancelados** - Atendimentos cancelados

Cada agendamento mostra:
- Data e horário
- Nome do cliente
- Telefone do cliente
- Serviço realizado
- Valor do serviço
- Status atual

---

## Sistema de Comissões

### Como funciona

1. O administrador define a **comissão fixa em reais** para cada barbeiro
2. A cada serviço **concluído**, a comissão é contabilizada
3. O barbeiro visualiza seu acumulado no painel

### Cálculo

```
Comissão Total = Quantidade de Serviços Concluídos × Comissão por Serviço
```

**Exemplo:**
- Comissão definida: R$ 15,00
- Serviços concluídos no mês: 20
- Comissão total: R$ 300,00

---

## Vinculação Barbeiro ↔ Usuário

Para um usuário acessar o painel do barbeiro:

### 1. Criar conta de usuário
O barbeiro deve criar uma conta normal no sistema.

### 2. Vincular à tabela barbers
Execute o SQL:

```sql
-- Vincular usuário ao registro de barbeiro
UPDATE public.barbers
SET user_id = (
  SELECT id FROM auth.users WHERE email = 'email-do-barbeiro@exemplo.com'
)
WHERE name = 'Nome do Barbeiro';
```

### 3. Adicionar role barber
Execute o SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'barber'
FROM auth.users
WHERE email = 'email-do-barbeiro@exemplo.com';
```

---

## Configuração de Comissão

### Via Dashboard Admin

1. Acesse o Painel Administrativo
2. Vá para a aba "Barbeiros"
3. Clique em "Editar" no barbeiro desejado
4. Preencha o campo "Comissão por Serviço (R$)"
5. Salve

### Via SQL

```sql
UPDATE public.barbers
SET commission = 15.00  -- Valor em reais
WHERE name = 'Nome do Barbeiro';
```

---

## Políticas de Segurança

O painel respeita as seguintes regras de RLS:

1. **Barbeiros só veem seus próprios dados**
   - Vinculação via `barbers.user_id = auth.uid()`

2. **Agendamentos filtrados por barbeiro**
   - Política: `Barbers can view own appointments`

3. **Administradores têm visão completa**
   - Podem acessar o painel de qualquer barbeiro

---

## Arquivo de Implementação

**Localização:** `src/pages/BarberDashboard.tsx`

Este arquivo contém:
- Verificação de acesso (role barber ou admin)
- Busca de dados do barbeiro vinculado ao usuário
- Cálculo de comissões e estatísticas
- Listagem de agendamentos
- Interface responsiva
