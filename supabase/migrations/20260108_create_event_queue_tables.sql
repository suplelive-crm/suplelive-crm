-- ============================================================================
-- MIGRATION: Criar tabelas para fila de eventos
-- Data: 08/01/2026
-- Descrição: Cria baselinker_sync_state e event_queue para processamento de eventos
-- ============================================================================

-- Tabela 1: Estado de sincronização do Baselinker
CREATE TABLE IF NOT EXISTS baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  last_log_id BIGINT DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca por workspace
CREATE INDEX IF NOT EXISTS idx_baselinker_sync_state_workspace
  ON baselinker_sync_state(workspace_id);

-- Comentários
COMMENT ON TABLE baselinker_sync_state IS 'Estado de sincronização dos eventos do Baselinker por workspace';
COMMENT ON COLUMN baselinker_sync_state.last_log_id IS 'Último log_id processado do getJournalList';
COMMENT ON COLUMN baselinker_sync_state.is_syncing IS 'Lock otimista - previne execuções simultâneas';

-- RLS Policies
ALTER TABLE baselinker_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view baselinker sync state in their workspace"
  ON baselinker_sync_state FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage baselinker sync state"
  ON baselinker_sync_state FOR ALL
  USING (true);

-- Tabela 2: Fila de eventos para processamento
CREATE TABLE IF NOT EXISTS event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_log_id BIGINT NOT NULL,
  event_type INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  order_id BIGINT,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(workspace_id, event_log_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_event_queue_pending
  ON event_queue(workspace_id, status, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_event_queue_event_type
  ON event_queue(event_type, status);

CREATE INDEX IF NOT EXISTS idx_event_queue_order_id
  ON event_queue(order_id)
  WHERE order_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE event_queue IS 'Fila de eventos do Baselinker para processamento assíncrono';
COMMENT ON COLUMN event_queue.event_log_id IS 'ID do evento no Baselinker (getJournalList)';
COMMENT ON COLUMN event_queue.event_type IS 'Tipo de evento (1=order_created, 3=payment_received, etc)';
COMMENT ON COLUMN event_queue.event_name IS 'Nome do evento (order_created, payment_received, etc)';
COMMENT ON COLUMN event_queue.status IS 'Status: pending, processed, failed';
COMMENT ON COLUMN event_queue.payload IS 'Dados completos do evento (JSON)';

-- RLS Policies
ALTER TABLE event_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view event queue in their workspace"
  ON event_queue FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage event queue"
  ON event_queue FOR ALL
  USING (true);

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ TABELAS DE EVENT QUEUE CRIADAS COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabelas criadas:';
  RAISE NOTICE '  1. baselinker_sync_state';
  RAISE NOTICE '     - Rastreia último evento processado por workspace';
  RAISE NOTICE '     - Lock otimista (is_syncing)';
  RAISE NOTICE '';
  RAISE NOTICE '  2. event_queue';
  RAISE NOTICE '     - Fila de eventos para processamento';
  RAISE NOTICE '     - UNIQUE constraint previne duplicatas';
  RAISE NOTICE '     - Retry automático (até 3 tentativas)';
  RAISE NOTICE '';
  RAISE NOTICE 'Índices criados para performance';
  RAISE NOTICE 'RLS habilitado em ambas as tabelas';
  RAISE NOTICE '';
  RAISE NOTICE 'Usar com Edge Functions:';
  RAISE NOTICE '  - baselinker-event-polling';
  RAISE NOTICE '  - process-event-queue';
  RAISE NOTICE '============================================================';
END $$;
