-- Migration: Event-Driven Architecture Tables
-- Created: 2025-01-07
-- Purpose: Support event-driven processing of Baselinker orders and customer actions

-- ============================================================================
-- 1. EVENT QUEUE
-- ============================================================================
-- Stores events from Baselinker to be processed asynchronously

CREATE TABLE IF NOT EXISTS public.event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Indexes for performance
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
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE NOT NULL,
  last_log_id BIGINT DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false,
  sync_errors JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_baselinker_sync_workspace ON public.baselinker_sync_state(workspace_id);

-- ============================================================================
-- 3. SCHEDULED MESSAGES
-- ============================================================================
-- Stores messages to be sent in the future (reorders, follow-ups, etc)

CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('reorder', 'upsell', 'follow_up', 'welcome', 'custom')),
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('low_stock', 'job_failed', 'delivery_confirmed', 'payment_received', 'info', 'warning', 'error')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE OR REPLACE FUNCTION public.process_event_queue()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function via pg_net (Supabase extension)
  -- Note: In production, replace [project-ref] with actual project reference
  PERFORM net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/process-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'event_id', NEW.id,
      'event_type', NEW.event_type,
      'event_name', NEW.event_name,
      'order_id', NEW.order_id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Failed to trigger process-event: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS event_queue_trigger ON public.event_queue;
CREATE TRIGGER event_queue_trigger
  AFTER INSERT ON public.event_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.process_event_queue();

-- ============================================================================
-- 6. TRIGGER FUNCTION: Auto-update updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
DROP TRIGGER IF EXISTS update_baselinker_sync_state_updated_at ON public.baselinker_sync_state;
CREATE TRIGGER update_baselinker_sync_state_updated_at
  BEFORE UPDATE ON public.baselinker_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_messages_updated_at ON public.scheduled_messages;
CREATE TRIGGER update_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7. HELPER FUNCTION: Get Event Name from Type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_event_name(event_type INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE event_type
    WHEN 1 THEN 'order_created'
    WHEN 3 THEN 'payment_received'
    WHEN 4 THEN 'order_removed'
    WHEN 5 THEN 'order_merged'
    WHEN 6 THEN 'order_split'
    WHEN 7 THEN 'invoice_created'
    WHEN 8 THEN 'receipt_created'
    WHEN 9 THEN 'package_created'
    WHEN 10 THEN 'package_deleted'
    WHEN 11 THEN 'delivery_updated'
    WHEN 12 THEN 'product_added'
    WHEN 13 THEN 'product_edited'
    WHEN 14 THEN 'product_removed'
    WHEN 15 THEN 'buyer_blacklisted'
    WHEN 17 THEN 'order_copied'
    WHEN 18 THEN 'status_changed'
    WHEN 19 THEN 'invoice_corrected'
    WHEN 20 THEN 'receipt_printed'
    WHEN 21 THEN 'invoice_cancelled'
    ELSE 'unknown_event_' || event_type::TEXT
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 8. RLS POLICIES (Row Level Security)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baselinker_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Event Queue: Only service role can access
CREATE POLICY "Service role can manage event_queue"
  ON public.event_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Baselinker Sync State: Service role only
CREATE POLICY "Service role can manage baselinker_sync_state"
  ON public.baselinker_sync_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Scheduled Messages: Users can view their workspace messages
CREATE POLICY "Users can view scheduled_messages in their workspace"
  ON public.scheduled_messages
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- Scheduled Messages: Service role can manage
CREATE POLICY "Service role can manage scheduled_messages"
  ON public.scheduled_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Notifications: Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users
      WHERE user_id = auth.uid()
    )
  );

-- Notifications: Users can mark their notifications as read
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications: Service role can manage
CREATE POLICY "Service role can manage notifications"
  ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9. SEED DATA
-- ============================================================================

-- Initialize baselinker_sync_state for existing workspaces
INSERT INTO public.baselinker_sync_state (workspace_id, last_log_id)
SELECT id, 0
FROM public.workspaces
WHERE id NOT IN (SELECT workspace_id FROM public.baselinker_sync_state)
ON CONFLICT (workspace_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.event_queue IS 'Queue of events from Baselinker to be processed asynchronously';
COMMENT ON TABLE public.baselinker_sync_state IS 'Tracks the last processed event log ID for each workspace';
COMMENT ON TABLE public.scheduled_messages IS 'Messages scheduled to be sent in the future (reorders, follow-ups)';
COMMENT ON TABLE public.notifications IS 'System notifications for users and workspaces';
COMMENT ON FUNCTION public.get_event_name IS 'Returns human-readable event name from Baselinker event type ID';
