-- Adicionar campo is_verified na tabela clients
-- Migration criada em: 07/01/2026

-- Adicionar coluna is_verified
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Adicionar índice para performance em consultas filtradas
CREATE INDEX IF NOT EXISTS idx_clients_is_verified ON clients(is_verified);

-- Adicionar comentário explicativo
COMMENT ON COLUMN clients.is_verified IS 'Indica se o cliente foi verificado manualmente por um administrador';

-- Estatísticas: atualizar estatísticas da tabela para otimização
ANALYZE clients;
