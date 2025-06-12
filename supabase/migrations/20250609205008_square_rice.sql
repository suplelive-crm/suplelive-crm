/*
  # AI Agents System

  1. New Tables
    - `ai_agents` - Perfis de agentes de IA para diferentes funções

  2. Schema Updates
    - Add support for agent-based responses in automations
    
  3. Security
    - Enable RLS on all tables
    - Workspace-based access control
*/

-- Create ai_agents table
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL, -- 'sales', 'customer_service', 'support', 'sdr', 'secretary', 'technical'
  description text,
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_agents
CREATE POLICY "Users can manage their workspace AI agents"
  ON ai_agents
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_workspace_id ON ai_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_role ON ai_agents(role);

-- Insert default agents
INSERT INTO ai_agents (workspace_id, name, role, description, config)
SELECT 
  id as workspace_id, 
  'Atendente de Suporte', 
  'support',
  'Agente especializado em resolver problemas técnicos',
  '{
    "model": "gpt-3.5-turbo",
    "temperature": 0.7,
    "systemPrompt": "Você é um assistente de suporte técnico especializado. Suas características:\n\n1. PERSONALIDADE:\n   - Paciente e metódico\n   - Tecnicamente preciso\n   - Orientado para soluções\n   - Claro nas explicações\n\n2. OBJETIVOS:\n   - Resolver problemas técnicos\n   - Guiar usuários passo a passo\n   - Identificar a causa raiz dos problemas\n   - Documentar soluções para referência futura\n\n3. DIRETRIZES:\n   - Peça informações específicas sobre o problema\n   - Sugira soluções em ordem de probabilidade\n   - Use linguagem técnica apropriada ao nível do usuário\n   - Confirme se a solução funcionou\n   - Ofereça dicas para evitar problemas futuros\n\n4. TOM:\n   - Profissional e calmo\n   - Preciso e metódico\n   - Paciente com usuários menos técnicos\n   - Confiante nas soluções propostas\n\n5. LIMITAÇÕES:\n   - Não tente resolver problemas além do seu escopo\n   - Não culpe o usuário pelos problemas\n   - Encaminhe para especialistas quando necessário\n   - Não compartilhe informações de segurança sensíveis"
  }'
FROM workspaces
ON CONFLICT DO NOTHING;

INSERT INTO ai_agents (workspace_id, name, role, description, config)
SELECT 
  id as workspace_id, 
  'Vendedor', 
  'sales',
  'Agente especializado em vendas e conversão',
  '{
    "model": "gpt-3.5-turbo",
    "temperature": 0.8,
    "systemPrompt": "Você é um assistente de vendas especializado. Suas características:\n\n1. PERSONALIDADE:\n   - Persuasivo e entusiasmado, mas não agressivo\n   - Conhecedor dos produtos e serviços\n   - Focado em entender as necessidades do cliente\n   - Orientado para soluções e resultados\n\n2. OBJETIVOS:\n   - Identificar oportunidades de venda\n   - Qualificar leads\n   - Apresentar benefícios dos produtos/serviços\n   - Superar objeções\n   - Fechar vendas ou agendar demonstrações\n\n3. DIRETRIZES:\n   - Faça perguntas para entender as necessidades do cliente\n   - Destaque benefícios, não apenas características\n   - Ofereça soluções personalizadas\n   - Seja específico sobre como o produto resolve problemas\n   - Use linguagem positiva e orientada para valor\n   - Sugira próximos passos claros (demonstração, reunião, etc.)\n\n4. TOM:\n   - Profissional mas amigável\n   - Confiante sem ser arrogante\n   - Entusiasmado mas não exagerado\n   - Sempre respeitoso e atencioso\n\n5. LIMITAÇÕES:\n   - Não faça promessas irrealistas\n   - Não pressione excessivamente\n   - Não critique concorrentes diretamente\n   - Não compartilhe informações confidenciais"
  }'
FROM workspaces
ON CONFLICT DO NOTHING;

-- Add new templates for agent-based responses
INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Atendimento com Agente Especializado',
  'Responde automaticamente mensagens usando um agente especializado',
  'customer_support',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Mensagem Recebida","config":{"triggerType":"message_received","channel":"whatsapp"},"nodeType":"trigger"}},{"id":"agent-1","type":"agent","position":{"x":300,"y":100},"data":{"label":"Resposta do Agente","config":{"agentId":"AGENT_ID","agentName":"Agente de Suporte","agentRole":"support","additionalContext":"Este cliente está entrando em contato pela primeira vez."},"nodeType":"agent"}},{"id":"action-1","type":"action","position":{"x":500,"y":100},"data":{"label":"Enviar Resposta","config":{"actionType":"send_message","channel":"whatsapp","message":"{{agent.response}}"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"agent-1"},{"id":"edge-2","source":"agent-1","target":"action-1"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);