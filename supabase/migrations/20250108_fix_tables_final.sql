-- ============================================================================
-- FIX ORDERS RLS AND CREATE MISSING TABLES
-- ============================================================================
-- Orders: client_id -> clients.workspace_id
-- Updates existing log tables to add workspace_id
-- Creates only truly missing tables
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXING TABLES AND RLS POLICIES';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 1. FIX ORDERS TABLE RLS POLICIES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1. FIXING ORDERS RLS POLICIES:';
  RAISE NOTICE '-------------------------------';
END $$;

-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN RAISE NOTICE '  ✓ RLS habilitado na tabela orders'; END $$;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders" ON public.orders;
DO $$ BEGIN RAISE NOTICE '  ✓ Políticas antigas removidas (se existiam)'; END $$;

-- Create RLS policies for orders (simplified - allows all authenticated users)
-- NOTE: Orders access workspace through orders.client_id -> clients.workspace_id
CREATE POLICY "Users can view orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete orders"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING (true);

DO $$ BEGIN RAISE NOTICE '  ✓ Políticas RLS criadas para orders'; END $$;

-- ============================================================================
-- 2. UPDATE EXISTING LOG TABLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2. UPDATING EXISTING LOG TABLES:';
  RAISE NOTICE '---------------------------------';
END $$;

-- 2.1 - Update log_lançamento_estoque
DO $$
BEGIN
  -- Add workspace_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'log_lançamento_estoque'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.log_lançamento_estoque
    ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    RAISE NOTICE '  ✓ Coluna workspace_id adicionada a log_lançamento_estoque';
  ELSE
    RAISE NOTICE '  ✓ Coluna workspace_id já existe em log_lançamento_estoque';
  END IF;
END $$;

-- Enable RLS on log_lançamento_estoque
ALTER TABLE public.log_lançamento_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage stock upload logs" ON public.log_lançamento_estoque;

CREATE POLICY "Users can manage stock upload logs"
  ON public.log_lançamento_estoque
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '  ✓ RLS configurado para log_lançamento_estoque'; END $$;

-- 2.2 - Update log_lançamento_transferencia
DO $$
BEGIN
  -- Add workspace_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'log_lançamento_transferencia'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.log_lançamento_transferencia
    ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
    RAISE NOTICE '  ✓ Coluna workspace_id adicionada a log_lançamento_transferencia';
  ELSE
    RAISE NOTICE '  ✓ Coluna workspace_id já existe em log_lançamento_transferencia';
  END IF;
END $$;

-- Enable RLS on log_lançamento_transferencia
ALTER TABLE public.log_lançamento_transferencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage transfer upload logs" ON public.log_lançamento_transferencia;

CREATE POLICY "Users can manage transfer upload logs"
  ON public.log_lançamento_transferencia
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '  ✓ RLS configurado para log_lançamento_transferencia'; END $$;

-- ============================================================================
-- 3. CREATE TRULY MISSING TABLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '3. CREATING MISSING TABLES:';
  RAISE NOTICE '---------------------------';
END $$;

-- 3.1 - STOCK_CHANGE_LOG (Audit log for all stock changes)
CREATE TABLE IF NOT EXISTS public.stock_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT,
  change_type TEXT NOT NULL, -- 'purchase', 'transfer', 'return', 'sale', 'adjustment'
  quantity_change NUMERIC NOT NULL,
  quantity_before NUMERIC NOT NULL,
  quantity_after NUMERIC NOT NULL,
  warehouse TEXT, -- 'ES' ou 'SP'
  reference_id UUID, -- ID da compra, transferência, devolução, etc
  reference_type TEXT, -- 'purchase', 'transfer', 'return', 'sale', 'adjustment'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_change_log_workspace ON public.stock_change_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stock_change_log_product ON public.stock_change_log(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_change_log_sku ON public.stock_change_log(sku);
CREATE INDEX IF NOT EXISTS idx_stock_change_log_created_at ON public.stock_change_log(created_at DESC);

ALTER TABLE public.stock_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view stock changes" ON public.stock_change_log;
DROP POLICY IF EXISTS "Users can insert stock changes" ON public.stock_change_log;

CREATE POLICY "Users can view stock changes"
  ON public.stock_change_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert stock changes"
  ON public.stock_change_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '  ✓ Tabela stock_change_log criada'; END $$;

-- 3.2 - BASELINKER_WAREHOUSES (Warehouse configuration for Baselinker)
CREATE TABLE IF NOT EXISTS public.baselinker_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  warehouse_id TEXT NOT NULL, -- ID do armazém no Baselinker
  warehouse_name TEXT NOT NULL,
  warehouse_code TEXT, -- 'ES' ou 'SP' para identificação interna
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_baselinker_warehouses_workspace ON public.baselinker_warehouses(workspace_id);

ALTER TABLE public.baselinker_warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage warehouses" ON public.baselinker_warehouses;

CREATE POLICY "Users can manage warehouses"
  ON public.baselinker_warehouses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '  ✓ Tabela baselinker_warehouses criada'; END $$;

-- ============================================================================
-- 4. FINAL MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Resumo das alterações:';
  RAISE NOTICE '  1. RLS policies criadas para orders';
  RAISE NOTICE '  2. Tabelas atualizadas:';
  RAISE NOTICE '     - log_lançamento_estoque (+ workspace_id)';
  RAISE NOTICE '     - log_lançamento_transferencia (+ workspace_id)';
  RAISE NOTICE '  3. Tabelas criadas:';
  RAISE NOTICE '     - stock_change_log';
  RAISE NOTICE '     - baselinker_warehouses';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: Orders acessa workspace através de:';
  RAISE NOTICE '      orders.client_id -> clients.workspace_id';
  RAISE NOTICE '';
END $$;
