-- Migration: Add expiry_date to products table
-- This field stores the product's expiration date for smart low-expiry notifications.

ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE;

COMMENT ON COLUMN products.expiry_date IS 'Data de validade do produto. Usada para alertas de proximidade do vencimento.';
