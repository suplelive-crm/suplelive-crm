import { useState, useEffect, useMemo } from 'react';
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

const getItemStatusCategory = (item: Purchase | Return | Transfer): string => {
    const statusLower = (item.status || '').toLowerCase();
    
    const isFinalStatus = statusLower.includes('entregue') || statusLower.includes('conferido') || statusLower.includes('estoque');

    if (!isFinalStatus && item.estimated_delivery && new Date(item.estimated_delivery) < new Date()) {
        return 'Atrasado';
    }

    if (isFinalStatus) {
        return 'Entregue';
    }

    if (
        statusLower.includes('problema') ||
        statusLower.includes('não autorizada') ||
        statusLower.includes('necessidade de apresentar') ||
        statusLower.includes('complementar') ||
        statusLower.includes('extraviado') ||
        statusLower.includes('pausado')
    ) {
        return 'Pausado/Problema';
    }

    if (statusLower.includes('trânsito') || statusLower.includes('transferência')) {
        return 'Em trânsito';
    }

    if (statusLower.includes('aguardando') || statusLower.includes('aguarde')) {
        return 'Aguardando';
    }
    
    return 'Outro'; // Fallback
};

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
  // NOVO ESTADO: para busca de produtos
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
  
  // LÓGICA DE FILTRO ATUALIZADA: agora inclui a busca por produto
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
        const searchTermLower = searchTerm.toLowerCase();
        const productSearchTermLower = productSearchTerm.toLowerCase();

        // Filtro por termo geral (loja, cliente, rastreio, status)
        const generalSearchMatch =
            (purchase.storeName || '').toLowerCase().includes(searchTermLower) ||
            (purchase.customerName || '').toLowerCase().includes(searchTermLower) ||
            (purchase.trackingCode || '').toLowerCase().includes(searchTermLower) ||
            (purchase.status || '').toLowerCase().includes(searchTermLower);

        if (searchTermLower && !generalSearchMatch) return false;

        // NOVO FILTRO: por nome do produto
        const productMatch = productSearchTermLower
            ? (purchase.products || []).some(product => 
                (product.name || '').toLowerCase().includes(productSearchTermLower)
              )
            : true;

        if (!productMatch) return false;

        // Filtro por categoria de status
        if (statusFilter === 'all') return true;
        
        const category = getItemStatusCategory(purchase);
        return category === statusFilter;
    });
  }, [purchases, searchTerm, productSearchTerm, statusFilter]);


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
  
  // RENDERIZAÇÃO DA TABELA ATUALIZADA
  const renderTableView = () => {
    if (activeTab === 'purchases') {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Compras ({filteredPurchases.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Loja/Cliente</TableHead>
                    {/* COLUNA ALTERADA */}
                    <TableHead>Última Atualização</TableHead>
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
                      const isInInventory = purchase.status?.toLowerCase().includes('lançado no estoque') || false;
                      
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell>{new Date(purchase.date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{purchase.customer_name || 'Não informado'}</TableCell>
                           {/* CÉLULA DA COLUNA ALTERADA */}
                          <TableCell>
        {/* VERIFICA SE 'atualizado' EXISTE E É UMA STRING, DEPOIS SUBSTITUI O ESPAÇO POR 'T' */}
        {purchase.atualizado && typeof purchase.atualizado === 'string'
            ? new Date(purchase.atualizado.replace(' ', 'T')).toLocaleString('pt-BR', {
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit'
              })
            : 'Não informado'}
    </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>{purchase.trackingCode || 'Não informado'}</span>
                              {purchase.trackingCode && (
                                <a 
                                  href={getTrackingUrl(purchase.carrier, purchase.trackingCode)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {purchase.products?.length || 0} item(s)
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(purchase.status)}>
                              {purchase.status || 'Não informado'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {purchase.estimated_delivery 
                              ? new Date(purchase.estimated_delivery).toLocaleDateString('pt-BR')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewDetails(purchase)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {!allProductsVerified && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <CheckSquare className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmar Produto</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja marcar todos os produtos desta compra como conferidos?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => {
                                          if (purchase.products) {
                                            purchase.products.forEach(product => {
                                              handleVerifyProduct(purchase.id, product.id);
                                            });
                                          }
                                        }}
                                      >
                                        Confirmar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              
                              {allProductsVerified && !isInInventory && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="default" size="sm">
                                      <Database className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Lançar no Estoque</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja lançar todos os produtos desta compra no estoque? Esta ação irá arquivar a compra.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleAddToInventory(purchase.id, 'purchase')}
                                      >
                                        Confirmar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              
                              {allProductsVerified && (
                                <Badge className="bg-blue-100 text-blue-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Conferido
                                </Badge>
                              )}
                              
                              {isInInventory && (
                                <Badge className="bg-green-100 text-green-800">
                                  <Database className="h-3 w-3 mr-1" />
                                  No Estoque
                                </Badge>
                              )}
                            </div>
                          </TableCell>
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
                          <TableCell>{new Date(returnItem.date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{returnItem.customerName || 'Não informado'}</TableCell>
                          <TableCell>{returnItem.storeName || 'Não informado'}</TableCell>
                          <TableCell>{returnItem.carrier || 'Não informado'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>{returnItem.trackingCode || 'Não informado'}</span>
                              {returnItem.trackingCode && (
                                <a 
                                  href={getTrackingUrl(returnItem.carrier, returnItem.trackingCode)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(returnItem.status)}>
                              {returnItem.status || 'Não informado'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {returnItem.estimated_delivery 
                              ? new Date(returnItem.estimated_delivery).toLocaleDateString('pt-BR')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewDetails(returnItem)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {!isInInventory ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="default" size="sm">
                                      <Database className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Lançar no Estoque</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja lançar esta devolução no estoque? Esta ação irá arquivar a devolução.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleAddToInventory(returnItem.id, 'return')}
                                      >
                                        Confirmar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <Badge className="bg-green-100 text-green-800">
                                  <Database className="h-3 w-3 mr-1" />
                                  No Estoque
                                </Badge>
                              )}
                            </div>
                          </TableCell>
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
                          <TableCell>{new Date(transfer.date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{transfer.customerName || 'Não informado'}</TableCell>
                          <TableCell>{transfer.storeName || 'Não informado'}</TableCell>
                          <TableCell>{transfer.carrier || 'Não informado'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>{transfer.trackingCode || 'Não informado'}</span>
                              {transfer.trackingCode && (
                                <a 
                                  href={getTrackingUrl(transfer.carrier, transfer.trackingCode)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(transfer.status)}>
                              {transfer.status || 'Não informado'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {transfer.estimated_delivery 
                              ? new Date(transfer.estimated_delivery).toLocaleDateString('pt-BR')
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleViewDetails(transfer)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              
                              {!isInInventory ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="default" size="sm">
                                      <Database className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Lançar no Estoque</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja lançar esta transferência no estoque? Esta ação irá arquivar a transferência.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleAddToInventory(transfer.id, 'transfer')}
                                      >
                                        Confirmar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : (
                                <Badge className="bg-green-100 text-green-800">
                                  <Database className="h-3 w-3 mr-1" />
                                  No Estoque
                                </Badge>
                              )}
                            </div>
                          </TableCell>
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Acompanhamento</h1>
              <p className="text-gray-600 mt-2">Gerencie compras, devoluções e transferências</p>
            </div>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCreatePurchaseOpen(true)}>
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Nova Compra
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateReturnOpen(true)}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Nova Devolução
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateTransferOpen(true)}>
                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                    Nova Transferência
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* ... (cards de estatísticas sem alterações) ... */}
          </div>

          {/* ÁREA DE FILTROS ATUALIZADA */}
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
              
              {/* Grupo de buscas */}
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar rastreio..."
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
                 {/* NOVO CAMPO DE BUSCA POR PRODUTO (apenas na aba de compras) */}
                {activeTab === 'purchases' && (
                    <div className="relative w-48">
                        <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar produto..."
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                )}
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
      <CreatePurchaseDialog 
        open={createPurchaseOpen} 
        onOpenChange={setCreatePurchaseOpen} 
      />
      
      <CreateReturnDialog 
        open={createReturnOpen} 
        onOpenChange={setCreateReturnOpen} 
      />
      
      <CreateTransferDialog 
        open={createTransferOpen} 
        onOpenChange={setCreateTransferOpen} 
      />
      
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