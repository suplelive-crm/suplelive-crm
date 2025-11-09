-- ============================================================================
-- ADD WAREHOUSE COLUMN TO PURCHASES TABLE
-- ============================================================================
-- Adds warehouse column to purchases table to track destination warehouse
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ADDING WAREHOUSE TO PURCHASES';
  RAISE NOTICE '========================================';
END $$;

-- Add warehouse column to purchases
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS warehouse TEXT;

DO $$ BEGIN RAISE NOTICE '  ✓ Coluna warehouse adicionada a purchases'; END $$;

-- Create index on warehouse for better query performance
CREATE INDEX IF NOT EXISTS idx_purchases_warehouse
  ON public.purchases(warehouse);

DO $$ BEGIN RAISE NOTICE '  ✓ Índice criado em warehouse'; END $$;

-- ============================================================================
-- FINAL MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Coluna warehouse adicionada à tabela purchases';
  RAISE NOTICE 'Esta coluna armazena o warehouse de destino da compra';
  RAISE NOTICE '';
END $$;
