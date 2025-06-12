/*
  # SaaS Omnichannel CRM Schema

  1. New Tables
    - `plans` - Subscription plans (Starter, Pro, Enterprise)
    - `workspaces` - Multi-tenant workspaces
    - `subscriptions` - Workspace subscription management
    - `channels` - Omnichannel integrations
    - `whatsapp_instances` - WhatsApp Baileys instances
    - `conversations` - Unified inbox conversations
    - `automations` - n8n workflow automations

  2. Schema Updates
    - Add workspace_id to existing tables (leads, clients, campaigns)
    - Update messages table for omnichannel support
    - Add proper indexes for performance

  3. Security
    - Enable RLS on all new tables
    - Update policies for workspace isolation
    - Ensure proper data segregation
*/

-- Create plans table first
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_monthly decimal(10,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}',
  limits jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  plan_id uuid REFERENCES plans(id),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id),
  status text DEFAULT 'active',
  billing_info jsonb DEFAULT '{}',
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz DEFAULT now() + interval '1 month',
  created_at timestamptz DEFAULT now()
);

-- Create channels table for omnichannel connections
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'whatsapp', 'shopee', 'mercado_livre', 'rd_marketplace'
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  status text DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  last_sync timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create WhatsApp instances table
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  instance_name text NOT NULL,
  session_id text UNIQUE,
  qr_code text,
  status text DEFAULT 'disconnected', -- 'connecting', 'connected', 'disconnected'
  phone_number text,
  webhook_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversations table for unified inbox
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  external_id text, -- ID from external platform
  status text DEFAULT 'open', -- 'open', 'closed', 'pending'
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create automations table for n8n workflows
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL, -- 'new_lead', 'new_order', 'message_received', etc.
  trigger_config jsonb DEFAULT '{}',
  n8n_webhook_url text,
  status text DEFAULT 'active', -- 'active', 'inactive'
  execution_count integer DEFAULT 0,
  last_executed timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add workspace_id to existing tables
DO $$
BEGIN
  -- Add workspace_id to leads table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Add workspace_id to clients table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE clients ADD COLUMN workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;

  -- Add workspace_id to campaigns table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaigns' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE campaigns ADD COLUMN workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update messages table for omnichannel support
DO $$
BEGIN
  -- Add conversation_id to messages table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;

  -- Add channel_type to messages table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'channel_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN channel_type text DEFAULT 'whatsapp';
  END IF;

  -- Add sender_type to messages table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'sender_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN sender_type text DEFAULT 'user'; -- 'user', 'client', 'system'
  END IF;

  -- Add external_id to messages table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'external_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN external_id text;
  END IF;

  -- Add metadata to messages table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE messages ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

-- Create workspace policies
CREATE POLICY "Users can read their workspace"
  ON workspaces
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can update their workspace"
  ON workspaces
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can create workspaces"
  ON workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Create plans policies (public read)
CREATE POLICY "Anyone can read plans"
  ON plans
  FOR SELECT
  TO authenticated
  USING (true);

-- Create subscription policies
CREATE POLICY "Users can manage their workspace subscriptions"
  ON subscriptions
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create channel policies
CREATE POLICY "Users can manage their workspace channels"
  ON channels
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create WhatsApp instance policies
CREATE POLICY "Users can manage their workspace WhatsApp instances"
  ON whatsapp_instances
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create conversation policies
CREATE POLICY "Users can manage their workspace conversations"
  ON conversations
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Create automation policies
CREATE POLICY "Users can manage their workspace automations"
  ON automations
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Update existing table policies for workspace isolation
DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;
CREATE POLICY "Users can manage their workspace leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own clients" ON clients;
CREATE POLICY "Users can manage their workspace clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their own campaigns" ON campaigns;
CREATE POLICY "Users can manage their workspace campaigns"
  ON campaigns
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Insert default plans
INSERT INTO plans (name, price_monthly, features, limits) VALUES
(
  'Starter',
  29.99,
  '{"whatsapp": true, "basic_crm": true, "email_support": true}',
  '{"channels": 2, "users": 1, "monthly_messages": 1000, "automations": 3}'
),
(
  'Pro',
  79.99,
  '{"whatsapp": true, "all_channels": true, "advanced_crm": true, "rfm_analysis": true, "campaigns": true, "priority_support": true}',
  '{"channels": 10, "users": 5, "monthly_messages": 10000, "automations": 20}'
),
(
  'Enterprise',
  199.99,
  '{"everything": true, "custom_integrations": true, "dedicated_support": true, "white_label": true}',
  '{"channels": -1, "users": -1, "monthly_messages": -1, "automations": -1}'
)
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_workspace_id ON channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_workspace_id ON whatsapp_instances(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automations_workspace_id ON automations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON leads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);