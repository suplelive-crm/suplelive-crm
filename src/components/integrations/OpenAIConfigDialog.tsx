import { useState, useEffect } from 'react';
import { Bot, Key, TestTube, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { AIAgentProfiles } from './AIAgentProfiles';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { initializeOpenAI, getOpenAI } from '@/lib/openai-api';
import { useToast } from '@/hooks/use-toast';

export function OpenAIConfigDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({
    apiKey: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 500,
    systemPrompt: 'Você é um assistente virtual inteligente para atendimento ao cliente. Seja profissional, amigável e útil.',
  });
  const [testMessage, setTestMessage] = useState('Olá, gostaria de saber mais sobre seus produtos');
  const [testResult, setTestResult] = useState<string>('');
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

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
      const savedConfig = localStorage.getItem(`openai_config_${currentWorkspace.id}`);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        if (parsed.apiKey) {
          setConnected(true);
          initializeOpenAI(parsed.apiKey, {
            model: parsed.model,
            temperature: parsed.temperature,
            maxTokens: parsed.maxTokens,
          });
        }
      }
    } catch (error) {
      console.error('Error loading OpenAI config:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!config.apiKey.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira sua chave da API OpenAI',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Testar a conexão primeiro
      const openai = initializeOpenAI(config.apiKey, {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

      await openai.generateChatbotResponse('teste', []);

      // Salvar configuração
      localStorage.setItem(`openai_config_${currentWorkspace?.id}`, JSON.stringify(config));
      
      setConnected(true);
      toast({
        title: 'Sucesso',
        description: 'Configuração OpenAI salva e testada com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: `Falha ao conectar com OpenAI: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestChatbot = async () => {
    if (!connected) {
      toast({
        title: 'Erro',
        description: 'Configure e salve a API OpenAI primeiro',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    try {
      const openai = getOpenAI();
      const response = await openai.generateChatbotResponse(
        testMessage,
        [],
        {
          clientName: 'João Silva',
          businessInfo: {
            name: currentWorkspace?.name || 'Minha Empresa',
            sector: 'Atendimento ao Cliente',
          },
        }
      );

      setTestResult(response.message);
      toast({
        title: 'Teste realizado',
        description: 'Resposta do chatbot gerada com sucesso!',
      });
    } catch (error: any) {
      toast({
        title: 'Erro no teste',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleTestClassification = async () => {
    if (!connected) {
      toast({
        title: 'Erro',
        description: 'Configure e salve a API OpenAI primeiro',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    try {
      const openai = getOpenAI();
      const result = await openai.classifyText(
        testMessage,
        ['suporte', 'vendas', 'informações', 'reclamação', 'elogio']
      );

      setTestResult(JSON.stringify(result, null, 2));
      toast({
        title: 'Classificação realizada',
        description: `Texto classificado como: ${result.category}`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro na classificação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Bot className="mr-2 h-4 w-4" />
          Configurar OpenAI
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Bot className="mr-2 h-5 w-5" />
            Configuração OpenAI - Chatbot e IA
          </DialogTitle>
          <DialogDescription>
            Configure a integração com OpenAI para chatbot inteligente e classificação de texto
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
            <TabsTrigger value="classification">Classificação</TabsTrigger>
            <TabsTrigger value="agents">Agentes</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Configurações da API</span>
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
                  Configure sua chave da API OpenAI e parâmetros do modelo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="apiKey">Chave da API OpenAI *</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="sk-..."
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://platform.openai.com/api-keys', '_blank')}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Obtenha sua chave em platform.openai.com/api-keys
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="model">Modelo</Label>
                    <Select value={config.model} onValueChange={(value) => setConfig({ ...config, model: value })}>
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

                  <div>
                    <Label htmlFor="maxTokens">Máximo de Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      min="50"
                      max="2000"
                      value={config.maxTokens}
                      onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="temperature">
                    Criatividade (Temperature): {config.temperature}
                  </Label>
                  <Slider
                    value={[config.temperature]}
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

                <div>
                  <Label htmlFor="systemPrompt">Prompt do Sistema</Label>
                  <Textarea
                    id="systemPrompt"
                    value={config.systemPrompt}
                    onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                    rows={4}
                    placeholder="Defina a personalidade e comportamento do chatbot..."
                  />
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

          <TabsContent value="chatbot" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Teste do Chatbot</CardTitle>
                <CardDescription>
                  Teste como o chatbot responderá às mensagens dos clientes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="testMessage">Mensagem de Teste</Label>
                  <Textarea
                    id="testMessage"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Digite uma mensagem para testar o chatbot..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleTestChatbot} 
                  disabled={testing || !connected}
                  className="w-full"
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando resposta...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Testar Chatbot
                    </>
                  )}
                </Button>

                {testResult && (
                  <div>
                    <Label>Resposta do Chatbot:</Label>
                    <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{testResult}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="classification" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Teste de Classificação de Texto</CardTitle>
                <CardDescription>
                  Teste como a IA classifica mensagens em categorias
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="testClassificationMessage">Texto para Classificar</Label>
                  <Textarea
                    id="testClassificationMessage"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Digite um texto para classificar..."
                    rows={3}
                  />
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Categorias Disponíveis:</h4>
                  <div className="flex flex-wrap gap-2">
                    {['suporte', 'vendas', 'informações', 'reclamação', 'elogio'].map((category) => (
                      <Badge key={category} variant="outline">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleTestClassification} 
                  disabled={testing || !connected}
                  className="w-full"
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Classificando...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Testar Classificação
                    </>
                  )}
                </Button>

                {testResult && (
                  <div>
                    <Label>Resultado da Classificação:</Label>
                    <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            {!connected ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Configuração OpenAI Necessária
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Configure sua chave da API OpenAI na aba Configuração antes de criar agentes
                  </p>
                  <Button onClick={() => document.getElementById('config-tab')?.click()}>
                    Ir para Configuração
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <AIAgentProfiles />
            )}
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