/*
  # Adicionar setores e atualizar templates

  1. New Tables
    - `sectors` - Setores para organização do atendimento
    
  2. Changes
    - Adicionar `sector_id` à tabela conversations
    - Atualizar templates com dados completos e prontos para uso
    
  3. Security
    - Enable RLS nos setores
    - Políticas para workspace isolation
*/

-- Create sectors table
CREATE TABLE IF NOT EXISTS sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3b82f6',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add sector_id to conversations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'sector_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN sector_id uuid REFERENCES sectors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;

-- Create policies for sectors
CREATE POLICY "Users can manage their workspace sectors"
  ON sectors
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sectors_workspace_id ON sectors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_sector_id ON conversations(sector_id);

-- Clear existing templates and insert complete ones
DELETE FROM automation_templates WHERE is_public = true;

-- Insert templates one by one to avoid JSON parsing issues
INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Boas-vindas para Novos Leads',
  'Envia mensagem de boas-vindas automaticamente quando um novo lead é criado',
  'lead_nurturing',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Novo Lead Criado","config":{"triggerType":"new_lead"},"nodeType":"trigger"}},{"id":"action-1","type":"action","position":{"x":400,"y":100},"data":{"label":"Enviar Boas-vindas","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá {{client.name}}! 👋\\n\\nObrigado pelo seu interesse em nossos serviços. Recebemos seu contato e em breve nossa equipe entrará em contato com você.\\n\\nEnquanto isso, fique à vontade para nos enviar qualquer dúvida!\\n\\nAtenciosamente,\\nEquipe de Atendimento","delay":30},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"action-1"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);

INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Follow-up Automático 24h',
  'Envia mensagem de follow-up após 24 horas se o lead não foi contatado',
  'sales',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Novo Lead","config":{"triggerType":"new_lead"},"nodeType":"trigger"}},{"id":"delay-1","type":"delay","position":{"x":300,"y":100},"data":{"label":"Aguardar 24h","config":{"duration":24,"unit":"hours"},"nodeType":"delay"}},{"id":"condition-1","type":"condition","position":{"x":500,"y":100},"data":{"label":"Status ainda é Novo?","config":{"field":"lead.status","operator":"equals","value":"new"},"nodeType":"condition"}},{"id":"action-1","type":"action","position":{"x":700,"y":50},"data":{"label":"Enviar Follow-up","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá {{client.name}}! 😊\\n\\nNotamos que você demonstrou interesse em nossos serviços ontem. Gostaríamos de saber se você tem alguma dúvida ou se podemos ajudar de alguma forma?\\n\\nEstamos aqui para esclarecer qualquer questão e ajudar você a encontrar a melhor solução!\\n\\nAguardamos seu retorno! 📱"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"delay-1"},{"id":"edge-2","source":"delay-1","target":"condition-1"},{"id":"edge-3","source":"condition-1","target":"action-1","sourceHandle":"true"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);

INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Direcionamento por Setor',
  'Direciona automaticamente clientes para setores específicos baseado em palavras-chave',
  'customer_support',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Mensagem Recebida","config":{"triggerType":"message_received","channel":"whatsapp"},"nodeType":"trigger"}},{"id":"condition-1","type":"condition","position":{"x":300,"y":50},"data":{"label":"Contém palavra vendas?","config":{"field":"message.content","operator":"contains","value":"vendas|comprar|preço|orçamento"},"nodeType":"condition"}},{"id":"condition-2","type":"condition","position":{"x":300,"y":150},"data":{"label":"Contém palavra suporte?","config":{"field":"message.content","operator":"contains","value":"suporte|problema|ajuda|dúvida"},"nodeType":"condition"}},{"id":"action-1","type":"action","position":{"x":500,"y":50},"data":{"label":"Direcionar para Vendas","config":{"actionType":"move_sector","sector":"vendas"},"nodeType":"action"}},{"id":"action-2","type":"action","position":{"x":500,"y":150},"data":{"label":"Direcionar para Suporte","config":{"actionType":"move_sector","sector":"suporte"},"nodeType":"action"}},{"id":"action-3","type":"action","position":{"x":700,"y":50},"data":{"label":"Mensagem Vendas","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá! 🛍️ Você foi direcionado para nossa equipe de vendas. Em breve um consultor especializado entrará em contato para ajudar com sua solicitação!"},"nodeType":"action"}},{"id":"action-4","type":"action","position":{"x":700,"y":150},"data":{"label":"Mensagem Suporte","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá! 🛠️ Você foi direcionado para nossa equipe de suporte técnico. Nossa equipe especializada irá ajudar a resolver sua questão o mais rápido possível!"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"condition-1"},{"id":"edge-2","source":"trigger-1","target":"condition-2"},{"id":"edge-3","source":"condition-1","target":"action-1","sourceHandle":"true"},{"id":"edge-4","source":"condition-2","target":"action-2","sourceHandle":"true"},{"id":"edge-5","source":"action-1","target":"action-3"},{"id":"edge-6","source":"action-2","target":"action-4"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);

INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Resposta Fora do Horário',
  'Responde automaticamente mensagens recebidas fora do horário comercial',
  'customer_support',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Mensagem Recebida","config":{"triggerType":"message_received","channel":"whatsapp"},"nodeType":"trigger"}},{"id":"condition-1","type":"condition","position":{"x":300,"y":100},"data":{"label":"Fora do horário?","config":{"field":"time","operator":"outside_business_hours","value":"09:00-18:00"},"nodeType":"condition"}},{"id":"delay-1","type":"delay","position":{"x":500,"y":100},"data":{"label":"Aguardar 30s","config":{"duration":30,"unit":"seconds"},"nodeType":"delay"}},{"id":"action-1","type":"action","position":{"x":700,"y":100},"data":{"label":"Resposta Automática","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá! 🌙\\n\\nObrigado por entrar em contato conosco!\\n\\nNo momento estamos fora do horário de atendimento (9h às 18h, de segunda a sexta).\\n\\nSua mensagem foi recebida e nossa equipe retornará o contato no próximo dia útil.\\n\\nPara urgências, você pode nos ligar no (11) 99999-9999.\\n\\nObrigado pela compreensão! 😊"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"condition-1"},{"id":"edge-2","source":"condition-1","target":"delay-1","sourceHandle":"true"},{"id":"edge-3","source":"delay-1","target":"action-1"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);

INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Nutrição de Lead Qualificado',
  'Sequência de mensagens para leads qualificados com interesse demonstrado',
  'lead_nurturing',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Lead Qualificado","config":{"triggerType":"stage_change","toStage":"qualified"},"nodeType":"trigger"}},{"id":"action-1","type":"action","position":{"x":300,"y":100},"data":{"label":"Mensagem Imediata","config":{"actionType":"send_message","channel":"whatsapp","message":"Parabéns {{client.name}}! 🎉\\n\\nIdentificamos que você tem um perfil ideal para nossos serviços. Nossa equipe comercial entrará em contato em breve para apresentar uma proposta personalizada!\\n\\nEnquanto isso, preparamos alguns materiais que podem interessar você. Gostaria de receber?"},"nodeType":"action"}},{"id":"delay-1","type":"delay","position":{"x":500,"y":100},"data":{"label":"Aguardar 2 horas","config":{"duration":2,"unit":"hours"},"nodeType":"delay"}},{"id":"action-2","type":"action","position":{"x":700,"y":100},"data":{"label":"Material Educativo","config":{"actionType":"send_message","channel":"whatsapp","message":"{{client.name}}, aqui está um material que pode ajudar você a entender melhor nossos serviços:\\n\\n📋 *Guia Completo: Como Escolher a Melhor Solução*\\n\\n✅ Principais benefícios\\n✅ Comparativo de opções\\n✅ Cases de sucesso\\n\\nTem alguma dúvida específica que posso esclarecer?"},"nodeType":"action"}},{"id":"delay-2","type":"delay","position":{"x":900,"y":100},"data":{"label":"Aguardar 1 dia","config":{"duration":1,"unit":"days"},"nodeType":"delay"}},{"id":"action-3","type":"action","position":{"x":1100,"y":100},"data":{"label":"Agendamento","config":{"actionType":"send_message","channel":"whatsapp","message":"Oi {{client.name}}! 📅\\n\\nQue tal agendarmos uma conversa rápida de 15 minutos para entender melhor suas necessidades?\\n\\nPosso apresentar como nossa solução pode ajudar especificamente seu caso.\\n\\nTem algum horário que funciona melhor para você esta semana?"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"action-1"},{"id":"edge-2","source":"action-1","target":"delay-1"},{"id":"edge-3","source":"delay-1","target":"action-2"},{"id":"edge-4","source":"action-2","target":"delay-2"},{"id":"edge-5","source":"delay-2","target":"action-3"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);

INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Integração com N8N',
  'Envia dados para webhook do N8N quando cliente muda de fase no Kanban',
  'sales',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Mudança de Fase","config":{"triggerType":"stage_change"},"nodeType":"trigger"}},{"id":"action-1","type":"action","position":{"x":300,"y":100},"data":{"label":"Notificar Cliente","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá {{client.name}}! Seu processo avançou para a fase: {{stage.name}}. Estamos trabalhando para atender você da melhor forma!"},"nodeType":"action"}},{"id":"action-2","type":"action","position":{"x":300,"y":250},"data":{"label":"Enviar para N8N","config":{"actionType":"webhook","url":"https://hooks.n8n.cloud/webhook/your-webhook-id","method":"POST","headers":"{\"Content-Type\": \"application/json\"}","body":"{\"client\": \"{{client}}\", \"stage\": \"{{stage}}\", \"event\": \"stage_change\"}"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"action-1"},{"id":"edge-2","source":"trigger-1","target":"action-2"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);

-- Insert default sectors for each workspace
INSERT INTO sectors (workspace_id, name, description, color, is_default)
SELECT 
  id as workspace_id, 
  'Geral', 
  'Setor padrão para todos os atendimentos', 
  '#3b82f6', 
  true
FROM workspaces
ON CONFLICT DO NOTHING;

INSERT INTO sectors (workspace_id, name, description, color)
SELECT 
  id as workspace_id, 
  'Vendas', 
  'Atendimento comercial e orçamentos', 
  '#10b981'
FROM workspaces
ON CONFLICT DO NOTHING;

INSERT INTO sectors (workspace_id, name, description, color)
SELECT 
  id as workspace_id, 
  'Suporte', 
  'Suporte técnico e dúvidas', 
  '#f59e0b'
FROM workspaces
ON CONFLICT DO NOTHING;

INSERT INTO sectors (workspace_id, name, description, color)
SELECT 
  id as workspace_id, 
  'Financeiro', 
  'Pagamentos e questões financeiras', 
  '#ef4444'
FROM workspaces
ON CONFLICT DO NOTHING;