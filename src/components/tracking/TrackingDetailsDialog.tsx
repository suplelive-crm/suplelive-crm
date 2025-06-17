import { useState, useEffect } from 'react';
import { Calendar, Package, Truck, CheckSquare, Archive, ExternalLink, RefreshCw, CheckCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Purchase, Return, Transfer } from '@/types/tracking';
import { useTrackingStore } from '@/store/trackingStore';
import { useToast } from '@/hooks/use-toast';
import { getTrackingUrl } from '@/lib/tracking-api';

interface TrackingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Purchase | Return | Transfer | null;
  type: 'purchase' | 'return' | 'transfer' | null;
}

export function TrackingDetailsDialog({ open, onOpenChange, item, type }: TrackingDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [refreshing, setRefreshing] = useState(false);
  const {
    verifyPurchaseProduct,
    addProductToInventory, // This function will be modified/reused for individual products
    updateTrackingStatus,
    archivePurchase,
    archiveReturn,
    archiveTransfer
  } = useTrackingStore();
  const { toast } = useToast();

  useEffect(() => {
    if (open && item && type) {
      // Refresh tracking status when dialog opens
      handleRefreshTracking();
    }
  }, [open, item, type]);

  if (!item || !type) return null;

  const handleVerifyProduct = async (purchaseId: string, productId: string) => {
    await verifyPurchaseProduct(purchaseId, productId);
  };

  // Modified function to handle adding a single product to inventory
  const handleAddProductToInventory = async (purchaseId: string, productId: string) => {
    // You'll need to implement this in your trackingStore.ts
    // This function should update the specific product's status to 'in stock' or similar
    // and potentially mark it as archived at the product level if your schema supports it.
    console.log(`Lançando produto ${productId} da compra ${purchaseId} no estoque.`);
    // Example: await updateProductStatusToInStock(purchaseId, productId);
    toast({
      title: "Produto Lançado",
      description: "O produto foi lançado no estoque com sucesso."
    });
    // This will trigger a re-render and update the UI
    if (item && type) {
      updateTrackingStatus(type, item.id);
    }
  };


  const handleArchiveItem = async (id: string, itemType: 'purchase' | 'return' | 'transfer') => {
    if (itemType === 'purchase') {
      await archivePurchase(id);
    } else if (itemType === 'return') {
      await archiveReturn(id);
    } else {
      await archiveTransfer(id);
    }
    onOpenChange(false);
  };

  const handleRefreshTracking = async () => {
    if (!item || !type) return;

    setRefreshing(true);
    try {
      await updateTrackingStatus(type, item.id);
      toast({
        title: "Status atualizado",
        description: "Informações de rastreio atualizadas com sucesso"
      });
    } catch (error) {
      console.error("Error refreshing tracking:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status de rastreio",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes('entregue') || status.includes('conferido') || status.includes('estoque')) {
      return 'bg-green-100 text-green-800';
    } else if (status.includes('trânsito')) {
      return 'bg-blue-100 text-blue-800';
    } else if (status.includes('aguardando')) {
      return 'bg-yellow-100 text-yellow-800';
    } else if (status.includes('problema') || status.includes('extraviado')) {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  const renderPurchaseDetails = (purchase: Purchase) => {
    // Calculate total cost safely
    const calculateTotalCost = () => {
      let productTotal = 0;
      if (purchase.products && purchase.products.length > 0) {
        productTotal = purchase.products.reduce((sum, p) => {
          const cost = typeof p.cost === 'number' ? p.cost : 0;
          const quantity = typeof p.quantity === 'number' ? p.quantity : 0;
          return sum + (cost * quantity);
        }, 0);
      }

      const deliveryFee = typeof purchase.deliveryFee === 'number' ? purchase.deliveryFee : 0;
      return productTotal + deliveryFee;
    };

    // Check if all products are verified
    const allProductsVerified = purchase.products?.every(p => p.isVerified) || false;

    // Check if purchase is already in inventory
    const isInInventory = purchase.status?.toLowerCase().includes('estoque') || false;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Data de Compra:</span>
            </div>
            <p className="text-sm">{new Date(purchase.date).toLocaleDateString('pt-BR')}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Transportadora:</span>
            </div>
            <p className="text-sm">{purchase.carrier || 'Não informada'}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Loja:</span>
            </div>
            <p className="text-sm">{purchase.storeName || 'Não informada'}</p>
          </div>

          {purchase.customerName && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Cliente:</span>
              </div>
              <p className="text-sm">{purchase.customerName}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Código de Rastreio:</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-sm">{purchase.trackingCode || 'Não informado'}</p>
              {purchase.trackingCode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    const url = getTrackingUrl(purchase.carrier, purchase.trackingCode);
                    if (url) {
                      window.open(url, '_blank');
                    }
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Status:</span>
            </div>
            <Badge className={getStatusColor(purchase.status)}>
              {purchase.status || 'Não informado'}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Previsão de Entrega:</span>
            </div>
            <p className="text-sm">
              {purchase.estimatedDelivery
                ? new Date(purchase.estimatedDelivery).toLocaleDateString('pt-BR')
                : 'Não disponível'}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Produtos</h3>

          <div className="space-y-3">
            {purchase.products?.map((product) => (
              <div
                key={product.id}
                className={`p-4 border rounded-lg ${product.isVerified ? 'bg-blue-50 border-blue-200' : ''} ${product.isInStock ? 'bg-green-50 border-green-200' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{product.name}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-sm text-gray-600">Quantidade: {product.quantity || 0}</p>
                      <p className="text-sm text-gray-600">
                        Custo: R$ {typeof product.cost === 'number' ? product.cost.toFixed(2) : '0.00'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Total: R$ {typeof product.totalCost === 'number'
                          ? product.totalCost.toFixed(2)
                          : ((typeof product.cost === 'number' ? product.cost : 0) *
                            (typeof product.quantity === 'number' ? product.quantity : 0)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2"> {/* Container for the buttons/badges */}
                    {!product.isVerified ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Conferir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Produto</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja marcar este produto como conferido?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleVerifyProduct(purchase.id, product.id)}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <>
                        <Badge className="bg-blue-100 text-blue-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Conferido
                        </Badge>
                        {!product.isInStock ? ( // Show "Lançar no Estoque" only if not already in stock
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Database className="h-4 w-4 mr-2" />
                                Lançar no Estoque
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Lançar Produto no Estoque</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja lançar este produto no estoque?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleAddProductToInventory(purchase.id, product.id)}
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
                      </>
                    )}
                  </div>
                </div>
              </div>
            )))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              <p className="text-sm font-medium">
                Taxa de Entrega: R$ {typeof purchase.deliveryFee === 'number' ? purchase.deliveryFee.toFixed(2) : '0.00'}
              </p>
              <p className="text-sm font-medium">
                Total: R$ {calculateTotalCost().toFixed(2)}
              </p>
            </div>

            <div className="flex gap-2">
              {allProductsVerified && !isInInventory && ( // This is for the *entire purchase* to inventory
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="default">
                      <Database className="h-4 w-4 mr-2" />
                      Lançar Compra no Estoque
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Lançar Compra no Estoque</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja lançar todos os produtos desta compra no estoque? Esta ação irá arquivar a compra.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => addProductToInventory(purchase.id)} // This one adds the whole purchase
                      >
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {allProductsVerified && (
                <Badge className="bg-blue-100 text-blue-800 py-2 px-3">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Conferido (Total)
                </Badge>
              )}

              {isInInventory && (
                <Badge className="bg-green-100 text-green-800 py-2 px-3">
                  <Database className="h-4 w-4 mr-2" />
                  Compra no Estoque
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReturnOrTransferDetails = (item: Return | Transfer, itemType: 'return' | 'transfer') => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Data:</span>
          </div>
          <p className="text-sm">{new Date(item.date).toLocaleDateString('pt-BR')}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Transportadora:</span>
          </div>
          <p className="text-sm">{item.carrier || 'Não informada'}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Loja:</span>
          </div>
          <p className="text-sm">{item.storeName || 'Não informada'}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Cliente:</span>
          </div>
          <p className="text-sm">{item.customerName || 'Não informado'}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Código de Rastreio:</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm">{item.trackingCode || 'Não informado'}</p>
            {item.trackingCode && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => {
                  const url = getTrackingUrl(item.carrier, item.trackingCode);
                  if (url) {
                    window.open(url, '_blank');
                  }
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Status:</span>
          </div>
          <Badge className={getStatusColor(item.status)}>
            {item.status || 'Não informado'}
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium">Previsão de Entrega:</span>
          </div>
          <p className="text-sm">
            {item.estimatedDelivery
              ? new Date(item.estimatedDelivery).toLocaleDateString('pt-BR')
              : 'Não disponível'}
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t">
        {!item.isArchived ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button>
                <Database className="h-4 w-4 mr-2" />
                Lançar no Estoque
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Lançar no Estoque</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja lançar {itemType === 'return' ? 'esta devolução' : 'esta transferência'} no estoque? Esta ação irá arquivar o item.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => addProductToInventory(item.id)} // This is for the whole return/transfer
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Badge className="bg-green-100 text-green-800 py-2 px-3">
            <Database className="h-4 w-4 mr-2" />
            Lançado no Estoque
          </Badge>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {type === 'purchase'
              ? 'Detalhes da Compra'
              : type === 'return'
                ? 'Detalhes da Devolução'
                : 'Detalhes da Transferência'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            {/*<TabsTrigger value="tracking">Rastreamento</TabsTrigger>*/}
          </TabsList>

          <TabsContent value="details" className="mt-4">
            {type === 'purchase' && renderPurchaseDetails(item as Purchase)}
            {type === 'return' && renderReturnOrTransferDetails(item as Return, 'return')}
            {type === 'transfer' && renderReturnOrTransferDetails(item as Transfer, 'transfer')}
          </TabsContent>

          <TabsContent value="tracking" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Histórico de Rastreamento</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshTracking}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Status Atual:</p>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status || 'Não informado'}
                    </Badge>
                  </div>

                  <div>
                    <p className="text-sm font-medium">Previsão de Entrega:</p>
                    <p className="text-sm">
                      {item.estimatedDelivery
                        ? new Date(item.estimatedDelivery).toLocaleDateString('pt-BR')
                        : 'Não disponível'}
                    </p>
                  </div>
                </div>

                <div className="border-l-2 border-gray-200 pl-4 space-y-6 ml-4">
                  {/* This would be populated with actual tracking history */}
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-blue-500"></div>
                    <div>
                      <p className="text-sm font-medium">Em trânsito</p>
                      <p className="text-xs text-gray-500">
                        {new Date().toLocaleDateString('pt-BR')} - {new Date().toLocaleTimeString('pt-BR')}
                      </p>
                      <p className="text-sm mt-1">Objeto em trânsito - de São Paulo/SP para Rio de Janeiro/RJ</p>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-4 h-4 rounded-full bg-gray-300"></div>
                    <div>
                      <p className="text-sm font-medium">Objeto postado</p>
                      <p className="text-xs text-gray-500">
                        {new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('pt-BR')} -
                        {new Date().toLocaleTimeString('pt-BR')}
                      </p>
                      <p className="text-sm mt-1">Objeto postado - São Paulo/SP</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between mt-6 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Archive className="h-4 w-4 mr-2" />
                Arquivar Lançamento
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar Lançamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja arquivar este lançamento? Ele será movido para a lista de arquivados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleArchiveItem(item.id, type)}
                >
                  Arquivar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}