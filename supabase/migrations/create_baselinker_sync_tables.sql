-- =====================================================
-- BASELINKER ORDER SYNC INFRASTRUCTURE
-- =====================================================
-- Criado para implementar sincronização híbrida de pedidos:
-- [A] Polling de novos pedidos via getOrders
-- [B] Polling de eventos via getJournalList
-- =====================================================

-- =====================================================
-- 1. BASELINKER_SYNC_STATE
-- Armazena o estado de sincronização por workspace
-- =====================================================
CREATE TABLE IF NOT EXISTS baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) UNIQUE NOT NULL,

  -- Event polling state (getJournalList)
  last_log_id BIGINT DEFAULT 0,

  -- Order polling state (getOrders)
  last_order_confirmed_timestamp INT DEFAULT 0,

  -- Status tracking
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false,

  -- Statistics
  total_events_processed BIGINT DEFAULT 0,
  total_orders_synced BIGINT DEFAULT 0,

  -- Error tracking
  sync_errors JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_baselinker_sync_state_workspace
  ON baselinker_sync_state(workspace_id);

CREATE INDEX IF NOT EXISTS idx_baselinker_sync_state_syncing
  ON baselinker_sync_state(is_syncing)
  WHERE is_syncing = true;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_baselinker_sync_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER baselinker_sync_state_updated_at
  BEFORE UPDATE ON baselinker_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION update_baselinker_sync_state_updated_at();

-- =====================================================
-- 2. ORDER_SYNC_QUEUE
-- Fila de eventos/pedidos a processar
-- =====================================================
CREATE TABLE IF NOT EXISTS order_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,

  -- Event identification
  event_log_id BIGINT UNIQUE NOT NULL,
  event_type INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  order_id_base BIGINT NOT NULL,

  -- Source tracking (NEW: distingue origem)
  source TEXT CHECK (source IN ('order_poll', 'event_poll')),

  -- Payload
  payload JSONB NOT NULL,

  -- Processing state
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),

  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ
);

-- Índices essenciais
CREATE INDEX IF NOT EXISTS idx_order_sync_queue_workspace
  ON order_sync_queue(workspace_id);

CREATE INDEX IF NOT EXISTS idx_order_sync_queue_status
  ON order_sync_queue(status)
  WHERE status IN ('pending', 'retry');

CREATE INDEX IF NOT EXISTS idx_order_sync_queue_order_id
  ON order_sync_queue(order_id_base);

CREATE INDEX IF NOT EXISTS idx_order_sync_queue_retry
  ON order_sync_queue(next_retry_at)
  WHERE status = 'retry' AND next_retry_at <= NOW();

CREATE INDEX IF NOT EXISTS idx_order_sync_queue_source
  ON order_sync_queue(source, created_at);

-- Índice composto para busca eficiente de próximo item
CREATE INDEX IF NOT EXISTS idx_order_sync_queue_next_item
  ON order_sync_queue(workspace_id, status, created_at)
  WHERE status IN ('pending', 'retry');

-- =====================================================
-- 3. ATUALIZAR TABELA ORDERS
-- Adicionar campos necessários para sync do Baselinker
-- =====================================================

-- Adicionar coluna order_id_base (ID do Baselinker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_id_base'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_id_base BIGINT;
  END IF;
END $$;

-- Adicionar coluna date_confirmed (data de confirmação do pedido)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'date_confirmed'
  ) THEN
    ALTER TABLE orders ADD COLUMN date_confirmed INT;
  END IF;
END $$;

-- Adicionar coluna order_status_id (status do Baselinker)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'order_status_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_status_id INT;
  END IF;
END $$;

-- Criar índice único para order_id_base por workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_id_base_workspace
  ON orders(order_id_base, workspace_id)
  WHERE order_id_base IS NOT NULL;

-- Criar índice para date_confirmed (usado no polling)
CREATE INDEX IF NOT EXISTS idx_orders_date_confirmed
  ON orders(date_confirmed)
  WHERE date_confirmed IS NOT NULL;

-- =====================================================
-- 4. FUNÇÕES AUXILIARES
-- =====================================================

-- Função para limpar eventos processados antigos (>30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_sync_queue_entries()
RETURNS void AS $$
BEGIN
  DELETE FROM order_sync_queue
  WHERE status = 'completed'
    AND processed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Função para resetar eventos travados (>1 hora em processing)
CREATE OR REPLACE FUNCTION reset_stuck_sync_queue_entries()
RETURNS void AS $$
BEGIN
  UPDATE order_sync_queue
  SET status = 'retry',
      next_retry_at = NOW(),
      error_message = 'Reset: stuck in processing for over 1 hour'
  WHERE status = 'processing'
    AND processing_started_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Função para obter estatísticas da fila
CREATE OR REPLACE FUNCTION get_sync_queue_stats(p_workspace_id UUID)
RETURNS TABLE (
  status TEXT,
  source TEXT,
  count BIGINT,
  oldest_created_at TIMESTAMPTZ,
  newest_created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.status,
    q.source,
    COUNT(*) as count,
    MIN(q.created_at) as oldest_created_at,
    MAX(q.created_at) as newest_created_at
  FROM order_sync_queue q
  WHERE q.workspace_id = p_workspace_id
  GROUP BY q.status, q.source
  ORDER BY q.status, q.source;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. RLS (ROW LEVEL SECURITY) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE baselinker_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_sync_queue ENABLE ROW LEVEL SECURITY;

-- Policy para baselinker_sync_state
CREATE POLICY "Users can view their workspace sync state"
  ON baselinker_sync_state FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage sync state"
  ON baselinker_sync_state FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Policy para order_sync_queue
CREATE POLICY "Users can view their workspace queue"
  ON order_sync_queue FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage queue"
  ON order_sync_queue FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- =====================================================
-- 6. CONFIGURAÇÃO INICIAL
-- =====================================================

-- Criar entrada de sync_state para workspaces existentes com Baselinker configurado
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, last_order_confirmed_timestamp)
SELECT
  w.id,
  COALESCE((w.settings->>'baselinker_last_log_id')::BIGINT, 0),
  0 -- Começar do zero para order polling
FROM workspaces w
WHERE w.settings->>'baselinker_api_key' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM baselinker_sync_state bss
    WHERE bss.workspace_id = w.id
  )
ON CONFLICT (workspace_id) DO NOTHING;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE baselinker_sync_state IS
  'Armazena estado de sincronização do Baselinker por workspace. Inclui last_log_id para eventos e last_order_confirmed_timestamp para novos pedidos.';

COMMENT ON TABLE order_sync_queue IS
  'Fila de eventos e pedidos a processar. Campo source distingue origem: order_poll (novos pedidos) ou event_poll (mudanças via journal).';

COMMENT ON COLUMN order_sync_queue.source IS
  'Origem do evento: order_poll (polling de getOrders) ou event_poll (polling de getJournalList)';

COMMENT ON COLUMN order_sync_queue.event_log_id IS
  'ID único do evento. Para order_poll, usar order_id_base como fallback para garantir unicidade.';

COMMENT ON COLUMN baselinker_sync_state.last_order_confirmed_timestamp IS
  'Último timestamp de date_confirmed processado. Usado no polling de getOrders com date_confirmed_from.';

COMMENT ON FUNCTION get_sync_queue_stats IS
  'Retorna estatísticas da fila de sincronização por status e source para um workspace.';

-- =====================================================
-- FIM DA MIGRATION
-- =====================================================
