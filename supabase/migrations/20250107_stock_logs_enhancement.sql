-- Migration: Enhance Stock Logs with Audit Trail
-- Created: 2025-01-07
-- Purpose: Add audit fields to existing log tables and create warehouse configuration

-- ============================================================================
-- 1. ENHANCE EXISTING LOG TABLES
-- ============================================================================

-- Add audit fields to log_lançamento_estoque
ALTER TABLE public.log_lançamento_estoque
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual', -- 'manual', 'baselinker', 'system', 'transfer'
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'add', -- 'add', 'remove', 'adjust', 'sync'
  ADD COLUMN IF NOT EXISTS warehouse_id TEXT, -- ID do warehouse no Baselinker
  ADD COLUMN IF NOT EXISTS warehouse_name TEXT, -- Nome do warehouse
  ADD COLUMN IF NOT EXISTS previous_quantity NUMERIC, -- Quantidade anterior
  ADD COLUMN IF NOT EXISTS new_quantity NUMERIC, -- Nova quantidade
  ADD COLUMN IF NOT EXISTS change_reason TEXT, -- Motivo da alteração
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id), -- Usuário que fez a alteração
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id), -- Workspace
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb; -- Dados adicionais

-- Add audit fields to log_lançamento_transferencia
ALTER TABLE public.log_lançamento_transferencia
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'transfer',
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS change_reason TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_log_estoque_workspace
  ON public.log_lançamento_estoque(workspace_id, dia_lancado DESC);

CREATE INDEX IF NOT EXISTS idx_log_estoque_sku
  ON public.log_lançamento_estoque(sku, dia_lancado DESC);

CREATE INDEX IF NOT EXISTS idx_log_estoque_source
  ON public.log_lançamento_estoque(source, action_type);

CREATE INDEX IF NOT EXISTS idx_log_transferencia_workspace
  ON public.log_lançamento_transferencia(workspace_id, dia_lancado DESC);

CREATE INDEX IF NOT EXISTS idx_log_transferencia_sku
  ON public.log_lançamento_transferencia(sku, dia_lancado DESC);

-- ============================================================================
-- 2. BASELINKER WAREHOUSE CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.baselinker_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  warehouse_id TEXT NOT NULL, -- ID do warehouse no Baselinker (ex: 'bl_1', 'bl_2')
  warehouse_name TEXT NOT NULL, -- Nome do warehouse
  is_active BOOLEAN DEFAULT true, -- Se a plataforma pode fazer alterações
  allow_stock_updates BOOLEAN DEFAULT true, -- Permite atualizar estoque
  allow_product_creation BOOLEAN DEFAULT false, -- Permite criar produtos
  sync_direction TEXT DEFAULT 'bidirectional' CHECK (sync_direction IN ('read_only', 'write_only', 'bidirectional')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_workspace_warehouse UNIQUE (workspace_id, warehouse_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_baselinker_warehouses_workspace
  ON public.baselinker_warehouses(workspace_id);

CREATE INDEX IF NOT EXISTS idx_baselinker_warehouses_active
  ON public.baselinker_warehouses(workspace_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- 3. STOCK CHANGE LOG (Nova tabela consolidada para TODAS as alterações)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.stock_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  product_name TEXT,

  -- Detalhes da alteração
  action_type TEXT NOT NULL CHECK (action_type IN ('add', 'remove', 'adjust', 'sync', 'transfer_in', 'transfer_out', 'return', 'sale')),
  source TEXT NOT NULL CHECK (source IN ('manual', 'baselinker', 'system', 'purchase', 'transfer', 'return', 'order')),

  -- Quantidades
  warehouse_id TEXT NOT NULL, -- ID do warehouse afetado
  warehouse_name TEXT,
  previous_quantity NUMERIC NOT NULL DEFAULT 0,
  new_quantity NUMERIC NOT NULL,
  quantity_change NUMERIC GENERATED ALWAYS AS (new_quantity - previous_quantity) STORED,

  -- Rastreabilidade
  change_reason TEXT,
  reference_id UUID, -- ID da compra, transferência, pedido, etc
  reference_type TEXT, -- 'purchase', 'transfer', 'order', 'manual', etc
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_stock_change_workspace
  ON public.stock_change_log(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_change_sku
  ON public.stock_change_log(sku, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_change_warehouse
  ON public.stock_change_log(warehouse_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_change_product
  ON public.stock_change_log(product_id, created_at DESC)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_change_source
  ON public.stock_change_log(source, action_type);

-- ============================================================================
-- 4. TRIGGER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_baselinker_warehouses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS update_baselinker_warehouses_timestamp ON public.baselinker_warehouses;
CREATE TRIGGER update_baselinker_warehouses_timestamp
  BEFORE UPDATE ON public.baselinker_warehouses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_baselinker_warehouses_updated_at();

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if warehouse is active for a workspace
CREATE OR REPLACE FUNCTION public.is_warehouse_active(
  p_workspace_id UUID,
  p_warehouse_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_active BOOLEAN;
BEGIN
  SELECT is_active INTO v_is_active
  FROM public.baselinker_warehouses
  WHERE workspace_id = p_workspace_id
    AND warehouse_id = p_warehouse_id;

  -- Se não encontrar configuração, retorna true (padrão)
  RETURN COALESCE(v_is_active, true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to log stock change
CREATE OR REPLACE FUNCTION public.log_stock_change(
  p_workspace_id UUID,
  p_sku TEXT,
  p_warehouse_id TEXT,
  p_previous_qty NUMERIC,
  p_new_qty NUMERIC,
  p_action_type TEXT,
  p_source TEXT,
  p_reason TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_product_id UUID;
  v_product_name TEXT;
  v_warehouse_name TEXT;
  v_user_name TEXT;
BEGIN
  -- Get product details
  SELECT id, name INTO v_product_id, v_product_name
  FROM public.products
  WHERE workspace_id = p_workspace_id AND sku = p_sku
  LIMIT 1;

  -- Get warehouse name
  SELECT warehouse_name INTO v_warehouse_name
  FROM public.baselinker_warehouses
  WHERE workspace_id = p_workspace_id AND warehouse_id = p_warehouse_id
  LIMIT 1;

  -- Get user name if provided
  IF p_user_id IS NOT NULL THEN
    SELECT raw_user_meta_data->>'name' INTO v_user_name
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  -- Insert log
  INSERT INTO public.stock_change_log (
    workspace_id,
    product_id,
    sku,
    product_name,
    action_type,
    source,
    warehouse_id,
    warehouse_name,
    previous_quantity,
    new_quantity,
    change_reason,
    reference_id,
    reference_type,
    user_id,
    user_name,
    metadata
  ) VALUES (
    p_workspace_id,
    v_product_id,
    p_sku,
    v_product_name,
    p_action_type,
    p_source,
    p_warehouse_id,
    v_warehouse_name,
    p_previous_qty,
    p_new_qty,
    p_reason,
    p_reference_id,
    p_reference_type,
    p_user_id,
    v_user_name,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. VIEWS FOR EASY QUERYING
-- ============================================================================

-- View: Recent stock changes
CREATE OR REPLACE VIEW public.v_recent_stock_changes AS
SELECT
  scl.*,
  p.name as product_full_name,
  w.name as workspace_name,
  CASE
    WHEN scl.quantity_change > 0 THEN 'increase'
    WHEN scl.quantity_change < 0 THEN 'decrease'
    ELSE 'no_change'
  END as change_direction
FROM public.stock_change_log scl
LEFT JOIN public.products p ON p.id = scl.product_id
LEFT JOIN public.workspaces w ON w.id = scl.workspace_id
WHERE scl.created_at > NOW() - INTERVAL '30 days'
ORDER BY scl.created_at DESC;

-- View: Stock changes by warehouse
CREATE OR REPLACE VIEW public.v_stock_changes_by_warehouse AS
SELECT
  workspace_id,
  warehouse_id,
  warehouse_name,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_changes,
  SUM(CASE WHEN quantity_change > 0 THEN 1 ELSE 0 END) as increases,
  SUM(CASE WHEN quantity_change < 0 THEN 1 ELSE 0 END) as decreases,
  SUM(quantity_change) as net_change,
  COUNT(DISTINCT sku) as unique_products
FROM public.stock_change_log
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY workspace_id, warehouse_id, warehouse_name, DATE_TRUNC('day', created_at)
ORDER BY date DESC, warehouse_id;

-- ============================================================================
-- 7. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.baselinker_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_change_log ENABLE ROW LEVEL SECURITY;

-- Policies for baselinker_warehouses
CREATE POLICY "Users can view warehouses in their workspace"
  ON public.baselinker_warehouses
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage warehouses in their workspace"
  ON public.baselinker_warehouses
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service role can manage all warehouses"
  ON public.baselinker_warehouses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policies for stock_change_log
CREATE POLICY "Users can view stock changes in their workspace"
  ON public.stock_change_log
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all stock changes"
  ON public.stock_change_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. COMMENTS
-- ============================================================================

COMMENT ON TABLE public.baselinker_warehouses IS 'Configuration of active Baselinker warehouses per workspace';
COMMENT ON TABLE public.stock_change_log IS 'Complete audit log of all stock changes from any source';
COMMENT ON FUNCTION public.is_warehouse_active IS 'Check if a warehouse is active for stock updates';
COMMENT ON FUNCTION public.log_stock_change IS 'Helper function to log stock changes with full traceability';
COMMENT ON VIEW public.v_recent_stock_changes IS 'View of recent stock changes with enriched data';
COMMENT ON VIEW public.v_stock_changes_by_warehouse IS 'Aggregated stock changes by warehouse and date';
