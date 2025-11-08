import { useState, useEffect } from 'react';
import { ShoppingBag, Key, TestTube, CheckCircle, XCircle, Loader2, RefreshCw, Clock, Database, Package, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useBaselinkerStore } from '@/store/baselinkerStore';
import { useToast } from '@/hooks/use-toast';

export function BaselinkerConfigDialog() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState({
    apiKey: '',
    syncInterval: 5,
    syncOrders: true,
    syncCustomers: true,
    syncInventory: true,
    orderStatuses: ['new', 'paid', 'processing', 'ready_for_shipping', 'shipped'],
    inventoryId: '',
  });
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [inventories, setInventories] = useState<any[]>([]);
  const [orderStatuses, setOrderStatuses] = useState<any[]>([]);
  const [syncStats, setSyncStats] = useState({
    lastSync: null as Date | null,
    ordersCount: 0,
    customersCount: 0,
    productsCount: 0,
  });
  const [authError, setAuthError] = useState<string>('');

  const { currentWorkspace } = useWorkspaceStore();
  const { 
    isConnected, 
    connect, 
    disconnect, 
    testConnection, 
    getInventories, 
    getOrderStatuses,
    syncOrders,
    syncCustomers,
    syncInventory,
    syncAll,
    getSyncStats
  } = useBaselinkerStore();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadSavedConfig();
      checkConnectionStatus();
    }
  }, [open, currentWorkspace?.id]);

  const checkConnectionStatus = async () => {
    try {
      setAuthError('');
      const connected = isConnected();
      setConnected(connected);
      
      if (connected) {
        // Load saved config from database
        const baselinkerSettings = currentWorkspace?.settings?.baselinker;
        if (baselinkerSettings && baselinkerSettings.token) {
          const parsedConfig = {
            apiKey: baselinkerSettings.token,
            syncInterval: baselinkerSettings.sync_interval || 5,
            syncOrders: baselinkerSettings.sync_orders !== false,
            syncCustomers: baselinkerSettings.sync_customers !== false,
            syncInventory: baselinkerSettings.sync_inventory !== false,
            orderStatuses: ['new', 'paid', 'processing', 'ready_for_shipping', 'shipped'],
            inventoryId: baselinkerSettings.inventory_id || '',
            warehouse_es: baselinkerSettings.warehouse_es || 1,
            warehouse_sp: baselinkerSettings.warehouse_sp || 2,
          };
          setConfig(parsedConfig);

          // Test connection to make sure it's still valid
          const { apiKey } = parsedConfig;
          if (apiKey) {
            try {
              // Test the API key first
              console.log("Testing connection with API key:", apiKey);
              const connectionResult = await testConnection(apiKey);
              console.log("Connection test result:", connectionResult);
              
              if (!connectionResult.success) {
                setConnected(false);
                setAuthError('Chave da API inválida ou expirada. Por favor, verifique sua chave da API.');
                toast({
                  title: 'Erro de Autenticação',
                  description: 'A chave da API Baselinker é inválida ou expirou. Por favor, atualize sua chave da API.',
                  variant: 'destructive',
                });
                return;
              }

              // Initialize the Baselinker client before fetching data
              await connect(parsedConfig);
              await fetchBaselinkerData();
              await fetchSyncStats();
            } catch (error: any) {
              console.error("Error during connection check:", error);
              setConnected(false);
              
              // Check if it's an authentication error
              if (error.message.includes('401') || error.message.includes('Unauthorized') || 
                  error.message.includes('Invalid API key')) {
                setAuthError('Chave da API inválida ou sem permissões necessárias.');
                toast({
                  title: 'Erro de Autenticação',
                  description: 'A chave da API Baselinker não tem as permissões necessárias ou é inválida. Verifique sua chave da API no painel Baselinker.',
                  variant: 'destructive',
                });
              } else {
                setAuthError('Erro de conexão com Baselinker.');
                toast({
                  title: 'Erro de Conexão',
                  description: 'A conexão com Baselinker falhou. Por favor, tente novamente.',
                  variant: 'destructive',
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      setConnected(false);
      setAuthError('Erro ao verificar status da conexão.');
    }
  };

  const loadSavedConfig = async () => {
    if (!currentWorkspace) return;

    try {
      // Buscar do banco
      const baselinkerSettings = currentWorkspace.settings?.baselinker;

      if (baselinkerSettings && baselinkerSettings.token) {
        setConfig({
          apiKey: baselinkerSettings.token,
          syncInterval: baselinkerSettings.sync_interval || 5,
          syncOrders: baselinkerSettings.sync_orders !== false,
          syncCustomers: baselinkerSettings.sync_customers !== false,
          syncInventory: baselinkerSettings.sync_inventory !== false,
          orderStatuses: ['new', 'paid', 'processing', 'ready_for_shipping', 'shipped'],
          inventoryId: baselinkerSettings.inventory_id || '',
        });
      }
    } catch (error) {
      console.error('Error loading Baselinker config:', error);
    }
  };

  const fetchBaselinkerData = async () => {
    try {
      setAuthError('');
      
      const inventoriesData = await getInventories();
      setInventories(inventoriesData);

      const statusesData = await getOrderStatuses();
      setOrderStatuses(statusesData);
    } catch (error: any) {
      console.error('Error fetching Baselinker data:', error);
      
      // Check if it's an authentication error
      if (error.message.includes('401') || error.message.includes('Unauthorized') || 
          error.message.includes('Invalid API key')) {
        setAuthError('Chave da API inválida ou sem permissões necessárias.');
        setConnected(false);
        toast({
          title: 'Erro de Autenticação',
          description: 'A chave da API Baselinker não tem as permissões necessárias. Verifique sua chave da API no painel Baselinker.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Falha ao buscar dados do Baselinker. Verifique sua conexão.',
          variant: 'destructive',
        });
      }
    }
  };

  const fetchSyncStats = async () => {
    try {
      const stats = await getSyncStats();
      setSyncStats(stats);
    } catch (error) {
      console.error('Error fetching sync stats:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!config.apiKey.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira sua chave da API Baselinker',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setAuthError('');
    
    try {
      // Test connection first
      console.log("Testing connection with API key:", config.apiKey);
      const connectionResult = await testConnection(config.apiKey);
      console.log("Connection test result:", connectionResult);
      
      if (!connectionResult.success) {
        setAuthError('Chave da API inválida ou sem permissões necessárias.');
        toast({
          title: 'Erro de Autenticação',
          description: 'A chave da API Baselinker é inválida ou não tem as permissões necessárias. Verifique sua chave da API no painel Baselinker.',
          variant: 'destructive',
        });
        return;
      }

      // Connect to Baselinker
      await connect(config);
      
      setConnected(true);
      toast({
        title: 'Sucesso',
        description: 'Configuração Baselinker salva e testada com sucesso!',
      });

      // Fetch initial data
      await fetchBaselinkerData();
      await fetchSyncStats();
    } catch (error: any) {
      console.error("Connection error:", error);
      
      // Check if it's an authentication error
      if (error.message.includes('401') || error.message.includes('Unauthorized') || 
          error.message.includes('Invalid API key')) {
        setAuthError('Chave da API inválida ou sem permissões necessárias.');
        toast({
          title: 'Erro de Autenticação',
          description: 'A chave da API Baselinker é inválida ou não tem as permissões necessárias. Verifique sua chave da API no painel Baselinker.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: `Falha ao conectar com Baselinker: ${error.message}`,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setConnected(false);
      setAuthError('');
      setConfig({
        apiKey: '',
        syncInterval: 5,
        syncOrders: true,
        syncCustomers: true,
        syncInventory: true,
        orderStatuses: ['new', 'paid', 'processing', 'ready_for_shipping', 'shipped'],
        inventoryId: '',
      });
      toast({
        title: 'Desconectado',
        description: 'Conexão com Baselinker removida com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: `Falha ao desconectar: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleTestConnection = async () => {
    if (!config.apiKey.trim()) {
      toast({
        title: 'Erro',
        description: 'Por favor, insira sua chave da API Baselinker',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setAuthError('');
    
    try {
      console.log("Testing connection with API key:", config.apiKey);
      const result = await testConnection(config.apiKey);
      console.log("Test connection result:", result);
      
      setTestResult(JSON.stringify(result, null, 2));
      
      if (result.success) {
        toast({
          title: 'Conexão bem-sucedida',
          description: 'API Baselinker está funcionando corretamente',
        });
      } else {
        if (result.message?.includes('401') || result.message?.includes('Unauthorized') || 
            result.message?.includes('Invalid API key')) {
          setAuthError('Chave da API inválida ou sem permissões necessárias.');
          toast({
            title: 'Erro de Autenticação',
            description: 'A chave da API Baselinker é inválida ou não tem as permissões necessárias. Verifique sua chave da API no painel Baselinker.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro na conexão',
            description: result.message || 'Falha ao conectar com Baselinker',
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      console.error("Test connection error:", error);
      
      if (error.message.includes('401') || error.message.includes('Unauthorized') || 
          error.message.includes('Invalid API key')) {
        setAuthError('Chave da API inválida ou sem permissões necessárias.');
        toast({
          title: 'Erro de Autenticação',
          description: 'A chave da API Baselinker é inválida ou não tem as permissões necessárias. Verifique sua chave da API no painel Baselinker.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro',
          description: `Falha ao testar conexão: ${error.message}`,
          variant: 'destructive',
        });
      }
      
      setTestResult(JSON.stringify({ success: false, message: error.message }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async (type: 'orders' | 'customers' | 'inventory' | 'all') => {
    if (!connected) {
      toast({
        title: 'Não Conectado',
        description: 'Por favor, configure e teste a conexão com Baselinker primeiro.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setAuthError('');
    
    try {
      if (type === 'orders' || type === 'all') {
        await syncOrders();
      }
      
      if (type === 'customers' || type === 'all') {
        await syncCustomers();
      }
      
      if (type === 'inventory' || type === 'all') {
        // Check if inventory sync is enabled and inventory ID is configured
        if (config.syncInventory && config.inventoryId) {
          await syncInventory();
        } else if (type === 'inventory') {
          // If specifically trying to sync inventory but config is incomplete
          toast({
            title: 'Configuração Incompleta',
            description: 'Por favor, selecione um inventário antes de sincronizar o estoque.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }
      
      // Refresh stats
      await fetchSyncStats();
      
      toast({
        title: 'Sincronização concluída',
        description: `Dados ${type === 'all' ? 'completos' : type} sincronizados com sucesso`,
      });
    } catch (error: any) {
      console.error("Sync error:", error);
      
      if (error.message.includes('401') || error.message.includes('Unauthorized') || 
          error.message.includes('Invalid API key')) {
        setAuthError('Chave da API inválida ou sem permissões necessárias.');
        setConnected(false);
        toast({
          title: 'Erro de Autenticação',
          description: 'A chave da API Baselinker é inválida ou expirou. Por favor, atualize sua chave da API.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro na sincronização',
          description: `Falha ao sincronizar dados: ${error.message}`,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ShoppingBag className="mr-2 h-4 w-4" />
          Configurar Baselinker
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <ShoppingBag className="mr-2 h-5 w-5" />
            Configuração Baselinker - ERP e Gestão de Pedidos
          </DialogTitle>
          <DialogDescription>
            Configure a integração com Baselinker para sincronizar pedidos, clientes e estoque
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="config" id="config-tab">Configuração</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="customers">Clientes</TabsTrigger>
            <TabsTrigger value="inventory">Estoque</TabsTrigger>
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
                  Configure sua chave da API Baselinker e parâmetros de sincronização
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Erro de Autenticação</p>
                      <p className="text-sm text-red-700">{authError}</p>
                      <p className="text-xs text-red-600 mt-1">
                        Verifique sua chave da API em: Baselinker → Configurações → API → API Token
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="apiKey">Chave da API Baselinker *</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Insira sua chave da API"
                      value={config.apiKey}
                      onChange={(e) => {
                        setConfig({ ...config, apiKey: e.target.value });
                        setAuthError(''); // Clear auth error when user types
                      }}
                      className={authError ? 'border-red-300 focus:border-red-500' : ''}
                    />
                    <Button
                      variant="outline"
                      onClick={() => window.open('https://panel.baselinker.com/developer_api.php', '_blank')}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {'Obtenha sua chave em Baselinker > Configurações > API > API Token'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="syncInterval">Intervalo de Sincronização (minutos)</Label>
                    <Input
                      id="syncInterval"
                      type="number"
                      min="1"
                      max="60"
                      value={config.syncInterval}
                      onChange={(e) => setConfig({ ...config, syncInterval: parseInt(e.target.value) || 5 })}
                    />
                  </div>

                  {connected && inventories.length > 0 && (
                    <div>
                      <Label htmlFor="inventoryId">Inventário Principal</Label>
                      <Select 
                        value={config.inventoryId} 
                        onValueChange={(value) => setConfig({ ...config, inventoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um inventário" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventories.map((inventory) => (
                            <SelectItem key={inventory.id} value={inventory.id.toString()}>
                              {inventory.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Dados a Sincronizar</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="syncOrders">Pedidos</Label>
                        <p className="text-xs text-gray-500">Sincronizar pedidos do Baselinker</p>
                      </div>
                      <Switch
                        id="syncOrders"
                        checked={config.syncOrders}
                        onCheckedChange={(checked) => setConfig({ ...config, syncOrders: checked })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="syncCustomers">Clientes</Label>
                        <p className="text-xs text-gray-500">Sincronizar clientes do Baselinker</p>
                      </div>
                      <Switch
                        id="syncCustomers"
                        checked={config.syncCustomers}
                        onCheckedChange={(checked) => setConfig({ ...config, syncCustomers: checked })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="syncInventory">Estoque</Label>
                        <p className="text-xs text-gray-500">Sincronizar produtos e estoque do Baselinker</p>
                      </div>
                      <Switch
                        id="syncInventory"
                        checked={config.syncInventory}
                        onCheckedChange={(checked) => setConfig({ ...config, syncInventory: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button onClick={handleSaveConfig} disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testando conexão...
                      </>
                    ) : (
                      'Salvar e Testar Conexão'
                    )}
                  </Button>
                  
                  <Button variant="outline" onClick={handleTestConnection} disabled={loading || !config.apiKey.trim()}>
                    <TestTube className="h-4 w-4 mr-2" />
                    Testar
                  </Button>
                </div>

                {connected && (
                  <Button variant="destructive" onClick={handleDisconnect} disabled={loading}>
                    Desconectar
                  </Button>
                )}
              </CardContent>
            </Card>

            {connected && (
              <Card>
                <CardHeader>
                  <CardTitle>Status da Sincronização</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Última Sincronização</h4>
                      <p className="text-sm">{formatDate(syncStats.lastSync)}</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Próxima Sincronização</h4>
                      <p className="text-sm">
                        {syncStats.lastSync 
                          ? formatDate(new Date(syncStats.lastSync.getTime() + config.syncInterval * 60000))
                          : 'Não agendada'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{syncStats.ordersCount}</p>
                      <p className="text-sm text-blue-800">Pedidos</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{syncStats.customersCount}</p>
                      <p className="text-sm text-green-800">Clientes</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">{syncStats.productsCount}</p>
                      <p className="text-sm text-purple-800">Produtos</p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <Button 
                      onClick={() => handleSyncNow('all')} 
                      disabled={loading || !connected}
                      className="w-full"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Sincronizar Agora
                    </Button>
                  </div>
                </CardContent>
              </Card>
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

          <TabsContent value="orders" className="space-y-4">
            {!connected ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Não conectado ao Baselinker
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Configure a conexão com Baselinker para sincronizar pedidos
                  </p>
                  <Button onClick={() => document.getElementById('config-tab')?.click()}>
                    Ir para Configuração
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Configuração de Pedidos</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSyncNow('orders')}
                        disabled={loading}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar Pedidos
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Configure quais pedidos serão sincronizados do Baselinker
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Status de Pedidos a Sincronizar</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {orderStatuses.map((status) => (
                          <div key={status.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`status-${status.id}`}
                              checked={config.orderStatuses.includes(status.id)}
                              onChange={(e) => {
                                const newStatuses = e.target.checked
                                  ? [...config.orderStatuses, status.id]
                                  : config.orderStatuses.filter(s => s !== status.id);
                                setConfig({ ...config, orderStatuses: newStatuses });
                              }}
                            />
                            <Label htmlFor={`status-${status.id}`} className="text-sm">
                              {status.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Mapeamento de Status</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Os status de pedidos do Baselinker serão mapeados para os status do OmniCRM da seguinte forma:
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">new, waiting_for_payment</span>
                          <Badge>pending</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">paid, ready_for_shipping</span>
                          <Badge className="bg-blue-100 text-blue-800">processing</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">shipped, delivered</span>
                          <Badge className="bg-green-100 text-green-800">completed</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">cancelled, returned</span>
                          <Badge className="bg-red-100 text-red-800">cancelled</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Estatísticas de Pedidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">{syncStats.ordersCount}</p>
                        <p className="text-sm text-blue-800">Total de Pedidos</p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-yellow-600">
                          {/* Placeholder for pending orders count */}
                          {Math.floor(syncStats.ordersCount * 0.2)}
                        </p>
                        <p className="text-sm text-yellow-800">Pendentes</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {/* Placeholder for completed orders count */}
                          {Math.floor(syncStats.ordersCount * 0.7)}
                        </p>
                        <p className="text-sm text-green-800">Concluídos</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {/* Placeholder for cancelled orders count */}
                          {Math.floor(syncStats.ordersCount * 0.1)}
                        </p>
                        <p className="text-sm text-red-800">Cancelados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="customers" className="space-y-4">
            {!connected ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Não conectado ao Baselinker
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Configure a conexão com Baselinker para sincronizar clientes
                  </p>
                  <Button onClick={() => document.getElementById('config-tab')?.click()}>
                    Ir para Configuração
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Configuração de Clientes</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSyncNow('customers')}
                        disabled={loading}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar Clientes
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Configure como os clientes serão sincronizados do Baselinker
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Criar clientes automaticamente</Label>
                          <p className="text-xs text-gray-500">Criar novos clientes a partir de pedidos</p>
                        </div>
                        <Switch
                          checked={true}
                          disabled={true}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Atualizar clientes existentes</Label>
                          <p className="text-xs text-gray-500">Atualizar dados de clientes existentes</p>
                        </div>
                        <Switch
                          checked={true}
                          disabled={true}
                        />
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-2">Mapeamento de Campos</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        Os dados de clientes do Baselinker serão mapeados para os campos do OmniCRM da seguinte forma:
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">email</span>
                          <span className="text-sm font-medium">→</span>
                          <span className="text-sm">email</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">phone</span>
                          <span className="text-sm font-medium">→</span>
                          <span className="text-sm">phone</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">delivery_fullname</span>
                          <span className="text-sm font-medium">→</span>
                          <span className="text-sm">name</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">invoice_company</span>
                          <span className="text-sm font-medium">→</span>
                          <span className="text-sm">company</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Estatísticas de Clientes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">{syncStats.customersCount}</p>
                        <p className="text-sm text-blue-800">Total de Clientes</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {/* Placeholder for active customers count */}
                          {Math.floor(syncStats.customersCount * 0.8)}
                        </p>
                        <p className="text-sm text-green-800">Clientes Ativos</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {/* Placeholder for new customers count */}
                          {Math.floor(syncStats.customersCount * 0.15)}
                        </p>
                        <p className="text-sm text-purple-800">Novos (30 dias)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4">
            {!connected ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Não conectado ao Baselinker
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Configure a conexão com Baselinker para sincronizar estoque
                  </p>
                  <Button onClick={() => document.getElementById('config-tab')?.click()}>
                    Ir para Configuração
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Configuração de Estoque</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleSyncNow('inventory')}
                        disabled={loading || !config.inventoryId}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar Estoque
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Configure como os produtos e estoque serão sincronizados do Baselinker
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Inventário a Sincronizar</Label>
                      <Select 
                        value={config.inventoryId} 
                        onValueChange={(value) => setConfig({ ...config, inventoryId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um inventário" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventories.map((inventory) => (
                            <SelectItem key={inventory.id} value={inventory.id.toString()}>
                              {inventory.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        Selecione o inventário principal do Baselinker para sincronizar
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Sincronizar estoque bidirecional</Label>
                          <p className="text-xs text-gray-500">Atualizar estoque no Baselinker quando alterado no OmniCRM</p>
                        </div>
                        <Switch
                          checked={false}
                          disabled={true}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Sincronizar preços</Label>
                          <p className="text-xs text-gray-500">Atualizar preços dos produtos</p>
                        </div>
                        <Switch
                          checked={true}
                          disabled={true}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Estatísticas de Estoque</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-blue-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-blue-600">{syncStats.productsCount}</p>
                        <p className="text-sm text-blue-800">Total de Produtos</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {/* Placeholder for in stock products count */}
                          {Math.floor(syncStats.productsCount * 0.75)}
                        </p>
                        <p className="text-sm text-green-800">Em Estoque</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {/* Placeholder for out of stock products count */}
                          {Math.floor(syncStats.productsCount * 0.25)}
                        </p>
                        <p className="text-sm text-red-800">Sem Estoque</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {/* Placeholder for low stock products count */}
                          {Math.floor(syncStats.productsCount * 0.15)}
                        </p>
                        <p className="text-sm text-purple-800">Estoque Baixo</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
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