-- ============================================================================
-- SETUP COMPLETO DO BANCO DE DADOS
-- ============================================================================
-- Este script verifica e configura TUDO que é necessário para o sistema funcionar
-- Execute este script COMPLETO no SQL Editor do Supabase Dashboard
-- ============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAÇÃO DO BANCO EXISTENTE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO VERIFICAÇÃO DO BANCO DE DADOS';
  RAISE NOTICE '========================================';
END $$;

-- Verificar tabelas principais existentes
DO $$
DECLARE
  tabelas_existentes TEXT[];
  tabela TEXT;
  tabelas_esperadas TEXT[] := ARRAY[
    'workspaces',
    'workspace_users',
    'clients',
    'leads',
    'orders',
    'campaigns',
    'conversations',
    'messages',
    'channels',
    'sectors',
    'whatsapp_instances',
    'automation_workflows',
    'kanban_boards',
    'products',
    'purchases',
    'transfers',
    'returns'
  ];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1. VERIFICANDO TABELAS PRINCIPAIS:';
  RAISE NOTICE '-----------------------------------';

  FOREACH tabela IN ARRAY tabelas_esperadas
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tabela
    ) THEN
      RAISE NOTICE '  ✓ % existe', tabela;
    ELSE
      RAISE NOTICE '  ✗ % NÃO EXISTE (será necessário criar)', tabela;
    END IF;
  END LOOP;
END $$;

-- Verificar tabelas event-driven
DO $$
DECLARE
  tabela TEXT;
  tabelas_event TEXT[] := ARRAY[
    'event_queue',
    'baselinker_sync_state',
    'scheduled_messages',
    'notifications'
  ];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2. VERIFICANDO TABELAS EVENT-DRIVEN:';
  RAISE NOTICE '------------------------------------';

  FOREACH tabela IN ARRAY tabelas_event
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tabela
    ) THEN
      RAISE NOTICE '  ✓ % existe', tabela;
    ELSE
      RAISE NOTICE '  ✗ % não existe (será criado)', tabela;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- PARTE 2: HABILITAR EXTENSÕES NECESSÁRIAS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '3. HABILITANDO EXTENSÕES:';
  RAISE NOTICE '-------------------------';
END $$;

-- Extensão pg_net (para chamar Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN RAISE NOTICE '  ✓ pg_net habilitado'; END $$;

-- Extensão pg_cron (para cron jobs)
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN RAISE NOTICE '  ✓ pg_cron habilitado'; END $$;

-- Extensão uuid-ossp (para gerar UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$ BEGIN RAISE NOTICE '  ✓ uuid-ossp habilitado'; END $$;

-- ============================================================================
-- PARTE 3: CRIAR TABELAS EVENT-DRIVEN (se não existirem)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '4. CRIANDO TABELAS EVENT-DRIVEN:';
  RAISE NOTICE '---------------------------------';
END $$;

-- 3.1 - EVENT QUEUE
CREATE TABLE IF NOT EXISTS public.event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  event_log_id BIGINT UNIQUE NOT NULL,
  event_type INTEGER NOT NULL,
  event_name TEXT,
  order_id BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

DO $$
BEGIN
  RAISE NOTICE '  ✓ event_queue criado/verificado';

  -- Add foreign key constraint only if workspaces table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'event_queue_workspace_id_fkey'
    ) THEN
      ALTER TABLE public.event_queue
      ADD CONSTRAINT event_queue_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
      RAISE NOTICE '    ✓ Foreign key para workspaces criada';
    END IF;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_event_queue_workspace ON public.event_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_event_queue_status ON public.event_queue(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_event_queue_event_type ON public.event_queue(event_type);
CREATE INDEX IF NOT EXISTS idx_event_queue_order_id ON public.event_queue(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_queue_created_at ON public.event_queue(created_at DESC);

-- 3.2 - BASELINKER SYNC STATE
CREATE TABLE IF NOT EXISTS public.baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID UNIQUE NOT NULL,
  last_log_id BIGINT DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false,
  sync_errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '  ✓ baselinker_sync_state criado/verificado';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'baselinker_sync_state_workspace_id_fkey'
    ) THEN
      ALTER TABLE public.baselinker_sync_state
      ADD CONSTRAINT baselinker_sync_state_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
      RAISE NOTICE '    ✓ Foreign key para workspaces criada';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_baselinker_sync_workspace ON public.baselinker_sync_state(workspace_id);

-- 3.3 - SCHEDULED MESSAGES
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  client_id UUID NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('reorder', 'upsell', 'follow_up', 'welcome', 'custom')),
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '  ✓ scheduled_messages criado/verificado';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'scheduled_messages_workspace_id_fkey'
    ) THEN
      ALTER TABLE public.scheduled_messages
      ADD CONSTRAINT scheduled_messages_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
      RAISE NOTICE '    ✓ Foreign key para workspaces criada';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'scheduled_messages_client_id_fkey'
    ) THEN
      ALTER TABLE public.scheduled_messages
      ADD CONSTRAINT scheduled_messages_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
      RAISE NOTICE '    ✓ Foreign key para clients criada';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for
  ON public.scheduled_messages(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_client
  ON public.scheduled_messages(client_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workspace
  ON public.scheduled_messages(workspace_id);

-- 3.4 - NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID,
  type TEXT NOT NULL CHECK (type IN ('low_stock', 'job_failed', 'delivery_confirmed', 'payment_received', 'info', 'warning', 'error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  RAISE NOTICE '  ✓ notifications criado/verificado';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'notifications_workspace_id_fkey'
    ) THEN
      ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_workspace_id_fkey
      FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
      RAISE NOTICE '    ✓ Foreign key para workspaces criada';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'auth') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'notifications_user_id_fkey'
    ) THEN
      ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '    ✓ Foreign key para auth.users criada';
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_workspace
  ON public.notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- ============================================================================
-- PARTE 4: CRIAR TRIGGER FUNCTION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '5. CRIANDO TRIGGER FUNCTION:';
  RAISE NOTICE '-----------------------------';
END $$;

CREATE OR REPLACE FUNCTION public.process_event_queue()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Try to get configuration from database settings
  BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.service_role_key', true);
  EXCEPTION
    WHEN OTHERS THEN
      -- Settings not configured yet, skip trigger
      RAISE NOTICE 'Supabase settings not configured, skipping event processing';
      RETURN NEW;
  END;

  -- Only process if we have the configuration
  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    -- Call Edge Function to process event
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-event',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'event_id', NEW.id,
        'event_name', NEW.event_name,
        'event_type', NEW.event_type
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN RAISE NOTICE '  ✓ Trigger function criada'; END $$;

-- Create trigger (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_process_event_queue'
  ) THEN
    CREATE TRIGGER trigger_process_event_queue
    AFTER INSERT ON public.event_queue
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION public.process_event_queue();
    RAISE NOTICE '  ✓ Trigger criado';
  ELSE
    RAISE NOTICE '  ✓ Trigger já existe';
  END IF;
END $$;

-- ============================================================================
-- PARTE 5: CONFIGURAR RLS (ROW LEVEL SECURITY)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '6. CONFIGURANDO RLS:';
  RAISE NOTICE '--------------------';
END $$;

-- Enable RLS
ALTER TABLE public.event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baselinker_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can manage event_queue" ON public.event_queue;
DROP POLICY IF EXISTS "Service role can manage baselinker_sync_state" ON public.baselinker_sync_state;
DROP POLICY IF EXISTS "Service role can manage scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;

-- Create policies
CREATE POLICY "Service role can manage event_queue"
  ON public.event_queue FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage baselinker_sync_state"
  ON public.baselinker_sync_state FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage scheduled_messages"
  ON public.scheduled_messages FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage notifications"
  ON public.notifications FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$ BEGIN RAISE NOTICE '  ✓ RLS policies configuradas'; END $$;

-- ============================================================================
-- PARTE 6: CRIAR HELPER FUNCTION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '7. CRIANDO HELPER FUNCTIONS:';
  RAISE NOTICE '-----------------------------';
END $$;

CREATE OR REPLACE FUNCTION public.check_event_system_config()
RETURNS TABLE(
  setting TEXT,
  value TEXT,
  is_configured BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    'app.supabase_url'::TEXT,
    COALESCE(current_setting('app.supabase_url', true), 'NOT SET')::TEXT,
    (current_setting('app.supabase_url', true) IS NOT NULL)::BOOLEAN
  UNION ALL
  SELECT
    'app.service_role_key'::TEXT,
    CASE
      WHEN current_setting('app.service_role_key', true) IS NOT NULL
      THEN '***SET***'
      ELSE 'NOT SET'
    END::TEXT,
    (current_setting('app.service_role_key', true) IS NOT NULL)::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN RAISE NOTICE '  ✓ Helper function criada'; END $$;

-- ============================================================================
-- PARTE 7: VERIFICAR WORKSPACES
-- ============================================================================

DO $$
DECLARE
  workspace_count INTEGER;
  workspace_id UUID;
  workspace_name TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '8. VERIFICANDO WORKSPACES:';
  RAISE NOTICE '--------------------------';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
    RAISE NOTICE '  ✓ Tabela workspaces existe';
    RAISE NOTICE '  ✓ Total de workspaces: %', workspace_count;

    IF workspace_count > 0 THEN
      RAISE NOTICE '';
      RAISE NOTICE '  Workspaces encontrados:';
      FOR workspace_id, workspace_name IN
        SELECT id, name FROM public.workspaces LIMIT 10
      LOOP
        RAISE NOTICE '    - % (ID: %)', workspace_name, workspace_id;
      END LOOP;
    ELSE
      RAISE NOTICE '';
      RAISE NOTICE '  ⚠️  ATENÇÃO: Nenhum workspace encontrado!';
      RAISE NOTICE '  ⚠️  Você precisa criar um workspace antes de continuar.';
    END IF;
  ELSE
    RAISE NOTICE '  ✗ Tabela workspaces NÃO EXISTE!';
    RAISE NOTICE '  ✗ Você precisa executar o schema.sql primeiro!';
  END IF;
END $$;

-- ============================================================================
-- PARTE 8: VERIFICAR CONFIGURAÇÕES
-- ============================================================================

DO $$
DECLARE
  config_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '9. VERIFICANDO CONFIGURAÇÕES:';
  RAISE NOTICE '------------------------------';

  FOR config_record IN SELECT * FROM check_event_system_config()
  LOOP
    IF config_record.is_configured THEN
      RAISE NOTICE '  ✓ %: %', config_record.setting, config_record.value;
    ELSE
      RAISE NOTICE '  ⚠️  %: % (não configurado)', config_record.setting, config_record.value;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- RESUMO FINAL
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICAÇÃO CONCLUÍDA!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '1. Configure as credenciais do workspace (workspaces.settings)';
  RAISE NOTICE '2. Crie o estado de sincronização inicial (baselinker_sync_state)';
  RAISE NOTICE '3. Configure os cron jobs';
  RAISE NOTICE '4. Teste o sistema';
  RAISE NOTICE '';
END $$;
