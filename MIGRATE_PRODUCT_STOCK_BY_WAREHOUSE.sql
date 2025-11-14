-- ============================================================================
-- Migração: Expandir tabela product_stock_by_warehouse para ser a fonte principal de estoque
-- ============================================================================
-- Esta migração adiciona campos essenciais à tabela product_stock_by_warehouse
-- para que ela possa substituir completamente a coluna stock_es da tabela products
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- Adicionar colunas à tabela product_stock_by_warehouse
ALTER TABLE public.product_stock_by_warehouse
ADD COLUMN IF NOT EXISTS ean TEXT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS cost NUMERIC,
ADD COLUMN IF NOT EXISTS price NUMERIC,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ DEFAULT NOW();

-- Comentários para as novas colunas
COMMENT ON COLUMN public.product_stock_by_warehouse.ean IS 'Código de barras EAN do produto';
COMMENT ON COLUMN public.product_stock_by_warehouse.product_name IS 'Nome do produto (cache para performance)';
COMMENT ON COLUMN public.product_stock_by_warehouse.cost IS 'Custo do produto neste warehouse';
COMMENT ON COLUMN public.product_stock_by_warehouse.price IS 'Preço de venda do produto';
COMMENT ON COLUMN public.product_stock_by_warehouse.last_sync_at IS 'Última sincronização do Baselinker';

-- Criar índice composto para busca eficiente
CREATE INDEX IF NOT EXISTS idx_product_stock_by_warehouse_sku_warehouse
ON public.product_stock_by_warehouse(workspace_id, sku, warehouse_id);

-- Criar índice para busca por EAN
CREATE INDEX IF NOT EXISTS idx_product_stock_by_warehouse_ean
ON public.product_stock_by_warehouse(workspace_id, ean);

-- Preencher dados das colunas novas a partir da tabela products
UPDATE public.product_stock_by_warehouse psw
SET
  ean = p.ean,
  product_name = p.name,
  cost = p.custo,
  price = p.price
FROM public.products p
WHERE psw.product_id = p.id
  AND (psw.ean IS NULL OR psw.product_name IS NULL);

-- ============================================================================
-- Criar constraint UNIQUE para garantir unicidade
-- ============================================================================
-- Dropar constraint antiga se existir
ALTER TABLE public.product_stock_by_warehouse
DROP CONSTRAINT IF EXISTS product_stock_by_warehouse_unique;

-- Criar constraint única para workspace + sku + warehouse
ALTER TABLE public.product_stock_by_warehouse
ADD CONSTRAINT product_stock_by_warehouse_unique
UNIQUE (workspace_id, sku, warehouse_id);

-- ============================================================================
-- Verificação
-- ============================================================================
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'product_stock_by_warehouse'
ORDER BY ordinal_position;

-- Verificar dados migrados
SELECT
  COUNT(*) as total_records,
  COUNT(DISTINCT sku) as unique_skus,
  COUNT(DISTINCT warehouse_id) as unique_warehouses,
  SUM(CASE WHEN ean IS NOT NULL THEN 1 ELSE 0 END) as records_with_ean,
  SUM(CASE WHEN cost IS NOT NULL THEN 1 ELSE 0 END) as records_with_cost
FROM public.product_stock_by_warehouse;

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
