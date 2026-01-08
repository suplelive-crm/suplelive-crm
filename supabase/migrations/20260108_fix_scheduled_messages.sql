-- ============================================================================
-- MIGRATION: Corrigir/Atualizar tabela scheduled_messages
-- Data: 08/01/2026
-- Descrição: Adiciona colunas faltantes à tabela scheduled_messages existente
-- ============================================================================

-- Verificar se a tabela existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'scheduled_messages'
  ) THEN
    -- Se não existe, criar do zero
    CREATE TABLE scheduled_messages (
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

    RAISE NOTICE 'Tabela scheduled_messages criada';
  ELSE
    RAISE NOTICE 'Tabela scheduled_messages já existe - adicionando colunas faltantes';
  END IF;
END $$;

-- Adicionar coluna retry_count se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'scheduled_messages'
    AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE scheduled_messages ADD COLUMN retry_count INTEGER DEFAULT 0;
    RAISE NOTICE 'Coluna retry_count adicionada';
  ELSE
    RAISE NOTICE 'Coluna retry_count já existe';
  END IF;
END $$;

-- Adicionar coluna error_message se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'scheduled_messages'
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE scheduled_messages ADD COLUMN error_message TEXT;
    RAISE NOTICE 'Coluna error_message adicionada';
  ELSE
    RAISE NOTICE 'Coluna error_message já existe';
  END IF;
END $$;

-- Adicionar coluna updated_at se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'scheduled_messages'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE scheduled_messages ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Coluna updated_at adicionada';
  ELSE
    RAISE NOTICE 'Coluna updated_at já existe';
  END IF;
END $$;

-- Remover constraint antigo de status (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scheduled_messages_status_check'
  ) THEN
    ALTER TABLE scheduled_messages DROP CONSTRAINT scheduled_messages_status_check;
    RAISE NOTICE 'Constraint antigo de status removido';
  END IF;
END $$;

-- Adicionar novo constraint de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scheduled_messages_status_new_check'
  ) THEN
    ALTER TABLE scheduled_messages
    ADD CONSTRAINT scheduled_messages_status_new_check
    CHECK (status IN ('pending', 'sent', 'failed'));
    RAISE NOTICE 'Novo constraint de status adicionado';
  ELSE
    RAISE NOTICE 'Constraint de status já existe';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Constraint de status já existe (duplicate_object)';
END $$;

-- Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON scheduled_messages(workspace_id, scheduled_for, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_client
  ON scheduled_messages(client_id);

-- Habilitar RLS se não estiver habilitado
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas (se existirem)
DROP POLICY IF EXISTS "Users can view scheduled messages in their workspace" ON scheduled_messages;
DROP POLICY IF EXISTS "Service role can insert scheduled messages" ON scheduled_messages;
DROP POLICY IF EXISTS "Service role can update scheduled messages" ON scheduled_messages;

-- Criar policies
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
  RAISE NOTICE '✅ TABELA scheduled_messages ATUALIZADA COM SUCESSO!';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Colunas verificadas/adicionadas:';
  RAISE NOTICE '  - retry_count';
  RAISE NOTICE '  - error_message';
  RAISE NOTICE '  - updated_at';
  RAISE NOTICE '';
  RAISE NOTICE 'Índices criados';
  RAISE NOTICE 'RLS habilitado';
  RAISE NOTICE 'Policies configuradas';
  RAISE NOTICE '';
  RAISE NOTICE 'Tabela pronta para uso!';
  RAISE NOTICE '============================================================';
END $$;

-- Verificar estrutura final
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scheduled_messages'
ORDER BY ordinal_position;
