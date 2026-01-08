-- Adicionar campos de verificação de pedidos
-- Migration criada em: 07/01/2026

-- Adicionar colunas de verificação
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_is_verified ON orders(is_verified);
CREATE INDEX IF NOT EXISTS idx_orders_verified_by ON orders(verified_by);
CREATE INDEX IF NOT EXISTS idx_orders_verified_at ON orders(verified_at);

-- Adicionar comentários explicativos
COMMENT ON COLUMN orders.is_verified IS 'Indica se o pedido foi verificado/aprovado por um administrador';
COMMENT ON COLUMN orders.verified_by IS 'ID do usuário que verificou o pedido';
COMMENT ON COLUMN orders.verified_at IS 'Data e hora em que o pedido foi verificado';

-- Atualizar estatísticas da tabela para otimização de queries
ANALYZE orders;
