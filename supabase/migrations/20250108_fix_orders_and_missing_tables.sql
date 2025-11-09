-- ============================================================================
-- FIX ORDERS TABLE AND CREATE MISSING TABLES
-- ============================================================================
-- This migration fixes RLS policies on orders table and creates missing tables
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIXING ORDERS TABLE AND MISSING TABLES';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 1. FIX ORDERS TABLE - ADD WORKSPACE_ID
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1. FIXING ORDERS TABLE:';
  RAISE NOTICE '------------------------';
END $$;

-- Add workspace_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN workspace_id UUID;
    RAISE NOTICE '  ✓ Coluna workspace_id adicionada à tabela orders';
  ELSE
    RAISE NOTICE '  ✓ Coluna workspace_id já existe em orders';
  END IF;
END $$;

-- Add foreign key constraint to workspaces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_workspace_id_fkey'
  ) THEN
    ALTER TABLE public.orders
    ADD CONSTRAINT orders_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
    RAISE NOTICE '  ✓ Foreign key para workspaces criada em orders';
  ELSE
    RAISE NOTICE '  ✓ Foreign key para workspaces já existe em orders';
  END IF;
END $$;

-- Create index on workspace_id
CREATE INDEX IF NOT EXISTS idx_orders_workspace_id ON public.orders(workspace_id);
DO $$ BEGIN RAISE NOTICE '  ✓ Índice idx_orders_workspace_id criado'; END $$;

-- Update existing orders to link to first workspace (if any exist)
DO $$
DECLARE
  first_workspace_id UUID;
BEGIN
  -- Get first workspace ID
  SELECT id INTO first_workspace_id FROM public.workspaces LIMIT 1;

  IF first_workspace_id IS NOT NULL THEN
    -- Update orders without workspace_id
    UPDATE public.orders
    SET workspace_id = first_workspace_id
    WHERE workspace_id IS NULL;

    RAISE NOTICE '  ✓ Orders existentes vinculados ao workspace';
  ELSE
    RAISE NOTICE '  ⚠ Nenhum workspace encontrado para vincular orders';
  END IF;
END $$;

-- Make workspace_id NOT NULL after updating existing records
DO $$
BEGIN
  ALTER TABLE public.orders ALTER COLUMN workspace_id SET NOT NULL;
  RAISE NOTICE '  ✓ Coluna workspace_id definida como NOT NULL';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '  ⚠ Não foi possível definir workspace_id como NOT NULL (pode haver orders sem workspace)';
END $$;

-- ============================================================================
-- 2. CREATE RLS POLICIES FOR ORDERS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2. CRIANDO RLS POLICIES PARA ORDERS:';
  RAISE NOTICE '-------------------------------------';
END $$;

-- Enable RLS on orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN RAISE NOTICE '  ✓ RLS habilitado na tabela orders'; END $$;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders in their workspace" ON public.orders;
DROP POLICY IF EXISTS "Users can delete orders in their workspace" ON public.orders;
DO $$ BEGIN RAISE NOTICE '  ✓ Políticas antigas removidas (se existiam)'; END $$;

-- Create RLS policies for orders (simplified - allows all authenticated users for now)
-- TODO: Update these policies when workspace_users table is created for proper multi-tenancy
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
-- 3. CREATE MISSING TABLES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '3. CRIANDO TABELAS FALTANTES:';
  RAISE NOTICE '------------------------------';
END $$;

-- 3.1 - STOCK_CHANGE_LOG
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

-- Simplified RLS policies (allows all authenticated users for now)
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

-- 3.2 - BASELINKER_WAREHOUSES
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

-- Simplified RLS policies (allows all authenticated users for now)
CREATE POLICY "Users can manage warehouses"
  ON public.baselinker_warehouses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '  ✓ Tabela baselinker_warehouses criada'; END $$;

-- 3.3 - LOG_LANÇAMENTO_ESTOQUE (Stock Upload Log)
CREATE TABLE IF NOT EXISTS public.log_lançamento_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  estoque_origem TEXT NOT NULL, -- 'ES' ou 'SP'
  quantidade NUMERIC NOT NULL,
  data_lançamento TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  baselinker_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_lancamento_estoque_workspace ON public.log_lançamento_estoque(workspace_id);
CREATE INDEX IF NOT EXISTS idx_log_lancamento_estoque_sku ON public.log_lançamento_estoque(sku);
CREATE INDEX IF NOT EXISTS idx_log_lancamento_estoque_status ON public.log_lançamento_estoque(status);

ALTER TABLE public.log_lançamento_estoque ENABLE ROW LEVEL SECURITY;

-- Simplified RLS policies (allows all authenticated users for now)
CREATE POLICY "Users can manage stock upload logs"
  ON public.log_lançamento_estoque
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '  ✓ Tabela log_lançamento_estoque criada'; END $$;

-- 3.4 - LOG_LANÇAMENTO_TRANSFERENCIA (Transfer Upload Log)
CREATE TABLE IF NOT EXISTS public.log_lançamento_transferencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transfer_id UUID REFERENCES public.transfers(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  estoque_origem TEXT NOT NULL, -- 'ES' ou 'SP'
  estoque_destino TEXT NOT NULL, -- 'ES' ou 'SP'
  data_lançamento TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  baselinker_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_lancamento_transferencia_workspace ON public.log_lançamento_transferencia(workspace_id);
CREATE INDEX IF NOT EXISTS idx_log_lancamento_transferencia_transfer ON public.log_lançamento_transferencia(transfer_id);
CREATE INDEX IF NOT EXISTS idx_log_lancamento_transferencia_status ON public.log_lançamento_transferencia(status);

ALTER TABLE public.log_lançamento_transferencia ENABLE ROW LEVEL SECURITY;

-- Simplified RLS policies (allows all authenticated users for now)
CREATE POLICY "Users can manage transfer upload logs"
  ON public.log_lançamento_transferencia
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '  ✓ Tabela log_lançamento_transferencia criada'; END $$;

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
  RAISE NOTICE '  1. Tabela orders atualizada com workspace_id';
  RAISE NOTICE '  2. RLS policies criadas para orders';
  RAISE NOTICE '  3. Tabelas criadas:';
  RAISE NOTICE '     - stock_change_log';
  RAISE NOTICE '     - baselinker_warehouses';
  RAISE NOTICE '     - log_lançamento_estoque';
  RAISE NOTICE '     - log_lançamento_transferencia';
  RAISE NOTICE '';
END $$;
