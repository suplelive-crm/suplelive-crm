import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowUp, ArrowDown, ExternalLink, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AddOrderDialog } from '@/components/orders/AddOrderDialog';
import { OrderDetailsDialog } from '@/components/orders/OrderDetailsDialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useCrmStore } from '@/store/crmStore';
import { Order } from '@/types';

export function OrdersPage() {
  const { orders, fetchOrders, deleteOrders } = useCrmStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'order_date', direction: 'descending' });
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(10);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (!order || !order.client) return false;
      const matchesSearch = order.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            order.total_amount.toString().includes(searchTerm) ||
                            (order.order_id_base && order.order_id_base.toString().includes(searchTerm)) ||
                            order.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, part) => acc && acc[part], obj);
        const aValue = getNestedValue(a, sortConfig.key);
        const bValue = getNestedValue(b, sortConfig.key);
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredOrders, sortConfig]);

  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(sortedOrders.length / (rowsPerPage as number));
  const paginatedOrders = useMemo(() => {
    if (rowsPerPage === 'all') return sortedOrders;
    const startIndex = (page - 1) * (rowsPerPage as number);
    const endIndex = startIndex + (rowsPerPage as number);
    return sortedOrders.slice(startIndex, endIndex);
  }, [sortedOrders, page, rowsPerPage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages > 0 ? totalPages : 1);
  }, [page, totalPages]);

  // Clear selection when page, filters, or sort changes
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [page, searchTerm, statusFilter, sortConfig]);

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setPage(1);
  };
  
  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(value === 'all' ? 'all' : Number(value));
    setPage(1);
  };

  const getSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="inline-block ml-1 h-4 w-4" /> : <ArrowDown className="inline-block ml-1 h-4 w-4" />;
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailsOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(paginatedOrders.map(order => order.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(prev => [...prev, orderId]);
    } else {
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedOrderIds.length === 0) return;

    const confirmed = window.confirm(`Tem certeza que deseja excluir ${selectedOrderIds.length} pedido(s)?`);
    if (!confirmed) return;

    await deleteOrders(selectedOrderIds);
    setSelectedOrderIds([]);
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'Pendente', className: 'bg-yellow-100 text-yellow-800' };
      case 'completed': return { text: 'Concluído', className: 'bg-green-100 text-green-800' };
      case 'cancelled': return { text: 'Cancelado', className: 'bg-red-100 text-red-800' };
      default: return { text: status, className: 'bg-gray-100 text-gray-800' };
    }
  };

  const totalRevenue = orders
    .filter(order => order.status === 'completed')
    .reduce((sum, order) => sum + order.total_amount, 0);

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
              <p className="text-gray-600 mt-2">Acompanhe os pedidos e vendas dos clientes</p>
            </div>
            <AddOrderDialog />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'pending').length}</div>
                <div className="text-sm text-gray-600">Pedidos Pendentes</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'completed').length}</div>
                <div className="text-sm text-gray-600">Pedidos Concluídos</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalRevenue)}</div>
                <div className="text-sm text-gray-600">Receita Total</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(orders.length > 0 ? (totalRevenue / orders.filter(o => o.status === 'completed').length || 1) : 0)}</div>
                <div className="text-sm text-gray-600">Ticket Médio</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Busca & Filtros</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input placeholder="Buscar pedidos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant={statusFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('all')}>Todos</Button>
                  <Button variant={statusFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('pending')}>Pendentes</Button>
                  <Button variant={statusFilter === 'completed' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('completed')}>Concluídos</Button>
                  <Button variant={statusFilter === 'cancelled' ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter('cancelled')}>Cancelados</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Todos os Pedidos ({sortedOrders.length})</CardTitle>
                {selectedOrderIds.length > 0 && (
                  <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir {selectedOrderIds.length} selecionado(s)
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className='p-0'>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={paginatedOrders.length > 0 && selectedOrderIds.length === paginatedOrders.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead onClick={() => requestSort('order_id_base')} className="cursor-pointer hover:bg-gray-100">ID do Pedido{getSortIcon('order_id_base')}</TableHead>
                      <TableHead onClick={() => requestSort('client.name')} className="cursor-pointer hover:bg-gray-100">Cliente{getSortIcon('client.name')}</TableHead>
                      <TableHead onClick={() => requestSort('total_amount')} className="cursor-pointer hover:bg-gray-100">Valor{getSortIcon('total_amount')}</TableHead>
                      <TableHead onClick={() => requestSort('status')} className="cursor-pointer hover:bg-gray-100">Status{getSortIcon('status')}</TableHead>
                      <TableHead onClick={() => requestSort('order_date')} className="cursor-pointer hover:bg-gray-100">Data{getSortIcon('order_date')}</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order) => {
                      const statusInfo = getStatusInfo(order.status);
                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedOrderIds.includes(order.id)}
                              onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {order.order_id_base ? (
                              <a href={`https://panel-u.baselinker.com/orders.php#order:${order.order_id_base}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline">
                                #{order.order_id_base}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span>#{order.id.slice(0, 8)}</span>
                            )}
                          </TableCell>
                          <TableCell>{order.client?.name || 'Cliente Desconhecido'}</TableCell>
                          <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                          <TableCell><Badge className={statusInfo.className}>{statusInfo.text}</Badge></TableCell>
                          <TableCell>{new Date(order.order_date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline">Editar</Button>
                              <Button size="sm" variant="outline" onClick={() => handleViewOrder(order)}>Ver</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter>
              <div className="w-full flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Total de {sortedOrders.length} pedidos.
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Itens por página:</span>
                    <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
                      <SelectTrigger className="w-[80px]"><SelectValue placeholder={rowsPerPage} /></SelectTrigger>
                      <SelectContent>
                        {[10, 20, 50, 100, 200].map(size => (<SelectItem key={size} value={String(size)}>{size}</SelectItem>))}
                        <SelectItem value="all">Todos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm font-medium">
                    Página {page} de {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
        
        <OrderDetailsDialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen} order={selectedOrder} />
      </div>
    </DashboardLayout>
  );
}