import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Save, Eye, RotateCcw, MessageSquare, RefreshCw, UserPlus, Clock, Filter, Info } from 'lucide-react';
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
  send_config: SendConfig;
  filter_config: FilterConfig;
  created_at?: string;
  updated_at?: string;
}

interface SendConfig {
  timing_type: 'immediate' | 'delayed' | 'before_end';
  delay_value?: number;
  delay_unit?: 'minutes' | 'hours' | 'days';
  days_before_end?: number;
  enabled: boolean;
}

interface FilterConfig {
  exclude_channels?: string[];
  min_order_value?: number;
  max_order_value?: number;
  first_order_only?: boolean;
  only_with_duration?: boolean;
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

const DEFAULT_SEND_CONFIG: Record<string, SendConfig> = {
  welcome: { timing_type: 'immediate', enabled: true },
  upsell: { timing_type: 'delayed', delay_value: 5, delay_unit: 'minutes', enabled: true },
  reorder: { timing_type: 'before_end', days_before_end: 15, enabled: true }
};

const DEFAULT_FILTER_CONFIG: Record<string, FilterConfig> = {
  welcome: { first_order_only: true, exclude_channels: [] },
  upsell: { exclude_channels: ['shop', 'atacado', 'whatsapp'], min_order_value: 0 },
  reorder: { exclude_channels: [], only_with_duration: true, min_order_value: 0 }
};

const TEMPLATE_VARIABLES = {
  welcome: ['client_name', 'order_id'],
  upsell: ['client_name', 'product_name', 'original_price', 'discounted_price'],
  reorder: ['client_name', 'product_name', 'product_sku', 'order_date', 'duration_days']
};

const AVAILABLE_CHANNELS = [
  { value: 'shop', label: 'Loja Física' },
  { value: 'atacado', label: 'Atacado' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'mercadolivre', label: 'Mercado Livre' },
  { value: 'shopee', label: 'Shopee' },
  { value: 'website', label: 'Site' }
];

export function MessageTemplateConfigAdvanced() {
  const { currentWorkspace } = useWorkspaceStore();
  const [templates, setTemplates] = useState<Record<string, string>>({
    welcome: DEFAULT_TEMPLATES.welcome,
    upsell: DEFAULT_TEMPLATES.upsell,
    reorder: DEFAULT_TEMPLATES.reorder
  });

  const [sendConfigs, setSendConfigs] = useState<Record<string, SendConfig>>(DEFAULT_SEND_CONFIG);
  const [filterConfigs, setFilterConfigs] = useState<Record<string, FilterConfig>>(DEFAULT_FILTER_CONFIG);

  const [originalData, setOriginalData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [previewData] = useState({
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

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('is_active', true);

      if (error) throw error;

      if (data && data.length > 0) {
        const templatesMap: Record<string, string> = {};
        const sendConfigsMap: Record<string, SendConfig> = {};
        const filterConfigsMap: Record<string, FilterConfig> = {};
        const originalMap: Record<string, any> = {};

        data.forEach(template => {
          templatesMap[template.template_type] = template.template_content;
          sendConfigsMap[template.template_type] = template.send_config || DEFAULT_SEND_CONFIG[template.template_type];
          filterConfigsMap[template.template_type] = template.filter_config || DEFAULT_FILTER_CONFIG[template.template_type];
          originalMap[template.template_type] = template;
        });

        setTemplates(templatesMap);
        setSendConfigs(sendConfigsMap);
        setFilterConfigs(filterConfigsMap);
        setOriginalData(originalMap);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async (type: 'welcome' | 'upsell' | 'reorder') => {
    if (!currentWorkspace) return;

    setSaving(true);
    try {
      const templateData = {
        workspace_id: currentWorkspace.id,
        template_type: type,
        template_content: templates[type],
        variables: TEMPLATE_VARIABLES[type],
        is_active: true,
        send_config: sendConfigs[type],
        filter_config: filterConfigs[type]
      };

      const existing = originalData[type];

      if (existing) {
        const { error } = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('message_templates')
          .insert(templateData);

        if (error) throw error;
      }

      toast.success('Template salvo com sucesso!');
      await loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = (type: 'welcome' | 'upsell' | 'reorder') => {
    setTemplates(prev => ({ ...prev, [type]: DEFAULT_TEMPLATES[type] }));
    setSendConfigs(prev => ({ ...prev, [type]: DEFAULT_SEND_CONFIG[type] }));
    setFilterConfigs(prev => ({ ...prev, [type]: DEFAULT_FILTER_CONFIG[type] }));
  };

  const replaceVariables = (template: string, data: Record<string, string>) => {
    let result = template;
    Object.entries(data).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  };

  const hasChanges = (type: string) => {
    const original = originalData[type];
    if (!original) return true;

    return (
      templates[type] !== original.template_content ||
      JSON.stringify(sendConfigs[type]) !== JSON.stringify(original.send_config) ||
      JSON.stringify(filterConfigs[type]) !== JSON.stringify(original.filter_config)
    );
  };

  const updateSendConfig = (type: string, key: string, value: any) => {
    setSendConfigs(prev => ({
      ...prev,
      [type]: { ...prev[type], [key]: value }
    }));
  };

  const updateFilterConfig = (type: string, key: string, value: any) => {
    setFilterConfigs(prev => ({
      ...prev,
      [type]: { ...prev[type], [key]: value }
    }));
  };

  const toggleExcludeChannel = (type: string, channel: string) => {
    const current = filterConfigs[type].exclude_channels || [];
    const updated = current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel];

    updateFilterConfig(type, 'exclude_channels', updated);
  };

  const getTimingDescription = (config: SendConfig) => {
    if (!config.enabled) return 'Desabilitado';

    switch (config.timing_type) {
      case 'immediate':
        return 'Imediato após a criação do pedido';
      case 'delayed':
        return `${config.delay_value} ${config.delay_unit === 'minutes' ? 'minutos' : config.delay_unit === 'hours' ? 'horas' : 'dias'} após o pedido`;
      case 'before_end':
        return `${config.days_before_end} dias antes do produto acabar`;
      default:
        return 'Não configurado';
    }
  };

  const renderSendConfigPanel = (type: 'welcome' | 'upsell' | 'reorder') => {
    const config = sendConfigs[type];

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-base">Configurações de Envio</CardTitle>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(checked) => updateSendConfig(type, 'enabled', checked)}
            />
          </div>
          <CardDescription className="text-xs">
            {getTimingDescription(config)}
          </CardDescription>
        </CardHeader>

        {config.enabled && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Quando enviar?</Label>
              <Select
                value={config.timing_type}
                onValueChange={(value) => updateSendConfig(type, 'timing_type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Imediatamente</SelectItem>
                  <SelectItem value="delayed">Com atraso</SelectItem>
                  <SelectItem value="before_end">Antes do fim da duração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.timing_type === 'delayed' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Valor</Label>
                  <Input
                    type="number"
                    min="1"
                    value={config.delay_value || 1}
                    onChange={(e) => updateSendConfig(type, 'delay_value', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Unidade</Label>
                  <Select
                    value={config.delay_unit || 'minutes'}
                    onValueChange={(value) => updateSendConfig(type, 'delay_unit', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutos</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                      <SelectItem value="days">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {config.timing_type === 'before_end' && (
              <div className="space-y-2">
                <Label className="text-sm">Dias antes do fim</Label>
                <Input
                  type="number"
                  min="1"
                  value={config.days_before_end || 15}
                  onChange={(e) => updateSendConfig(type, 'days_before_end', parseInt(e.target.value))}
                />
                <p className="text-xs text-gray-500">
                  A mensagem será enviada X dias antes do produto acabar (duração do produto - X dias)
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  const renderFilterConfigPanel = (type: 'welcome' | 'upsell' | 'reorder') => {
    const config = filterConfigs[type];

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-base">Filtros de Envio</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Defina quando esta mensagem deve ser enviada
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Canais excluídos */}
          <div className="space-y-2">
            <Label className="text-sm">Não enviar para estes canais:</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_CHANNELS.map(channel => {
                const isExcluded = (config.exclude_channels || []).includes(channel.value);
                return (
                  <Badge
                    key={channel.value}
                    variant={isExcluded ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleExcludeChannel(type, channel.value)}
                  >
                    {channel.label}
                    {isExcluded && ' ✕'}
                  </Badge>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Valor do pedido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Valor mínimo (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={config.min_order_value || 0}
                onChange={(e) => updateFilterConfig(type, 'min_order_value', parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Valor máximo (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Sem limite"
                value={config.max_order_value || ''}
                onChange={(e) => updateFilterConfig(type, 'max_order_value', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
          </div>

          <Separator />

          {/* Opções específicas */}
          {type === 'welcome' && (
            <div className="flex items-center justify-between">
              <Label className="text-sm">Apenas primeira compra</Label>
              <Switch
                checked={config.first_order_only || false}
                onCheckedChange={(checked) => updateFilterConfig(type, 'first_order_only', checked)}
              />
            </div>
          )}

          {type === 'reorder' && (
            <div className="flex items-center justify-between">
              <Label className="text-sm">Apenas produtos com duração</Label>
              <Switch
                checked={config.only_with_duration || false}
                onCheckedChange={(checked) => updateFilterConfig(type, 'only_with_duration', checked)}
              />
            </div>
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Mensagens serão enviadas apenas para pedidos que atendam TODOS os filtros configurados.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  };

  const renderTemplateEditor = (
    type: 'welcome' | 'upsell' | 'reorder',
    icon: React.ReactNode,
    title: string,
    description: string
  ) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Coluna Esquerda: Editor e Configurações */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>

        {/* Template */}
        <div className="space-y-2">
          <Label htmlFor={`template-${type}`}>Template da Mensagem</Label>
          <Textarea
            id={`template-${type}`}
            value={templates[type]}
            onChange={(e) => setTemplates(prev => ({ ...prev, [type]: e.target.value }))}
            rows={8}
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

        {/* Configurações de Envio */}
        {renderSendConfigPanel(type)}

        {/* Filtros */}
        {renderFilterConfigPanel(type)}

        {/* Botões */}
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
            Restaurar
          </Button>
        </div>
      </div>

      {/* Coluna Direita: Preview */}
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

        {/* Info de Timing */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-900">Timing de Envio:</p>
                <p className="text-blue-700 mt-1">{getTimingDescription(sendConfigs[type])}</p>
              </div>
            </div>
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
        <h2 className="text-2xl font-bold">Templates de Mensagens com Configurações Avançadas</h2>
        <p className="text-gray-600 mt-2">
          Personalize mensagens, timing de envio e filtros para cada tipo de automação
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
            Segunda Unidade
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
            'Oferta de segunda unidade com 20% de desconto'
          )}
        </TabsContent>

        <TabsContent value="reorder" className="mt-6">
          {renderTemplateEditor(
            'reorder',
            <RefreshCw className="h-6 w-6 text-purple-600" />,
            'Mensagem de Recompra',
            'Enviada antes do produto acabar para incentivar recompra'
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
