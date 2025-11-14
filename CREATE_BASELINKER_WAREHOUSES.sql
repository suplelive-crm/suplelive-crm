-- ============================================================================
-- Criar tabela baselinker_warehouses para gerenciar warehouses dinâmicos
-- ============================================================================
-- Esta tabela armazena a configuração dos warehouses do Baselinker
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- Dropar tabela existente se houver (cuidado: apaga dados!)
DROP TABLE IF EXISTS public.baselinker_warehouses CASCADE;

-- Criar tabela baselinker_warehouses
CREATE TABLE public.baselinker_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL,
  warehouse_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  allow_stock_updates BOOLEAN NOT NULL DEFAULT true,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Garantir que cada warehouse seja único por workspace
  CONSTRAINT baselinker_warehouses_unique UNIQUE (workspace_id, warehouse_id)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_baselinker_warehouses_workspace_id
ON public.baselinker_warehouses(workspace_id);

CREATE INDEX IF NOT EXISTS idx_baselinker_warehouses_active
ON public.baselinker_warehouses(workspace_id, is_active);

-- Adicionar comentários
COMMENT ON TABLE public.baselinker_warehouses IS 'Armazena configuração dos warehouses do Baselinker por workspace';
COMMENT ON COLUMN public.baselinker_warehouses.warehouse_id IS 'ID do warehouse no Baselinker';
COMMENT ON COLUMN public.baselinker_warehouses.is_active IS 'Se o warehouse está ativo para sincronização';
COMMENT ON COLUMN public.baselinker_warehouses.allow_stock_updates IS 'Se permite atualização de estoque';
COMMENT ON COLUMN public.baselinker_warehouses.sync_direction IS 'Direção da sincronização: read_only, write_only, ou bidirectional';

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
