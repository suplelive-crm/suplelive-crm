-- ============================================================================
-- SETUP AUTOMÁTICO DO BANCO DE DADOS
-- ============================================================================
-- Este script APENAS cria as estruturas necessárias
-- NÃO configura credenciais (isso é feito pelo usuário no painel web)
-- Funciona para TODOS os workspaces automaticamente
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO SETUP AUTOMÁTICO';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- 1. HABILITAR EXTENSÕES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1. HABILITANDO EXTENSÕES:';
  RAISE NOTICE '-------------------------';
END $$;

CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ BEGIN RAISE NOTICE '  ✓ pg_net habilitado'; END $$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN RAISE NOTICE '  ✓ pg_cron habilitado'; END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$ BEGIN RAISE NOTICE '  ✓ uuid-ossp habilitado'; END $$;

-- ============================================================================
-- 2. CRIAR TABELAS EVENT-DRIVEN
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '2. CRIANDO TABELAS EVENT-DRIVEN:';
  RAISE NOTICE '---------------------------------';
END $$;

-- 2.1 - EVENT QUEUE
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

CREATE INDEX IF NOT EXISTS idx_event_queue_workspace ON public.event_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_event_queue_status ON public.event_queue(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_event_queue_event_type ON public.event_queue(event_type);
CREATE INDEX IF NOT EXISTS idx_event_queue_order_id ON public.event_queue(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_queue_created_at ON public.event_queue(created_at DESC);

-- 2.2 - BASELINKER SYNC STATE
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

-- 2.3 - SCHEDULED MESSAGES
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

-- 2.4 - NOTIFICATIONS
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
-- 3. CRIAR TRIGGER FUNCTION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '3. CRIANDO TRIGGER FUNCTION:';
  RAISE NOTICE '-----------------------------';
END $$;

CREATE OR REPLACE FUNCTION public.process_event_queue()
RETURNS TRIGGER AS $$
DECLARE
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  BEGIN
    supabase_url := current_setting('app.supabase_url', true);
    service_role_key := current_setting('app.service_role_key', true);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NEW;
  END;

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
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
-- 4. CONFIGURAR RLS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '4. CONFIGURANDO RLS:';
  RAISE NOTICE '--------------------';
END $$;

ALTER TABLE public.event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baselinker_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage event_queue" ON public.event_queue;
DROP POLICY IF EXISTS "Service role can manage baselinker_sync_state" ON public.baselinker_sync_state;
DROP POLICY IF EXISTS "Service role can manage scheduled_messages" ON public.scheduled_messages;
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;

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
-- 5. CRIAR ESTADO DE SINCRONIZAÇÃO PARA TODOS OS WORKSPACES
-- ============================================================================

DO $$
DECLARE
  workspace_record RECORD;
  workspaces_count INTEGER := 0;
  created_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '5. CRIANDO ESTADO DE SINCRONIZAÇÃO:';
  RAISE NOTICE '------------------------------------';

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    FOR workspace_record IN
      SELECT id, name FROM public.workspaces
    LOOP
      workspaces_count := workspaces_count + 1;

      -- Criar estado de sincronização se não existir
      IF NOT EXISTS (
        SELECT 1 FROM public.baselinker_sync_state
        WHERE workspace_id = workspace_record.id
      ) THEN
        INSERT INTO public.baselinker_sync_state (workspace_id, last_log_id, is_syncing)
        VALUES (workspace_record.id, 0, false);

        created_count := created_count + 1;
        RAISE NOTICE '  ✓ Estado criado para: %', workspace_record.name;
      ELSE
        RAISE NOTICE '  ✓ Estado já existe para: %', workspace_record.name;
      END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '  Total de workspaces: %', workspaces_count;
    RAISE NOTICE '  Estados criados: %', created_count;
    RAISE NOTICE '  Estados existentes: %', workspaces_count - created_count;
  ELSE
    RAISE NOTICE '  ⚠️  Tabela workspaces não existe';
  END IF;
END $$;

-- ============================================================================
-- 6. CONFIGURAR VARIÁVEIS DO SISTEMA (OPCIONAL)
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '6. CONFIGURANDO VARIÁVEIS:';
  RAISE NOTICE '--------------------------';
  RAISE NOTICE '  ℹ️  No Supabase hospedado, Edge Functions já têm acesso';
  RAISE NOTICE '  ℹ️  Você pode configurar manualmente se necessário:';
  RAISE NOTICE '     ALTER ROLE postgres SET app.supabase_url TO ''https://...'';';
  RAISE NOTICE '     ALTER ROLE postgres SET app.service_role_key TO ''...'';';
END $$;

-- ============================================================================
-- 7. RESUMO FINAL
-- ============================================================================

DO $$
DECLARE
  workspace_count INTEGER;
  sync_state_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SETUP CONCLUÍDO!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO workspace_count FROM public.workspaces;
  SELECT COUNT(*) INTO sync_state_count FROM public.baselinker_sync_state;

  RAISE NOTICE 'Resumo:';
  RAISE NOTICE '  ✓ Extensões habilitadas (pg_net, pg_cron, uuid-ossp)';
  RAISE NOTICE '  ✓ Tabelas event-driven criadas (4 tabelas)';
  RAISE NOTICE '  ✓ Triggers configurados';
  RAISE NOTICE '  ✓ RLS policies criadas';
  RAISE NOTICE '  ✓ Workspaces: %', workspace_count;
  RAISE NOTICE '  ✓ Estados de sincronização: %', sync_state_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos passos:';
  RAISE NOTICE '  1. Configurar cron jobs (baselinker-event-poller)';
  RAISE NOTICE '  2. Usuários configuram credenciais no painel web';
  RAISE NOTICE '  3. Sistema funciona automaticamente!';
  RAISE NOTICE '';
END $$;
