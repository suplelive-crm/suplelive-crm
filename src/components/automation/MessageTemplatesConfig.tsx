import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Eye, RotateCcw, MessageSquare, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { toast } from 'sonner';

interface MessageTemplate {
  id?: string;
  workspace_id: string;
  template_type: 'welcome' | 'upsell' | 'reorder';
  template_content: string;
  variables: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_TEMPLATES = {
  welcome: `Olá {{client_name}}! 👋

Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.

Qualquer dúvida, estou à disposição! 😊`,

  upsell: `Oi, {{client_name}}! Tudo bem? 😀

Confirmamos sua compra do {{product_name}} e tenho uma surpresa especial pra você:

✨ Leve mais 1 unidade com desconto exclusivo no Pix!

👉 Cada unidade adicional sai por R$ {{discounted_price}} no Pix.
📦 O envio vai junto com o seu pedido.
⏳ Oferta válida por 1 hora a partir do recebimento desta mensagem.

É só me responder "SIM" aqui mesmo que já adiciono pra você. 😉`,

  reorder: `Olá {{client_name}}!

O produto "{{product_name}}" que você comprou está acabando! 🏁

Quer fazer uma nova compra para não ficar sem? 🛒

É só me chamar! 😊`
};

const TEMPLATE_VARIABLES = {
  welcome: ['client_name', 'order_id'],
  upsell: ['client_name', 'product_name', 'original_price', 'discounted_price'],
  reorder: ['client_name', 'product_name', 'product_sku', 'order_date', 'duration_days']
};

export function MessageTemplatesConfig() {
  const { currentWorkspace } = useWorkspaceStore();
  const [templates, setTemplates] = useState<Record<string, string>>({
    welcome: DEFAULT_TEMPLATES.welcome,
    upsell: DEFAULT_TEMPLATES.upsell,
    reorder: DEFAULT_TEMPLATES.reorder
  });
  const [originalTemplates, setOriginalTemplates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState({
    client_name: 'João Silva',
    order_id: '12345',
    product_name: 'Vitamina C 1000mg',
    original_price: '89,90',
    discounted_price: '71,92',
    product_sku: 'VIT-C-1000',
    order_date: new Date().toLocaleDateString('pt-BR'),
    duration_days: '60'
  });

  useEffect(() => {
    if (currentWorkspace) {
      loadTemplates();
    }
  }, [currentWorkspace]);

  const loadTemplates = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedTemplates: Record<string, string> = {};
        data.forEach(template => {
          loadedTemplates[template.template_type] = template.template_content;
        });
        setTemplates({ ...DEFAULT_TEMPLATES, ...loadedTemplates });
        setOriginalTemplates({ ...DEFAULT_TEMPLATES, ...loadedTemplates });
      } else {
        setTemplates(DEFAULT_TEMPLATES);
        setOriginalTemplates(DEFAULT_TEMPLATES);
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates de mensagens');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (type: 'welcome' | 'upsell' | 'reorder') => {
    if (!currentWorkspace) return;

    try {
      setSaving(true);

      // Verificar se template já existe
      const { data: existing } = await supabase
        .from('message_templates')
        .select('id')
        .eq('workspace_id', currentWorkspace.id)
        .eq('template_type', type)
        .maybeSingle();

      if (existing) {
        // Atualizar
        const { error } = await supabase
          .from('message_templates')
          .update({
            template_content: templates[type],
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Criar
        const { error } = await supabase
          .from('message_templates')
          .insert({
            workspace_id: currentWorkspace.id,
            template_type: type,
            template_content: templates[type],
            variables: TEMPLATE_VARIABLES[type],
            is_active: true
          });

        if (error) throw error;
      }

      setOriginalTemplates(prev => ({ ...prev, [type]: templates[type] }));
      toast.success('Template salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = (type: 'welcome' | 'upsell' | 'reorder') => {
    setTemplates(prev => ({ ...prev, [type]: DEFAULT_TEMPLATES[type] }));
  };

  const replaceVariables = (template: string, data: Record<string, string>) => {
    let result = template;
    Object.entries(data).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  const hasChanges = (type: string) => {
    return templates[type] !== originalTemplates[type];
  };

  const renderTemplateEditor = (
    type: 'welcome' | 'upsell' | 'reorder',
    icon: React.ReactNode,
    title: string,
    description: string
  ) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Editor */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`template-${type}`}>Template da Mensagem</Label>
          <Textarea
            id={`template-${type}`}
            value={templates[type]}
            onChange={(e) => setTemplates(prev => ({ ...prev, [type]: e.target.value }))}
            rows={12}
            className="font-mono text-sm"
            placeholder="Digite o template da mensagem..."
          />
        </div>

        <Alert>
          <AlertDescription>
            <strong>Variáveis disponíveis:</strong>
            <div className="flex flex-wrap gap-2 mt-2">
              {TEMPLATE_VARIABLES[type].map(variable => (
                <Badge key={variable} variant="outline" className="font-mono text-xs">
                  {`{{${variable}}}`}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button
            onClick={() => saveTemplate(type)}
            disabled={saving || !hasChanges(type)}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Template'}
          </Button>

          <Button
            variant="outline"
            onClick={() => resetTemplate(type)}
            disabled={templates[type] === DEFAULT_TEMPLATES[type]}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Padrão
          </Button>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-5 w-5 text-gray-600" />
          <h3 className="font-semibold text-lg">Preview da Mensagem</h3>
        </div>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                  B
                </div>
                <div className="flex-1">
                  <div className="bg-green-100 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {replaceVariables(templates[type], previewData)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dados de Exemplo</CardTitle>
            <CardDescription className="text-xs">
              Edite os valores abaixo para testar diferentes cenários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {TEMPLATE_VARIABLES[type].map(variable => (
              <div key={variable} className="space-y-1">
                <Label className="text-xs">{variable}</Label>
                <Textarea
                  value={previewData[variable as keyof typeof previewData] || ''}
                  onChange={(e) => setPreviewData(prev => ({ ...prev, [variable]: e.target.value }))}
                  rows={variable === 'product_list' ? 3 : 1}
                  className="text-xs"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando templates...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Templates de Mensagens Automáticas</h2>
        <p className="text-gray-600 mt-2">
          Personalize as mensagens enviadas automaticamente para seus clientes
        </p>
      </div>

      <Tabs defaultValue="upsell" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="welcome">
            <UserPlus className="h-4 w-4 mr-2" />
            Boas-Vindas
          </TabsTrigger>
          <TabsTrigger value="upsell">
            <MessageSquare className="h-4 w-4 mr-2" />
            Venda Casada
          </TabsTrigger>
          <TabsTrigger value="reorder">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recompra
          </TabsTrigger>
        </TabsList>

        <TabsContent value="welcome" className="mt-6">
          {renderTemplateEditor(
            'welcome',
            <UserPlus className="h-6 w-6 text-blue-600" />,
            'Mensagem de Boas-Vindas',
            'Enviada para novos clientes após o primeiro pedido'
          )}
        </TabsContent>

        <TabsContent value="upsell" className="mt-6">
          {renderTemplateEditor(
            'upsell',
            <MessageSquare className="h-6 w-6 text-green-600" />,
            'Oferta de Segunda Unidade',
            'Oferta de segunda unidade com 20% de desconto, enviada após pedidos de canais específicos'
          )}
        </TabsContent>

        <TabsContent value="reorder" className="mt-6">
          {renderTemplateEditor(
            'reorder',
            <RefreshCw className="h-6 w-6 text-purple-600" />,
            'Mensagem de Recompra',
            'Agendada para ser enviada quando o produto estiver acabando'
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
