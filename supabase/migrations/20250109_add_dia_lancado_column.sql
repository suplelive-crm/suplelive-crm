-- ============================================================================
-- ADD MISSING COLUMNS TO LOG TABLES
-- ============================================================================
-- 1. Adds status column to both log tables
-- 2. Adds estoque_origem to log_lançamento_estoque for warehouse tracking
-- NOTE: dia_lancado already exists in base schema
-- NOTE: v_recent_stock_changes already exists from 20250107_stock_logs_enhancement.sql
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADDING MISSING COLUMNS TO LOG TABLES';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 1. ADD STATUS AND ESTOQUE_ORIGEM TO LOG_LANÇAMENTO_ESTOQUE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1. UPDATING LOG_LANÇAMENTO_ESTOQUE:';
  RAISE NOTICE '-----------------------------------';
END $$;

-- Add status column if it doesn't exist
ALTER TABLE public.log_lançamento_estoque
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

DO $$ BEGIN RAISE NOTICE '  ✓ Coluna status adicionada/verificada'; END $$;

-- Add estoque_origem column if it doesn't exist (to track which warehouse received the purchase)
ALTER TABLE public.log_lançamento_estoque
  ADD COLUMN IF NOT EXISTS estoque_origem TEXT;

DO $$ BEGIN RAISE NOTICE '  ✓ Coluna estoque_origem adicionada/verificada'; END $$;

-- Add error_message column for tracking failures
ALTER TABLE public.log_lançamento_estoque
  ADD COLUMN IF NOT EXISTS error_message TEXT;

DO $$ BEGIN RAISE NOTICE '  ✓ Coluna error_message adicionada/verificada'; END $$;

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_log_lancamento_estoque_status
  ON public.log_lançamento_estoque(status);

DO $$ BEGIN RAISE NOTICE '  ✓ Índice criado em status'; END $$;

-- ============================================================================
-- 2. ADD STATUS TO LOG_LANÇAMENTO_TRANSFERENCIA
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2. UPDATING LOG_LANÇAMENTO_TRANSFERENCIA:';
  RAISE NOTICE '-----------------------------------------';
END $$;

-- Add status column if it doesn't exist
ALTER TABLE public.log_lançamento_transferencia
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

DO $$ BEGIN RAISE NOTICE '  ✓ Coluna status adicionada/verificada'; END $$;

-- Add error_message column for tracking failures
ALTER TABLE public.log_lançamento_transferencia
  ADD COLUMN IF NOT EXISTS error_message TEXT;

DO $$ BEGIN RAISE NOTICE '  ✓ Coluna error_message adicionada/verificada'; END $$;

-- Create index on status
CREATE INDEX IF NOT EXISTS idx_log_lancamento_transferencia_status
  ON public.log_lançamento_transferencia(status);

DO $$ BEGIN RAISE NOTICE '  ✓ Índice criado em status'; END $$;

-- ============================================================================
-- 3. FINAL MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Resumo das alterações:';
  RAISE NOTICE '  1. Colunas adicionadas a log_lançamento_estoque:';
  RAISE NOTICE '     - status (para filtrar sucessos/falhas)';
  RAISE NOTICE '     - estoque_origem (warehouse de destino)';
  RAISE NOTICE '     - error_message (mensagem de erro)';
  RAISE NOTICE '  2. Colunas adicionadas a log_lançamento_transferencia:';
  RAISE NOTICE '     - status (para filtrar sucessos/falhas)';
  RAISE NOTICE '     - error_message (mensagem de erro)';
  RAISE NOTICE '  3. Índices criados para performance';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: dia_lancado já existe no schema base';
  RAISE NOTICE 'NOTA: v_recent_stock_changes já foi criada em migração anterior';
  RAISE NOTICE '';
END $$;
