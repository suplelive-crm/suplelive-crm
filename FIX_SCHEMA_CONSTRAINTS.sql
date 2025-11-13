-- ============================================================================
-- FIX: Constraints e Índices Faltantes no Schema
-- ============================================================================
-- Execute este script no Supabase SQL Editor para adicionar constraints
-- e índices que estão faltando no schema atual
-- ============================================================================

-- ============================================================================
-- PASSO 1: Adicionar UNIQUE constraint em product_stock_by_warehouse
-- ============================================================================
DO $$
BEGIN
  -- Verificar se a constraint já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_stock_by_warehouse_unique'
  ) THEN
    ALTER TABLE public.product_stock_by_warehouse
    ADD CONSTRAINT product_stock_by_warehouse_unique
    UNIQUE(workspace_id, sku, warehouse_id);

    RAISE NOTICE '✅ UNIQUE constraint adicionada em product_stock_by_warehouse';
  ELSE
    RAISE NOTICE '⚠️ UNIQUE constraint já existe em product_stock_by_warehouse';
  END IF;
END $$;

-- ============================================================================
-- PASSO 2: Adicionar índices para performance em product_stock_by_warehouse
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_product_stock_workspace
  ON public.product_stock_by_warehouse(workspace_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_product
  ON public.product_stock_by_warehouse(product_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_warehouse
  ON public.product_stock_by_warehouse(warehouse_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_sku
  ON public.product_stock_by_warehouse(sku);

-- ============================================================================
-- PASSO 3: Adicionar UNIQUE constraint em baselinker_warehouses
-- ============================================================================
DO $$
BEGIN
  -- Verificar se a constraint já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'baselinker_warehouses_unique'
  ) THEN
    ALTER TABLE public.baselinker_warehouses
    ADD CONSTRAINT baselinker_warehouses_unique
    UNIQUE(workspace_id, warehouse_id);

    RAISE NOTICE '✅ UNIQUE constraint adicionada em baselinker_warehouses';
  ELSE
    RAISE NOTICE '⚠️ UNIQUE constraint já existe em baselinker_warehouses';
  END IF;
END $$;

-- ============================================================================
-- PASSO 4: Adicionar índices em outras tabelas importantes
-- ============================================================================

-- Índices em event_queue
CREATE INDEX IF NOT EXISTS idx_event_queue_workspace
  ON public.event_queue(workspace_id);

CREATE INDEX IF NOT EXISTS idx_event_queue_status
  ON public.event_queue(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_event_queue_created_at
  ON public.event_queue(created_at DESC);

-- Índices em stock_change_log
CREATE INDEX IF NOT EXISTS idx_stock_change_log_workspace
  ON public.stock_change_log(workspace_id);

CREATE INDEX IF NOT EXISTS idx_stock_change_log_product
  ON public.stock_change_log(product_id);

CREATE INDEX IF NOT EXISTS idx_stock_change_log_sku
  ON public.stock_change_log(sku);

CREATE INDEX IF NOT EXISTS idx_stock_change_log_created_at
  ON public.stock_change_log(created_at DESC);

-- Índices em log_lançamento_estoque
CREATE INDEX IF NOT EXISTS idx_log_lancamento_estoque_workspace
  ON public.log_lançamento_estoque(workspace_id);

CREATE INDEX IF NOT EXISTS idx_log_lancamento_estoque_tracking
  ON public.log_lançamento_estoque(tracking_code);

-- Índices em log_lançamento_transferencia
CREATE INDEX IF NOT EXISTS idx_log_lancamento_transferencia_workspace
  ON public.log_lançamento_transferencia(workspace_id);

CREATE INDEX IF NOT EXISTS idx_log_lancamento_transferencia_tracking
  ON public.log_lançamento_transferencia(tracking_code);

-- Índices em scheduled_messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workspace
  ON public.scheduled_messages(workspace_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_client
  ON public.scheduled_messages(client_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status
  ON public.scheduled_messages(status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for
  ON public.scheduled_messages(scheduled_for) WHERE status = 'pending';

-- ============================================================================
-- PASSO 5: Criar view product_stock_summary (se não existir)
-- ============================================================================
CREATE OR REPLACE VIEW product_stock_summary AS
SELECT
  psw.workspace_id,
  psw.sku,
  p.name as product_name,
  psw.warehouse_id,
  bw.warehouse_name,
  psw.stock_quantity,
  psw.updated_at as last_updated
FROM product_stock_by_warehouse psw
LEFT JOIN products p ON psw.product_id = p.id
LEFT JOIN baselinker_warehouses bw ON psw.warehouse_id = bw.warehouse_id
  AND psw.workspace_id = bw.workspace_id
ORDER BY psw.sku, psw.warehouse_id;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Verificar constraints
SELECT
  '✅ Constraints em product_stock_by_warehouse' as check_type,
  conname as constraint_name,
  contype as type
FROM pg_constraint
WHERE conrelid = 'public.product_stock_by_warehouse'::regclass
ORDER BY conname;

-- Verificar índices
SELECT
  '✅ Índices em product_stock_by_warehouse' as check_type,
  indexname as index_name
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'product_stock_by_warehouse'
ORDER BY indexname;

-- Verificar view
SELECT
  '✅ View product_stock_summary' as check_type,
  viewname
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'product_stock_summary';

-- Verificar dados de exemplo
SELECT
  '✅ Dados de exemplo (product_stock_summary)' as check_type,
  COUNT(*) as total_records
FROM product_stock_summary;

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
-- Agora seu schema está completo com:
-- 1. ✅ UNIQUE constraints para prevenir duplicatas
-- 2. ✅ Índices para melhorar performance
-- 3. ✅ View para facilitar consultas
-- ============================================================================
