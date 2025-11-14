-- ============================================================================
-- Adicionar coluna warehouse_code à tabela baselinker_warehouses
-- ============================================================================
-- Esta migration adiciona a coluna warehouse_code sem deletar dados existentes
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- Adicionar a coluna warehouse_code se não existir
ALTER TABLE public.baselinker_warehouses
ADD COLUMN IF NOT EXISTS warehouse_code TEXT;

-- Preencher warehouse_code com o warehouse_id para registros existentes (temporário)
UPDATE public.baselinker_warehouses
SET warehouse_code = warehouse_id
WHERE warehouse_code IS NULL;

-- Adicionar comentário
COMMENT ON COLUMN public.baselinker_warehouses.warehouse_code IS 'Código curto do warehouse (ex: ES, SP)';

-- ============================================================================
-- Verificação
-- ============================================================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'baselinker_warehouses'
ORDER BY ordinal_position;

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
