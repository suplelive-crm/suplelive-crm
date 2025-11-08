-- Migration: Event-Driven Architecture Tables (FIXED)
-- Created: 2025-01-08
-- Purpose: Support event-driven processing of Baselinker orders and customer actions
-- Fix: Removed dependencies on tables that may not exist yet

-- ============================================================================
-- 1. EVENT QUEUE
-- ============================================================================
-- Stores events from Baselinker to be processed asynchronously

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

-- Add foreign key constraint only if workspaces table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    ALTER TABLE public.event_queue
    DROP CONSTRAINT IF EXISTS event_queue_workspace_id_fkey;

    ALTER TABLE public.event_queue
    ADD CONSTRAINT event_queue_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_queue_workspace ON public.event_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_event_queue_status ON public.event_queue(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_event_queue_event_type ON public.event_queue(event_type);
CREATE INDEX IF NOT EXISTS idx_event_queue_order_id ON public.event_queue(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_queue_created_at ON public.event_queue(created_at DESC);

-- ============================================================================
-- 2. BASELINKER SYNC STATE
-- ============================================================================
-- Tracks the last processed event log ID per workspace

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

-- Add foreign key constraint only if workspaces table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    ALTER TABLE public.baselinker_sync_state
    DROP CONSTRAINT IF EXISTS baselinker_sync_state_workspace_id_fkey;

    ALTER TABLE public.baselinker_sync_state
    ADD CONSTRAINT baselinker_sync_state_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_baselinker_sync_workspace ON public.baselinker_sync_state(workspace_id);

-- ============================================================================
-- 3. SCHEDULED MESSAGES
-- ============================================================================
-- Stores messages to be sent in the future (reorders, follow-ups, etc)

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

-- Add foreign key constraints only if referenced tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    ALTER TABLE public.scheduled_messages
    DROP CONSTRAINT IF EXISTS scheduled_messages_workspace_id_fkey;

    ALTER TABLE public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients' AND table_schema = 'public') THEN
    ALTER TABLE public.scheduled_messages
    DROP CONSTRAINT IF EXISTS scheduled_messages_client_id_fkey;

    ALTER TABLE public.scheduled_messages
    ADD CONSTRAINT scheduled_messages_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_for
  ON public.scheduled_messages(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_client
  ON public.scheduled_messages(client_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_workspace
  ON public.scheduled_messages(workspace_id);

-- ============================================================================
-- 4. NOTIFICATIONS TABLE (Para alertas do sistema)
-- ============================================================================
-- Stores system notifications (low stock, failed jobs, etc)

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

-- Add foreign key constraints only if referenced tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces' AND table_schema = 'public') THEN
    ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_workspace_id_fkey;

    ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Check if auth.users exists (it should in Supabase)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'auth') THEN
    ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

    ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_workspace
  ON public.notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, read_at)
  WHERE read_at IS NULL;

-- ============================================================================
-- 5. TRIGGER FUNCTION: Process Event Queue
-- ============================================================================
-- Automatically calls Edge Function when new event is inserted
-- NOTE: This requires app.supabase_url and app.service_role_key to be set

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
  END IF;
END $$;

-- ============================================================================
-- 6. RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baselinker_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Event Queue Policies
-- Service role can do anything (for Edge Functions)
CREATE POLICY "Service role can manage event_queue"
  ON public.event_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Baselinker Sync State Policies
CREATE POLICY "Service role can manage baselinker_sync_state"
  ON public.baselinker_sync_state
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Scheduled Messages Policies
CREATE POLICY "Service role can manage scheduled_messages"
  ON public.scheduled_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Notifications Policies
-- Users can view their own notifications
CREATE POLICY "Users can view their notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role can manage notifications"
  ON public.notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- CONFIGURATION HELPER
-- ============================================================================

-- Function to check if configuration is set
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

-- ============================================================================
-- DONE!
-- ============================================================================

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '✓ Event-driven tables created successfully!';
  RAISE NOTICE '  - event_queue';
  RAISE NOTICE '  - baselinker_sync_state';
  RAISE NOTICE '  - scheduled_messages';
  RAISE NOTICE '  - notifications';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Configure Supabase settings:';
  RAISE NOTICE '   ALTER DATABASE postgres SET app.supabase_url TO ''https://your-project.supabase.co'';';
  RAISE NOTICE '   ALTER DATABASE postgres SET app.service_role_key TO ''your-key'';';
  RAISE NOTICE '';
  RAISE NOTICE '2. Check configuration:';
  RAISE NOTICE '   SELECT * FROM check_event_system_config();';
  RAISE NOTICE '';
  RAISE NOTICE '3. Configure workspace credentials (see QUICK_START_MULTI_TENANT.md)';
END $$;
