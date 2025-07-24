import { useState, useEffect } from 'react';
import { Calendar, Package, Truck, CheckSquare, Archive, ExternalLink, RefreshCw, CheckCircle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Purchase, Return, Transfer, PurchaseProduct } from '@/types/tracking';
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
  const [refreshing, setRefreshing] = useState(false);
  const [vencimentoDate, setVencimentoDate] = useState<string>('');
  const [productToVerify, setProductToVerify] = useState<PurchaseProduct | null>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationObservations, setVerificationObservations] = useState('');

  const {
    verifyPurchaseProduct,
    addProductToInventory,
    updateTrackingStatus,
    archivePurchase,
    archiveReturn,
    archiveTransfer,
    verifyReturn
  } = useTrackingStore();
  const { toast } = useToast();

  useEffect(() => {
    if (open && item && type) {
      setVencimentoDate('');
      setProductToVerify(null);
      setShowVerificationDialog(false);
      setVerificationObservations('');
    }
  }, [open, item, type]);

  if (!item || !type) return null;

  const handleVerifyProduct = async (purchaseId: string, productId: string, vencimento?: string) => {
    try {
      await verifyPurchaseProduct(purchaseId, productId, vencimento);
      toast({
        title: "Produto Conferido",
        description: "O produto foi marcado como conferido com sucesso."
      });
      setVencimentoDate('');
      setProductToVerify(null);
    } catch (error) {
      console.error('Error verifying product:', error);
    }
  };

  const handleVerifyReturn = async (returnId: string, observations?: string) => {
    try {
      await verifyReturn(returnId);
      toast({
        title: "Devolução Conferida",
        description: "A devolução foi marcada como conferida com sucesso."
      });
      setShowVerificationDialog(false);
      setVerificationObservations('');
    } catch (error) {
      console.error('Error verifying return:', error);
    }
  };

  const handleArchiveItem = async (id: string, itemType: 'purchase' | 'return' | 'transfer') => {
    try {
      if (itemType === 'purchase') {
        await archivePurchase(id);
      } else if (itemType === 'return') {
        await archiveReturn(id);
      } else {
        await archiveTransfer(id);
      }
      toast({
        title: "Item Arquivado",
        description: "O item foi movido para os arquivados."
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error archiving item:', error);
    }
  };

  const handleRefreshTracking = async () => {
    if (!item || !type) return;
    setRefreshing(true);
    try {
      await updateTrackingStatus(type, item.id);
      toast({
        title: "Status Atualizado",
        description: "O status de rastreamento foi atualizado com sucesso."
      });
    } catch (error) {
      console.error("Erro ao atualizar rastreio:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status de rastreio.",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const lowerStatus = (status || '').toLowerCase();

    if (
      lowerStatus.includes('problema') ||
      lowerStatus.includes('extraviado') ||
      lowerStatus.includes('cancelado') ||
      lowerStatus.includes('não entregue - carteiro não atendido')
    ) {
      return 'bg-red-100 text-red-800';
    } else if (lowerStatus.includes('entregue') || lowerStatus.includes('conferido') || lowerStatus.includes('estoque')) {
      return 'bg-green-100 text-green-800';
    } else if (lowerStatus.includes('trânsito') || lowerStatus.includes('processamento')) {
      return 'bg-blue-100 text-blue-800';
    } else if (lowerStatus.includes('aguardando') || lowerStatus.includes('pendente')) {
      return 'bg-yellow-100 text-yellow-800';
    } else {
      return 'bg-gray-100 text-gray-800';
    }
  };

  const renderPurchaseDetails = (purchase: Purchase) => {
    const calculateTotalCost = () => {
      const productTotal = purchase.products?.reduce((sum, p) => sum + (p.cost * p.quantity), 0) || 0;
      const deliveryFee = purchase.delivery_fee || 0;
      return productTotal + deliveryFee;
    };

    const allProductsVerified = purchase.products?.every(p => p.is_verified) || false;
    const purchaseInInventory = purchase.status?.toLowerCase().includes('estoque');
    const isDelivered = purchase.status?.toLowerCase().includes('entregue') || purchaseInInventory;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Transportadora:</span>
            </div>
            <p className="font-medium">{purchase.carrier || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Loja:</span>
            </div>
            <p className="font-medium">{purchase.storeName || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Cliente:</span>
            </div>
            <p className="font-medium">{purchase.customer_name || 'Não informado'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Código de Rastreio:</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{purchase.trackingCode || 'Não informado'}</p>
              {purchase.trackingCode && (
                <a 
                  href={getTrackingUrl(purchase.carrier, purchase.trackingCode)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Status:</span>
            </div>
            <Badge className={`${getStatusColor(purchase.status)} border-transparent`}>
              {purchase.status || 'Não informado'}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{isDelivered ? 'Entrega feita dia:' : 'Previsão de Entrega:'}</span>
            </div>
            <p className="font-medium">
              {isDelivered
                ? (purchase.updated_at ? new Date(purchase.updated_at).toLocaleDateString('pt-BR') : 'Não disponível')
                : (purchase.estimated_delivery ? new Date(purchase.estimated_delivery).toLocaleDateString('pt-BR') : 'Não disponível')
              }
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold border-b pb-2">Produtos</h3>
          <div className="space-y-3">
            {purchase.products?.map((product) => (
              <div 
                key={product.id} 
                className={`p-4 border rounded-lg ${product.is_verified ? 'bg-cyan-50 border-cyan-200' : 'bg-transparent'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{product.name || `Item ${product.id}`}</h4>
                    <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                      <span>Quantidade: <span className="font-medium text-foreground">{product.quantity || 0}</span></span>
                      <span>Custo: <span className="font-medium text-foreground">R$ {(product.cost || 0).toFixed(2)}</span></span>
                      <span>Total: <span className="font-medium text-foreground">R$ {((product.cost || 0) * (product.quantity || 0)).toFixed(2)}</span></span>
                      {product.vencimento && (
                        <span>Vencimento: <span className="font-medium text-foreground">
                          {new Date(product.vencimento).toLocaleDateString('pt-BR')}
                        </span></span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!product.is_verified ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Conferir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar Produto: {product.name}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Para marcar o produto como conferido, insira a data de vencimento, se aplicável.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2 py-4">
                            <Label htmlFor="vencimento-date" className="text-sm font-medium">
                              Data de Vencimento (Opcional):
                            </Label>
                            <input 
                              id="vencimento-date" 
                              type="date" 
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                              value={vencimentoDate} 
                              onChange={(e) => setVencimentoDate(e.target.value)} 
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setVencimentoDate('')}>
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleVerifyProduct(purchase.id, product.id, vencimentoDate || undefined)}
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <Button variant="outline" size="sm" className="bg-white cursor-default pointer-events-none">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Conferido
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Taxa de Entrega: R$ {(purchase.delivery_fee || 0).toFixed(2)}</p>
              <p className="text-lg font-bold">Total da Compra: R$ {calculateTotalCost().toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
              {allProductsVerified && !purchaseInInventory && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button>
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
                      <AlertDialogAction onClick={() => addProductToInventory(purchase.id)}>
                        Confirmar e Arquivar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {purchaseInInventory && (
                <Badge className="bg-green-100 text-green-800 py-2 px-3 border-transparent">
                  <Database className="h-4 w-4 mr-2" />
                  Compra em Estoque
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReturnDetails = (returnItem: Return) => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Transportadora:</span>
            </div>
            <p className="font-medium">{returnItem.carrier || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Loja:</span>
            </div>
            <p className="font-medium">{returnItem.storeName || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Cliente:</span>
            </div>
            <p className="font-medium">{returnItem.customer_name || 'Não informado'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Código de Rastreio:</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{returnItem.trackingCode || 'Não informado'}</p>
              {returnItem.trackingCode && (
                <a 
                  href={getTrackingUrl(returnItem.carrier, returnItem.trackingCode)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Status:</span>
            </div>
            <Badge className={`${getStatusColor(returnItem.status)} border-transparent`}>
              {returnItem.status || 'Não informado'}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Previsão de Entrega:</span>
            </div>
            <p className="font-medium">
              {returnItem.estimated_delivery 
                ? new Date(returnItem.estimated_delivery).toLocaleDateString('pt-BR') 
                : 'Não disponível'
              }
            </p>
          </div>
        </div>

        {returnItem.observations && (
          <div className="space-y-2">
            <h4 className="font-medium">Observações:</h4>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {returnItem.observations}
            </p>
          </div>
        )}

        {returnItem.verification_observations && (
          <div className="space-y-2">
            <h4 className="font-medium">Observações da Conferência:</h4>
            <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg border border-green-200">
              {returnItem.verification_observations}
            </p>
            <p className="text-xs text-gray-500">
              Conferido em: {returnItem.verified_at ? new Date(returnItem.verified_at).toLocaleDateString('pt-BR') : 'N/A'}
            </p>
          </div>
        )}

        {!returnItem.is_verified && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowVerificationDialog(true)}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Conferir Devolução
            </Button>
          </div>
        )}

        {returnItem.is_verified && (
          <div className="flex justify-end pt-4 border-t">
            <Badge className="bg-green-100 text-green-800 py-2 px-3 border-transparent">
              <CheckCircle className="h-4 w-4 mr-2" />
              Devolução Conferida
            </Badge>
          </div>
        )}
      </div>
    );
  };

  const renderTransferDetails = (transfer: Transfer) => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Transportadora:</span>
            </div>
            <p className="font-medium">{transfer.carrier || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Loja:</span>
            </div>
            <p className="font-medium">{transfer.storeName || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Cliente:</span>
            </div>
            <p className="font-medium">{transfer.customer_name || 'Não informado'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Código de Rastreio:</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{transfer.trackingCode || 'Não informado'}</p>
              {transfer.trackingCode && (
                <a 
                  href={getTrackingUrl(transfer.carrier, transfer.trackingCode)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Status:</span>
            </div>
            <Badge className={`${getStatusColor(transfer.status)} border-transparent`}>
              {transfer.status || 'Não informado'}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Previsão de Entrega:</span>
            </div>
            <p className="font-medium">
              {transfer.estimated_delivery 
                ? new Date(transfer.estimated_delivery).toLocaleDateString('pt-BR') 
                : 'Não disponível'
              }
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {type === 'purchase' ? 'Detalhes da Compra' : 
               type === 'return' ? 'Detalhes da Devolução' : 
               'Detalhes da Transferência'}
            </DialogTitle>
          </DialogHeader>

          {type === 'purchase' && renderPurchaseDetails(item as Purchase)}
          {type === 'return' && renderReturnDetails(item as Return)}
          {type === 'transfer' && renderTransferDetails(item as Transfer)}
          
          <DialogFooter className="sm:justify-between mt-6 pt-4 border-t">
            <Button variant="ghost" onClick={handleRefreshTracking} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando...' : 'Atualizar Dados'}
            </Button>
            <div className='flex gap-2'>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className='bg-red-700 hover:bg-red-800'>
                    <Archive className="h-4 w-4 mr-2" />
                    Arquivar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Arquivar Item</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja arquivar este item? Ele será movido para a lista de arquivados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      className='bg-red-700 hover:bg-red-800' 
                      onClick={() => handleArchiveItem(item.id, type)}
                    >
                      Sim, Arquivar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Verificação de Devolução */}
      <AlertDialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferir Devolução</AlertDialogTitle>
            <AlertDialogDescription>
              Marque esta devolução como conferida e adicione observações se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="verification-observations">Observações da Conferência (Opcional)</Label>
              <Textarea
                id="verification-observations"
                value={verificationObservations}
                onChange={(e) => setVerificationObservations(e.target.value)}
                placeholder="Adicione observações sobre a conferência da devolução..."
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowVerificationDialog(false);
              setVerificationObservations('');
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleVerifyReturn(item.id, verificationObservations)}>
              Confirmar Conferência
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}