import { useState, useEffect } from 'react';
import {
  Calendar, Package, Truck, CheckSquare, Archive, ExternalLink, RefreshCw,
  CheckCircle, Database, MapPin, Clock, List, FileText, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
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

type YourTrackingHistoryEvent = {
  data: string;
  detalhe: string;
  cidade?: string;
  uf?: string;
  tipo?: string;
  sigla?: string;
  descricao?: string;
};

// Certifique-se de que sua definição de PurchaseProduct em '@/types/tracking' inclua 'is_in_stock'
interface ExtendedPurchaseProduct extends PurchaseProduct {
  is_in_stock?: boolean;
}

interface ExtendedPurchase extends Purchase {
  products?: ExtendedPurchaseProduct[];
}

interface ItemWithYourMetadata extends ExtendedPurchase, Return, Transfer {
  metadata?: YourTrackingHistoryEvent[];
}

export function TrackingDetailsDialog({ open, onOpenChange, item, type }: TrackingDetailsDialogProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [vencimentoDate, setVencimentoDate] = useState<string>('');
  const [precoMl, setPrecoMl] = useState<number | ''>('');
  // NOVO ESTADO: para o preço de atacado
  const [precoAtacado, setPrecoAtacado] = useState<number | ''>('');
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
    if (open) {
      setVencimentoDate('');
      setPrecoMl('');
      // NOVO: Resetando o estado do preço de atacado ao abrir
      setPrecoAtacado('');
      setShowVerificationDialog(false);
      setVerificationObservations('');
    }
  }, [open]);

  if (!item || !type) return null;

  // FUNÇÃO ATUALIZADA: para incluir preco_atacado
  const handleVerifyProduct = async (
    purchaseId: string,
    productId: string,
    vencimento?: string,
    preco_ml?: number,
    preco_atacado?: number // NOVO PARÂMETRO
  ) => {
    try {
      // Passando o novo parâmetro para a função do store
      await verifyPurchaseProduct(purchaseId, productId, vencimento, preco_ml, preco_atacado);
      toast({
        title: "Produto Conferido",
        description: "O produto foi marcado como conferido com sucesso."
      });
      setVencimentoDate('');
      setPrecoMl('');
      // NOVO: Resetando o estado do preço de atacado após o sucesso
      setPrecoAtacado('');
    } catch (error) {
      console.error('Error verifying product:', error);
      toast({ title: "Erro", description: "Não foi possível conferir o produto.", variant: "destructive" });
    }
  };

  const handleVerifyTransferProduct = async (transferId: string, productId: string) => {
    try {
      // For now, we'll just mark as verified - you can extend this later
      await verifyTransferProduct(transferId, productId);
      toast({
        title: "Produto Conferido",
        description: "O produto da transferência foi marcado como conferido."
      });
    } catch (error) {
      console.error('Error verifying transfer product:', error);
      toast({ 
        title: "Erro", 
        description: "Não foi possível conferir o produto da transferência.", 
        variant: "destructive" 
      });
    }
  };

  const handleVerifyReturn = async (returnId: string, observations?: string) => {
    try {
      await verifyReturn(returnId, observations);
      toast({
        title: "Devolução Conferida",
        description: "A devolução foi marcada como conferida com sucesso."
      });
      setShowVerificationDialog(false);
      setVerificationObservations('');
    } catch (error) {
      console.error('Error verifying return:', error);
      toast({ title: "Erro", description: "Não foi possível conferir a devolução.", variant: "destructive" });
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
      toast({ title: "Erro", description: "Não foi possível arquivar o item.", variant: "destructive" });
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
    if (lowerStatus.includes('problema') || lowerStatus.includes('extraviado') || lowerStatus.includes('cancelado') || lowerStatus.includes('não entregue - carteiro não atendido')) {
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

  const renderGeneralDetails = (currentItem: Purchase | Return | Transfer) => {
    const isTransfer = 'source_stock' in currentItem;
    const isPurchase = 'products' in currentItem && !isTransfer;
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4" />
              <span>Transportadora:</span>
            </div>
            <p className="font-medium">{currentItem.carrier || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Loja:</span>
            </div>
            <p className="font-medium">{currentItem.storeName || 'Não informada'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Cliente:</span>
            </div>
            <p className="font-medium">{currentItem.customer_name || 'Não informado'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>Código de Rastreio:</span>
            </div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{currentItem.trackingCode || 'Não informado'}</p>
              {currentItem.trackingCode && (
                <a
                  href={getTrackingUrl(currentItem.carrier, currentItem.trackingCode)}
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
            <Badge className={`${getStatusColor(currentItem.status)} border-transparent`}>
              {currentItem.status || 'Não informado'}
            </Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Previsão de Entrega:</span>
            </div>
            <p className="font-medium">
              {(currentItem as Purchase)?.estimated_delivery
                ? new Date((currentItem as Purchase).estimated_delivery!).toLocaleDateString('pt-BR')
                : 'Não disponível'
              }
            </p>
          </div>
          
          {isTransfer && (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>Estoque de Origem:</span>
                </div>
                <p className="font-medium">
                  {stockLocations.find(l => l.value === (currentItem as Transfer).source_stock)?.label || (currentItem as Transfer).source_stock}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>Estoque de Destino:</span>
                </div>
                <p className="font-medium">
                  {stockLocations.find(l => l.value === (currentItem as Transfer).destination_stock)?.label || (currentItem as Transfer).destination_stock}
                </p>
              </div>
            </>
          )}
        </div>

        {isPurchase && (currentItem as Purchase).observation && (
          <div className="space-y-2 mt-4">
            <h4 className="font-medium flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" /> Observações da Compra:
            </h4>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {(currentItem as Purchase).observation}
            </p>
          </div>
        )}

        {isPurchase && renderPurchaseProducts(currentItem as ExtendedPurchase)}
        {isTransfer && renderTransferProducts(currentItem as Transfer)}
        {type === 'return' && renderReturnObservations(currentItem as Return)}
      </div>
    );
  };
 
  const renderPurchaseProducts = (purchase: ExtendedPurchase) => {
    const calculateTotalCost = () => {
      const productTotal = purchase.products?.reduce((sum, p) => sum + (p.cost * p.quantity), 0) || 0;
      const deliveryFee = purchase.delivery_fee || 0;
      return productTotal + deliveryFee;
    };
    const allProductsVerified = purchase.products?.every(p => p.is_verified) || false;
    const purchaseInInventory = purchase.status?.toLowerCase().includes('estoque');

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Produtos</h3>
        <div className="space-y-3">
          {purchase.products?.map((product) => (
            <div
              key={product.id}
              className={`p-4 border rounded-lg ${product.is_verified ? (product.is_in_stock ? 'bg-green-50 border-green-200' : 'bg-cyan-50 border-cyan-200') : 'bg-transparent'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">
                    {product.name || `Item ${product.id}`}
                    {product.SKU && ` - ${product.SKU}`}
                  </h4>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    <span>Quantidade: <span className="font-medium text-foreground">{product.quantity || 0}</span></span>
                    <span>Custo: <span className="font-medium text-foreground">R$ {(product.cost || 0).toFixed(2)}</span></span>
                    <span>Total: <span className="font-medium text-foreground">R$ {((product.cost || 0) * (product.quantity || 0)).toFixed(2)}</span></span>
                    {product.vencimento && (
                      <span>Vencimento: <span className="font-medium text-foreground">
                        {new Date(product.vencimento).toLocaleDateString('pt-BR')}
                      </span></span>
                    )}
                    {product.preco_ml && (
                      <span>Preço ML: <span className="font-medium text-foreground">R$ {(product.preco_ml || 0).toFixed(2)}</span></span>
                    )}
                    {/* NOVO: Exibindo o preço de atacado */}
                    {product.preco_atacado && (
                      <span>Preço Atacado: <span className="font-medium text-foreground">R$ {(product.preco_atacado || 0).toFixed(2)}</span></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!product.is_verified ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        {/* ATUALIZADO: para popular também o estado do preço de atacado */}
                        <Button variant="outline" size="sm" onClick={() => {
                          setVencimentoDate(product.vencimento || '');
                          setPrecoMl(product.preco_ml || '');
                          setPrecoAtacado(product.preco_atacado || '');
                        }}>
                          <CheckSquare className="h-4 w-4 mr-2" /> Conferir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar Produto: {product.name}</AlertDialogTitle>
                          <AlertDialogDescription>
                            Para marcar o produto como conferido, insira os preços e a data de vencimento.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="vencimento-date" className="flex items-center gap-2 text-sm font-medium">
                              <Calendar className="h-4 w-4 text-gray-500" />
                              Data de Vencimento:
                            </Label>
                            <Input
                              id="vencimento-date"
                              type="date"
                              value={vencimentoDate}
                              onChange={(e) => setVencimentoDate(e.target.value)}
                              tabIndex={0}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="preco-ml" className="flex items-center gap-2 text-sm font-medium">
                              <DollarSign className="h-4 w-4 text-gray-500" />
                              Preço do produto - Mercado Livre:
                            </Label>
                            <Input
                              id="preco-ml"
                              type="number"
                              step="0.10"
                              value={precoMl}
                              onChange={(e) => setPrecoMl(e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="R$ 0.00"
                              tabIndex={0}
                            />
                             <div className="flex justify-end space-x-2">
                                <Button type="button" variant="secondary" onClick={() => setPrecoMl(p => p !== '' ? (p > 50 ? p - 50 : 0) : 0)} >-50</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoMl(p => p !== '' ? (p > 10 ? p - 10 : 0) : 0)} >-10</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoMl(p => p !== '' ? (p > 1 ? p - 1 : 0) : 0)} >-1</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoMl(p => (p !== '' ? p : 0) + 1)} >+1</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoMl(p => (p !== '' ? p : 0) + 10)} >+10</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoMl(p => (p !== '' ? p : 0) + 50)} >+50</Button>
                              </div>
                          </div>
                          {/* NOVO: Campo de input para Preço de Atacado com controles */}
                          <div className="space-y-2">
                            <Label htmlFor="preco-atacado" className="flex items-center gap-2 text-sm font-medium">
                              <DollarSign className="h-4 w-4 text-gray-500" />
                              Preço para o Atacado:
                            </Label>
                            <Input
                              id="preco-atacado"
                              type="number"
                              step="0.10"
                              value={precoAtacado}
                              onChange={(e) => setPrecoAtacado(e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="R$ 0.00"
                              tabIndex={0}
                            />
                             <div className="flex justify-end space-x-2">
                                <Button type="button" variant="secondary" onClick={() => setPrecoAtacado(p => p !== '' ? (p > 50 ? p - 50 : 0) : 0)} >-50</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoAtacado(p => p !== '' ? (p > 10 ? p - 10 : 0) : 0)} >-10</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoAtacado(p => p !== '' ? (p > 1 ? p - 1 : 0) : 0)} >-1</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoAtacado(p => (p !== '' ? p : 0) + 1)} >+1</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoAtacado(p => (p !== '' ? p : 0) + 10)} >+10</Button>
                                <Button type="button" variant="secondary" onClick={() => setPrecoAtacado(p => (p !== '' ? p : 0) + 50)} >+50</Button>
                              </div>
                          </div>
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => { setVencimentoDate(''); setPrecoMl(''); setPrecoAtacado(''); }}>Cancelar</AlertDialogCancel>
                          {/* ATUALIZADO: Enviando o novo valor de precoAtacado */}
                          <AlertDialogAction
                            onClick={() => handleVerifyProduct(
                              purchase.id,
                              product.id,
                              vencimentoDate || undefined,
                              precoMl !== '' ? parseFloat(String(precoMl)) : undefined,
                              precoAtacado !== '' ? parseFloat(String(precoAtacado)) : undefined
                            )}
                          >
                            Confirmar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : product.is_in_stock ? (
                    <Badge className="bg-green-100 text-green-800 py-2 px-3 border-transparent pointer-events-none">
                      <Database className="h-4 w-4 mr-2" /> No Estoque
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" className="bg-white cursor-default pointer-events-none">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Conferido
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
                    <Database className="h-4 w-4 mr-2" /> Lançar Compra no Estoque
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Lançar Compra no Estoque</AlertDialogTitle>
                    <AlertDialogDescription>Tem certeza que deseja lançar todos os produtos desta compra no estoque? Esta ação irá arquivar a compra.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => addProductToInventory(purchase.id)}>Confirmar e Arquivar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {purchaseInInventory && (
              <Badge className="bg-green-100 text-green-800 py-2 px-3 border-transparent">
                <Database className="h-4 w-4 mr-2" /> Compra em Estoque
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  };
 
  const renderTransferProducts = (transfer: Transfer) => {
    const allProductsVerified = transfer.products?.every(p => p.is_verified) || false;
    const transferInInventory = transfer.status?.toLowerCase().includes('estoque');

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold border-b pb-2">Produtos em Transferência</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-center">
            <h4 className="font-medium text-blue-800">Estoque de Origem</h4>
            <p className="text-lg font-bold text-blue-600">
              {stockLocations.find(l => l.value === transfer.source_stock)?.label || transfer.source_stock}
            </p>
          </div>
          <div className="text-center">
            <h4 className="font-medium text-blue-800">Estoque de Destino</h4>
            <p className="text-lg font-bold text-blue-600">
              {stockLocations.find(l => l.value === transfer.destination_stock)?.label || transfer.destination_stock}
            </p>
          </div>
        </div>
        
        <div className="space-y-3">
          {transfer.products?.map((product) => (
            <div
              key={product.id}
              className={`p-4 border rounded-lg ${product.is_verified ? 'bg-green-50 border-green-200' : 'bg-transparent'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">
                    {product.name || `Item ${product.id}`}
                    {product.sku && ` - ${product.sku}`}
                  </h4>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                    <span>Quantidade: <span className="font-medium text-foreground">{product.quantity || 0}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!product.is_verified ? (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        // For transfers, we'll verify without additional data
                        handleVerifyTransferProduct(transfer.id, product.id);
                      }}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" /> Conferir
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="bg-white cursor-default pointer-events-none">
                      <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Conferido
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex justify-end pt-4 border-t">
          {allProductsVerified && !transferInInventory && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>
                  <Database className="h-4 w-4 mr-2" /> Finalizar Transferência
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Finalizar Transferência</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja finalizar esta transferência? Esta ação irá arquivar a transferência.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => addProductToInventory(transfer.id)}>
                    Confirmar e Arquivar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {transferInInventory && (
            <Badge className="bg-green-100 text-green-800 py-2 px-3 border-transparent">
              <Database className="h-4 w-4 mr-2" /> Transferência Finalizada
            </Badge>
          )}
        </div>
      </div>
    );
  };
  
  const renderReturnObservations = (returnItem: Return) => {
    return (
      <div className="space-y-4">
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
              <CheckSquare className="h-4 w-4 mr-2" /> Conferir Devolução
            </Button>
          </div>
        )}
        {returnItem.is_verified && (
          <div className="flex justify-end pt-4 border-t">
            <Badge className="bg-green-100 text-green-800 py-2 px-3 border-transparent">
              <CheckCircle className="h-4 w-4 mr-2" /> Devolução Conferida
            </Badge>
          </div>
        )}
      </div>
    );
  };
 
  const renderTrackingHistory = (currentItem: ItemWithYourMetadata) => {
    const trackingHistory: YourTrackingHistoryEvent[] = (currentItem.metadata as YourTrackingHistoryEvent[]) || [];
   
    if (!trackingHistory || trackingHistory.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum histórico de rastreamento disponível.
        </div>
      );
    }
   
    return (
      <div className="space-y-4 py-4">
        <div className="space-y-3">
          {trackingHistory
            .slice()
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
            .map((event, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="relative pt-1">
                  <div className="h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                  {index < trackingHistory.length - 1 && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 h-full w-0.5 bg-blue-200" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className="font-medium">{event.detalhe} - {event.descricao}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(event.data).toLocaleDateString('pt-BR')}</span>
                    {event.cidade && (
                      <>
                        <MapPin className="h-3 w-3" />
                        <span>{event.cidade}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
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

          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general"><List className="h-4 w-4 mr-2" />Informações Gerais</TabsTrigger>
              <TabsTrigger value="tracking"><Truck className="h-4 w-4 mr-2" />Rastreamento</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              {renderGeneralDetails(item as ItemWithYourMetadata)}
            </TabsContent>
            <TabsContent value="tracking">
              {renderTrackingHistory(item as ItemWithYourMetadata)}
            </TabsContent>
          </Tabs>

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
                    <Archive className="h-4 w-4 mr-2" /> Arquivar
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