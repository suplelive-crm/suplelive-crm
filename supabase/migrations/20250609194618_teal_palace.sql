/*
  # Add OpenAI and n8n Support to Automation System

  1. Updates
    - Add new action types for OpenAI integration
    - Add new trigger types for chatbot and text classification
    - Update automation_workflows table with new fields for AI configuration
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add new fields to automation_workflows for AI configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_workflows' AND column_name = 'ai_config'
  ) THEN
    ALTER TABLE automation_workflows ADD COLUMN ai_config jsonb DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'automation_workflows' AND column_name = 'n8n_webhook_url'
  ) THEN
    ALTER TABLE automation_workflows ADD COLUMN n8n_webhook_url text;
  END IF;
END $$;

-- Add new templates for OpenAI and n8n integration
INSERT INTO automation_templates (name, description, category, template_data, is_public) VALUES (
  'Chatbot com OpenAI',
  'Responde automaticamente mensagens com IA usando OpenAI',
  'customer_support',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Mensagem Recebida","config":{"triggerType":"message_received","channel":"whatsapp"},"nodeType":"trigger"}},{"id":"condition-1","type":"condition","position":{"x":300,"y":100},"data":{"label":"Fora do horário?","config":{"field":"time","operator":"outside_business_hours","value":"09:00-18:00"},"nodeType":"condition"}},{"id":"action-1","type":"action","position":{"x":500,"y":50},"data":{"label":"Resposta IA","config":{"actionType":"chatbot_response","model":"gpt-3.5-turbo","systemPrompt":"Você é um assistente virtual para atendimento ao cliente. Seja conciso, amigável e útil. Responda em português.","temperature":0.7,"transferIfUnsure":true},"nodeType":"action"}},{"id":"action-2","type":"action","position":{"x":500,"y":150},"data":{"label":"Resposta Fora do Horário","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá! 🌙\\n\\nObrigado por entrar em contato conosco!\\n\\nNo momento estamos fora do horário de atendimento (9h às 18h, de segunda a sexta).\\n\\nSua mensagem foi recebida e nossa equipe retornará o contato no próximo dia útil.\\n\\nObrigado pela compreensão! 😊"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"condition-1"},{"id":"edge-2","source":"condition-1","target":"action-1","sourceHandle":"false"},{"id":"edge-3","source":"condition-1","target":"action-2","sourceHandle":"true"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
),
(
  'Classificação de Texto com IA',
  'Classifica mensagens recebidas e direciona para setores apropriados',
  'customer_support',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Mensagem Recebida","config":{"triggerType":"message_received","channel":"whatsapp"},"nodeType":"trigger"}},{"id":"action-1","type":"action","position":{"x":300,"y":100},"data":{"label":"Classificar Texto","config":{"actionType":"text_classification","categories":"suporte, vendas, informações, reclamação, elogio","model":"gpt-3.5-turbo","actionOnCategory":"move_sector","categoryMapping":{"suporte":"setor_suporte_id","vendas":"setor_vendas_id","informações":"setor_geral_id","reclamação":"setor_suporte_id","elogio":"setor_geral_id"}},"nodeType":"action"}},{"id":"action-2","type":"action","position":{"x":500,"y":100},"data":{"label":"Notificar Cliente","config":{"actionType":"send_message","channel":"whatsapp","message":"Olá {{client.name}}! Sua mensagem foi classificada e direcionada para o setor apropriado. Em breve um atendente entrará em contato."},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"action-1"},{"id":"edge-2","source":"action-1","target":"action-2"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
),
(
  'Integração com n8n',
  'Envia dados para n8n e processa a resposta',
  'sales',
  '{"nodes":[{"id":"trigger-1","type":"trigger","position":{"x":100,"y":100},"data":{"label":"Mensagem Recebida","config":{"triggerType":"message_received"},"nodeType":"trigger"}},{"id":"action-1","type":"action","position":{"x":300,"y":100},"data":{"label":"Enviar para n8n","config":{"actionType":"webhook","url":"https://seu-n8n.com/webhook/chatbot","method":"POST","headers":{"Content-Type":"application/json"},"body":{"message":"{{message.content}}","client":{"name":"{{client.name}}","phone":"{{client.phone}}","email":"{{client.email}}"}},"waitForResponse":true},"nodeType":"action"}},{"id":"action-2","type":"action","position":{"x":500,"y":100},"data":{"label":"Enviar Resposta","config":{"actionType":"send_message","channel":"whatsapp","message":"{{webhook.response}}"},"nodeType":"action"}}],"connections":[{"id":"edge-1","source":"trigger-1","target":"action-1"},{"id":"edge-2","source":"action-1","target":"action-2"}],"viewport":{"x":0,"y":0,"zoom":1}}',
  true
);