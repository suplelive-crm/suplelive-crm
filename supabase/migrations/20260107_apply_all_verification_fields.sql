-- ============================================================================
-- MIGRATION: Adicionar Campos de Verificação
-- Data: 07/01/2026
-- Descrição: Adiciona campos de verificação para clientes e pedidos
-- ============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAÇÃO DE CLIENTES
-- ============================================================================

-- Adicionar campo is_verified à tabela clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_clients_is_verified ON clients(is_verified);

-- Adicionar comentário
COMMENT ON COLUMN clients.is_verified IS 'Indica se o cliente foi verificado manualmente por um administrador';

-- Atualizar estatísticas da tabela
ANALYZE clients;

-- ============================================================================
-- PARTE 2: VERIFICAÇÃO DE PEDIDOS
-- ============================================================================

-- Adicionar campos de verificação de pedidos
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_orders_is_verified ON orders(is_verified);
CREATE INDEX IF NOT EXISTS idx_orders_verified_by ON orders(verified_by);
CREATE INDEX IF NOT EXISTS idx_orders_verified_at ON orders(verified_at);

-- Adicionar comentários
COMMENT ON COLUMN orders.is_verified IS 'Indica se o pedido foi verificado/aprovado por um administrador';
COMMENT ON COLUMN orders.verified_by IS 'ID do usuário que verificou o pedido';
COMMENT ON COLUMN orders.verified_at IS 'Data e hora da verificação do pedido';

-- Atualizar estatísticas da tabela
ANALYZE orders;

-- ============================================================================
-- PARTE 3: VERIFICAÇÃO E MENSAGENS DE SUCESSO
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION APLICADA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Campos adicionados:';
  RAISE NOTICE '1. clients.is_verified (BOOLEAN)';
  RAISE NOTICE '2. orders.is_verified (BOOLEAN)';
  RAISE NOTICE '3. orders.verified_by (UUID)';
  RAISE NOTICE '4. orders.verified_at (TIMESTAMPTZ)';
  RAISE NOTICE '';
  RAISE NOTICE 'Índices criados:';
  RAISE NOTICE '- idx_clients_is_verified';
  RAISE NOTICE '- idx_orders_is_verified';
  RAISE NOTICE '- idx_orders_verified_by';
  RAISE NOTICE '- idx_orders_verified_at';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '1. Testar funcionalidades no frontend';
  RAISE NOTICE '2. Verificar se os badges aparecem corretamente';
  RAISE NOTICE '3. Testar permissões (apenas Admin/Owner)';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- PARTE 4: CONSULTAS DE VALIDAÇÃO (OPCIONAL - APENAS PARA VERIFICAÇÃO)
-- ============================================================================

-- Verificar se os campos foram criados corretamente
DO $$
DECLARE
  v_clients_verified_exists BOOLEAN;
  v_orders_verified_exists BOOLEAN;
  v_orders_verified_by_exists BOOLEAN;
  v_orders_verified_at_exists BOOLEAN;
BEGIN
  -- Verificar clients.is_verified
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'clients'
    AND column_name = 'is_verified'
  ) INTO v_clients_verified_exists;

  -- Verificar orders.is_verified
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
    AND column_name = 'is_verified'
  ) INTO v_orders_verified_exists;

  -- Verificar orders.verified_by
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
    AND column_name = 'verified_by'
  ) INTO v_orders_verified_by_exists;

  -- Verificar orders.verified_at
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'orders'
    AND column_name = 'verified_at'
  ) INTO v_orders_verified_at_exists;

  -- Exibir resultados
  RAISE NOTICE '';
  RAISE NOTICE '--- VALIDAÇÃO DE CAMPOS ---';
  RAISE NOTICE 'clients.is_verified: %', CASE WHEN v_clients_verified_exists THEN '✓ OK' ELSE '✗ ERRO' END;
  RAISE NOTICE 'orders.is_verified: %', CASE WHEN v_orders_verified_exists THEN '✓ OK' ELSE '✗ ERRO' END;
  RAISE NOTICE 'orders.verified_by: %', CASE WHEN v_orders_verified_by_exists THEN '✓ OK' ELSE '✗ ERRO' END;
  RAISE NOTICE 'orders.verified_at: %', CASE WHEN v_orders_verified_at_exists THEN '✓ OK' ELSE '✗ ERRO' END;
  RAISE NOTICE '';

  -- Verificar se há algum erro
  IF NOT (v_clients_verified_exists AND v_orders_verified_exists AND v_orders_verified_by_exists AND v_orders_verified_at_exists) THEN
    RAISE WARNING 'ATENÇÃO: Alguns campos não foram criados corretamente!';
  ELSE
    RAISE NOTICE '✓ Todos os campos foram criados com sucesso!';
  END IF;
END $$;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
