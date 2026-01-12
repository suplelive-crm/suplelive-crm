import { useState } from 'react';
import { Database, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { supabase } from '@/lib/supabase';

export function GhostAPISConfigDialog() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [testCPF, setTestCPF] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: any;
    message: string;
  } | null>(null);

  const { toast } = useToast();
  const { currentWorkspace, updateCurrentWorkspace } = useWorkspaceStore();

  // Load current token when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      const currentToken = currentWorkspace?.settings?.ghostapis?.token || '';
      setToken(currentToken);
      setTestResult(null);
    }
  };

  const handleSave = async () => {
    if (!token.trim()) {
      toast({
        title: 'Token necessário',
        description: 'Por favor, insira o token da API GhostAPIs',
        variant: 'destructive',
      });
      return;
    }

    if (!currentWorkspace?.id) {
      toast({
        title: 'Workspace não selecionado',
        description: 'Por favor, selecione um workspace',
        variant: 'destructive',
      });
      return;
    }

    try {
      const updatedSettings = {
        ...(currentWorkspace.settings || {}),
        ghostapis: {
          token: token.trim(),
          enabled: true,
        },
      };

      const { error } = await supabase
        .from('workspaces')
        .update({ settings: updatedSettings })
        .eq('id', currentWorkspace.id);

      if (error) throw error;

      // Atualizar workspace no store local
      updateCurrentWorkspace({
        ...currentWorkspace,
        settings: updatedSettings,
      });

      toast({
        title: 'Configuração salva',
        description: 'Token do GhostAPIs foi configurado com sucesso',
      });

      setOpen(false);
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a configuração',
        variant: 'destructive',
      });
    }
  };

  const handleTestConnection = async () => {
    if (!token.trim()) {
      toast({
        title: 'Token necessário',
        description: 'Por favor, insira o token antes de testar',
        variant: 'destructive',
      });
      return;
    }

    if (!testCPF.trim()) {
      toast({
        title: 'CPF necessário',
        description: 'Por favor, insira um CPF para testar a conexão',
        variant: 'destructive',
      });
      return;
    }

    if (!currentWorkspace?.id) {
      toast({
        title: 'Workspace não selecionado',
        description: 'Por favor, selecione um workspace',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Clean CPF (remove non-numeric characters)
      const cpfLimpo = testCPF.replace(/\D/g, '');

      if (cpfLimpo.length !== 11) {
        setTestResult({
          success: false,
          message: 'CPF deve ter 11 dígitos',
        });
        setTesting(false);
        return;
      }

      // Primeiro, salvar o token temporariamente nas configurações
      // para que a Edge Function possa usá-lo
      const updatedSettings = {
        ...(currentWorkspace.settings || {}),
        ghostapis: {
          token: token.trim(),
          enabled: true,
        },
      };

      await supabase
        .from('workspaces')
        .update({ settings: updatedSettings })
        .eq('id', currentWorkspace.id);

      // Atualizar workspace local
      updateCurrentWorkspace({
        ...currentWorkspace,
        settings: updatedSettings,
      });

      console.log('[GHOST API TEST] Chamando Edge Function...');

      // Test API connection via baselinker-proxy with service: 'ghostapis'
      const { data, error } = await supabase.functions.invoke('baselinker-proxy', {
        body: {
          service: 'ghostapis',
          endpoint: 'cpf',
          params: {
            cpf2: cpfLimpo,
          },
          workspaceId: currentWorkspace.id,
        },
      });

      console.log('[GHOST API TEST] Resposta:', { data, error });

      if (error) {
        setTestResult({
          success: false,
          message: `Erro ao chamar API: ${error.message}`,
        });
        setTesting(false);
        return;
      }

      if (!data || !data['response.NOME']) {
        setTestResult({
          success: false,
          message: 'CPF não encontrado na base de dados',
        });
        setTesting(false);
        return;
      }

      setTestResult({
        success: true,
        data: {
          nome: data['response.NOME'] || 'N/A',
          email: data['response.EMAIL'] || 'N/A',
          telefones: data['response.TELEFONES'] || 'N/A',
          cpf: data['response.CPF'] || cpfLimpo,
        },
        message: 'Conexão bem-sucedida! Dados encontrados.',
      });

      toast({
        title: 'Teste realizado',
        description: 'Conexão com GhostAPIs funcionando corretamente',
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Erro ao testar conexão: ${error.message}`,
      });

      toast({
        title: 'Erro no teste',
        description: 'Não foi possível conectar com a API',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const isConfigured =
    currentWorkspace?.settings?.ghostapis?.enabled &&
    currentWorkspace?.settings?.ghostapis?.token;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Database className="mr-2 h-4 w-4" />
          {isConfigured ? 'Configuração GhostAPIs' : 'Configurar GhostAPIs'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configurar GhostAPIs (Verificador de CPF)</DialogTitle>
          <DialogDescription>
            Configure o token da API GhostAPIs para enriquecer dados de clientes através do CPF.
            A API busca automaticamente nome, email e telefone quando o pedido não possui essas informações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Token Configuration */}
          <div className="space-y-2">
            <Label htmlFor="token">Token da API</Label>
            <Input
              id="token"
              type="text"
              placeholder="aa21949b4c1804624d6a3a36253eeaad"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              Insira o token fornecido pelo GhostAPIs para consultar dados de CPF
            </p>
          </div>

          {/* Test Connection */}
          <div className="space-y-2">
            <Label htmlFor="testCPF">Testar Conexão (CPF)</Label>
            <div className="flex gap-2">
              <Input
                id="testCPF"
                type="text"
                placeholder="123.456.789-00"
                value={testCPF}
                onChange={(e) => setTestCPF(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={handleTestConnection}
                disabled={testing || !token}
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testando...
                  </>
                ) : (
                  'Testar'
                )}
              </Button>
            </div>
            <p className="text-sm text-gray-500">
              Insira um CPF válido para testar se a API está funcionando
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-4 rounded-lg border ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <Check className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <X className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      testResult.success ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {testResult.message}
                  </p>
                  {testResult.success && testResult.data && (
                    <div className="mt-2 space-y-1 text-sm text-gray-700">
                      <p>
                        <strong>Nome:</strong> {testResult.data.nome}
                      </p>
                      <p>
                        <strong>Email:</strong> {testResult.data.email}
                      </p>
                      <p>
                        <strong>Telefones:</strong> {testResult.data.telefones}
                      </p>
                      <p>
                        <strong>CPF:</strong> {testResult.data.cpf}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Como Funciona</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Quando um pedido chega sem email/telefone, mas com CPF</li>
              <li>• O sistema consulta automaticamente a API GhostAPIs</li>
              <li>• Busca nome, email e telefone do cliente</li>
              <li>• Cria/atualiza o cliente com os dados encontrados</li>
              <li>• Permite envio de mensagens automáticas via WhatsApp</li>
            </ul>
          </div>

          {/* Current Configuration Status */}
          {isConfigured && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <p className="text-sm font-medium text-green-900">
                  GhostAPIs está configurado e ativo
                </p>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Token atual: {currentWorkspace?.settings?.ghostapis?.token?.substring(0, 10)}...
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Configuração</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
