import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye, UserPlus, Filter, Download, MoreHorizontal, Phone, Mail, Tag, CheckCircle, XCircle, User, Calendar, ArrowUpDown, ShoppingBag } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { RFMAnalysisCard } from '@/components/rfm/RFMAnalysisCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCrmStore } from '@/store/crmStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Importe o modal de detalhes do pedido e o tipo Order
import { OrderDetailsDialog } from '@/components/orders/OrderDetailsDialog'; // Ajuste o caminho se necessário
import { Order } from '@/types'; // Ajuste o caminho se necessário

type SortableKey = 'name' | 'status' | 'total_orders' | 'total_spent' | 'created_at';

export function ClientsPage() {
  // Adicione a nova função fetchClientOrders da store
  const { clients, leads, fetchClients, fetchLeads, fetchClientRFMAnalysis, convertLeadToClient, fetchClientOrders } = useCrmStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  
  // --- Novos estados para a tabela de pedidos ---
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // ... (useEffect, allContacts, filteredContacts, sortedContacts, etc. continuam iguais) ...

  // Atualize a função handleViewContact para buscar os pedidos
  const handleViewContact = async (contact: any) => {
    // Reseta estados anteriores
    setSelectedClient(contact);
    setClientOrders([]);
    
    if (contact.type === 'client') {
      setIsOrdersLoading(true);
      try {
        // Busca RFM e Pedidos em paralelo para mais performance
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
  
  // --- Novas funções auxiliares ---
  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR');
  const countOrderItems = (order: Order) => {
     // Assumindo que a quantidade está em order.metadata (como no nosso exemplo anterior)
     if (Array.isArray(order.metadata)) {
         return order.metadata.reduce((sum, item) => sum + (item.quantidade_de_itens || 0), 0);
     }
     return 1; // Fallback
  };

  // Função para abrir o modal de detalhes do pedido
  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };

  // ... (o restante das funções como getStatusColor, getInitials, etc. continuam iguais) ...
  
  return (
    <DashboardLayout>
      {/* O JSX principal da página (tabela de clientes) permanece o mesmo */}
      <div className="w-full h-full">
        {/* ... */}
        {/* Contacts Table */}
        <Card>
          {/* ... CardHeader e TableHeader ... */}
          <TableBody>
            {sortedContacts.map((contact) => (
              <TableRow key={`${contact.type}-${contact.id}`}>
                {/* ... TableCells da lista de clientes ... */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewContact(contact)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      {/* --- AQUI ESTÁ O MODAL DO CLIENTE ATUALIZADO --- */}
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>{selectedClient?.name} - Detalhes do Contato</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6 mt-4">
                          {/* Card de Informações e Resumo de Pedidos */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           {/* ... Card de Informações do Contato ... */}
                           {/* ... Card de Resumo de Pedidos ... */}
                          </div>
                          
                          {/* Card de Análise RFM */}
                          {selectedClient?.rfm_analysis && (
                            <RFMAnalysisCard analysis={selectedClient.rfm_analysis} />
                          )}
                          
                          {/* --- NOVA SEÇÃO: HISTÓRICO DE PEDIDOS --- */}
                          {selectedClient?.type === 'client' && (
                            <Card>
                              <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                  <ShoppingBag className="h-5 w-5" />
                                  Histórico de Pedidos
                                </CardTitle>
                              </CardHeader>
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
                                          <TableCell className="text-right">
                                            <Button size="icon" variant="ghost" onClick={() => handleViewOrder(order)}>
                                              <Eye className="h-4 w-4" />
                                            </Button>
                                          </TableCell>
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
                    {/* ... Restante dos botões de ação ... */}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Card>
      </div>
      
      {/* Renderiza o modal de detalhes do PEDIDO fora do loop */}
      <OrderDetailsDialog
        open={isOrderModalOpen}
        onOpenChange={setIsOrderModalOpen}
        order={selectedOrder}
      />
    </DashboardLayout>
  );
}