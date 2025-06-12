import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QrCode, RefreshCw, Trash2, MessageSquare, CheckCircle, XCircle, Clock, RotateCcw, Send, Image, FileText, Video, Mic, FolderSync as Sync, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useToast } from '@/hooks/use-toast';

export function WhatsAppConfigDialog() {
  const [open, setOpen] = useState(false);
  const [instanceName, setInstanceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [restartLoading, setRestartLoading] = useState<string | null>(null);
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const [reconnectLoading, setReconnectLoading] = useState<string | null>(null);
  
  // Test message state
  const [testMessage, setTestMessage] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [testMediaUrl, setTestMediaUrl] = useState('');
  const [testMediaType, setTestMediaType] = useState<'image' | 'video' | 'audio' | 'document'>('image');
  const [testCaption, setTestCaption] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  
  const { 
    whatsappInstances, 
    fetchWhatsAppInstances,
    connectWhatsApp,
    disconnectWhatsApp,
    deleteWhatsApp,
    getWhatsAppQR,
    restartWhatsApp,
    sendWhatsAppMessage,
    sendWhatsAppMedia,
    syncWhatsAppStatus,
    syncAllWhatsAppInstances,
    reconnectWhatsApp
  } = useWorkspaceStore();
  
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchWhatsAppInstances();
    }
  }, [open, fetchWhatsAppInstances]);

  // Auto-sync instances every 30 seconds when dialog is open
  useEffect(() => {
    if (!open) return;
    
    const interval = setInterval(() => {
      syncAllWhatsAppInstances();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [open, syncAllWhatsAppInstances]);

  const handleCreateInstance = async () => {
    if (!instanceName.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira um nome para a instância',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await connectWhatsApp(instanceName.trim());
      setInstanceName('');
      toast({
        title: 'Sucesso',
        description: 'Instância WhatsApp criada com sucesso. Escaneie o QR code para conectar.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao criar instância WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async (instanceId: string) => {
    setReconnectLoading(instanceId);
    try {
      await reconnectWhatsApp(instanceId);
      toast({
        title: 'Sucesso',
        description: 'Reconectando instância WhatsApp...',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao reconectar instância WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setReconnectLoading(null);
    }
  };

  const handleDisconnect = async (instanceId: string) => {
    try {
      await disconnectWhatsApp(instanceId);
      toast({
        title: 'Sucesso',
        description: 'Instância WhatsApp desconectada',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao desconectar instância WhatsApp',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (instanceId: string) => {
    setDeleteLoading(instanceId);
    try {
      await deleteWhatsApp(instanceId);
      toast({
        title: 'Sucesso',
        description: 'Instância WhatsApp deletada com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao deletar instância WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleRefreshQR = async (instanceId: string) => {
    setQrLoading(true);
    try {
      await getWhatsAppQR(instanceId);
      toast({
        title: 'Sucesso',
        description: 'QR code atualizado',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao atualizar QR code',
        variant: 'destructive',
      });
    } finally {
      setQrLoading(false);
    }
  };

  const handleRestart = async (instanceId: string) => {
    setRestartLoading(instanceId);
    try {
      await restartWhatsApp(instanceId);
      toast({
        title: 'Sucesso',
        description: 'Instância reiniciada com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao reiniciar instância',
        variant: 'destructive',
      });
    } finally {
      setRestartLoading(null);
    }
  };

  const handleSyncStatus = async (instanceId: string) => {
    setSyncLoading(instanceId);
    try {
      await syncWhatsAppStatus(instanceId);
      toast({
        title: 'Sucesso',
        description: 'Status sincronizado com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao sincronizar status',
        variant: 'destructive',
      });
    } finally {
      setSyncLoading(null);
    }
  };

  const handleSendTestMessage = async (instanceId: string) => {
    if (!testMessage.trim() || !testNumber.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha o número e a mensagem',
        variant: 'destructive',
      });
      return;
    }

    setSendingTest(true);
    try {
      await sendWhatsAppMessage(instanceId, testNumber, testMessage);
      setTestMessage('');
      setTestNumber('');
      toast({
        title: 'Sucesso',
        description: 'Mensagem de teste enviada com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao enviar mensagem de teste',
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendTestMedia = async (instanceId: string) => {
    if (!testMediaUrl.trim() || !testNumber.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha o número e a URL da mídia',
        variant: 'destructive',
      });
      return;
    }

    setSendingTest(true);
    try {
      await sendWhatsAppMedia(instanceId, testNumber, testMediaUrl, testMediaType, testCaption);
      setTestMediaUrl('');
      setTestNumber('');
      setTestCaption('');
      toast({
        title: 'Sucesso',
        description: 'Mídia de teste enviada com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao enviar mídia de teste',
        variant: 'destructive',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'connecting': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'disconnected': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <XCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'connecting': return 'bg-yellow-100 text-yellow-800';
      case 'disconnected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Mic className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <MessageSquare className="mr-2 h-4 w-4" />
          Configurar WhatsApp
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração WhatsApp Evolution API</DialogTitle>
          <DialogDescription>
            Gerencie suas instâncias WhatsApp conectadas via Evolution API com funcionalidades completas.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="instances" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="instances">Instâncias</TabsTrigger>
            <TabsTrigger value="test">Teste de Mensagens</TabsTrigger>
            <TabsTrigger value="info">Informações</TabsTrigger>
          </TabsList>

          <TabsContent value="instances" className="space-y-6">
            {/* Create New Instance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Criar Nova Instância</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="instanceName">Nome da Instância</Label>
                    <Input
                      id="instanceName"
                      placeholder="Ex: WhatsApp Vendas"
                      value={instanceName}
                      onChange={(e) => setInstanceName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !loading) {
                          handleCreateInstance();
                        }
                      }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleCreateInstance} 
                      disabled={loading || !instanceName.trim()}
                      className="min-w-[120px]"
                    >
                      {loading ? 'Criando...' : 'Criar Instância'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Existing Instances */}
            {whatsappInstances.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Instâncias Existentes ({whatsappInstances.length})</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncAllWhatsAppInstances()}
                    >
                      <Sync className="h-4 w-4 mr-2" />
                      Sincronizar Todas
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {whatsappInstances.map((instance) => (
                      <div key={instance.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(instance.status)}
                            <div>
                              <h3 className="font-medium">{instance.instance_name}</h3>
                              <p className="text-sm text-gray-500">
                                {instance.phone_number || 'Não conectado'}
                              </p>
                              <p className="text-xs text-gray-400">
                                Criado em: {new Date(instance.created_at).toLocaleDateString('pt-BR')}
                              </p>
                              {instance.session_id && (
                                <p className="text-xs text-gray-400">
                                  Session ID: {instance.session_id}
                                </p>
                              )}
                              {instance.webhook_url && (
                                <p className="text-xs text-green-600">
                                  ✓ Webhook configurado
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 flex-wrap">
                            <Badge className={getStatusColor(instance.status)}>
                              {getStatusText(instance.status)}
                            </Badge>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSyncStatus(instance.id)}
                              disabled={syncLoading === instance.id}
                            >
                              <Sync className={`h-4 w-4 mr-1 ${syncLoading === instance.id ? 'animate-spin' : ''}`} />
                              {syncLoading === instance.id ? 'Sincronizando...' : 'Sincronizar'}
                            </Button>
                            
                            {instance.status === 'disconnected' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReconnect(instance.id)}
                                disabled={reconnectLoading === instance.id}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <Wifi className={`h-4 w-4 mr-1 ${reconnectLoading === instance.id ? 'animate-spin' : ''}`} />
                                {reconnectLoading === instance.id ? 'Reconectando...' : 'Reconectar'}
                              </Button>
                            )}
                            
                            {instance.status === 'connecting' && instance.qr_code && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRefreshQR(instance.id)}
                                disabled={qrLoading}
                              >
                                <RefreshCw className={`h-4 w-4 mr-1 ${qrLoading ? 'animate-spin' : ''}`} />
                                Atualizar QR
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestart(instance.id)}
                              disabled={restartLoading === instance.id}
                            >
                              <RotateCcw className={`h-4 w-4 mr-1 ${restartLoading === instance.id ? 'animate-spin' : ''}`} />
                              {restartLoading === instance.id ? 'Reiniciando...' : 'Reiniciar'}
                            </Button>
                            
                            {instance.status !== 'disconnected' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDisconnect(instance.id)}
                              >
                                Desconectar
                              </Button>
                            )}
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  disabled={deleteLoading === instance.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  {deleteLoading === instance.id ? 'Deletando...' : 'Deletar'}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar a instância "{instance.instance_name}"? 
                                    Esta ação não pode ser desfeita e a instância será removida permanentemente 
                                    tanto do sistema quanto da Evolution API.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(instance.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Deletar Permanentemente
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {/* QR Code Display */}
                        {instance.status === 'connecting' && instance.qr_code && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <div className="text-center">
                              <QrCode className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                              <p className="text-sm text-gray-600 mb-4">
                                Escaneie este QR code com seu WhatsApp
                              </p>
                              <div className="bg-white p-4 rounded-lg border inline-block">
                                <img 
                                  src={instance.qr_code} 
                                  alt="WhatsApp QR Code" 
                                  className="w-48 h-48 mx-auto"
                                />
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                O QR code expira em alguns minutos. Clique em "Atualizar QR" se necessário.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Connected Status */}
                        {instance.status === 'connected' && (
                          <div className="mt-4 p-4 bg-green-50 rounded-lg">
                            <div className="flex items-center justify-center space-x-2">
                              <CheckCircle className="h-5 w-5 text-green-600" />
                              <span className="text-green-800 font-medium">
                                WhatsApp conectado com sucesso!
                              </span>
                            </div>
                            {instance.phone_number && (
                              <p className="text-center text-sm text-green-700 mt-1">
                                Número: {instance.phone_number}
                              </p>
                            )}
                            <p className="text-center text-xs text-green-600 mt-2">
                              ✓ Pronto para enviar e receber mensagens
                            </p>
                          </div>
                        )}

                        {/* Disconnected Status */}
                        {instance.status === 'disconnected' && (
                          <div className="mt-4 p-4 bg-red-50 rounded-lg">
                            <div className="flex items-center justify-center space-x-2">
                              <XCircle className="h-5 w-5 text-red-600" />
                              <span className="text-red-800 font-medium">
                                WhatsApp desconectado
                              </span>
                            </div>
                            <p className="text-center text-sm text-red-700 mt-1">
                              Clique em "Reconectar" para gerar um novo QR code ou "Reiniciar" para tentar reconectar
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="test" className="space-y-6">
            {whatsappInstances.filter(i => i.status === 'connected').length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhuma instância conectada
                  </h3>
                  <p className="text-gray-500">
                    Conecte uma instância WhatsApp para testar o envio de mensagens
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {whatsappInstances.filter(i => i.status === 'connected').map((instance) => (
                  <Card key={instance.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <MessageSquare className="h-5 w-5" />
                        <span>Teste de Mensagens - {instance.instance_name}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="text" className="w-full">
                        <TabsList>
                          <TabsTrigger value="text">Texto</TabsTrigger>
                          <TabsTrigger value="media">Mídia</TabsTrigger>
                        </TabsList>

                        <TabsContent value="text" className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="testNumber">Número (com DDD)</Label>
                              <Input
                                id="testNumber"
                                placeholder="11999999999"
                                value={testNumber}
                                onChange={(e) => setTestNumber(e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="testMessage">Mensagem</Label>
                            <Textarea
                              id="testMessage"
                              placeholder="Digite sua mensagem de teste..."
                              value={testMessage}
                              onChange={(e) => setTestMessage(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <Button
                            onClick={() => handleSendTestMessage(instance.id)}
                            disabled={sendingTest || !testMessage.trim() || !testNumber.trim()}
                            className="w-full"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {sendingTest ? 'Enviando...' : 'Enviar Mensagem de Teste'}
                          </Button>
                        </TabsContent>

                        <TabsContent value="media" className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="testNumberMedia">Número (com DDD)</Label>
                              <Input
                                id="testNumberMedia"
                                placeholder="11999999999"
                                value={testNumber}
                                onChange={(e) => setTestNumber(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="testMediaType">Tipo de Mídia</Label>
                              <Select value={testMediaType} onValueChange={(value: any) => setTestMediaType(value)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="image">
                                    <div className="flex items-center">
                                      <Image className="h-4 w-4 mr-2" />
                                      Imagem
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="video">
                                    <div className="flex items-center">
                                      <Video className="h-4 w-4 mr-2" />
                                      Vídeo
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="audio">
                                    <div className="flex items-center">
                                      <Mic className="h-4 w-4 mr-2" />
                                      Áudio
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="document">
                                    <div className="flex items-center">
                                      <FileText className="h-4 w-4 mr-2" />
                                      Documento
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="testMediaUrl">URL da Mídia</Label>
                            <Input
                              id="testMediaUrl"
                              placeholder="https://exemplo.com/arquivo.jpg"
                              value={testMediaUrl}
                              onChange={(e) => setTestMediaUrl(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="testCaption">Legenda (Opcional)</Label>
                            <Textarea
                              id="testCaption"
                              placeholder="Digite uma legenda para a mídia..."
                              value={testCaption}
                              onChange={(e) => setTestCaption(e.target.value)}
                              rows={2}
                            />
                          </div>
                          <Button
                            onClick={() => handleSendTestMedia(instance.id)}
                            disabled={sendingTest || !testMediaUrl.trim() || !testNumber.trim()}
                            className="w-full"
                          >
                            {getMediaIcon(testMediaType)}
                            <span className="ml-2">
                              {sendingTest ? 'Enviando...' : `Enviar ${testMediaType === 'image' ? 'Imagem' : testMediaType === 'video' ? 'Vídeo' : testMediaType === 'audio' ? 'Áudio' : 'Documento'}`}
                            </span>
                          </Button>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações da Evolution API</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900">Servidor</h4>
                      <p className="text-sm text-gray-600">https://evolution.suplelive.com.br</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Versão da API</h4>
                      <p className="text-sm text-gray-600">Evolution API v2.2.2</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">✓ Webhook Configurado Automaticamente</h4>
                    <p className="text-sm text-green-700">
                      O webhook está configurado para receber mensagens automaticamente em:
                    </p>
                    <code className="text-xs bg-green-100 px-2 py-1 rounded mt-1 block">
                      {import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook
                    </code>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Funcionalidades Disponíveis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>• ✓ Envio de mensagens de texto</div>
                      <div>• ✓ Envio de imagens e vídeos</div>
                      <div>• ✓ Envio de áudios e documentos</div>
                      <div>• ✓ Recebimento automático de mensagens</div>
                      <div>• ✓ Criação automática de clientes</div>
                      <div>• ✓ Conversas unificadas no inbox</div>
                      <div>• ✓ Status de entrega em tempo real</div>
                      <div>• ✓ Múltiplas instâncias</div>
                      <div>• ✓ QR Code automático</div>
                      <div>• ✓ Webhook em tempo real</div>
                      <div>• ✓ Sincronização de status</div>
                      <div>• ✓ Reconexão inteligente</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Eventos de Webhook Processados</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div>• QRCODE_UPDATED</div>
                      <div>• CONNECTION_UPDATE</div>
                      <div>• MESSAGES_UPSERT</div>
                      <div>• MESSAGES_UPDATE</div>
                      <div>• SEND_MESSAGE</div>
                      <div>• CONTACTS_SET</div>
                      <div>• CONTACTS_UPSERT</div>
                      <div>• CONTACTS_UPDATE</div>
                      <div>• PRESENCE_UPDATE</div>
                      <div>• CHATS_SET</div>
                      <div>• CHATS_UPSERT</div>
                      <div>• CHATS_UPDATE</div>
                      <div>• CHATS_DELETE</div>
                      <div>• GROUPS_UPSERT</div>
                      <div>• GROUP_UPDATE</div>
                      <div>• GROUP_PARTICIPANTS_UPDATE</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Importantes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Cada instância WhatsApp pode ser conectada a apenas um número de telefone</p>
                  <p>• O QR code expira automaticamente após alguns minutos</p>
                  <p>• Use o botão "Atualizar QR" se o código expirar</p>
                  <p>• Mantenha o WhatsApp Web fechado no navegador para evitar conflitos</p>
                  <p>• A conexão é mantida automaticamente pela Evolution API</p>
                  <p>• <strong>Use "Reconectar" para gerar um novo QR code sem recriar a instância</strong></p>
                  <p>• <strong>Deletar uma instância remove permanentemente todos os dados</strong></p>
                  <p>• <strong>Mensagens recebidas criam automaticamente clientes e conversas</strong></p>
                  <p>• Webhooks são configurados automaticamente para receber eventos em tempo real</p>
                  <p>• Use "Reiniciar" se a instância apresentar problemas de conexão</p>
                  <p>• Teste sempre as mensagens antes de usar em produção</p>
                  <p>• <strong>Use "Sincronizar" para verificar o status atual na Evolution API</strong></p>
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