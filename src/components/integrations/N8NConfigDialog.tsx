import { useState, useEffect } from 'react';
import { Zap, Key, TestTube, CheckCircle, XCircle, Loader2, Link, RefreshCw, Bot, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { initializeN8N, getN8N } from '@/lib/n8n-api';
import { useToast } from '@/hooks/use-toast';

export function N8NConfigDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({
    baseUrl: '',
    apiKey: '',
    username: '',
    password: '',
  });
  const [authType, setAuthType] = useState<'apiKey' | 'basic'>('apiKey');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);

  const { currentWorkspace } = useWorkspaceStore();
  const { toast } = useToast();

  useEffect(() => {
    // Carregar configuração salva
    loadSavedConfig();
  }, [currentWorkspace]);

  const loadSavedConfig = async () => {
    if (!currentWorkspace) return;

    try {
      // Aqui você carregaria a configuração do workspace
      // Por enquanto, vamos usar localStorage como exemplo
      const savedConfig = localStorage.getItem(`n8n_config_${currentWorkspace.id}`);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        setAuthType(parsed.apiKey ? 'apiKey' : 'basic');
        
        try {
          // Inicializar n8n com a configuração salva
          initializeN8N(parsed);
          setConnected(true);
          
          // Carregar workflows
          fetchWorkflows();
        } catch (error) {
          console.error('Error initializing n8n:', error);
          setConnected(false);
        }
      }
    } catch (error) {
      console.error('Error loading n8n config:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!config.baseUrl) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira a URL do servidor n8n',
        variant: 'destructive',
      });
      return;
    }

    if (authType === 'apiKey' && !config.apiKey) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira a chave da API n8n',
        variant: 'destructive',
      });
      return;
    }

    if (authType === 'basic' && (!config.username || !config.password)) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira o usuário e senha para autenticação',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Inicializar n8n com a configuração
      const n8nConfig = {
        baseUrl: config.baseUrl,
        apiKey: authType === 'apiKey' ? config.apiKey : undefined,
        username: authType === 'basic' ? config.username : undefined,
        password: authType === 'basic' ? config.password : undefined,
      };
      
      const n8n = initializeN8N(n8nConfig);

      // Testar a conexão
      try {
        const isHealthy = await n8n.healthCheck();
        if (!isHealthy) {
          throw new Error('Não foi possível conectar ao servidor n8n');
        }
      } catch (error) {
        throw new Error(`Falha na conexão com n8n: ${error.message}`);
      }

      // Salvar configuração
      localStorage.setItem(`n8n_config_${currentWorkspace?.id}`, JSON.stringify(n8nConfig));
      
      setConnected(true);
      toast({
        title: 'Sucesso',
        description: 'Configuração n8n salva e testada com sucesso!',
      });
      
      // Carregar workflows
      fetchWorkflows();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: `Falha ao conectar com n8n: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    if (!connected) return;
    
    setLoadingWorkflows(true);
    try {
      const n8n = getN8N();
      if (!n8n) throw new Error('n8n não inicializado');
      
      const workflows = await n8n.getWorkflows();
      setWorkflows(workflows);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: `Falha ao carregar workflows: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoadingWorkflows(false);
    }
  };

  const handleCreateChatbotWorkflow = async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const n8n = getN8N();
      if (!n8n) throw new Error('n8n não inicializado');
      
      const workflow = await n8n.createChatbotWorkflow('Chatbot Automático', {
        openaiApiKey: 'sk-...',  // Placeholder, será substituído pelo usuário no n8n
        systemPrompt: 'Você é um assistente virtual para atendimento ao cliente.',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
      });
      
      toast({
        title: 'Sucesso',
        description: `Workflow de chatbot criado: ${workflow.name}`,
      });
      
      fetchWorkflows();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: `Falha ao criar workflow: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassifierWorkflow = async () => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const n8n = getN8N();
      if (!n8n) throw new Error('n8n não inicializado');
      
      const workflow = await n8n.createTextClassifierWorkflow('Classificador de Texto', {
        openaiApiKey: 'sk-...',  // Placeholder, será substituído pelo usuário no n8n
        categories: ['suporte', 'vendas', 'informações', 'reclamação', 'elogio'],
        model: 'gpt-3.5-turbo',
      });
      
      toast({
        title: 'Sucesso',
        description: `Workflow de classificação criado: ${workflow.name}`,
      });
      
      fetchWorkflows();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: `Falha ao criar workflow: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (webhookPath: string) => {
    if (!connected) return;
    
    setLoading(true);
    try {
      const n8n = getN8N();
      if (!n8n) throw new Error('n8n não inicializado');
      
      const result = await n8n.triggerWebhook(webhookPath, {
        message: 'Teste de webhook',
        timestamp: new Date().toISOString(),
      });
      
      setTestResult(JSON.stringify(result, null, 2));
      
      if (result.success) {
        toast({
          title: 'Sucesso',
          description: 'Webhook executado com sucesso',
        });
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Falha ao executar webhook',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: `Falha ao testar webhook: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Zap className="mr-2 h-4 w-4" />
          Configurar n8n
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Zap className="mr-2 h-5 w-5" />
            Configuração n8n - Automação Avançada
          </DialogTitle>
          <DialogDescription>
            Configure a integração com n8n para automações avançadas e fluxos de trabalho personalizados
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Configurações do Servidor</span>
                  {connected ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <XCircle className="h-3 w-3 mr-1" />
                      Desconectado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Configure a conexão com seu servidor n8n self-hosted
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="baseUrl">URL do Servidor n8n *</Label>
                  <Input
                    id="baseUrl"
                    placeholder="https://seu-servidor-n8n.com"
                    value={config.baseUrl}
                    onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL completa do seu servidor n8n (ex: https://n8n.seudominio.com)
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Button
                      type="button"
                      variant={authType === 'apiKey' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAuthType('apiKey')}
                    >
                      Chave API
                    </Button>
                    <Button
                      type="button"
                      variant={authType === 'basic' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAuthType('basic')}
                    >
                      Usuário/Senha
                    </Button>
                  </div>

                  {authType === 'apiKey' ? (
                    <div>
                      <Label htmlFor="apiKey">Chave da API n8n *</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="n8n_api_..."
                        value={config.apiKey}
                        onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Encontre sua chave API em Configurações &gt; API &gt; API Keys
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="username">Usuário *</Label>
                        <Input
                          id="username"
                          placeholder="admin"
                          value={config.username}
                          onChange={(e) => setConfig({ ...config, username: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Senha *</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="********"
                          value={config.password}
                          onChange={(e) => setConfig({ ...config, password: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Button onClick={handleSaveConfig} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando conexão...
                    </>
                  ) : (
                    'Salvar e Testar Conexão'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflows" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Workflows Disponíveis</h3>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchWorkflows}
                disabled={!connected || loadingWorkflows}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingWorkflows ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            {!connected ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Não conectado ao n8n
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Configure a conexão com seu servidor n8n para visualizar os workflows
                  </p>
                  <Button onClick={() => document.getElementById('config-tab')?.click()}>
                    Ir para Configuração
                  </Button>
                </CardContent>
              </Card>
            ) : loadingWorkflows ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : workflows.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum workflow encontrado
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Crie seu primeiro workflow ou use um dos nossos templates
                  </p>
                  <Button onClick={() => document.getElementById('templates-tab')?.click()}>
                    Ver Templates
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflows.map((workflow) => (
                  <Card key={workflow.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{workflow.name}</CardTitle>
                        <Badge variant={workflow.active ? 'default' : 'secondary'}>
                          {workflow.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-500 mb-4">
                        ID: {workflow.id}
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(`${config.baseUrl}/workflow/${workflow.id}`, '_blank')}
                        >
                          <Link className="h-4 w-4 mr-2" />
                          Abrir no n8n
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleTestWebhook(`webhook-test-${workflow.id}`)}
                        >
                          <TestTube className="h-4 w-4 mr-2" />
                          Testar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {testResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Resultado do Teste</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm">
                    {testResult}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Chatbot com OpenAI</CardTitle>
                  <CardDescription>
                    Cria um workflow para processar mensagens com GPT
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Este template cria um endpoint webhook que processa mensagens usando a API OpenAI e retorna respostas personalizadas.
                    </p>
                    <Button 
                      onClick={handleCreateChatbotWorkflow}
                      disabled={!connected || loading}
                      className="w-full"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Bot className="mr-2 h-4 w-4" />
                      )}
                      Criar Workflow de Chatbot
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Classificador de Texto</CardTitle>
                  <CardDescription>
                    Classifica mensagens em categorias predefinidas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Este template cria um endpoint webhook que classifica textos em categorias como suporte, vendas, informações, etc.
                    </p>
                    <Button 
                      onClick={handleCreateClassifierWorkflow}
                      disabled={!connected || loading}
                      className="w-full"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Tag className="mr-2 h-4 w-4" />
                      )}
                      Criar Workflow de Classificação
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Instruções de Uso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">1. Configuração da API OpenAI</h4>
                    <p className="text-sm text-gray-600">
                      Após criar o workflow, você precisará configurar suas credenciais da OpenAI no n8n:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-gray-600 mt-2 space-y-1">
                      <li>Abra o workflow no n8n</li>
                      <li>Clique no nó OpenAI</li>
                      <li>Clique em "Create New" nas credenciais</li>
                      <li>Insira sua chave API da OpenAI</li>
                      <li>Salve as credenciais</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-medium">2. Ativação do Workflow</h4>
                    <p className="text-sm text-gray-600">
                      Para que o workflow funcione, você precisa ativá-lo:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-gray-600 mt-2 space-y-1">
                      <li>Clique no botão "Ativar" no canto superior direito</li>
                      <li>O webhook estará disponível na URL mostrada no nó Webhook</li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-medium">3. Integração com o OmniCRM</h4>
                    <p className="text-sm text-gray-600">
                      Para integrar com o OmniCRM, use a URL do webhook nos nós de automação:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-gray-600 mt-2 space-y-1">
                      <li>Copie a URL do webhook do n8n</li>
                      <li>No OmniCRM, crie uma automação com um nó de ação "Webhook"</li>
                      <li>Cole a URL do webhook no campo URL</li>
                      <li>Configure o método como POST e o corpo da requisição conforme necessário</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}