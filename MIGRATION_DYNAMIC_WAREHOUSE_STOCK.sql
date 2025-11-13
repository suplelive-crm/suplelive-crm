-- ============================================================================
-- MIGRAÇÃO: Sistema de Estoque Dinâmico por Warehouse
-- ============================================================================
-- Execute este script no Supabase SQL Editor para migrar de stock_es/stock_sp
-- para um sistema dinâmico que suporta múltiplos warehouses do Baselinker
-- ============================================================================

-- ============================================================================
-- PASSO 1: Criar tabela de estoque por warehouse
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.product_stock_by_warehouse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, sku, warehouse_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_stock_workspace ON public.product_stock_by_warehouse(workspace_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_product ON public.product_stock_by_warehouse(product_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_warehouse ON public.product_stock_by_warehouse(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_sku ON public.product_stock_by_warehouse(sku);

-- ============================================================================
-- PASSO 2: Habilitar RLS (Row Level Security)
-- ============================================================================
ALTER TABLE public.product_stock_by_warehouse ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para autenticados
DROP POLICY IF EXISTS "Users can view product stock" ON public.product_stock_by_warehouse;
DROP POLICY IF EXISTS "Users can insert product stock" ON public.product_stock_by_warehouse;
DROP POLICY IF EXISTS "Users can update product stock" ON public.product_stock_by_warehouse;
DROP POLICY IF EXISTS "Users can delete product stock" ON public.product_stock_by_warehouse;

CREATE POLICY "Users can view product stock"
  ON public.product_stock_by_warehouse FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert product stock"
  ON public.product_stock_by_warehouse FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update product stock"
  ON public.product_stock_by_warehouse FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete product stock"
  ON public.product_stock_by_warehouse FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- PASSO 3: Migrar dados existentes de stock_es/stock_sp (OPCIONAL)
-- ============================================================================
-- Este passo migra os dados existentes das colunas stock_es e stock_sp
-- para a nova tabela product_stock_by_warehouse
-- ATENÇÃO: Execute apenas se você já tiver dados e warehouses configurados

-- Migrar stock_es (assumindo warehouse_id 'ES' ou buscar da baselinker_warehouses)
-- INSERT INTO public.product_stock_by_warehouse (workspace_id, product_id, warehouse_id, sku, stock_quantity, created_at, updated_at)
-- SELECT
--   p.workspace_id,
--   p.id as product_id,
--   p.warehouseID as warehouse_id,
--   p.sku,
--   COALESCE(p.stock_es, 0) as stock_quantity,
--   NOW(),
--   NOW()
-- FROM public.products p
-- WHERE p.stock_es > 0
-- ON CONFLICT (workspace_id, sku, warehouse_id)
-- DO UPDATE SET
--   stock_quantity = EXCLUDED.stock_quantity,
--   updated_at = NOW();

-- ============================================================================
-- PASSO 4: Criar função para obter estoque total de um produto
-- ============================================================================
CREATE OR REPLACE FUNCTION get_product_total_stock(p_sku TEXT, p_workspace_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(stock_quantity), 0)::INTEGER
    FROM product_stock_by_warehouse
    WHERE sku = p_sku
      AND workspace_id = p_workspace_id
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASSO 5: Criar função para obter estoque por warehouse específico
-- ============================================================================
CREATE OR REPLACE FUNCTION get_product_warehouse_stock(
  p_sku TEXT,
  p_warehouse_id TEXT,
  p_workspace_id UUID
)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(stock_quantity, 0)::INTEGER
    FROM product_stock_by_warehouse
    WHERE sku = p_sku
      AND warehouse_id = p_warehouse_id
      AND workspace_id = p_workspace_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PASSO 6: Criar view para facilitar consultas de estoque
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
SELECT
  '✅ Tabela criada' as status,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'product_stock_by_warehouse';

SELECT
  '✅ Políticas RLS criadas' as status,
  policyname,
  cmd as "Tipo"
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'product_stock_by_warehouse'
ORDER BY policyname;

SELECT
  '✅ Índices criados' as status,
  indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'product_stock_by_warehouse';

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
-- 1. As colunas stock_es e stock_sp na tabela products continuarão existindo
--    mas não serão mais usadas pelo sistema
-- 2. Todo o estoque agora será gerenciado pela tabela product_stock_by_warehouse
-- 3. O sistema suportará quantos warehouses você configurar no Baselinker
-- 4. Para remover as colunas antigas (APÓS confirmar que tudo funciona):
--    ALTER TABLE products DROP COLUMN stock_es;
--    ALTER TABLE products DROP COLUMN stock_sp;
-- ============================================================================
