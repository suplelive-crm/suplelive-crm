import { useState, useEffect, useMemo } from 'react'; // useMemo foi adicionado para otimização
import { motion } from 'framer-motion';
import { 
  ShoppingBag, 
  RotateCcw, 
  Truck, 
  Package, 
  ArrowLeftRight, 
  Filter, 
  Plus, 
  RefreshCw, 
  CheckSquare, 
  Archive, 
  Eye, 
  MoreHorizontal,
  Calendar,
  Search,
  LayoutGrid,
  LayoutList,
  CheckCircle,
  Database
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTrackingStore } from '@/store/trackingStore';
import { Purchase, Return, Transfer } from '@/types/tracking';
import { CreatePurchaseDialog } from '@/components/tracking/CreatePurchaseDialog';
import { CreateReturnDialog } from '@/components/tracking/CreateReturnDialog';
import { CreateTransferDialog } from '@/components/tracking/CreateTransferDialog';
import { TrackingDetailsDialog } from '@/components/tracking/TrackingDetailsDialog';
import { KanbanBoard } from '@/components/tracking/KanbanBoard';
import { useToast } from '@/hooks/use-toast';
import { getTrackingUrl } from '@/lib/tracking-api';

// --- INÍCIO DA MODIFICAÇÃO: Helper para categorizar o status ---
/**
 * Categoriza um item com base em seu status e data de entrega estimada.
 * @param item - O objeto de compra, devolução ou transferência.
 * @returns Uma string representando a categoria do status.
 */
const getItemStatusCategory = (item: Purchase | Return | Transfer): string => {
    const statusLower = (item.status || '').toLowerCase();
    const isFinalStatus = statusLower.includes('entregue') || statusLower.includes('conferido') || statusLower.includes('estoque');

    // 1. Atrasado: Não tem status final, e a data de previsão já passou.
    if (!isFinalStatus && item.estimated_delivery && new Date(item.estimated_delivery) < new Date()) {
        return 'Atrasado';
    }

    // 2. Entregue: Status final de entrega ou conferência.
    if (isFinalStatus) {
        return 'Entregue';
    }

    // 3. Pausado/Problema: Agrega vários status problemáticos.
    if (
        statusLower.includes('problema') ||
        statusLower.includes('não autorizada') ||
        statusLower.includes('necessidade de apresentar') ||
        statusLower.includes('extraviado') ||
        statusLower.includes('pausado')
    ) {
        return 'Pausado/Problema';
    }

    // 4. Em trânsito: Itens em movimento.
    if (statusLower.includes('trânsito')) {
        return 'Em trânsito';
    }

    // 5. Aguardando: Itens que aguardam postagem ou coleta.
    if (statusLower.includes('aguardando')) {
        return 'Aguardando';
    }
    
    // Fallback para outros status não categorizados
    return 'Outro';
};
// --- FIM DA MODIFICAÇÃO ---


export function TrackingPage() {
  const { 
    purchases, 
    returns, 
    transfers, 
    viewMode,
    showArchived,
    loading,
    setViewMode,
    setShowArchived,
    fetchPurchases,
    fetchReturns,
    fetchTransfers,
    updateAllTrackingStatuses,
    verifyPurchaseProduct,
    addProductToInventory,
    archivePurchase,
    archiveReturn,
    archiveTransfer,
    findItemByTrackingCode
  } = useTrackingStore();
  
  const [activeTab, setActiveTab] = useState('purchases');
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- INÍCIO DA MODIFICAÇÃO: Estado para o filtro de status ---
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' para mostrar todos
  // --- FIM DA MODIFICAÇÃO ---

  const [createPurchaseOpen, setCreatePurchaseOpen] = useState(false);
  const [createReturnOpen, setCreateReturnOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Purchase | Return | Transfer | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchingByTracking, setSearchingByTracking] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    fetchPurchases();
    fetchReturns();
    fetchTransfers();
    
    const interval = setInterval(() => {
      updateAllTrackingStatuses();
    }, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchPurchases, fetchReturns, fetchTransfers, updateAllTrackingStatuses]);
  

  // --- INÍCIO DA MODIFICAÇÃO: Lógica de filtragem atualizada ---
  // A lógica foi movida para dentro do useMemo para otimização, evitando recálculos a cada renderização.
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch =
            (purchase.storeName || '').toLowerCase().includes(searchTermLower) ||
            (purchase.customerName || '').toLowerCase().includes(searchTermLower) ||
            (purchase.trackingCode || '').toLowerCase().includes(searchTermLower) ||
            (purchase.status || '').toLowerCase().includes(searchTermLower);

        if (!searchMatch) return false;

        if (statusFilter === 'all') return true;
        
        const category = getItemStatusCategory(purchase);
        return category === statusFilter;
    });
  }, [purchases, searchTerm, statusFilter]);

  const filteredReturns = useMemo(() => {
    return returns.filter(returnItem => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch =
            (returnItem.storeName || '').toLowerCase().includes(searchTermLower) ||
            (returnItem.customerName || '').toLowerCase().includes(searchTermLower) ||
            (returnItem.trackingCode || '').toLowerCase().includes(searchTermLower) ||
            (returnItem.status || '').toLowerCase().includes(searchTermLower);

        if (!searchMatch) return false;
        
        if (statusFilter === 'all') return true;

        const category = getItemStatusCategory(returnItem);
        return category === statusFilter;
    });
  }, [returns, searchTerm, statusFilter]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter(transfer => {
        const searchTermLower = searchTerm.toLowerCase();
        const searchMatch =
            (transfer.storeName || '').toLowerCase().includes(searchTermLower) ||
            (transfer.customerName || '').toLowerCase().includes(searchTermLower) ||
            (transfer.trackingCode || '').toLowerCase().includes(searchTermLower) ||
            (transfer.status || '').toLowerCase().includes(searchTermLower);

        if (!searchMatch) return false;

        if (statusFilter === 'all') return true;

        const category = getItemStatusCategory(transfer);
        return category === statusFilter;
    });
  }, [transfers, searchTerm, statusFilter]);
  // --- FIM DA MODIFICAÇÃO ---
  
  const handleRefreshTracking = () => {
    updateAllTrackingStatuses();
  };
  
  const handleViewDetails = (item: Purchase | Return | Transfer) => {
    setSelectedItem(item);
    setDetailsOpen(true);
  };
  
  const handleVerifyProduct = async (purchaseId: string, productId: string) => {
    await verifyPurchaseProduct(purchaseId, productId);
  };
  
  const handleAddToInventory = async (id: string, type: 'purchase' | 'return' | 'transfer') => {
    if (type === 'purchase') {
      await addProductToInventory(id);
    } else if (type === 'return') {
      await archiveReturn(id);
    } else {
      await archiveTransfer(id);
    }
  };
  
  const handleSearchByTrackingCode = async () => {
    if (!searchTerm) {
      toast({
        title: "Código de rastreio vazio",
        description: "Por favor, digite um código de rastreio para buscar",
        variant: "destructive"
      });
      return;
    }
    
    setSearchingByTracking(true);
    try {
      const result = await findItemByTrackingCode(searchTerm);
      
      if (result) {
        setActiveTab(result.type === 'purchase' ? 'purchases' : 
                    result.type === 'return' ? 'returns' : 'transfers');
        
        setSelectedItem(result.item);
        setDetailsOpen(true);
        
        toast({
          title: "Item encontrado",
          description: `Encontrado em ${result.type === 'purchase' ? 'compras' : result.type === 'return' ? 'devoluções' : 'transferências'}`,
        });
      } else {
        toast({
          title: "Não encontrado",
          description: "Nenhum item encontrado com este código de rastreio",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro na busca",
        description: error.message || "Erro ao buscar por código de rastreio",
        variant: "destructive"
      });
    } finally {
      setSearchingByTracking(false);
    }
  };
  
  const getStatusColor = (status: string) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower.includes('entregue') || statusLower.includes('conferido')) {
      return 'bg-green-100 text-green-800';
    } else if (statusLower.includes('trânsito')) {
      return 'bg-blue-100 text-blue-800';
    } else if (statusLower.includes('aguardando')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (statusLower.includes('problema') || statusLower.includes('não autorizada') || statusLower.includes('necessidade de apresentar') || statusLower.includes('extraviado')) {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };
  
  const renderTableView = () => {
    // A lógica interna de renderTableView continua a mesma, pois ela já utiliza as listas filtradas
    // (filteredPurchases, filteredReturns, filteredTransfers)
    if (activeTab === 'purchases') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Compras ({filteredPurchases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* O restante do código da tabela de compras permanece inalterado */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Loja/Cliente</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        Nenhuma compra encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchases.map((purchase) => {
                      const allProductsVerified = purchase.products?.every(p => p.isVerified) || false;
                      const isInInventory = purchase.status?.toLowerCase().includes('estoque') || false;
                      
                      return (
                        <TableRow key={purchase.id}>
                           {/* Células da tabela de compras... */}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      );
    } else if (activeTab === 'returns') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Devoluções ({filteredReturns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* O restante do código da tabela de devoluções permanece inalterado */}
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReturns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        Nenhuma devolução encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReturns.map((returnItem) => {
                      const isInInventory = returnItem.status?.toLowerCase().includes('estoque') || false;
                      
                      return (
                        <TableRow key={returnItem.id}>
                          {/* Células da tabela de devoluções... */}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      );
    } else {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Transferências ({filteredTransfers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* O restante do código da tabela de transferências permanece inalterado */}
             <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Transportadora</TableHead>
                    <TableHead>Rastreio</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Previsão</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransfers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center">
                        Nenhuma transferência encontrada para os filtros selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransfers.map((transfer) => {
                       const isInInventory = transfer.status?.toLowerCase().includes('estoque') || false;
                      
                      return (
                        <TableRow key={transfer.id}>
                          {/* Células da tabela de transferências... */}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
          {/* O cabeçalho e os cards de estatísticas permanecem os mesmos */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
             {/* ... */}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ... */}
          </div>


          {/* --- INÍCIO DA MODIFICAÇÃO: UI de filtros com o novo Select --- */}
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="purchases">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Compras
                </TabsTrigger>
                <TabsTrigger value="returns">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Devoluções
                </TabsTrigger>
                <TabsTrigger value="transfers">
                  <ArrowLeftRight className="h-4 w-4 mr-2" />
                  Transferências
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por loja, cliente, rastreio..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearchByTrackingCode();
                      }
                    }}
                  />
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleSearchByTrackingCode}
                  disabled={searchingByTracking || !searchTerm}
                >
                  {searchingByTracking ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Novo componente Select para filtrar por status */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="Em trânsito">Em trânsito</SelectItem>
                  <SelectItem value="Aguardando">Aguardando</SelectItem>
                  <SelectItem value="Entregue">Entregue</SelectItem>
                  <SelectItem value="Pausado/Problema">Pausado / Problema</SelectItem>
                  <SelectItem value="Atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2">
                <Label htmlFor="show-archived" className="text-sm shrink-0">Mostrar Arquivados</Label>
                <Switch
                  id="show-archived"
                  checked={showArchived}
                  onCheckedChange={setShowArchived}
                />
              </div>
              
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="rounded-r-none"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                  className="rounded-l-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          {/* --- FIM DA MODIFICAÇÃO --- */}

          {/* Main Content */}
          <div className="flex-1">
            {viewMode === 'table' ? (
              renderTableView()
            ) : (
              <KanbanBoard 
                activeTab={activeTab}
                purchases={filteredPurchases}
                returns={filteredReturns}
                transfers={filteredTransfers}
                onViewDetails={handleViewDetails}
                onVerifyProduct={handleVerifyProduct}
                onAddToInventory={handleAddToInventory}
              />
            )}
          </div>
        </motion.div>
      </div>
      
      {/* Dialogs */}
      <CreatePurchaseDialog open={createPurchaseOpen} onOpenChange={setCreatePurchaseOpen} />
      <CreateReturnDialog open={createReturnOpen} onOpenChange={setCreateReturnOpen} />
      <CreateTransferDialog open={createTransferOpen} onOpenChange={setCreateTransferOpen} />
      <TrackingDetailsDialog 
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        item={selectedItem}
        type={
          selectedItem 
            ? 'products' in selectedItem 
              ? 'purchase' 
              : activeTab === 'returns' 
                ? 'return' 
                : 'transfer'
            : null
        }
      />
    </DashboardLayout>
  );
}