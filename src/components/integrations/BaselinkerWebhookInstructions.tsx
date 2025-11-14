import { useState } from 'react';
import { Webhook, Copy, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useToast } from '@/hooks/use-toast';

export function BaselinkerWebhookInstructions() {
  const { currentWorkspace } = useWorkspaceStore();
  const { toast } = useToast();
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({});

  // URL do webhook (você precisará ajustar com o seu project ID real)
  const webhookUrl = `https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-webhook`;
  const workspaceId = currentWorkspace?.id || '';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [label]: true });
    toast({
      title: 'Copiado!',
      description: `${label} copiado para a área de transferência`,
    });
    setTimeout(() => {
      setCopied({ ...copied, [label]: false });
    }, 2000);
  };

  const events = [
    { id: 'order_status_changed', name: 'Mudança de Status do Pedido', recommended: true },
    { id: 'new_order', name: 'Novo Pedido Criado', recommended: true },
    { id: 'order_updated', name: 'Pedido Atualizado', recommended: true },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
              <Webhook className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Webhook do Baselinker</CardTitle>
              <CardDescription>
                Configure webhook para receber atualizações em tempo real dos pedidos
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Recomendado
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Benefits Section */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Benefícios do Webhook
          </h3>
          <ul className="space-y-1 text-sm text-green-800">
            <li>⚡ <strong>Tempo Real:</strong> Atualizações instantâneas (segundos, não minutos)</li>
            <li>💰 <strong>Redução de Custos:</strong> Menos requisições à API</li>
            <li>🔄 <strong>Mais Eficiente:</strong> Processa apenas o que mudou</li>
            <li>📊 <strong>Rastreabilidade:</strong> Cada evento é registrado</li>
          </ul>
        </div>

        {/* Step 1: URL Configuration */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">
              1
            </span>
            URL do Webhook
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Configure esta URL no painel do Baselinker:
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 p-3 bg-gray-50 border rounded-lg font-mono text-sm break-all">
                {webhookUrl}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl, 'URL do Webhook')}
              >
                {copied['webhook-url'] ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Step 2: Workspace ID Header */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">
              2
            </span>
            Header Personalizado
          </h3>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Adicione este header personalizado no webhook:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-gray-50 border rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Nome do Header:</div>
                  <div className="font-mono text-sm">x-workspace-id</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard('x-workspace-id', 'Nome do Header')}
                >
                  {copied['header-name'] ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-gray-50 border rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">Valor do Header:</div>
                  <div className="font-mono text-sm break-all">{workspaceId}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(workspaceId, 'Workspace ID')}
                >
                  {copied['workspace-id'] ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Events Selection */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">
              3
            </span>
            Eventos para Monitorar
          </h3>
          <p className="text-sm text-gray-600">
            Selecione estes eventos no painel do Baselinker:
          </p>
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="font-medium text-sm">{event.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{event.id}</div>
                  </div>
                </div>
                {event.recommended && (
                  <Badge variant="outline" className="text-xs">
                    Recomendado
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 4: Configuration Instructions */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">
              4
            </span>
            Como Configurar no Baselinker
          </h3>
          <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
            <li>Acesse o painel do Baselinker</li>
            <li>Vá em <strong>Configurações → API → Webhooks</strong></li>
            <li>Clique em <strong>"Adicionar webhook"</strong></li>
            <li>Cole a URL do webhook no campo apropriado</li>
            <li>Configure o método como <strong>POST</strong></li>
            <li>Adicione o header personalizado <code className="bg-gray-100 px-1 py-0.5 rounded">x-workspace-id</code></li>
            <li>Selecione os eventos que deseja monitorar</li>
            <li>Clique em <strong>"Salvar"</strong></li>
            <li>Use o botão <strong>"Testar webhook"</strong> para verificar se está funcionando</li>
          </ol>
        </div>

        {/* Important Note */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Importante
          </h3>
          <ul className="space-y-1 text-sm text-amber-800">
            <li>• O webhook <strong>atualiza</strong> pedidos existentes, não cria novos</li>
            <li>• Para novos pedidos, execute uma sincronização manual primeiro</li>
            <li>• Mantenha a sincronização periódica ativa como backup</li>
          </ul>
        </div>

        {/* External Link */}
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open('https://panel.baselinker.com/', '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir Painel do Baselinker
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
