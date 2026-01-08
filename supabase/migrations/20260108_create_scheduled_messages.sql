-- ============================================================================
-- MIGRATION: Criar tabela scheduled_messages
-- Data: 08/01/2026
-- Descrição: Cria tabela para armazenar mensagens agendadas (recompra, etc)
-- ============================================================================

-- Tabela de mensagens agendadas
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON scheduled_messages(workspace_id, scheduled_for, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_client
  ON scheduled_messages(client_id);

-- RLS Policies
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scheduled messages in their workspace"
  ON scheduled_messages FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert scheduled messages"
  ON scheduled_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update scheduled messages"
  ON scheduled_messages FOR UPDATE
  USING (true);

-- Comentários
COMMENT ON TABLE scheduled_messages IS 'Mensagens agendadas para envio (recompra, follow-up, etc)';
COMMENT ON COLUMN scheduled_messages.message_type IS 'Tipo da mensagem: reorder, follow_up, birthday, etc';
COMMENT ON COLUMN scheduled_messages.scheduled_for IS 'Data/hora agendada para envio';
COMMENT ON COLUMN scheduled_messages.status IS 'Status: pending, sent, failed';
COMMENT ON COLUMN scheduled_messages.retry_count IS 'Número de tentativas de envio';

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅ TABELA scheduled_messages CRIADA COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabela: scheduled_messages';
  RAISE NOTICE '  - Armazena mensagens agendadas para envio';
  RAISE NOTICE '  - Índices criados para performance';
  RAISE NOTICE '  - RLS habilitado';
  RAISE NOTICE '';
  RAISE NOTICE 'Usar com Edge Function: send-scheduled-messages';
  RAISE NOTICE '============================================================';
END $$;
