import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
// Adicionando 'Pencil' e 'Trash2' para os ícones
import {
  ShoppingBag, RotateCcw, Truck, Package, ArrowLeftRight, Filter, Plus,
  RefreshCw, CheckSquare, Archive, Eye, MoreHorizontal, Calendar, Search,
  LayoutGrid, LayoutList, CheckCircle, Database, ArrowUpDown, ChevronLeft,
  ChevronRight, ChevronsLeft, ChevronsRight, Pencil, Trash2
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTrackingStore } from '@/store/trackingStore';
import { Purchase, Return, Transfer } from '@/types/tracking';
import { CreatePurchaseDialog } from '@/components/tracking/CreatePurchaseDialog';
import { EditPurchaseDialog } from '@/components/tracking/EditPurchaseDialog';
import { CreateReturnDialog } from '@/components/tracking/CreateReturnDialog';
import { CreateTransferDialog } from '@/components/tracking/CreateTransferDialog';
import { TrackingDetailsDialog } from '@/components/tracking/TrackingDetailsDialog';
import { KanbanBoard } from '@/components/tracking/KanbanBoard';
import { useToast } from '@/hooks/use-toast';
import { getTrackingUrl } from '@/lib/tracking-api';

// #region Funções de Helper
const getItemStatusCategory = (item: Purchase | Return | Transfer): string => {
  const statusLower = (item.status || '').toLowerCase();
  if (
    statusLower.includes('problema') ||
    statusLower.includes('não autorizada') ||
    statusLower.includes('necessidade de apresentar') ||
    statusLower.includes('complementar') ||
    statusLower.includes('extraviado') ||
    statusLower.includes('pausado') ||
    statusLower.includes('não entregue - carteiro não atendido')
  ) {
    return 'Pausado/Problema';
  }
  const isFinalStatus = statusLower.includes('entregue') || statusLower.includes('conferido') || statusLower.includes('estoque');
  if (isFinalStatus) {
    return 'Entregue';
  }
  if (item.estimated_delivery && new Date(item.estimated_delivery) < new Date()) {
    return 'Atrasado';
  }
  if (statusLower.includes('trânsito') || statusLower.includes('transferência') || statusLower.includes('saiu para entrega')) {
    return 'Em trânsito';
  }
  if (statusLower.includes('aguardando') || statusLower.includes('aguarde')) {
    return 'Aguardando';
  }
  return 'Outro';
};


const getStatusColor = (status: string) => {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('saiu para entrega')) {
    return 'bg-[#4169E1] text-white';
  } else if (statusLower.includes('entregue') || statusLower.includes('conferido')) {
    return 'bg-green-100 text-green-800';
  } else if (statusLower.includes('trânsito')) {
    return 'bg-blue-100 text-blue-800';
  } else if (statusLower.includes('aguardando')) {
    return 'bg-yellow-100 text-yellow-800';
  } else if (statusLower.includes('problema') || statusLower.includes('não autorizada') || statusLower.includes('necessidade de apresentar') || statusLower.includes('extraviado') || statusLower.includes('não entregue - carteiro não atendido')) {
    return 'bg-red-100 text-red-800';
  } else {
    return 'bg-gray-100 text-gray-800';
  }
};
// #endregion

// #region Hook customizado para lógica da tabela
type SortDirection = 'ascending' | 'descending';
type GenericItem = Purchase | Return | Transfer;

function useTable(data: GenericItem[], defaultSortKey: keyof GenericItem, defaultRowsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);
  const [sortConfig, setSortConfig] = useState<{ key: keyof GenericItem; direction: SortDirection }>({
    key: defaultSortKey,
    direction: 'descending',
  });

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (sortConfig.key === 'products') {
          const aLen = (a as Purchase).products?.length || 0;
          const bLen = (b as Purchase).products?.length || 0;
          if (aLen < bLen) return sortConfig.direction === 'ascending' ? -1 : 1;
          if (aLen > bLen) return sortConfig.direction === 'ascending' ? 1 : -1;
          return 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const totalRows = sortedData.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const requestSort = (key: keyof GenericItem) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const changeRowsPerPage = (newSize: number) => {
    setRowsPerPage(newSize);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
    setSortConfig({ key: defaultSortKey, direction: 'descending' });
  }, [data, defaultSortKey]);

  return { paginatedData, requestSort, sortConfig, currentPage, totalPages, changePage, rowsPerPage, changeRowsPerPage, totalRows };
}
// #endregion

export function TrackingPage() {
  const {
    purchases, returns, transfers, viewMode, showArchived, loading,
    setViewMode, setShowArchived, fetchPurchases, fetchReturns, fetchTransfers,
    updateAllTrackingStatuses, verifyPurchaseProduct, addProductToInventory,
    archivePurchase, archiveReturn, archiveTransfer, findItemByTrackingCode,
    deletePurchase
  } = useTrackingStore();

  const [activeTab, setActiveTab] = useState('purchases');
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createPurchaseOpen, setCreatePurchaseOpen] = useState(false);
  const [createReturnOpen, setCreateReturnOpen] = useState(false);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<GenericItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchingByTracking, setSearchingByTracking] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState<'purchase' | 'return' | 'transfer' | null>(null);

  // Estados para o diálogo de EDIÇÃO
  const [isEditPurchaseOpen, setIsEditPurchaseOpen] = useState(false);
  const [purchaseToEdit, setPurchaseToEdit] = useState<Purchase | null>(null);

  // Estado para o diálogo de DELEÇÃO
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    fetchPurchases();
    fetchReturns();
    fetchTransfers();
    const interval = setInterval(() => { updateAllTrackingStatuses(); }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPurchases, fetchReturns, fetchTransfers, updateAllTrackingStatuses]);

  const filteredData = useMemo(() => {
    let dataToFilter: GenericItem[] = [];
    if (activeTab === 'purchases') dataToFilter = purchases;
    if (activeTab === 'returns') dataToFilter = returns;
    if (activeTab === 'transfers') dataToFilter = transfers;

    return dataToFilter.filter(item => {
      const searchTermLower = searchTerm.toLowerCase();
      const productSearchTermLower = productSearchTerm.toLowerCase();
      const generalSearchMatch =
        (item.storeName || '').toLowerCase().includes(searchTermLower) ||
        (item.customer_name || '').toLowerCase().includes(searchTermLower) ||
        (item.trackingCode || '').toLowerCase().includes(searchTermLower) ||
        (item.status || '').toLowerCase().includes(searchTermLower);

      if (searchTermLower && !generalSearchMatch) return false;

      if (activeTab === 'purchases' && productSearchTermLower) {
        const productMatch = ((item as Purchase).products || []).some(p => (p.name || '').toLowerCase().includes(productSearchTermLower));
        if (!productMatch) return false;
      }

      if (statusFilter === 'all') return true;
      const category = getItemStatusCategory(item);
      return category === statusFilter;
    });
  }, [purchases, returns, transfers, activeTab, searchTerm, productSearchTerm, statusFilter]);

  const {
    paginatedData, requestSort, sortConfig, currentPage, totalPages, changePage,
    rowsPerPage, changeRowsPerPage, totalRows
  } = useTable(filteredData, 'date');

  const handleRefreshTracking = () => updateAllTrackingStatuses();
  
  const handleRunAutomation = async () => {
    try {
      await updateAllTrackingStatuses();
    } catch (error) {
      console.error('Error running tracking automation:', error);
    }
  };
  const handleViewDetails = (item: GenericItem) => { 
    setSelectedItem(item); 
    // Determinar o tipo baseado na presença de propriedades específicas
    if ('products' in item) {
      setSelectedItemType('purchase');
    } else if (activeTab === 'returns') {
      setSelectedItemType('return');
    } else {
      setSelectedItemType('transfer');
    }
    setDetailsOpen(true); 
  };

  // Função para abrir o diálogo de EDIÇÃO
  const handleEditPurchase = (purchase: Purchase) => {
    setPurchaseToEdit(purchase);
    setIsEditPurchaseOpen(true);
  };

  // Função para confirmar e executar a DELEÇÃO
  const handleDeletePurchaseConfirm = async () => {
    if (!purchaseToDelete) return;
    try {
      await deletePurchase(purchaseToDelete.id);
    } catch (error) {
      console.error("Falha ao deletar o pedido:", error);
    } finally {
      setPurchaseToDelete(null); 
    }
  };

  const handleVerifyReturn = async (returnId: string, observations?: string) => {
    // Esta função será implementada no store se necessário
    console.log('Verify return:', returnId, observations);
  };

  const handleVerifyProduct = async (purchaseId: string, productId: string) => await verifyPurchaseProduct(purchaseId, productId);
  const handleAddToInventory = async (id: string, type: 'purchase' | 'return' | 'transfer') => {
    if (type === 'purchase') await addProductToInventory(id);
    else if (type === 'return') await archiveReturn(id);
    else await archiveTransfer(id);
  };

  const handleSearchByTrackingCode = async () => {
    if (!searchTerm) {
      toast({ title: "Código de rastreio vazio", description: "Por favor, digite um código de rastreio para buscar", variant: "destructive" });
      return;
    }
    setSearchingByTracking(true);
    try {
      const result = await findItemByTrackingCode(searchTerm);
      if (result) {
        const typeMap = { purchase: 'purchases', return: 'returns', transfer: 'transfers' };
        setActiveTab(typeMap[result.type] || 'purchases');
        setSelectedItem(result.item);
        setDetailsOpen(true);
        toast({ title: "Item encontrado", description: `Encontrado em ${typeMap[result.type]}` });
      } else {
        toast({ title: "Não encontrado", description: "Nenhum item encontrado com este código de rastreio", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Erro na busca", description: error.message || "Erro ao buscar por código de rastreio", variant: "destructive" });
    } finally {
      setSearchingByTracking(false);
    }
  };

  const SortableHeader = ({ tKey, label }: { tKey: keyof GenericItem; label: string }) => (
    <TableHead>
      <Button variant="ghost" onClick={() => requestSort(tKey)} className="px-2">
        {label}
        <ArrowUpDown className={`ml-2 h-4 w-4 ${sortConfig.key === tKey ? 'text-foreground' : 'text-muted-foreground'}`} />
      </Button>
    </TableHead>
  );

  const renderTableView = () => {
    const tableHeaders = {
      purchases: [
        { key: 'date', label: 'Data' }, { key: 'customerName', label: 'Loja/Cliente' }, { key: 'trackingCode', label: 'Rastreio' },
        { key: 'products', label: 'Produtos' }, { key: 'status', label: 'Status' }, { key: 'updated_at', label: 'Última Atualização' },
        { key: 'estimated_delivery', label: 'Previsão' }
      ],
      returns: [
        { key: 'date', label: 'Data' }, { key: 'customerName', label: 'Cliente' }, { key: 'storeName', label: 'Loja' },
        { key: 'carrier', label: 'Transportadora' }, { key: 'trackingCode', label: 'Rastreio' }, { key: 'status', label: 'Status' },
        { key: 'estimated_delivery', label: 'Previsão' }, { key: 'observations', label: 'Observações' }, { key: 'is_verified', label: 'Conferido' }
      ],
      transfers: [
        { key: 'date', label: 'Data' }, { key: 'customerName', label: 'Cliente' }, { key: 'storeName', label: 'Loja' },
        { key: 'carrier', label: 'Transportadora' }, { key: 'trackingCode', label: 'Rastreio' }, { key: 'status', label: 'Status' },
        { key: 'estimated_delivery', label: 'Previsão' }, { key: 'observations', label: 'Observações' }, { key: 'is_verified', label: 'Conferido' }
      ]
    };
    const currentHeaders = tableHeaders[activeTab as keyof typeof tableHeaders] || [];

    return (
      <Card>
        <CardHeader>
          <CardTitle>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} ({filteredData.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {currentHeaders.map(h => <SortableHeader key={String(h.key)} tKey={h.key as keyof GenericItem} label={h.label} />)}
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={currentHeaders.length + 1} className="h-24 text-center">
                      Nenhum item encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map(item => {
                    if (activeTab === 'purchases') {
                      const purchase = item as Purchase;
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell>{new Date(purchase.date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{purchase.customer_name || 'Não informado'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>{purchase.trackingCode || 'Não informado'}</span>
                              {purchase.trackingCode && <a href={getTrackingUrl(purchase.carrier, purchase.trackingCode)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg></a>}
                            </div>
                          </TableCell>
                          <TableCell>{purchase.products?.length || 0} item(s)</TableCell>
                          <TableCell><Badge className={getStatusColor(purchase.status)}>{purchase.status || 'Não informado'}</Badge></TableCell>
                          <TableCell>{purchase.updated_at ? new Date(purchase.updated_at).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                          <TableCell>{purchase.estimated_delivery ? new Date(purchase.estimated_delivery).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {/* BOTÃO DE EDIÇÃO REATIVADO */}
                              <Button variant="outline" size="sm" onClick={() => handleEditPurchase(purchase)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(purchase)}><Eye className="h-4 w-4" /></Button>
                              
                              <Button variant="destructive" size="sm" onClick={() => setPurchaseToDelete(purchase)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    } else if (activeTab === 'returns') {
                      const returnItem = item as Return;
                      return (
                        <TableRow key={returnItem.id}>
                          <TableCell>{new Date(returnItem.date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{returnItem.customer_name || 'Não informado'}</TableCell>
                          <TableCell>{returnItem.storeName || 'Não informado'}</TableCell>
                          <TableCell>{returnItem.carrier || 'Não informado'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>{returnItem.trackingCode || 'Não informado'}</span>
                              {returnItem.trackingCode && <a href={getTrackingUrl(returnItem.carrier, returnItem.trackingCode)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg></a>}
                            </div>
                          </TableCell>
                          <TableCell><Badge className={getStatusColor(returnItem.status)}>{returnItem.status || 'Não informado'}</Badge></TableCell>
                          <TableCell>{returnItem.estimated_delivery ? new Date(returnItem.estimated_delivery).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                          <TableCell>
                            <div className="max-w-xs truncate">
                              {returnItem.observations || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {returnItem.is_verified ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sim
                              </Badge>
                            ) : (
                              <Badge variant="outline">Não</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(returnItem)}><Eye className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    } else if (activeTab === 'transfers') {
                      const transfer = item as Transfer;
                      return (
                        <TableRow key={transfer.id}>
                          <TableCell>{new Date(transfer.date).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>{transfer.customer_name || 'Não informado'}</TableCell>
                          <TableCell>{transfer.storeName || 'Não informado'}</TableCell>
                          <TableCell>{transfer.carrier || 'Não informado'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              <span>{transfer.trackingCode || 'Não informado'}</span>
                              {transfer.trackingCode && <a href={getTrackingUrl(transfer.carrier, transfer.trackingCode)} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" x2="21" y1="14" y2="3" /></svg></a>}
                            </div>
                          </TableCell>
                          <TableCell><Badge className={getStatusColor(transfer.status)}>{transfer.status || 'Não informado'}</Badge></TableCell>
                          <TableCell>{transfer.estimated_delivery ? new Date(transfer.estimated_delivery).toLocaleDateString('pt-BR') : 'N/A'}</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm" onClick={() => handleViewDetails(transfer)}><Eye className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return null;
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between space-x-2 py-4">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Linhas por página</p>
              <Select
                value={`${rowsPerPage}`}
                onValueChange={(value) => {
                  changeRowsPerPage(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-[80px]">
                  <SelectValue placeholder={rowsPerPage} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                  {totalRows > 0 && <SelectItem value={`${totalRows}`}>Todos</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages || 1}</span>
              <Button variant="outline" size="icon" onClick={() => changePage(1)} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => changePage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => changePage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={() => changePage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-full space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Acompanhamento</h1>
              <p className="text-gray-600 mt-2">Gerencie compras, devoluções e transferências</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Adicionar</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setCreatePurchaseOpen(true)}><ShoppingBag className="h-4 w-4 mr-2" />Nova Compra</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateReturnOpen(true)}><RotateCcw className="h-4 w-4 mr-2" />Nova Devolução</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateTransferOpen(true)}><ArrowLeftRight className="h-4 w-4 mr-2" />Nova Transferência</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Seus cards de estatísticas aqui... */}
          </div>

          <div className="flex flex-col md:flex-row justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="purchases"><ShoppingBag className="h-4 w-4 mr-2" />Compras</TabsTrigger>
                <TabsTrigger value="returns"><RotateCcw className="h-4 w-4 mr-2" />Devoluções</TabsTrigger>
                <TabsTrigger value="transfers"><ArrowLeftRight className="h-4 w-4 mr-2" />Transferências</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Buscar rastreio..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" onKeyDown={(e) => { if (e.key === 'Enter') handleSearchByTrackingCode(); }} />
                </div>
                {activeTab === 'purchases' && (
                  <div className="relative w-48">
                    <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Buscar produto..." value={productSearchTerm} onChange={(e) => setProductSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                )}
                <Button variant="outline" onClick={handleSearchByTrackingCode} disabled={searchingByTracking || !searchTerm}>
                  {searchingByTracking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]"><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
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
                <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              </div>
              
              <Button 
                variant="outline" 
                onClick={handleRunAutomation}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Executar Automação
              </Button>

              <div className="flex border rounded-md">
                <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="rounded-r-none"><LayoutList className="h-4 w-4" /></Button>
                <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="rounded-l-none"><LayoutGrid className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          <div className="flex-1">
            {viewMode === 'table' ? renderTableView() : (
              <KanbanBoard
                activeTab={activeTab}
                purchases={filteredData.filter(p => activeTab === 'purchases') as Purchase[]}
                returns={filteredData.filter(r => activeTab === 'returns') as Return[]}
                transfers={filteredData.filter(t => activeTab === 'transfers') as Transfer[]}
                onViewDetails={handleViewDetails}
                onVerifyProduct={handleVerifyProduct}
                onAddToInventory={handleAddToInventory}
                onVerifyReturn={handleVerifyReturn}
              />
            )}
          </div>
        </motion.div>
      </div>

      <CreatePurchaseDialog open={createPurchaseOpen} onOpenChange={setCreatePurchaseOpen} />
      <CreateReturnDialog open={createReturnOpen} onOpenChange={setCreateReturnOpen} />
      <CreateTransferDialog open={createTransferOpen} onOpenChange={setCreateTransferOpen} />
      <TrackingDetailsDialog 
        open={detailsOpen} 
        onOpenChange={setDetailsOpen} 
        item={selectedItem} 
        type={selectedItemType} 
      />

      <EditPurchaseDialog
        open={isEditPurchaseOpen}
        onOpenChange={setIsEditPurchaseOpen}
        purchase={purchaseToEdit}
      />
      
      <AlertDialog open={!!purchaseToDelete} onOpenChange={(isOpen) => !isOpen && setPurchaseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o pedido de compra
              <strong className="mx-1">#{purchaseToDelete?.id}</strong>
              e todos os seus produtos associados dos nossos servidores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePurchaseConfirm}>
              Sim, deletar pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </DashboardLayout>
  );
}