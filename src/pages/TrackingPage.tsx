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
  
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
        const searchTermLower = searchTerm.toLowerCase();
        const productSearchTermLower = productSearchTerm.toLowerCase();

        const generalSearchMatch =
            (purchase.storeName || '').toLowerCase().includes(searchTermLower) ||
            (purchase.customerName || '').toLowerCase().includes(searchTermLower) ||
            (purchase.trackingCode || '').toLowerCase().includes(searchTermLower) ||
            (purchase.status || '').toLowerCase().includes(searchTermLower);

        if (searchTermLower && !generalSearchMatch) return false;

        const productMatch = productSearchTermLower
            ? (purchase.products || []).some(product => 
                (product.name || '').toLowerCase().includes(productSearchTermLower)
              )
            : true;

        if (!productMatch) return false;

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
  
  // ... (demais funções handle... sem alteração) ...
  
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
                          {/* AJUSTE FINAL APLICADO */}
                          <TableCell>
                            {purchase.atualizado != null ? new Date(purchase.atualizado * 1000).toLocaleDateString('pt-BR') : 'N/A'}
                          </TableCell>
                          <TableCell>{purchase.customer_name || 'Não informado'}</TableCell>
                          {/* AJUSTE FINAL APLICADO */}
                          <TableCell>
                            {purchase.atualizado != null ? new Date(purchase.atualizado * 1000).toLocaleDateString('pt-BR') : 'N/A'}
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
                          {/* ... (célula de ações sem alteração) ... */}
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
    // ... (código para devoluções e transferências sem alterações) ...
  };
  
  return (
    <DashboardLayout>
       {/* ... (Resto do JSX sem alterações) ... */}
    </DashboardLayout>
  );
}