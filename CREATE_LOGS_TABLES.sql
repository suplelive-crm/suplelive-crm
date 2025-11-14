-- ============================================================================
-- Criação das Tabelas de Logs e Event Queue
-- ============================================================================
-- Este script cria as tabelas necessárias para o sistema de Jobs & Logs
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Tabela de Fila de Eventos (Event Queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_log_id BIGINT NOT NULL,
  event_type INTEGER NOT NULL,
  event_name TEXT,
  order_id BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para event_queue
CREATE INDEX IF NOT EXISTS idx_event_queue_workspace ON public.event_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_event_queue_status ON public.event_queue(status);
CREATE INDEX IF NOT EXISTS idx_event_queue_created_at ON public.event_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_queue_event_log_id ON public.event_queue(event_log_id);

-- Comentários
COMMENT ON TABLE public.event_queue IS 'Fila de eventos do Baselinker para processamento assíncrono';
COMMENT ON COLUMN public.event_queue.event_log_id IS 'ID do log no Baselinker (getJournalList)';
COMMENT ON COLUMN public.event_queue.event_type IS 'Tipo do evento (códigos do Baselinker)';
COMMENT ON COLUMN public.event_queue.event_name IS 'Nome do evento (order_created, payment_received, etc)';
COMMENT ON COLUMN public.event_queue.status IS 'Status do processamento do evento';
COMMENT ON COLUMN public.event_queue.retry_count IS 'Número de tentativas de reprocessamento';

-- ============================================================================
-- 2. Tabela de Logs de Alteração de Estoque
-- ============================================================================
-- Dropar view existente antes de criar/alterar a tabela
DROP VIEW IF EXISTS public.v_recent_stock_changes CASCADE;

CREATE TABLE IF NOT EXISTS public.stock_change_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  product_name TEXT,
  warehouse_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('sync', 'manual_update', 'purchase', 'transfer', 'order', 'return', 'adjustment')),
  source TEXT NOT NULL CHECK (source IN ('manual', 'baselinker', 'system', 'purchase', 'transfer', 'order', 'return')),
  previous_quantity NUMERIC NOT NULL,
  new_quantity NUMERIC NOT NULL,
  quantity_change NUMERIC NOT NULL,
  change_reason TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para stock_change_logs
CREATE INDEX IF NOT EXISTS idx_stock_change_logs_workspace ON public.stock_change_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stock_change_logs_sku ON public.stock_change_logs(workspace_id, sku);
CREATE INDEX IF NOT EXISTS idx_stock_change_logs_warehouse ON public.stock_change_logs(workspace_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_change_logs_created_at ON public.stock_change_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_change_logs_source ON public.stock_change_logs(source);

-- Comentários
COMMENT ON TABLE public.stock_change_logs IS 'Registro de todas as alterações de estoque na plataforma';
COMMENT ON COLUMN public.stock_change_logs.action_type IS 'Tipo da ação que causou a alteração';
COMMENT ON COLUMN public.stock_change_logs.source IS 'Origem da alteração (manual, baselinker, sistema, etc)';
COMMENT ON COLUMN public.stock_change_logs.quantity_change IS 'Diferença de quantidade (pode ser negativo)';

-- ============================================================================
-- 3. View para Logs Recentes com Informações de Warehouse e Usuário
-- ============================================================================
CREATE OR REPLACE VIEW public.v_recent_stock_changes AS
SELECT
  scl.id,
  scl.workspace_id,
  scl.sku,
  scl.product_name,
  scl.warehouse_id,
  COALESCE(bw.warehouse_name, scl.warehouse_id) as warehouse_name,
  scl.action_type,
  scl.source,
  scl.previous_quantity,
  scl.new_quantity,
  scl.quantity_change,
  scl.change_reason,
  scl.user_id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.email,
    'Sistema'
  ) as user_name,
  scl.metadata,
  scl.created_at
FROM public.stock_change_logs scl
LEFT JOIN public.baselinker_warehouses bw
  ON scl.workspace_id = bw.workspace_id
  AND scl.warehouse_id = bw.warehouse_id
LEFT JOIN auth.users u ON scl.user_id = u.id
ORDER BY scl.created_at DESC;

-- Comentário da view
COMMENT ON VIEW public.v_recent_stock_changes IS 'View com logs de estoque enriquecidos com nomes de warehouse e usuário';

-- ============================================================================
-- 4. Tabela de Estado de Sincronização do Baselinker
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  last_log_id BIGINT NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN NOT NULL DEFAULT false,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para baselinker_sync_state
CREATE INDEX IF NOT EXISTS idx_baselinker_sync_state_workspace ON public.baselinker_sync_state(workspace_id);

-- Comentários
COMMENT ON TABLE public.baselinker_sync_state IS 'Estado da sincronização do Baselinker por workspace';
COMMENT ON COLUMN public.baselinker_sync_state.last_log_id IS 'Último event_log_id processado do getJournalList';
COMMENT ON COLUMN public.baselinker_sync_state.is_syncing IS 'Flag para evitar execuções concorrentes';

-- ============================================================================
-- 5. Function para Criar Logs Automaticamente em Updates de Estoque
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_stock_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Só registra se a quantidade mudou
  IF OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity THEN
    INSERT INTO public.stock_change_logs (
      workspace_id,
      product_id,
      sku,
      product_name,
      warehouse_id,
      action_type,
      source,
      previous_quantity,
      new_quantity,
      quantity_change,
      change_reason,
      user_id
    ) VALUES (
      NEW.workspace_id,
      NEW.product_id,
      NEW.sku,
      NEW.product_name,
      NEW.warehouse_id,
      COALESCE(current_setting('app.stock_action_type', true), 'sync'),
      COALESCE(current_setting('app.stock_source', true), 'system'),
      COALESCE(OLD.stock_quantity, 0),
      NEW.stock_quantity,
      NEW.stock_quantity - COALESCE(OLD.stock_quantity, 0),
      current_setting('app.stock_change_reason', true),
      NULLIF(current_setting('app.user_id', true), '')::uuid
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário da function
COMMENT ON FUNCTION public.log_stock_change() IS 'Trigger function para criar logs automáticos de alteração de estoque';

-- ============================================================================
-- 6. Trigger para Logar Alterações em product_stock_by_warehouse
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_log_stock_change ON public.product_stock_by_warehouse;

CREATE TRIGGER trigger_log_stock_change
  AFTER UPDATE ON public.product_stock_by_warehouse
  FOR EACH ROW
  WHEN (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity)
  EXECUTE FUNCTION public.log_stock_change();

-- ============================================================================
-- Verificação
-- ============================================================================
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('event_queue', 'stock_change_logs', 'baselinker_sync_state')
ORDER BY table_name, ordinal_position;

-- Verificar triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_log_stock_change';

-- ============================================================================
-- CONCLUÍDO!
-- ============================================================================
-- As seguintes tabelas foram criadas:
-- 1. event_queue - Fila de eventos do Baselinker
-- 2. stock_change_logs - Logs de alterações de estoque
-- 3. baselinker_sync_state - Estado de sincronização
-- 4. v_recent_stock_changes - View com logs enriquecidos
--
-- O trigger trigger_log_stock_change foi criado para registrar automaticamente
-- todas as alterações de estoque na tabela product_stock_by_warehouse
-- ============================================================================
