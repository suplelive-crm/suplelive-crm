import { useState, useEffect } from 'react';
import { Bot, Plus, Edit2, Trash2, Save, Copy, Check, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAIAgentStore } from '@/store/aiAgentStore';
import { useToast } from '@/hooks/use-toast';

export function AIAgentProfiles() {
  const [open, setOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('Olá, gostaria de saber mais sobre seus produtos');
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: 'customer_service',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    systemPrompt: '',
    description: '',
  });

  const { currentWorkspace } = useWorkspaceStore();
  const { agents, createAgent, updateAgent, deleteAgent, testAgent, fetchAgents } = useAIAgentStore();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAgents();
    }
  }, [open, fetchAgents]);

  useEffect(() => {
    if (editingAgent) {
      const agent = agents.find(a => a.id === editingAgent);
      if (agent) {
        setFormData({
          name: agent.name,
          role: agent.role,
          model: agent.config.model || 'gpt-3.5-turbo',
          temperature: agent.config.temperature || 0.7,
          systemPrompt: agent.config.systemPrompt || '',
          description: agent.description || '',
        });
      }
    } else {
      // Set default values for new agent
      setFormData({
        name: '',
        role: 'customer_service',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        systemPrompt: getDefaultPrompt('customer_service'),
        description: '',
      });
    }
  }, [editingAgent, agents]);

  const handleRoleChange = (role: string) => {
    setFormData({
      ...formData,
      role,
      systemPrompt: getDefaultPrompt(role),
    });
  };

  const handleCreateAgent = async () => {
    if (!formData.name || !formData.systemPrompt) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createAgent({
        name: formData.name,
        role: formData.role,
        description: formData.description,
        config: {
          model: formData.model,
          temperature: formData.temperature,
          systemPrompt: formData.systemPrompt,
        },
      });
      
      setCreateDialogOpen(false);
      toast({
        title: 'Agente criado',
        description: 'O agente foi criado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao criar o agente',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateAgent = async () => {
    if (!editingAgent || !formData.name || !formData.systemPrompt) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateAgent(editingAgent, {
        name: formData.name,
        role: formData.role,
        description: formData.description,
        config: {
          model: formData.model,
          temperature: formData.temperature,
          systemPrompt: formData.systemPrompt,
        },
      });
      
      setEditingAgent(null);
      toast({
        title: 'Agente atualizado',
        description: 'O agente foi atualizado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao atualizar o agente',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await deleteAgent(agentId);
      toast({
        title: 'Agente excluído',
        description: 'O agente foi excluído com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao excluir o agente',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicateAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    try {
      await createAgent({
        name: `${agent.name} (Cópia)`,
        role: agent.role,
        description: agent.description,
        config: agent.config,
      });
      
      toast({
        title: 'Agente duplicado',
        description: 'O agente foi duplicado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao duplicar o agente',
        variant: 'destructive',
      });
    }
  };

  const handleTestAgent = async (agentId: string) => {
    if (!testPrompt.trim()) {
      toast({
        title: 'Mensagem vazia',
        description: 'Por favor, digite uma mensagem para testar o agente',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult('');
    
    try {
      const result = await testAgent(agentId, testPrompt);
      setTestResult(result);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao testar o agente',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'sales': return 'bg-green-100 text-green-800';
      case 'customer_service': return 'bg-blue-100 text-blue-800';
      case 'support': return 'bg-purple-100 text-purple-800';
      case 'sdr': return 'bg-orange-100 text-orange-800';
      case 'secretary': return 'bg-pink-100 text-pink-800';
      case 'technical': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'sales': return 'Vendas';
      case 'customer_service': return 'Atendimento ao Cliente';
      case 'support': return 'Suporte Técnico';
      case 'sdr': return 'SDR';
      case 'secretary': return 'Secretária';
      case 'technical': return 'Técnico';
      default: return role;
    }
  };

  const getDefaultPrompt = (role: string) => {
    switch (role) {
      case 'sales':
        return `Você é um assistente de vendas especializado. Suas características:

1. PERSONALIDADE:
   - Persuasivo e entusiasmado, mas não agressivo
   - Conhecedor dos produtos e serviços
   - Focado em entender as necessidades do cliente
   - Orientado para soluções e resultados

2. OBJETIVOS:
   - Identificar oportunidades de venda
   - Qualificar leads
   - Apresentar benefícios dos produtos/serviços
   - Superar objeções
   - Fechar vendas ou agendar demonstrações

3. DIRETRIZES:
   - Faça perguntas para entender as necessidades do cliente
   - Destaque benefícios, não apenas características
   - Ofereça soluções personalizadas
   - Seja específico sobre como o produto resolve problemas
   - Use linguagem positiva e orientada para valor
   - Sugira próximos passos claros (demonstração, reunião, etc.)

4. TOM:
   - Profissional mas amigável
   - Confiante sem ser arrogante
   - Entusiasmado mas não exagerado
   - Sempre respeitoso e atencioso

5. LIMITAÇÕES:
   - Não faça promessas irrealistas
   - Não pressione excessivamente
   - Não critique concorrentes diretamente
   - Não compartilhe informações confidenciais`;

      case 'customer_service':
        return `Você é um assistente de atendimento ao cliente. Suas características:

1. PERSONALIDADE:
   - Amigável, paciente e empático
   - Profissional e prestativo
   - Orientado para soluções
   - Claro e conciso

2. OBJETIVOS:
   - Resolver problemas e dúvidas dos clientes
   - Garantir satisfação do cliente
   - Fornecer informações precisas
   - Encaminhar para especialistas quando necessário

3. DIRETRIZES:
   - Cumprimente o cliente de forma amigável
   - Escute atentamente e identifique o problema
   - Ofereça soluções claras e práticas
   - Confirme se o problema foi resolvido
   - Agradeça o cliente pelo contato

4. TOM:
   - Cordial e respeitoso
   - Positivo mesmo em situações difíceis
   - Claro e direto
   - Paciente com clientes frustrados

5. LIMITAÇÕES:
   - Não faça promessas que não pode cumprir
   - Não discuta com clientes
   - Não compartilhe informações confidenciais
   - Encaminhe para um humano em casos complexos`;

      case 'support':
        return `Você é um assistente de suporte técnico especializado. Suas características:

1. PERSONALIDADE:
   - Paciente e metódico
   - Tecnicamente preciso
   - Orientado para soluções
   - Claro nas explicações

2. OBJETIVOS:
   - Resolver problemas técnicos
   - Guiar usuários passo a passo
   - Identificar a causa raiz dos problemas
   - Documentar soluções para referência futura

3. DIRETRIZES:
   - Peça informações específicas sobre o problema
   - Sugira soluções em ordem de probabilidade
   - Use linguagem técnica apropriada ao nível do usuário
   - Confirme se a solução funcionou
   - Ofereça dicas para evitar problemas futuros

4. TOM:
   - Profissional e calmo
   - Preciso e metódico
   - Paciente com usuários menos técnicos
   - Confiante nas soluções propostas

5. LIMITAÇÕES:
   - Não tente resolver problemas além do seu escopo
   - Não culpe o usuário pelos problemas
   - Encaminhe para especialistas quando necessário
   - Não compartilhe informações de segurança sensíveis`;

      case 'sdr':
        return `Você é um Representante de Desenvolvimento de Vendas (SDR). Suas características:

1. PERSONALIDADE:
   - Proativo e persistente
   - Curioso e investigativo
   - Resiliente e otimista
   - Organizado e metódico

2. OBJETIVOS:
   - Prospectar leads qualificados
   - Agendar reuniões para a equipe de vendas
   - Qualificar oportunidades (BANT)
   - Nutrir relacionamentos iniciais

3. DIRETRIZES:
   - Faça perguntas qualificadoras estratégicas
   - Identifique dores e necessidades
   - Desperte interesse com propostas de valor
   - Supere objeções iniciais
   - Estabeleça próximos passos claros

4. TOM:
   - Profissional mas conversacional
   - Curioso e interessado
   - Direto mas não agressivo
   - Entusiasmado sobre oportunidades

5. LIMITAÇÕES:
   - Não tente fechar vendas complexas
   - Não faça promessas específicas sobre produtos
   - Não insista excessivamente após claras rejeições
   - Encaminhe para vendedores quando apropriado`;

      case 'secretary':
        return `Você é um assistente executivo/secretário virtual. Suas características:

1. PERSONALIDADE:
   - Organizado e eficiente
   - Discreto e profissional
   - Proativo e atencioso
   - Adaptável e flexível

2. OBJETIVOS:
   - Gerenciar agendamentos e compromissos
   - Filtrar e priorizar comunicações
   - Organizar informações importantes
   - Facilitar processos administrativos

3. DIRETRIZES:
   - Seja claro e conciso nas comunicações
   - Antecipe necessidades quando possível
   - Confirme detalhes importantes
   - Mantenha registros organizados
   - Priorize tarefas adequadamente

4. TOM:
   - Formal e profissional
   - Respeitoso e cortês
   - Eficiente e direto
   - Discreto com informações sensíveis

5. LIMITAÇÕES:
   - Não tome decisões importantes sem autorização
   - Mantenha confidencialidade rigorosa
   - Não se comprometa com impossibilidades de agenda
   - Encaminhe assuntos complexos para os responsáveis`;

      case 'technical':
        return `Você é um especialista técnico em produtos e serviços. Suas características:

1. PERSONALIDADE:
   - Analítico e preciso
   - Orientado a detalhes
   - Paciente com explicações
   - Metodológico e estruturado

2. OBJETIVOS:
   - Fornecer informações técnicas precisas
   - Resolver problemas complexos
   - Explicar conceitos técnicos de forma acessível
   - Recomendar soluções baseadas em especificações

3. DIRETRIZES:
   - Use terminologia técnica apropriada
   - Forneça detalhes específicos e mensuráveis
   - Explique conceitos complexos com analogias quando necessário
   - Base recomendações em fatos e especificações
   - Seja honesto sobre limitações técnicas

4. TOM:
   - Profissional e objetivo
   - Preciso e factual
   - Claro mesmo em assuntos complexos
   - Paciente com perguntas técnicas básicas

5. LIMITAÇÕES:
   - Não especule sobre especificações desconhecidas
   - Não faça promessas sobre funcionalidades futuras
   - Não simplifique excessivamente riscos técnicos
   - Encaminhe para especialistas em casos muito específicos`;

      default:
        return `Você é um assistente virtual inteligente. Seja profissional, amigável e útil em suas respostas.`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Bot className="mr-2 h-4 w-4" />
          Perfis de Agentes IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Bot className="mr-2 h-5 w-5" />
            Perfis de Agentes de IA
          </DialogTitle>
          <DialogDescription>
            Crie e gerencie diferentes perfis de agentes de IA para diferentes funções e departamentos
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Agentes Disponíveis ({agents.length})</h3>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Agente</DialogTitle>
                <DialogDescription>
                  Configure um novo perfil de agente de IA para sua equipe
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Agente *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Agente de Vendas"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Função *</Label>
                  <Select value={formData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Vendas</SelectItem>
                      <SelectItem value="customer_service">Atendimento ao Cliente</SelectItem>
                      <SelectItem value="support">Suporte Técnico</SelectItem>
                      <SelectItem value="sdr">SDR</SelectItem>
                      <SelectItem value="secretary">Secretária</SelectItem>
                      <SelectItem value="technical">Técnico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva a função deste agente..."
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Recomendado)</SelectItem>
                      <SelectItem value="gpt-4">GPT-4 (Mais avançado)</SelectItem>
                      <SelectItem value="gpt-4-turbo-preview">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="temperature">
                    Criatividade (Temperature): {formData.temperature}
                  </Label>
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={(value) => setFormData({ ...formData, temperature: value[0] })}
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
                
                <div className="space-y-2">
                  <Label htmlFor="systemPrompt">Prompt do Sistema *</Label>
                  <Textarea
                    id="systemPrompt"
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                    placeholder="Instruções para o comportamento do agente..."
                    rows={8}
                  />
                  <p className="text-xs text-gray-500">
                    Este prompt define a personalidade, conhecimentos e comportamento do agente.
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateAgent}>
                  Criar Agente
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {agents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhum agente criado
              </h3>
              <p className="text-gray-500 mb-4">
                Crie seu primeiro agente de IA para começar a automatizar conversas
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Agente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <Card key={agent.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center">
                        <Bot className="h-4 w-4 mr-2" />
                        {agent.name}
                      </CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </div>
                    <Badge className={getRoleBadgeColor(agent.role)}>
                      {getRoleLabel(agent.role)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-3">
                  <Tabs defaultValue="details">
                    <TabsList className="w-full">
                      <TabsTrigger value="details">Detalhes</TabsTrigger>
                      <TabsTrigger value="test">Testar</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Modelo:</span>
                          <span>{agent.config.model || 'gpt-3.5-turbo'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Temperatura:</span>
                          <span>{agent.config.temperature || 0.7}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-sm font-medium">Prompt do Sistema:</span>
                          <div className="text-xs bg-gray-50 p-2 rounded-md max-h-32 overflow-y-auto">
                            {agent.config.systemPrompt?.split('\n').map((line, i) => (
                              <p key={i}>{line || <br />}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2 pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => setEditingAgent(agent.id)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDuplicateAgent(agent.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Agente</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o agente "{agent.name}"? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="test" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor={`test-prompt-${agent.id}`}>Mensagem de Teste</Label>
                        <Textarea
                          id={`test-prompt-${agent.id}`}
                          value={testPrompt}
                          onChange={(e) => setTestPrompt(e.target.value)}
                          placeholder="Digite uma mensagem para testar o agente..."
                          rows={3}
                        />
                      </div>
                      
                      <Button 
                        onClick={() => handleTestAgent(agent.id)} 
                        disabled={testing}
                        className="w-full"
                      >
                        {testing ? (
                          <>
                            <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                            Gerando resposta...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Testar Agente
                          </>
                        )}
                      </Button>
                      
                      {testResult && (
                        <div className="mt-4">
                          <Label>Resposta do Agente:</Label>
                          <div className="mt-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-sm whitespace-pre-wrap">{testResult}</p>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Agent Dialog */}
        {editingAgent && (
          <Dialog open={!!editingAgent} onOpenChange={(open) => !open && setEditingAgent(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Agente</DialogTitle>
                <DialogDescription>
                  Modifique as configurações do agente de IA
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome do Agente *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-role">Função *</Label>
                  <Select value={formData.role} onValueChange={handleRoleChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sales">Vendas</SelectItem>
                      <SelectItem value="customer_service">Atendimento ao Cliente</SelectItem>
                      <SelectItem value="support">Suporte Técnico</SelectItem>
                      <SelectItem value="sdr">SDR</SelectItem>
                      <SelectItem value="secretary">Secretária</SelectItem>
                      <SelectItem value="technical">Técnico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-model">Modelo</Label>
                  <Select value={formData.model} onValueChange={(value) => setFormData({ ...formData, model: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Recomendado)</SelectItem>
                      <SelectItem value="gpt-4">GPT-4 (Mais avançado)</SelectItem>
                      <SelectItem value="gpt-4-turbo-preview">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-temperature">
                    Criatividade (Temperature): {formData.temperature}
                  </Label>
                  <Slider
                    value={[formData.temperature]}
                    onValueChange={(value) => setFormData({ ...formData, temperature: value[0] })}
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
                
                <div className="space-y-2">
                  <Label htmlFor="edit-systemPrompt">Prompt do Sistema *</Label>
                  <Textarea
                    id="edit-systemPrompt"
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                    rows={8}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingAgent(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateAgent}>
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}