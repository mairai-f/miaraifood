# 🗄️ Esquema do Banco de Dados

## Visão Geral

Este documento descreve a estrutura completa do banco de dados do BarberPro.

---

## Tabelas

### 📋 appointments (Agendamentos)

Armazena todos os agendamentos do sistema.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | Não | Identificador único (auto-gerado) |
| client_id | uuid | Sim | ID do usuário que fez o agendamento |
| client_name | text | Não | Nome do cliente |
| client_phone | text | Sim | Telefone do cliente |
| barber_id | uuid | Não | ID do barbeiro |
| service_id | uuid | Não | ID do serviço |
| appointment_date | date | Não | Data do agendamento |
| appointment_time | time | Não | Horário do agendamento |
| status | enum | Não | Status: scheduled, completed, cancelled |
| notes | text | Sim | Observações |
| created_by | uuid | Sim | Quem criou o agendamento |
| created_at | timestamp | Não | Data de criação |
| updated_at | timestamp | Não | Última atualização |

**Políticas RLS:**
- Usuários podem ver e editar seus próprios agendamentos
- Barbeiros podem ver seus próprios agendamentos (via user_id na tabela barbers)
- Administradores têm acesso total

---

### 💈 barbers (Barbeiros)

Cadastro de barbeiros da barbearia.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | Não | Identificador único |
| name | text | Não | Nome do barbeiro |
| email | text | Sim | Email |
| phone | text | Sim | Telefone |
| bio | text | Sim | Biografia/descrição |
| photo_url | text | Sim | URL da foto do barbeiro |
| commission | numeric | Não | Comissão fixa por serviço (R$) |
| is_active | boolean | Não | Se está ativo no sistema |
| user_id | uuid | Sim | Vinculação com conta de usuário |
| created_at | timestamp | Não | Data de criação |
| updated_at | timestamp | Não | Última atualização |

**Políticas RLS:**
- Público pode ver barbeiros ativos
- Barbeiro pode ver seus próprios dados
- Administradores têm acesso total

---

### ✂️ services (Serviços)

Serviços oferecidos pela barbearia.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | Não | Identificador único |
| name | text | Não | Nome do serviço |
| description | text | Sim | Descrição |
| price | numeric | Não | Preço em reais |
| duration_minutes | integer | Não | Duração em minutos (padrão: 30) |
| is_active | boolean | Não | Se está ativo |
| created_at | timestamp | Não | Data de criação |
| updated_at | timestamp | Não | Última atualização |

**Políticas RLS:**
- Público pode ver serviços ativos
- Administradores têm acesso total

---

### 🛍️ products (Produtos)

Produtos vendidos na barbearia.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | Não | Identificador único |
| name | text | Não | Nome do produto |
| description | text | Sim | Descrição |
| price | numeric | Não | Preço em reais |
| stock_quantity | integer | Não | Quantidade em estoque |
| category | text | Sim | Categoria (ex: Gel, Tintas) |
| image_url | text | Sim | URL da imagem |
| is_active | boolean | Não | Se está ativo na vitrine |
| created_at | timestamp | Não | Data de criação |
| updated_at | timestamp | Não | Última atualização |

**Políticas RLS:**
- Público pode ver produtos ativos
- Administradores têm acesso total

---

### 👤 profiles (Perfis de Usuário)

Dados adicionais dos usuários.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | Não | ID do usuário (referência auth.users) |
| full_name | text | Não | Nome completo |
| phone | text | Sim | Telefone (único) |
| avatar_url | text | Sim | URL da foto de perfil |
| created_at | timestamp | Não | Data de criação |
| updated_at | timestamp | Não | Última atualização |

**Políticas RLS:**
- Usuários podem ver e editar seus próprios perfis

---

### 🔐 user_roles (Permissões)

Define as permissões dos usuários.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | Não | Identificador único |
| user_id | uuid | Não | ID do usuário |
| role | enum | Não | Papel: admin, client, barber |

**Políticas RLS:**
- Usuários podem ver suas próprias permissões
- Administradores podem gerenciar todas as permissões

---

### 🕐 business_hours (Horários de Funcionamento)

Configuração dos horários de funcionamento.

| Coluna | Tipo | Nullable | Descrição |
|--------|------|----------|-----------|
| id | uuid | Não | Identificador único |
| day_of_week | integer | Não | Dia da semana (0=Domingo, 6=Sábado) |
| open_time | time | Não | Horário de abertura |
| close_time | time | Não | Horário de fechamento |
| is_open | boolean | Não | Se funciona neste dia |

**Políticas RLS:**
- Público pode visualizar horários
- Administradores podem editar

---

## Enums (Tipos Personalizados)

### app_role
- `admin` - Administrador do sistema
- `client` - Cliente
- `barber` - Barbeiro

### appointment_status
- `scheduled` - Agendado
- `completed` - Concluído
- `cancelled` - Cancelado

---

## Funções do Banco de Dados

### has_role(user_id, role)
Verifica se um usuário possui determinada permissão.
Usa SECURITY DEFINER para funcionar corretamente com RLS.

### handle_new_user()
Trigger executado automaticamente ao criar novo usuário.
Cria o perfil automaticamente na tabela profiles.

### update_updated_at_column()
Trigger para atualizar automaticamente o campo updated_at.

### validate_appointment_input()
Trigger de validação para garantir:
- Nome do cliente: 2-100 caracteres
- Telefone: formato válido (8-15 dígitos)

---

## Storage Buckets

### barber-photos
- **Público**: Sim
- **Uso**: Fotos dos barbeiros

### product-images
- **Público**: Sim
- **Uso**: Imagens dos produtos

---

## Segurança

Todas as tabelas utilizam Row Level Security (RLS) para garantir que:
1. Usuários só acessem dados permitidos
2. Operações administrativas requerem role `admin`
3. Dados públicos são acessíveis para leitura
4. Modificações são protegidas por autenticação
