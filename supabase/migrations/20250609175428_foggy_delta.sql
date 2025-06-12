/*
  # Sistema Completo de Automação

  1. New Tables
    - `automation_workflows` - Fluxos de automação principais
    - `automation_triggers` - Gatilhos de automação
    - `automation_actions` - Ações de automação
    - `automation_conditions` - Condições para execução
    - `automation_executions` - Histórico de execuções
    - `automation_templates` - Templates pré-definidos

  2. Features
    - Drag & drop workflow builder
    - Multiple trigger types
    - Conditional logic
    - Webhook integrations
    - Template system
    - Execution tracking

  3. Security
    - Enable RLS on all tables
    - Workspace-based access control
*/

-- Create automation_workflows table
CREATE TABLE IF NOT EXISTS automation_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft', -- 'draft', 'active', 'paused', 'archived'
  trigger_type text NOT NULL, -- 'manual', 'time_based', 'event_based', 'webhook'
  workflow_data jsonb DEFAULT '{}', -- Visual workflow structure
  settings jsonb DEFAULT '{}', -- Workflow settings
  execution_count integer DEFAULT 0,
  last_executed timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create automation_triggers table
CREATE TABLE IF NOT EXISTS automation_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES automation_workflows(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'new_lead', 'stage_change', 'message_received', 'time_delay', 'webhook', 'manual'
  config jsonb DEFAULT '{}', -- Trigger configuration
  position jsonb DEFAULT '{"x": 0, "y": 0}', -- Position in visual editor
  created_at timestamptz DEFAULT now()
);

-- Create automation_actions table
CREATE TABLE IF NOT EXISTS automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES automation_workflows(id) ON DELETE CASCADE,
  trigger_id uuid REFERENCES automation_triggers(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'send_message', 'move_stage', 'create_task', 'webhook', 'delay', 'condition'
  config jsonb DEFAULT '{}', -- Action configuration
  position jsonb DEFAULT '{"x": 0, "y": 0}', -- Position in visual editor
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create automation_conditions table
CREATE TABLE IF NOT EXISTS automation_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES automation_workflows(id) ON DELETE CASCADE,
  action_id uuid REFERENCES automation_actions(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'client_tag', 'client_value', 'time_condition', 'custom'
  operator text NOT NULL, -- 'equals', 'contains', 'greater_than', 'less_than', 'exists'
  value text,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create automation_executions table
CREATE TABLE IF NOT EXISTS automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES automation_workflows(id) ON DELETE CASCADE,
  trigger_data jsonb DEFAULT '{}',
  execution_data jsonb DEFAULT '{}',
  status text DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
  error_message text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL
);

-- Create automation_templates table
CREATE TABLE IF NOT EXISTS automation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL, -- 'lead_nurturing', 'customer_support', 'sales', 'marketing'
  template_data jsonb NOT NULL DEFAULT '{}',
  is_public boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for automation_workflows
CREATE POLICY "Users can manage their workspace automation workflows"
  ON automation_workflows
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

-- Create policies for automation_triggers
CREATE POLICY "Users can manage triggers for their workspace workflows"
  ON automation_triggers
  FOR ALL
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- Create policies for automation_actions
CREATE POLICY "Users can manage actions for their workspace workflows"
  ON automation_actions
  FOR ALL
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- Create policies for automation_conditions
CREATE POLICY "Users can manage conditions for their workspace workflows"
  ON automation_conditions
  FOR ALL
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- Create policies for automation_executions
CREATE POLICY "Users can view executions for their workspace workflows"
  ON automation_executions
  FOR ALL
  TO authenticated
  USING (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    workflow_id IN (
      SELECT id FROM automation_workflows 
      WHERE workspace_id IN (
        SELECT id FROM workspaces WHERE owner_id = auth.uid()
      )
    )
  );

-- Create policies for automation_templates
CREATE POLICY "Anyone can read public templates"
  ON automation_templates
  FOR SELECT
  TO authenticated
  USING (is_public = true);

CREATE POLICY "Users can manage their own templates"
  ON automation_templates
  FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_workflows_workspace_id ON automation_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_status ON automation_workflows(status);
CREATE INDEX IF NOT EXISTS idx_automation_triggers_workflow_id ON automation_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_workflow_id ON automation_actions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_trigger_id ON automation_actions(trigger_id);
CREATE INDEX IF NOT EXISTS idx_automation_conditions_workflow_id ON automation_conditions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_conditions_action_id ON automation_conditions(action_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_workflow_id ON automation_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_automation_executions_status ON automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_automation_templates_category ON automation_templates(category);

-- Insert default automation templates
INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES
(
  'Boas-vindas para Novos Leads',
  'Envia mensagem de boas-vindas automaticamente quando um novo lead é criado',
  'lead_nurturing',
  '{
    "triggers": [
      {
        "type": "new_lead",
        "config": {},
        "position": {"x": 100, "y": 100}
      }
    ],
    "actions": [
      {
        "type": "send_message",
        "config": {
          "message": "Olá {{client.name}}! Obrigado pelo seu interesse. Em breve entraremos em contato.",
          "channel": "whatsapp",
          "delay": 0
        },
        "position": {"x": 300, "y": 100}
      }
    ]
  }',
  true
),
(
  'Follow-up Automático',
  'Envia mensagem de follow-up após 24 horas se o lead não foi contatado',
  'sales',
  '{
    "triggers": [
      {
        "type": "new_lead",
        "config": {},
        "position": {"x": 100, "y": 100}
      }
    ],
    "actions": [
      {
        "type": "delay",
        "config": {
          "duration": 86400,
          "unit": "seconds"
        },
        "position": {"x": 300, "y": 100}
      },
      {
        "type": "condition",
        "config": {
          "field": "status",
          "operator": "equals",
          "value": "new"
        },
        "position": {"x": 500, "y": 100}
      },
      {
        "type": "send_message",
        "config": {
          "message": "Olá {{client.name}}! Notamos que você demonstrou interesse. Podemos ajudar com alguma dúvida?",
          "channel": "whatsapp"
        },
        "position": {"x": 700, "y": 100}
      }
    ]
  }',
  true
),
(
  'Movimentação no Kanban',
  'Envia notificação quando cliente muda de fase no Kanban',
  'sales',
  '{
    "triggers": [
      {
        "type": "stage_change",
        "config": {},
        "position": {"x": 100, "y": 100}
      }
    ],
    "actions": [
      {
        "type": "send_message",
        "config": {
          "message": "Parabéns {{client.name}}! Você avançou para a fase: {{stage.name}}",
          "channel": "whatsapp"
        },
        "position": {"x": 300, "y": 100}
      },
      {
        "type": "webhook",
        "config": {
          "url": "https://hooks.n8n.cloud/webhook/your-webhook-id",
          "method": "POST",
          "headers": {
            "Content-Type": "application/json"
          },
          "body": {
            "client": "{{client}}",
            "stage": "{{stage}}",
            "event": "stage_change"
          }
        },
        "position": {"x": 300, "y": 250}
      }
    ]
  }',
  true
),
(
  'Resposta Automática no Inbox',
  'Responde automaticamente mensagens recebidas fora do horário comercial',
  'customer_support',
  '{
    "triggers": [
      {
        "type": "message_received",
        "config": {
          "channel": "whatsapp"
        },
        "position": {"x": 100, "y": 100}
      }
    ],
    "actions": [
      {
        "type": "condition",
        "config": {
          "field": "time",
          "operator": "outside_business_hours",
          "value": "09:00-18:00"
        },
        "position": {"x": 300, "y": 100}
      },
      {
        "type": "send_message",
        "config": {
          "message": "Olá! Recebemos sua mensagem. Nosso horário de atendimento é das 9h às 18h. Retornaremos em breve!",
          "channel": "whatsapp",
          "delay": 30
        },
        "position": {"x": 500, "y": 100}
      }
    ]
  }',
  true
)
ON CONFLICT DO NOTHING;