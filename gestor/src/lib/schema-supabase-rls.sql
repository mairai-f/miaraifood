-- ============================================================================
-- SCRIPT DE INICIALIZAÇÃO SUPABASE (MULTI-TENANT + RLS EM 100% DAS TABELAS)
-- Plataforma MIAR Foodservice Intelligence - 2026
-- ============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES DE AUTENTICAÇÃO E CLAIMS DO JWT
-- ----------------------------------------------------------------------------

-- Extrai o ID do tenant (company_id) do JWT autenticado no Supabase
CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
BEGIN
    RETURN (auth.jwt() -> 'user_metadata' ->> 'company_id')::UUID;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Verifica se o usuário autenticado é Superadmin da Supergestora
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = 'superadmin';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. TABELAS DO NÚCLEO MULTI-TENANT & SUPERRGESTORA
-- ----------------------------------------------------------------------------

-- 2.1 Empresas / Restaurantes (Tenants)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    document VARCHAR(20) UNIQUE NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 Planos e Assinaturas (Supergestora SaaS)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. USUÁRIOS & PERMISSÕES GRANULARES (RBAC)
-- ----------------------------------------------------------------------------

-- 3.1 Usuários / Colaboradores com vinculação a empresa
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pin_code VARCHAR(10), -- PIN de 4 dígitos atribuído pelo Administrador
    role VARCHAR(50) NOT NULL, -- superadmin, owner, manager, cashier, waiter, cook, delivery
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 Permissões dos 12 Módulos do Sistema
CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_key VARCHAR(50) NOT NULL,
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uk_user_module UNIQUE(user_id, module_key)
);

-- ----------------------------------------------------------------------------
-- 4. CARDÁPIO, INSUMOS & FICHA TÉCNICA (BAIXA AUTOMÁTICA)
-- ----------------------------------------------------------------------------

-- 4.1 Categorias de Produtos
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- 4.2 Insumos do Estoque
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- kg, g, l, ml, un
    current_stock DECIMAL(12,4) DEFAULT 0.0000,
    minimum_stock DECIMAL(12,4) DEFAULT 0.0000,
    cost_per_unit DECIMAL(10,4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.3 Produtos Acabados do Cardápio
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) DEFAULT 0.00,
    barcode VARCHAR(50),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4.4 Ficha Técnica (Receitas)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    quantity_required DECIMAL(12,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uk_product_ingredient UNIQUE(product_id, ingredient_id)
);

-- ----------------------------------------------------------------------------
-- 5. OPERAÇÃO: MESAS, CAIXA, PEDIDOS & IDEMPOTÊNCIA
-- ----------------------------------------------------------------------------

-- 5.1 Mesas
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    number INT NOT NULL,
    seats INT DEFAULT 4,
    sector VARCHAR(50) DEFAULT 'Salão Principal',
    status VARCHAR(20) DEFAULT 'free',
    qr_code_token VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uk_company_table_number UNIQUE(company_id, number)
);

-- 5.2 Turnos de Caixa
CREATE TABLE IF NOT EXISTS cash_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    opened_by_user_id UUID NOT NULL REFERENCES users(id),
    closed_by_user_id UUID REFERENCES users(id),
    opening_balance DECIMAL(10,2) NOT NULL,
    closing_balance DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'open',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- 5.3 Pedidos / Comandas (Com Chave de Idempotência)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cash_session_id UUID REFERENCES cash_sessions(id),
    table_id UUID REFERENCES tables(id),
    waiter_user_id UUID REFERENCES users(id),
    customer_name VARCHAR(255),
    type VARCHAR(30) NOT NULL, -- dine_in, counter, delivery, drive_thru
    status VARCHAR(30) NOT NULL, -- pending, preparing, ready, completed, canceled
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    idempotency_key VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE
);

-- Índice Único de Idempotência por Empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 5.4 Itens do Pedido
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. MOVIMENTAÇÃO DE ESTOQUE (BAIXAS AUTOMÁTICAS & ESTORNOS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
    movement_type VARCHAR(30) NOT NULL, -- sale_deduction, cancel_reversal, manual_entry, loss_waste
    quantity_changed DECIMAL(12,4) NOT NULL,
    previous_stock DECIMAL(12,4) NOT NULL,
    new_stock DECIMAL(12,4) NOT NULL,
    reason TEXT,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS) EM TODAS AS TABELAS
-- ----------------------------------------------------------------------------

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 8. POLÍTICAS DE SEGURANÇA POR TENANT (RLS POLICIES)
-- ----------------------------------------------------------------------------

-- Companies Policy
CREATE POLICY p_companies_superadmin ON companies FOR ALL USING (is_superadmin());
CREATE POLICY p_companies_tenant ON companies FOR SELECT USING (id = current_company_id());

-- Users & Permissions Policy
CREATE POLICY p_users_tenant ON users FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_user_permissions_tenant ON user_permissions FOR ALL USING (
    user_id IN (SELECT id FROM users WHERE company_id = current_company_id()) OR is_superadmin()
);

-- Products, Categories & Ingredients Policy
CREATE POLICY p_categories_tenant ON categories FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_products_tenant ON products FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_ingredients_tenant ON ingredients FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_recipes_tenant ON recipes FOR ALL USING (company_id = current_company_id() OR is_superadmin());

-- Tables, Cash Sessions, Orders & Stock Movements Policy
CREATE POLICY p_tables_tenant ON tables FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_cash_sessions_tenant ON cash_sessions FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_orders_tenant ON orders FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_order_items_tenant ON order_items FOR ALL USING (company_id = current_company_id() OR is_superadmin());
CREATE POLICY p_stock_movements_tenant ON stock_movements FOR ALL USING (company_id = current_company_id() OR is_superadmin());
