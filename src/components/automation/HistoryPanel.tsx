import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Play, Eye, Package, MessageSquare, RefreshCw, TrendingUp, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutomationStore } from '@/store/automationStore';
import { useTrackingStore } from '@/store/trackingStore';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from '@/store/workspaceStore';

interface ReorderMessage {
  id: string;
  order_id: string;
  client_id: string;
  product_name: string;
  sku: string;
  order_date: string;
  mensagem_recompra: boolean;
  total_amount?: number;
  client?: {
    name: string;
    phone?: string;
    cpf?: string;
  };
}

interface UpsellMessage {
  order_id: string;
  client_id: string;
  order_date: string;
  mensagem_enviada: boolean;
  client?: {
    name: string;
    phone?: string;
    cpf?: string;
  };
  total_amount?: number;
}

export function HistoryPanel() {
  const { executions, fetchExecutions } = useAutomationStore();
  const { purchases, returns, transfers, fetchPurchases, fetchReturns, fetchTransfers } = useTrackingStore();
  const { currentWorkspace } = useWorkspaceStore();

  const [selectedExecution, setSelectedExecution] = useState<any>(null);
  const [reorderMessages, setReorderMessages] = useState<ReorderMessage[]>([]);
  const [upsellMessages, setUpsellMessages] = useState<UpsellMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  useEffect(() => {
    fetchExecutions();
    fetchPurchases();
    fetchReturns();
    fetchTransfers();
    fetchReorderMessages();
    fetchUpsellMessages();
  }, []);

  const fetchReorderMessages = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders_products')
        .select(`
          id,
          order_id,
          nome_produto,
          sku,
          mensagem_recompra,
          order:orders!orders_products_order_id_fkey(
            order_id_base,
            client_id,
            order_date,
            total_amount,
            client:clients(name, phone, cpf)
          )
        `)
        .not('mensagem_recompra', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const mapped = (data || []).map(item => ({
        id: item.id,
        order_id: item.order?.order_id_base?.toString() || '',
        client_id: item.order?.client_id || '',
        product_name: item.nome_produto || '',
        sku: item.sku || '',
        order_date: item.order?.order_date || '',
        mensagem_recompra: item.mensagem_recompra,
        total_amount: item.order?.total_amount,
        client: item.order?.client
      }));

      setReorderMessages(mapped);
    } catch (error) {
      console.error('Erro ao buscar mensagens de recompra:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpsellMessages = async () => {
    if (!currentWorkspace) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          order_id_base,
          client_id,
          order_date,
          mensagem_enviada,
          total_amount,
          client:clients(name, phone, cpf)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .not('mensagem_enviada', 'is', null)
        .order('order_date', { ascending: false })
        .limit(100);

      if (error) throw error;

      const mapped = (data || []).map(order => ({
        order_id: order.order_id_base?.toString() || '',
        client_id: order.client_id,
        order_date: order.order_date,
        mensagem_enviada: order.mensagem_enviada,
        client: order.client,
        total_amount: order.total_amount
      }));

      setUpsellMessages(mapped);
    } catch (error) {
      console.error('Erro ao buscar mensagens de venda casada:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtros aplicados
  const applyFilters = (items: any[]) => {
    return items.filter(item => {
      // Filtro de busca por nome/CPF/telefone
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = item.client?.name?.toLowerCase().includes(search);
        const matchesCPF = item.client?.cpf?.toLowerCase().includes(search);
        const matchesPhone = item.client?.phone?.toLowerCase().includes(search);

        if (!matchesName && !matchesCPF && !matchesPhone) {
          return false;
        }
      }

      // Filtro de data
      if (dateFrom && item.order_date) {
        const itemDate = new Date(item.order_date);
        const fromDate = new Date(dateFrom);
        if (itemDate < fromDate) return false;
      }

      if (dateTo && item.order_date) {
        const itemDate = new Date(item.order_date);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) return false;
      }

      // Filtro de valor
      if (minAmount && item.total_amount) {
        if (item.total_amount < parseFloat(minAmount)) return false;
      }

      if (maxAmount && item.total_amount) {
        if (item.total_amount > parseFloat(maxAmount)) return false;
      }

      return true;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'sent':
      case 'in_stock':
        return 'bg-green-100 text-green-800';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'running':
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'sent':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'running':
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      completed: 'Concluído',
      failed: 'Falhou',
      running: 'Executando',
      cancelled: 'Cancelado',
      pending: 'Pendente',
      sent: 'Enviada',
      in_stock: 'Em Estoque',
      conferido: 'Conferido'
    };
    return statusMap[status] || status;
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = end.getTime() - start.getTime();

    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${Math.round(duration / 1000)}s`;
    return `${Math.round(duration / 60000)}m`;
  };

  const allStockMovements = [
    ...purchases.map(p => ({ ...p, type: 'purchase' as const })),
    ...transfers.map(t => ({ ...t, type: 'transfer' as const })),
    ...returns.map(r => ({ ...r, type: 'return' as const }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);

  const filteredUpsellMessages = applyFilters(upsellMessages);
  const filteredReorderMessages = applyFilters(reorderMessages);
  const filteredStockMovements = applyFilters(allStockMovements);

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setMinAmount('');
    setMaxAmount('');
  };

  const FilterSection = () => (
    <div className="bg-gray-50 p-4 rounded-lg space-y-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="h-4 w-4 text-gray-600" />
        <span className="font-medium text-sm">Filtros</span>
        {(searchTerm || dateFrom || dateTo || minAmount || maxAmount) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
            Limpar Filtros
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2">
          <label className="text-xs text-gray-600 mb-1 block">Buscar (Nome/CPF/Telefone)</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Digite para buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Data Início</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Data Fim</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Valor Mínimo</label>
          <Input
            type="number"
            placeholder="R$ 0,00"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-600 mb-1 block">Valor Máximo</label>
          <Input
            type="number"
            placeholder="R$ 999,99"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="executions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="executions">
            <Play className="h-4 w-4 mr-2" />
            Execuções ({executions.length})
          </TabsTrigger>
          <TabsTrigger value="stock">
            <Package className="h-4 w-4 mr-2" />
            Lançamentos ({filteredStockMovements.length})
          </TabsTrigger>
          <TabsTrigger value="upsell">
            <TrendingUp className="h-4 w-4 mr-2" />
            Venda Casada ({filteredUpsellMessages.length})
          </TabsTrigger>
          <TabsTrigger value="reorder">
            <RefreshCw className="h-4 w-4 mr-2" />
            Recompra ({filteredReorderMessages.length})
          </TabsTrigger>
        </TabsList>

        {/* Aba de Execuções de Automação */}
        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Execuções de Automação</CardTitle>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma execução encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Automação</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Iniciado</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((execution) => (
                      <TableRow key={execution.id}>
                        <TableCell className="font-medium">
                          {execution.workflow?.name || 'Automação Deletada'}
                        </TableCell>
                        <TableCell>
                          {execution.client?.name || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(execution.status)}>
                            {getStatusIcon(execution.status)}
                            <span className="ml-1">{getStatusText(execution.status)}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDuration(execution.started_at, execution.completed_at)}
                        </TableCell>
                        <TableCell>
                          {new Date(execution.started_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedExecution(execution)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Detalhes
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Detalhes da Execução</DialogTitle>
                                <DialogDescription>
                                  Informações detalhadas sobre a execução da automação
                                </DialogDescription>
                              </DialogHeader>

                              {selectedExecution && (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="font-medium">Automação</h4>
                                      <p className="text-sm text-gray-600">
                                        {selectedExecution.workflow?.name || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <h4 className="font-medium">Status</h4>
                                      <Badge className={getStatusColor(selectedExecution.status)}>
                                        {getStatusText(selectedExecution.status)}
                                      </Badge>
                                    </div>
                                    <div>
                                      <h4 className="font-medium">Cliente</h4>
                                      <p className="text-sm text-gray-600">
                                        {selectedExecution.client?.name || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <h4 className="font-medium">Duração</h4>
                                      <p className="text-sm text-gray-600">
                                        {formatDuration(selectedExecution.started_at, selectedExecution.completed_at)}
                                      </p>
                                    </div>
                                  </div>

                                  {selectedExecution.error_message && (
                                    <div>
                                      <h4 className="font-medium text-red-600">Erro</h4>
                                      <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                        {selectedExecution.error_message}
                                      </p>
                                    </div>
                                  )}

                                  <div>
                                    <h4 className="font-medium">Dados do Gatilho</h4>
                                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                                      {JSON.stringify(selectedExecution.trigger_data, null, 2)}
                                    </pre>
                                  </div>

                                  <div>
                                    <h4 className="font-medium">Dados da Execução</h4>
                                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                                      {JSON.stringify(selectedExecution.execution_data, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Lançamentos de Estoque */}
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Lançamentos de Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <FilterSection />
              {filteredStockMovements.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum lançamento encontrado</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Transportadora</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Código de Rastreio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Produtos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStockMovements.map((movement) => {
                      const typeLabels = {
                        purchase: 'Compra',
                        transfer: 'Transferência',
                        return: 'Devolução'
                      };

                      const productCount = movement.type === 'purchase'
                        ? (movement as any).products?.length || 0
                        : movement.type === 'transfer'
                        ? (movement as any).products?.length || 0
                        : 0;

                      return (
                        <TableRow key={`${movement.type}-${movement.id}`}>
                          <TableCell>
                            <Badge variant="outline">
                              {typeLabels[movement.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(movement.date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{movement.carrier}</TableCell>
                          <TableCell>{movement.storeName}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {movement.trackingCode}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(movement.status)}>
                              {getStatusText(movement.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {productCount > 0 ? `${productCount} produto(s)` : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Mensagens de Venda Casada */}
        <TabsContent value="upsell">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Mensagens de Venda Casada</CardTitle>
            </CardHeader>
            <CardContent>
              <FilterSection />
              {filteredUpsellMessages.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma mensagem de venda casada encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Data do Pedido</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUpsellMessages.map((msg) => (
                      <TableRow key={msg.order_id}>
                        <TableCell className="font-medium">
                          #{msg.order_id}
                        </TableCell>
                        <TableCell>
                          {msg.client?.name || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {msg.client?.cpf || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {msg.client?.phone || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {new Date(msg.order_date).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {msg.total_amount
                            ? `R$ ${msg.total_amount.toFixed(2)}`
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(msg.mensagem_enviada ? 'sent' : 'pending')}>
                            {getStatusIcon(msg.mensagem_enviada ? 'sent' : 'pending')}
                            <span className="ml-1">
                              {msg.mensagem_enviada ? 'Enviada' : 'Não Enviada'}
                            </span>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Mensagens de Recompra */}
        <TabsContent value="reorder">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Mensagens de Recompra</CardTitle>
            </CardHeader>
            <CardContent>
              <FilterSection />
              {filteredReorderMessages.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma mensagem de recompra encontrada</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Data do Pedido</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReorderMessages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell className="font-medium">
                          #{msg.order_id}
                        </TableCell>
                        <TableCell>
                          {msg.client?.name || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {msg.client?.cpf || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {msg.client?.phone || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {msg.product_name || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {msg.sku || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {msg.order_date ? new Date(msg.order_date).toLocaleString('pt-BR') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {msg.total_amount
                            ? `R$ ${msg.total_amount.toFixed(2)}`
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(msg.mensagem_recompra ? 'sent' : 'pending')}>
                            {getStatusIcon(msg.mensagem_recompra ? 'sent' : 'pending')}
                            <span className="ml-1">
                              {msg.mensagem_recompra ? 'Enviada' : 'Não Enviada'}
                            </span>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
