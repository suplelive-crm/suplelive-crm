import { useState, useEffect } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Node } from 'reactflow';
import { useSectorStore } from '@/store/sectorStore';
import { useAIAgentStore } from '@/store/aiAgentStore';
import { MessageEditor } from './MessageEditor';

interface NodeConfigPanelProps {
  node: Node;
  onUpdate: (data: any) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, onUpdate, onDelete, onClose }: NodeConfigPanelProps) {
  const [config, setConfig] = useState(node.data.config || {});
  const [label, setLabel] = useState(node.data.label || '');
  const { sectors } = useSectorStore();
  const { agents, fetchAgents } = useAIAgentStore();

  useEffect(() => {
    if (node.type === 'agent') {
      fetchAgents();
    }
  }, [node.type, fetchAgents]);

  const handleSave = () => {
    onUpdate({ config, label });
  };

  const renderTriggerConfig = () => {
    switch (config.triggerType) {
      case 'new_lead':
        return (
          <div className="space-y-4">
            <div>
              <Label>Origem do Lead (Opcional)</Label>
              <Select 
                value={config.source || 'any'} 
                onValueChange={(value) => setConfig({ ...config, source: value === 'any' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer origem</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="social_media">Redes Sociais</SelectItem>
                  <SelectItem value="referral">Indicação</SelectItem>
                  <SelectItem value="advertising">Publicidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'stage_change':
        return (
          <div className="space-y-4">
            <div>
              <Label>Fase de Origem</Label>
              <Input
                value={config.fromStage || ''}
                onChange={(e) => setConfig({ ...config, fromStage: e.target.value })}
                placeholder="Qualquer fase"
              />
            </div>
            <div>
              <Label>Fase de Destino</Label>
              <Input
                value={config.toStage || ''}
                onChange={(e) => setConfig({ ...config, toStage: e.target.value })}
                placeholder="Qualquer fase"
              />
            </div>
          </div>
        );

      case 'message_received':
        return (
          <div className="space-y-4">
            <div>
              <Label>Canal</Label>
              <Select 
                value={config.channel || 'any'} 
                onValueChange={(value) => setConfig({ ...config, channel: value === 'any' ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer canal</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Palavras-chave (Opcional)</Label>
              <Input
                value={config.keywords || ''}
                onChange={(e) => setConfig({ ...config, keywords: e.target.value })}
                placeholder="palavra1, palavra2"
              />
            </div>
          </div>
        );

      case 'webhook':
        return (
          <div className="space-y-4">
            <div>
              <Label>URL do Webhook</Label>
              <Input
                value={config.webhookUrl || ''}
                onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                placeholder="https://exemplo.com/webhook"
              />
            </div>
            <div>
              <Label>Método</Label>
              <Select 
                value={config.method || 'POST'} 
                onValueChange={(value) => setConfig({ ...config, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      default:
        return (
          <div>
            <Label>Tipo de Gatilho</Label>
            <Select 
              value={config.triggerType || ''} 
              onValueChange={(value) => setConfig({ ...config, triggerType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um gatilho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_lead">Novo Lead</SelectItem>
                <SelectItem value="stage_change">Mudança de Fase</SelectItem>
                <SelectItem value="message_received">Mensagem Recebida</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="time_based">Baseado em Tempo</SelectItem>
                <SelectItem value="chatbot">Chatbot</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
    }
  };

  const renderActionConfig = () => {
    switch (config.actionType) {
      case 'send_message':
        return (
          <div className="space-y-4">
            <div>
              <Label>Canal</Label>
              <Select 
                value={config.channel || 'whatsapp'} 
                onValueChange={(value) => setConfig({ ...config, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <MessageEditor 
              value={config.message || ''} 
              onChange={(value) => setConfig({ ...config, message: value })}
              channel={config.channel || 'whatsapp'}
            />
            
            <div>
              <Label>Delay (segundos)</Label>
              <Input
                type="number"
                value={config.delay || 0}
                onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) })}
                min="0"
              />
            </div>
          </div>
        );

      case 'move_stage':
        return (
          <div className="space-y-4">
            <div>
              <Label>Nova Fase</Label>
              <Input
                value={config.targetStage || ''}
                onChange={(e) => setConfig({ ...config, targetStage: e.target.value })}
                placeholder="Nome da fase de destino"
              />
            </div>
          </div>
        );

      case 'move_sector':
        return (
          <div className="space-y-4">
            <div>
              <Label>Setor de Destino</Label>
              <Select 
                value={config.sector || ''} 
                onValueChange={(value) => setConfig({ ...config, sector: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector.id} value={sector.id}>
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: sector.color }}
                        />
                        {sector.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'webhook':
        return (
          <div className="space-y-4">
            <div>
              <Label>URL</Label>
              <Input
                value={config.url || ''}
                onChange={(e) => setConfig({ ...config, url: e.target.value })}
                placeholder="https://hooks.n8n.cloud/webhook/your-id"
              />
            </div>
            <div>
              <Label>Método</Label>
              <Select 
                value={config.method || 'POST'} 
                onValueChange={(value) => setConfig({ ...config, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Headers (JSON)</Label>
              <Input
                value={typeof config.headers === 'string' ? config.headers : JSON.stringify(config.headers || {"Content-Type": "application/json"})}
                onChange={(e) => setConfig({ ...config, headers: e.target.value })}
                placeholder='{"Content-Type": "application/json"}'
              />
            </div>
            <div>
              <Label>Body (JSON)</Label>
              <Input
                value={typeof config.body === 'string' ? config.body : JSON.stringify(config.body || {"client": "{{client}}", "event": "automation"})}
                onChange={(e) => setConfig({ ...config, body: e.target.value })}
                placeholder='{"client": "{{client}}", "event": "automation"}'
              />
            </div>
          </div>
        );

      case 'chatbot_response':
        return (
          <div className="space-y-4">
            <div>
              <Label>Modelo</Label>
              <Select 
                value={config.model || 'gpt-3.5-turbo'} 
                onValueChange={(value) => setConfig({ ...config, model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prompt do Sistema</Label>
              <Textarea
                value={config.systemPrompt || 'Você é um assistente virtual para atendimento ao cliente.'}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label>Temperatura (Criatividade)</Label>
              <Slider
                value={[config.temperature || 0.7]}
                onValueChange={(value) => setConfig({ ...config, temperature: value[0] })}
                max={1}
                min={0}
                step={0.1}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Transferir para humano se não souber responder</Label>
              <Switch
                checked={config.transferIfUnsure || false}
                onCheckedChange={(checked) => setConfig({ ...config, transferIfUnsure: checked })}
              />
            </div>
          </div>
        );

      case 'text_classification':
        return (
          <div className="space-y-4">
            <div>
              <Label>Categorias (separadas por vírgula)</Label>
              <Input
                value={config.categories || 'suporte, vendas, informações, reclamação, elogio'}
                onChange={(e) => setConfig({ ...config, categories: e.target.value })}
                placeholder="suporte, vendas, informações..."
              />
            </div>
            <div>
              <Label>Modelo</Label>
              <Select 
                value={config.model || 'gpt-3.5-turbo'} 
                onValueChange={(value) => setConfig({ ...config, model: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ação baseada na categoria</Label>
              <Select 
                value={config.actionOnCategory || 'move_sector'} 
                onValueChange={(value) => setConfig({ ...config, actionOnCategory: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="move_sector">Mover para Setor</SelectItem>
                  <SelectItem value="tag">Adicionar Tag</SelectItem>
                  <SelectItem value="notify">Notificar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mapeamento de Categorias (JSON)</Label>
              <Textarea
                value={typeof config.categoryMapping === 'string' ? config.categoryMapping : JSON.stringify(config.categoryMapping || {"suporte": "setor_suporte_id", "vendas": "setor_vendas_id"}, null, 2)}
                onChange={(e) => setConfig({ ...config, categoryMapping: e.target.value })}
                rows={4}
                placeholder='{"suporte": "setor_suporte_id", "vendas": "setor_vendas_id"}'
              />
            </div>
          </div>
        );

      case 'agent_response':
        return (
          <div className="space-y-4">
            <div>
              <Label>Selecionar Agente</Label>
              <Select 
                value={config.agentId || ''} 
                onValueChange={(value) => {
                  const agent = agents.find(a => a.id === value);
                  setConfig({ 
                    ...config, 
                    agentId: value,
                    agentName: agent?.name || '',
                    agentRole: agent?.role || '',
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name} ({agent.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Nenhum agente disponível. Crie agentes na configuração OpenAI.
                </p>
              )}
            </div>
            
            <div>
              <Label>Canal de Resposta</Label>
              <Select 
                value={config.channel || 'whatsapp'} 
                onValueChange={(value) => setConfig({ ...config, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Contexto Adicional (Opcional)</Label>
              <Textarea
                value={config.additionalContext || ''}
                onChange={(e) => setConfig({ ...config, additionalContext: e.target.value })}
                placeholder="Informações adicionais para o agente..."
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Informações que serão incluídas no prompt do agente para contextualizar a resposta.
              </p>
            </div>
            
            <div>
              <Label>Delay (segundos)</Label>
              <Input
                type="number"
                value={config.delay || 0}
                onChange={(e) => setConfig({ ...config, delay: parseInt(e.target.value) })}
                min="0"
              />
            </div>
          </div>
        );

      default:
        return (
          <div>
            <Label>Tipo de Ação</Label>
            <Select 
              value={config.actionType || ''} 
              onValueChange={(value) => setConfig({ ...config, actionType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="send_message">Enviar Mensagem</SelectItem>
                <SelectItem value="move_stage">Mover Fase</SelectItem>
                <SelectItem value="move_sector">Mover para Setor</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="create_task">Criar Tarefa</SelectItem>
                <SelectItem value="add_tag">Adicionar Tag</SelectItem>
                <SelectItem value="chatbot_response">Resposta de Chatbot</SelectItem>
                <SelectItem value="text_classification">Classificação de Texto</SelectItem>
                <SelectItem value="agent_response">Resposta de Agente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
    }
  };

  const renderConditionConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label>Campo</Label>
          <Select 
            value={config.field || ''} 
            onValueChange={(value) => setConfig({ ...config, field: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um campo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client.name">Nome do Cliente</SelectItem>
              <SelectItem value="client.email">Email do Cliente</SelectItem>
              <SelectItem value="client.phone">Telefone do Cliente</SelectItem>
              <SelectItem value="client.tags">Tags do Cliente</SelectItem>
              <SelectItem value="lead.status">Status do Lead</SelectItem>
              <SelectItem value="lead.source">Origem do Lead</SelectItem>
              <SelectItem value="message.content">Conteúdo da Mensagem</SelectItem>
              <SelectItem value="time">Horário</SelectItem>
              <SelectItem value="chatbot.intent">Intenção do Chatbot</SelectItem>
              <SelectItem value="classification.category">Categoria da Classificação</SelectItem>
              <SelectItem value="agent.response">Resposta do Agente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Operador</Label>
          <Select 
            value={config.operator || ''} 
            onValueChange={(value) => setConfig({ ...config, operator: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um operador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Igual a</SelectItem>
              <SelectItem value="not_equals">Diferente de</SelectItem>
              <SelectItem value="contains">Contém</SelectItem>
              <SelectItem value="not_contains">Não contém</SelectItem>
              <SelectItem value="greater_than">Maior que</SelectItem>
              <SelectItem value="less_than">Menor que</SelectItem>
              <SelectItem value="exists">Existe</SelectItem>
              <SelectItem value="not_exists">Não existe</SelectItem>
              <SelectItem value="outside_business_hours">Fora do Horário Comercial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Valor</Label>
          <Input
            value={config.value || ''}
            onChange={(e) => setConfig({ ...config, value: e.target.value })}
            placeholder="Valor para comparação"
          />
        </div>
      </div>
    );
  };

  const renderDelayConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label>Duração</Label>
          <Input
            type="number"
            value={config.duration || 1}
            onChange={(e) => setConfig({ ...config, duration: parseInt(e.target.value) })}
            min="1"
          />
        </div>
        
        <div>
          <Label>Unidade</Label>
          <Select 
            value={config.unit || 'minutes'} 
            onValueChange={(value) => setConfig({ ...config, unit: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seconds">Segundos</SelectItem>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderChatbotConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label>Modelo</Label>
          <Select 
            value={config.model || 'gpt-3.5-turbo'} 
            onValueChange={(value) => setConfig({ ...config, model: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Prompt do Sistema</Label>
          <Textarea
            value={config.systemPrompt || 'Você é um assistente virtual para atendimento ao cliente.'}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            rows={4}
          />
        </div>
        <div>
          <Label>Temperatura (Criatividade)</Label>
          <Slider
            value={[config.temperature || 0.7]}
            onValueChange={(value) => setConfig({ ...config, temperature: value[0] })}
            max={1}
            min={0}
            step={0.1}
            className="mt-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Mais conservador</span>
            <span>Mais criativo</span>
          </div>
        </div>
      </div>
    );
  };

  const renderClassifierConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label>Categorias (separadas por vírgula)</Label>
          <Input
            value={config.categories || 'suporte, vendas, informações, reclamação, elogio'}
            onChange={(e) => setConfig({ ...config, categories: e.target.value })}
            placeholder="suporte, vendas, informações..."
          />
        </div>
        <div>
          <Label>Modelo</Label>
          <Select 
            value={config.model || 'gpt-3.5-turbo'} 
            onValueChange={(value) => setConfig({ ...config, model: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
              <SelectItem value="gpt-4">GPT-4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  const renderAgentConfig = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label>Selecionar Agente</Label>
          <Select 
            value={config.agentId || ''} 
            onValueChange={(value) => {
              const agent = agents.find(a => a.id === value);
              setConfig({ 
                ...config, 
                agentId: value,
                agentName: agent?.name || '',
                agentRole: agent?.role || '',
              });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name} ({agent.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agents.length === 0 && (
            <p className="text-xs text-red-500 mt-1">
              Nenhum agente disponível. Crie agentes na configuração OpenAI.
            </p>
          )}
        </div>
        
        <div>
          <Label>Contexto Adicional (Opcional)</Label>
          <Textarea
            value={config.additionalContext || ''}
            onChange={(e) => setConfig({ ...config, additionalContext: e.target.value })}
            placeholder="Informações adicionais para o agente..."
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            Informações que serão incluídas no prompt do agente para contextualizar a resposta.
          </p>
        </div>
      </div>
    );
  };

  const renderConfig = () => {
    switch (node.type) {
      case 'trigger':
        return renderTriggerConfig();
      case 'action':
        return renderActionConfig();
      case 'condition':
        return renderConditionConfig();
      case 'delay':
        return renderDelayConfig();
      case 'chatbot':
        return renderChatbotConfig();
      case 'classifier':
        return renderClassifierConfig();
      case 'agent':
        return renderAgentConfig();
      default:
        return <div>Configuração não disponível</div>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Configurar Nó</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <Label>Nome do Nó</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome descritivo"
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Configurações</CardTitle>
          </CardHeader>
          <CardContent>
            {renderConfig()}
          </CardContent>
        </Card>

        <div className="flex space-x-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
          
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}