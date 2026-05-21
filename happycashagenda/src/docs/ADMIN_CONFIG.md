# 🔐 Configuração de Administradores

## Como Tornar um Usuário Administrador

Este documento explica como atribuir permissões de administrador a um usuário.

---

## Pré-requisito

O usuário precisa **primeiro criar uma conta** no sistema através da página de cadastro.

---

## Método 1: Via Interface do Lovable Cloud

1. Acesse o painel do Lovable Cloud (Backend)
2. Navegue até a tabela `user_roles`
3. Clique em "Insert Row"
4. Preencha:
   - `user_id`: ID do usuário (encontre na tabela `profiles` ou `auth.users`)
   - `role`: `admin`
5. Salve

---

## Método 2: Via SQL (Recomendado)

Execute o seguinte comando SQL no editor de queries:

```sql
-- =====================================================
-- CONFIGURAÇÃO DE ADMINISTRADOR
-- =====================================================
--
-- INSTRUÇÕES:
-- 1. Substitua 'email@exemplo.com' pelo email do usuário
-- 2. Execute o comando
-- 3. O usuário terá acesso administrativo imediato
--
-- =====================================================

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'email@exemplo.com';
```

---

## Verificar Administradores Existentes

Para ver todos os administradores do sistema:

```sql
SELECT
  u.email,
  u.created_at as conta_criada,
  ur.role
FROM auth.users u
JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';
```

---

## Remover Permissão de Administrador

Para remover as permissões de admin:

```sql
DELETE FROM public.user_roles
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'email@exemplo.com'
)
AND role = 'admin';
```

---

## Administrador Atual do Sistema

O administrador principal configurado é:

📧 **Email**: `celioantonio.dev@gmail.com`

---

## Segurança

A verificação de admin é feita através de:

1. **Tabela user_roles**: Armazena as permissões
2. **Função has_role()**: Verifica permissões em queries SQL
3. **Hook useAuth**: Verifica permissões no frontend

O sistema usa Row Level Security (RLS) para garantir que apenas administradores possam executar ações administrativas.
