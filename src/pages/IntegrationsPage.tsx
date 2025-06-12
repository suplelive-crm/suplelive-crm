import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, ShoppingBag, Package, Store, Settings, Zap, RefreshCw, CheckCircle, XCircle, Clock, Bot } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WhatsAppConfigDialog } from '@/components/whatsapp/WhatsAppConfigDialog';
import { OpenAIConfigDialog } from '@/components/integrations/OpenAIConfigDialog';
import { N8NConfigDialog } from '@/components/integrations/N8NConfigDialog';
import { BaselinkerConfigDialog } from '@/components/integrations/BaselinkerConfigDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useBaselinkerStore } from '@/store/baselinkerStore';

export function IntegrationsPage() {
  const { 
    channels, 
    whatsappInstances, 
    fetchChannels, 
    fetchWhatsAppInstances,
    disconnectWhatsApp 
  } = useWorkspaceStore();
  
  const { isConnected: isBaselinkerConnected } = useBaselinkerStore();

  useEffect(() => {
    fetchChannels();
    fetchWhatsAppInstances();
  }, [fetchChannels, fetchWhatsAppInstances]);

  const integrations = [
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Conecte WhatsApp Business via Evolution API para mensagens diretas',
      icon: MessageSquare,
      color: 'bg-green-100 text-green-800',
      status: whatsappInstances.some(i => i.status === 'connected') ? 'connected' : 'disconnected',
      action: 'Configurar WhatsApp',
      available: true,
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'Integre com OpenAI para chatbot inteligente e classificação de texto',
      icon: Bot,
      color: 'bg-purple-100 text-purple-800',
      status: localStorage.getItem(`openai_config_${useWorkspaceStore.getState().currentWorkspace?.id}`) ? 'connected' : 'disconnected',
      action: 'Configurar OpenAI',
      available: true,
    },
    {
      id: 'n8n',
      name: 'n8n Automation',
      description: 'Conecte com n8n para automações avançadas e fluxos de trabalho personalizados',
      icon: Zap,
      color: 'bg-blue-100 text-blue-800',
      status: localStorage.getItem(`n8n_config_${useWorkspaceStore.getState().currentWorkspace?.id}`) ? 'connected' : 'disconnected',
      action: 'Configurar n8n',
      available: true,
    },
    {
      id: 'baselinker',
      name: 'Baselinker',
      description: 'Sincronize pedidos, clientes e estoque com o ERP Baselinker',
      icon: ShoppingBag,
      color: 'bg-orange-100 text-orange-800',
      status: isBaselinkerConnected() ? 'connected' : 'disconnected',
      action: 'Configurar Baselinker',
      available: true,
    },
    {
      id: 'shopee',
      name: 'Shopee',
      description: 'Sincronize pedidos e mensagens do marketplace Shopee',
      icon: ShoppingBag,
      color: 'bg-orange-100 text-orange-800',
      status: channels.some(c => c.type === 'shopee' && c.status === 'connected') ? 'connected' : 'disconnected',
      action: 'Conectar Shopee',
      available: false,
    },
    {
      id: 'mercado_livre',
      name: 'Mercado Livre',
      description: 'Integre com Mercado Livre para gestão de pedidos e mensagens',
      icon: Package,
      color: 'bg-yellow-100 text-yellow-800',
      status: channels.some(c => c.type === 'mercado_livre' && c.status === 'connected') ? 'connected' : 'disconnected',
      action: 'Conectar Mercado Livre',
      available: false,
    },
    {
      id: 'rd_marketplace',
      name: 'RD Marketplace',
      description: 'Conecte RD Marketplace para gestão unificada de clientes',
      icon: Store,
      color: 'bg-blue-100 text-blue-800',
      status: channels.some(c => c.type === 'rd_marketplace' && c.status === 'connected') ? 'connected' : 'disconnected',
      action: 'Conectar RD Marketplace',
      available: false,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4" />;
      case 'connecting': return <Clock className="h-4 w-4" />;
      default: return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectado';
      default: return 'Desconhecido';
    }
  };

  const renderIntegrationAction = (integration: typeof integrations[0]) => {
    switch (integration.id) {
      case 'whatsapp':
        return <WhatsAppConfigDialog />;
      case 'openai':
        return <OpenAIConfigDialog />;
      case 'n8n':
        return <N8NConfigDialog />;
      case 'baselinker':
        return <BaselinkerConfigDialog />;
      default:
        return (
          <Button className="w-full\" variant="outline\" disabled={!integration.available}>
            <integration.icon className="mr-2 h-4 w-4" />
            {integration.action} {!integration.available && '(Em Breve)'}
          </Button>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full space-y-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Integrações</h1>
            <p className="text-gray-600 mt-2">Conecte seus canais e automatize seus fluxos de trabalho</p>
          </div>

          {/* Connected Channels Overview */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">
                  {channels.filter(c => c.status === 'connected').length}
                </div>
                <div className="text-sm text-gray-600">Canais Conectados</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">
                  {whatsappInstances.filter(i => i.status === 'connected').length}
                </div>
                <div className="text-sm text-gray-600">Instâncias WhatsApp</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">
                  {localStorage.getItem(`openai_config_${useWorkspaceStore.getState().currentWorkspace?.id}`) ? 1 : 0}
                </div>
                <div className="text-sm text-gray-600">Integrações IA</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-600">
                  {(localStorage.getItem(`n8n_config_${useWorkspaceStore.getState().currentWorkspace?.id}`) ? 1 : 0) + 
                   (isBaselinkerConnected() ? 1 : 0)}
                </div>
                <div className="text-sm text-gray-600">Automações & ERPs</div>
              </CardContent>
            </Card>
          </div>

          {/* Available Integrations */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Integrações Disponíveis</h2>
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
              {integrations.map((integration) => {
                const Icon = integration.icon;
                return (
                  <Card key={integration.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${integration.color}`}>
                            <Icon className="h-6 w-6" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{integration.name}</CardTitle>
                            <CardDescription>{integration.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(integration.status)}
                          <Badge className={getStatusColor(integration.status)}>
                            {getStatusText(integration.status)}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {renderIntegrationAction(integration)}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Connected WhatsApp Instances */}
          {whatsappInstances.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Instâncias WhatsApp</h2>
              <div className="w-full space-y-4">
                {whatsappInstances.map((instance) => (
                  <Card key={instance.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-green-100 text-green-800">
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-medium">{instance.instance_name}</h3>
                            <p className="text-sm text-gray-500">
                              {instance.phone_number || 'Não conectado'}
                            </p>
                            <p className="text-xs text-gray-400">
                              Criado em: {new Date(instance.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(instance.status)}
                            <Badge className={getStatusColor(instance.status)}>
                              {getStatusText(instance.status)}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectWhatsApp(instance.id)}
                          >
                            Desconectar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}