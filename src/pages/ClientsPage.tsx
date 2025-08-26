import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye, UserPlus, Filter, Download, MoreHorizontal, Phone, Mail, Tag, CheckCircle, XCircle, User, Calendar, ArrowUpDown, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { RFMAnalysisCard } from '@/components/rfm/RFMAnalysisCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCrmStore } from '@/store/crmStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Importe o modal de detalhes do pedido e o tipo Order
import { OrderDetailsDialog } from '@/components/orders/OrderDetailsDialog'; // Ajuste o caminho se necessário
import { Order } from '@/types'; // Ajuste o caminho se necessário

type SortableKey = 'name' | 'status' | 'total_orders' | 'total_spent' | 'created_at';

export function ClientsPage() {
  const { clients, leads, fetchClients, fetchLeads, fetchClientRFMAnalysis, convertLeadToClient, fetchClientOrders } = useCrmStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  
  // --- Estados para a Paginação ---
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number | 'all'>(10);

  // Estados para a tabela de pedidos do cliente no modal
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchLeads();
  }, [fetchClients, fetchLeads]);

  const allContacts = useMemo(() => [
    ...leads.map(lead => ({ ...lead, type: 'lead', status: lead.status })),
    ...clients.map(client => ({ ...client, type: 'client', status: 'converted' }))
  ], [leads, clients]);

  const filteredContacts = useMemo(() => allContacts.filter(contact => {
    const matchesSearch =
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || contact.status === statusFilter;
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'leads' && contact.type === 'lead') ||
      (activeTab === 'clients' && contact.type === 'client');
    return matchesSearch && matchesStatus && matchesTab;
  }), [allContacts, searchTerm, statusFilter, activeTab]);

  const sortedContacts = useMemo(() => {
    const sortableItems = [...filteredContacts];
    if (sortConfig) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue == null) return 1;
        if (bValue == null) return -1;
        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            comparison = aValue - bValue;
        } else {
            comparison = String(aValue).localeCompare(String(bValue));
        }
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [filteredContacts, sortConfig]);
  
  // --- Lógica de Paginação ---
  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(sortedContacts.length / (rowsPerPage as number));

  const paginatedContacts = useMemo(() => {
    if (rowsPerPage === 'all') {
      return sortedContacts;
    }
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return sortedContacts.slice(startIndex, endIndex);
  }, [sortedContacts, page, rowsPerPage]);

  // Efeito para corrigir a página atual se ela se tornar inválida após uma filtragem
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages > 0 ? totalPages : 1);
    }
  }, [page, totalPages]);

  const requestSort = (key: SortableKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setPage(1); // Reseta para a primeira página ao reordenar
  };
  
  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(value === 'all' ? 'all' : Number(value));
    setPage(1); // Reseta para a primeira página ao mudar itens por página
  };

  const getSortIcon = (key: SortableKey) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
    }
    return <ArrowUpDown className="ml-2 h-4 w-4" />;
  };

  const handleViewContact = async (contact: any) => {
    setSelectedClient(contact);
    setClientOrders([]);
    if (contact.type === 'client') {
      setIsOrdersLoading(true);
      try {
        const [rfmData, ordersData] = await Promise.all([
          fetchClientRFMAnalysis ? fetchClientRFMAnalysis(contact.id) : Promise.resolve(null),
          fetchClientOrders(contact.id)
        ]);
        setSelectedClient({ ...contact, rfm_analysis: rfmData });
        setClientOrders(ordersData);
      } catch (error) {
        console.error('Erro ao buscar detalhes do cliente:', error);
      } finally {
        setIsOrdersLoading(false);
      }
    }
  };

  const handleConvertLead = async (leadId: string) => {
    try {
      await convertLeadToClient(leadId);
    } catch (error) {
      console.error('Error converting lead:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'contacted': return 'bg-amber-100 text-amber-800';
      case 'qualified': return 'bg-green-100 text-green-800';
      case 'converted': return 'bg-indigo-100 text-indigo-800';
      case 'lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new': return 'Novo';
      case 'contacted': return 'Contatado';
      case 'qualified': return 'Qualificado';
      case 'converted': return 'Cliente';
      case 'lost': return 'Perdido';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'converted': return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'lost': return <XCircle className="h-3 w-3 mr-1" />;
      default: return null;
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');
  
  const countOrderItems = (order: Order) => {
     if (Array.isArray(order.metadata)) {
         return order.metadata.reduce((sum, item) => sum + (item.quantidade_de_itens || 0), 0);
     }
     return 1;
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Clientes & Leads</h1>
              <p className="text-muted-foreground mt-1">Gerencie seus contatos e clientes potenciais</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Exportar</Button>
              <AddClientDialog />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><UserPlus className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{leads.filter(l => l.status === 'new').length}</div>
                    <div className="text-sm text-muted-foreground">Novos Leads</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center"><Phone className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <div className="text-2xl font-bold text-amber-600">{leads.filter(l => l.status === 'contacted').length}</div>
                    <div className="text-sm text-muted-foreground">Contatados</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{leads.filter(l => l.status === 'qualified').length}</div>
                    <div className="text-sm text-muted-foreground">Qualificados</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center"><User className="h-5 w-5 text-indigo-600" /></div>
                  <div>
                    <div className="text-2xl font-bold text-indigo-600">{clients.length}</div>
                    <div className="text-sm text-muted-foreground">Clientes</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="h-5 w-5 text-red-600" /></div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{leads.filter(l => l.status === 'lost').length}</div>
                    <div className="text-sm text-muted-foreground">Perdidos</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex flex-col gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="leads">Leads</TabsTrigger>
                  <TabsTrigger value="clients">Clientes</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input placeholder="Buscar por nome, email ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-[250px]" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setStatusFilter('all')}>Todos os Status</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter('new')}>Novos</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter('contacted')}>Contatados</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter('qualified')}>Qualificados</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter('converted')}>Clientes</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setStatusFilter('lost')}>Perdidos</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Tabs>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle>Contatos ({filteredContacts.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Button variant="ghost" onClick={() => requestSort('name')} className="-ml-4">Nome{getSortIcon('name')}</Button></TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead><Button variant="ghost" onClick={() => requestSort('status')} className="-ml-4">Status{getSortIcon('status')}</Button></TableHead>
                      <TableHead><Button variant="ghost" onClick={() => requestSort('total_orders')} className="-ml-4">Pedidos{getSortIcon('total_orders')}</Button></TableHead>
                      <TableHead><Button variant="ghost" onClick={() => requestSort('total_spent')} className="-ml-4">Total Gasto{getSortIcon('total_spent')}</Button></TableHead>
                      <TableHead><Button variant="ghost" onClick={() => requestSort('created_at')} className="-ml-4">Criado{getSortIcon('created_at')}</Button></TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedContacts.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="h-24 text-center">Nenhum contato encontrado.</TableCell></TableRow>
                    ) : (
                      paginatedContacts.map((contact) => (
                        <TableRow key={`${contact.type}-${contact.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className={contact.type === 'client' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}>{getInitials(contact.name)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{contact.name}</div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Badge variant={contact.type === 'client' ? 'default' : 'secondary'} className="text-xs">{contact.type === 'client' ? 'Cliente' : 'Lead'}</Badge>
                                  {contact.tags && contact.tags.length > 0 && (<Badge variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1" />{contact.tags[0]}{contact.tags.length > 1 && `+${contact.tags.length - 1}`}</Badge>)}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {contact.email && (<div className="flex items-center text-sm"><Mail className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><span>{contact.email}</span></div>)}
                              {contact.phone && (<div className="flex items-center text-sm"><Phone className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /><span>{contact.phone}</span></div>)}
                            </div>
                          </TableCell>
                          <TableCell><Badge className={getStatusColor(contact.status)}>{getStatusIcon(contact.status)}{getStatusText(contact.status)}</Badge></TableCell>
                          <TableCell>{contact.total_orders || 0}</TableCell>
                          <TableCell>R$ {(contact.total_spent || 0).toFixed(2)}</TableCell>
                          <TableCell>{new Date(contact.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Dialog>
                                <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => handleViewContact(contact)}><Eye className="h-4 w-4" /></Button></DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                  <DialogHeader><DialogTitle>{selectedClient?.name} - Detalhes do Contato</DialogTitle></DialogHeader>
                                  <div className="space-y-6 mt-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      <Card>
                                        <CardHeader><CardTitle className="text-base">Informações de Contato</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                          <div className="flex items-center gap-4">
                                            <Avatar className="h-16 w-16"><AvatarFallback className={selectedClient?.type === 'client' ? 'bg-indigo-100 text-indigo-600 text-xl' : 'bg-blue-100 text-blue-600 text-xl'}>{getInitials(selectedClient?.name || '')}</AvatarFallback></Avatar>
                                            <div>
                                              <h3 className="text-lg font-semibold">{selectedClient?.name}</h3>
                                              <Badge className={getStatusColor(selectedClient?.status || '')}>{getStatusIcon(selectedClient?.status || '')}{getStatusText(selectedClient?.status || '')}</Badge>
                                            </div>
                                          </div>
                                          <div className="space-y-2 pt-2">
                                            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span>{selectedClient?.email || 'Não informado'}</span></div>
                                            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span>{selectedClient?.phone || 'Não informado'}</span></div>
                                            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>Cliente desde: {selectedClient?.created_at ? new Date(selectedClient.created_at).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                      {selectedClient?.type === 'client' && (
                                        <Card>
                                          <CardHeader><CardTitle className="text-base">Resumo de Pedidos</CardTitle></CardHeader>
                                          <CardContent className="space-y-4">
                                            <div className="grid grid-cols-3 gap-4">
                                              <div className="bg-muted/50 p-3 rounded-lg text-center"><div className="text-2xl font-bold">{selectedClient?.total_orders || 0}</div><div className="text-sm text-muted-foreground">Pedidos</div></div>
                                              <div className="bg-muted/50 p-3 rounded-lg text-center"><div className="text-2xl font-bold">R$ {(selectedClient?.total_spent || 0).toFixed(2)}</div><div className="text-sm text-muted-foreground">Total Gasto</div></div>
                                              <div className="bg-muted/50 p-3 rounded-lg text-center"><div className="text-2xl font-bold">{selectedClient?.total_orders ? `R$ ${(selectedClient.total_spent / selectedClient.total_orders).toFixed(2)}` : 'R$ 0.00'}</div><div className="text-sm text-muted-foreground">Ticket Médio</div></div>
                                            </div>
                                            <div className="pt-2">
                                              <h4 className="text-sm font-medium mb-2">Último Pedido</h4>
                                              {selectedClient?.last_order_date ? (<div className="bg-muted/30 p-3 rounded-lg"><div className="flex justify-between items-center"><span className="text-sm">Data:</span><span className="text-sm font-medium">{new Date(selectedClient.last_order_date).toLocaleDateString('pt-BR')}</span></div></div>) : (<div className="text-sm text-muted-foreground">Nenhum pedido realizado</div>)}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      )}
                                    </div>
                                    {selectedClient?.rfm_analysis && (<RFMAnalysisCard analysis={selectedClient.rfm_analysis} />)}
                                    {selectedClient?.type === 'client' && (
                                      <Card>
                                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShoppingBag className="h-5 w-5" />Histórico de Pedidos</CardTitle></CardHeader>
                                        <CardContent>
                                          {isOrdersLoading ? (
                                            <div className="text-center p-8 text-muted-foreground">Carregando pedidos...</div>
                                          ) : clientOrders.length > 0 ? (
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead>ID Pedido</TableHead>
                                                  <TableHead>Data</TableHead>
                                                  <TableHead className="text-center">Itens</TableHead>
                                                  <TableHead className="text-right">Valor Total</TableHead>
                                                  <TableHead className="text-right">Ações</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {clientOrders.map((order) => (
                                                  <TableRow key={order.id}>
                                                    <TableCell className="font-mono text-xs">#{order.order_id_base || order.id.slice(0, 8)}</TableCell>
                                                    <TableCell>{formatDate(order.order_date)}</TableCell>
                                                    <TableCell className="text-center">{countOrderItems(order)}</TableCell>
                                                    <TableCell className="text-right font-medium">{formatCurrency(order.total_amount)}</TableCell>
                                                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => handleViewOrder(order)}><Eye className="h-4 w-4" /></Button></TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          ) : (
                                            <div className="text-center p-8 text-muted-foreground">Nenhum pedido encontrado para este cliente.</div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                              {contact.type === 'lead' && contact.status !== 'converted' && (<Button size="sm" onClick={() => handleConvertLead(contact.id)}><UserPlus className="h-4 w-4 mr-1" />Converter</Button>)}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Editar</DropdownMenuItem>
                                  <DropdownMenuItem>Enviar Mensagem</DropdownMenuItem>
                                  {contact.type === 'client' && (<DropdownMenuItem>Ver Pedidos</DropdownMenuItem>)}
                                  <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter>
              <div className="w-full flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Total de {sortedContacts.length} contatos.
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
      </div>
      <OrderDetailsDialog open={isOrderModalOpen} onOpenChange={setIsOrderModalOpen} order={selectedOrder} />
    </DashboardLayout>
  );
}