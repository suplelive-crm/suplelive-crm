import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpDown,
  Package,
  TrendingUp,
  TrendingDown,
  Search,
} from 'lucide-react';

interface EventQueueItem {
  id: string;
  event_log_id: number;
  event_type: number;
  event_name: string;
  order_id?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retry_count: number;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

interface StockChangeLog {
  id: string;
  sku: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  action_type: string;
  source: string;
  previous_quantity: number;
  new_quantity: number;
  quantity_change: number;
  change_reason?: string;
  user_name?: string;
  created_at: string;
}

export function JobsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [events, setEvents] = useState<EventQueueItem[]>([]);
  const [stockLogs, setStockLogs] = useState<StockChangeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [eventStatusFilter, setEventStatusFilter] = useState<string>('all');
  const [stockSourceFilter, setStockSourceFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (currentWorkspace?.id) {
      loadData();
    }
  }, [currentWorkspace?.id, eventStatusFilter, stockSourceFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadEventQueue(), loadStockLogs()]);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadEventQueue = async () => {
    try {
      let query = supabase
        .from('event_queue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (eventStatusFilter !== 'all') {
        query = query.eq('status', eventStatusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error: any) {
      console.error('Error loading events:', error);
      throw error;
    }
  };

  const loadStockLogs = async () => {
    try {
      let query = supabase
        .from('v_recent_stock_changes')
        .select('*')
        .eq('workspace_id', currentWorkspace!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (stockSourceFilter !== 'all') {
        query = query.eq('source', stockSourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setStockLogs(data || []);
    } catch (error: any) {
      console.error('Error loading stock logs:', error);
      throw error;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success('Dados atualizados');
  };

  const retryEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('event_queue')
        .update({ status: 'pending', retry_count: 0, error_message: null })
        .eq('id', eventId);

      if (error) throw error;

      toast.success('Evento reenviado para processamento');
      await loadEventQueue();
    } catch (error: any) {
      console.error('Error retrying event:', error);
      toast.error('Erro ao reprocessar evento');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completo</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      manual: 'bg-blue-500',
      baselinker: 'bg-purple-500',
      system: 'bg-gray-500',
      purchase: 'bg-green-500',
      transfer: 'bg-orange-500',
      order: 'bg-pink-500',
    };

    return (
      <Badge className={colors[source] || 'bg-gray-500'}>
        {source}
      </Badge>
    );
  };

  const filteredEvents = events.filter((event) => {
    if (!searchTerm) return true;
    return (
      event.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.order_id?.toString().includes(searchTerm) ||
      event.event_log_id.toString().includes(searchTerm)
    );
  });

  const filteredStockLogs = stockLogs.filter((log) => {
    if (!searchTerm) return true;
    return (
      log.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.warehouse_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Jobs & Logs</h1>
            <p className="text-muted-foreground">
              Monitore eventos do Baselinker e alterações de estoque
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{events.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eventos Completos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {events.filter((e) => e.status === 'completed').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eventos Falhados</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {events.filter((e) => e.status === 'failed').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alterações de Estoque</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stockLogs.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events">Fila de Eventos</TabsTrigger>
            <TabsTrigger value="stock-logs">Logs de Estoque</TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Eventos do Baselinker</CardTitle>
                    <CardDescription>
                      Últimos 100 eventos processados pela plataforma
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={eventStatusFilter} onValueChange={setEventStatusFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="processing">Processando</SelectItem>
                        <SelectItem value="completed">Completo</SelectItem>
                        <SelectItem value="failed">Falhou</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-[250px]"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Log ID</TableHead>
                      <TableHead>Tentativas</TableHead>
                      <TableHead>Criado</TableHead>
                      <TableHead>Processado</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nenhum evento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.event_name}</TableCell>
                          <TableCell>{getStatusBadge(event.status)}</TableCell>
                          <TableCell>{event.order_id || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{event.event_log_id}</TableCell>
                          <TableCell>
                            {event.retry_count > 0 && (
                              <Badge variant="outline">{event.retry_count}x</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {event.processed_at
                              ? format(new Date(event.processed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {event.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => retryEvent(event.id)}
                              >
                                Reprocessar
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stock Logs Tab */}
          <TabsContent value="stock-logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Logs de Alteração de Estoque</CardTitle>
                    <CardDescription>
                      Todas as alterações de estoque feitas pela plataforma
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={stockSourceFilter} onValueChange={setStockSourceFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Origem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Origens</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="baselinker">Baselinker</SelectItem>
                        <SelectItem value="system">Sistema</SelectItem>
                        <SelectItem value="purchase">Compra</SelectItem>
                        <SelectItem value="transfer">Transferência</SelectItem>
                        <SelectItem value="order">Pedido</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-[250px]"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStockLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nenhum log de estoque encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStockLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono font-medium">{log.sku}</TableCell>
                          <TableCell>{log.product_name || '-'}</TableCell>
                          <TableCell>{log.warehouse_name || log.warehouse_id}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.action_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {log.quantity_change > 0 ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              <span
                                className={
                                  log.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                {log.quantity_change > 0 ? '+' : ''}
                                {log.quantity_change}
                              </span>
                              <span className="text-muted-foreground text-sm">
                                ({log.previous_quantity} → {log.new_quantity})
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getSourceBadge(log.source)}</TableCell>
                          <TableCell className="text-sm">{log.user_name || '-'}</TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
