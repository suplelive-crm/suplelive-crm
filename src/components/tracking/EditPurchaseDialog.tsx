import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Package, DollarSign, Truck, Lock, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTrackingStore } from '@/store/trackingStore';
import { useCrmStore } from '@/store/crmStore';
import { useToast } from '@/hooks/use-toast';
import { ProductAutocomplete } from './ProductAutocomplete';
import { Purchase, PurchaseProduct } from '@/types/tracking';

interface EditPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: Purchase | null;
}

// O tipo foi atualizado para incluir as flags de status
type FormProduct = Partial<PurchaseProduct>;

export function EditPurchaseDialog({ open, onOpenChange, purchase }: EditPurchaseDialogProps) {
  const [formData, setFormData] = useState({
    date: '',
    carrier: '',
    storeName: '',
    customer_name: '',
    trackingCode: '',
    delivery_fee: 0,
    observation: '',
  });

  const [products, setProducts] = useState<FormProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const { updatePurchase } = useTrackingStore();
  const { products: dbProducts, fetchProducts } = useCrmStore();
  const { toast } = useToast();
  
  useEffect(() => {
    if (purchase) {
      setFormData({
        date: new Date(purchase.date).toISOString().split('T')[0],
        carrier: purchase.carrier || '',
        storeName: purchase.storeName || '',
        customer_name: purchase.customer_name || '',
        trackingCode: purchase.trackingCode || '',
        delivery_fee: purchase.delivery_fee || 0,
        observation: purchase.observation || '',
      });
      setProducts(structuredClone(purchase.products || [])); 
    }
    if (open) {
      fetchProducts();
    }
  }, [purchase, open, fetchProducts]);

  const confirmWithPassword = () => {
    const secret = "152729";
    const password = prompt("Para confirmar esta ação, por favor, digite a senha:");
    if (password === secret) return true;
    if (password !== null) {
      toast({ title: 'Senha Incorreta', description: 'A operação não foi autorizada.', variant: 'destructive' });
    }
    return false;
  };

  const handleAddProduct = () => setProducts([...products, { name: '', quantity: 1, cost: 0, SKU: '' }]);
  
  const handleRemoveProduct = (index: number) => {
    if (!confirmWithPassword()) return;
    setProducts(products.filter((_, i) => i !== index));
  };
  
  const handleProductFieldChange = (index: number, field: keyof FormProduct, value: any) => {
    setProducts(currentProducts => {
        const newProducts = [...currentProducts];
        const productToUpdate = newProducts[index];
        if (productToUpdate) {
            (productToUpdate as any)[field] = value;
        }
        return newProducts;
    });
  };
  
  const handleProductSelect = (index: number, selectedProduct: any) => {
    setProducts(currentProducts => {
      const newProducts = [...currentProducts];
      const productToUpdate = newProducts[index];
      if (productToUpdate) {
        newProducts[index] = {
            ...productToUpdate,
            name: selectedProduct.name,
            SKU: selectedProduct.SKU || ''
        };
      }
      return newProducts;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;
    
    // Log de diagnóstico adicionado
    console.log("Estado dos produtos antes de salvar:", JSON.stringify(products, null, 2));

    if (!confirmWithPassword()) return;

    if (!formData.date || !formData.carrier || !formData.storeName || !formData.trackingCode) {
      toast({ title: 'Erro de Validação', description: 'Por favor, preencha todos os campos da compra.', variant: 'destructive' });
      return;
    }
    
    const invalidProduct = products.find(p => !p.name || !p.SKU || !(p.quantity && p.quantity > 0));
    if (invalidProduct) {
      toast({ 
        title: 'Erro nos Produtos', 
        description: `Por favor, verifique o produto "${invalidProduct.name || 'novo'}". Todos os produtos devem ter Nome, SKU e Quantidade maior que zero.`, 
        variant: 'destructive',
        duration: 5000 
      });
      return;
    }

    setLoading(true);
    try {
      // Log de diagnóstico adicionado
      console.log("Enviando para updatePurchase:", { purchaseId: purchase.id, formData, products });
      await updatePurchase(purchase.id, formData, products as any);
      onOpenChange(false);
    } catch (error: any) {
      // Log de diagnóstico adicionado
      console.error('Falha ao submeter a atualização:', error);
      toast({ title: 'Erro ao Salvar', description: error.message || 'Ocorreu um erro inesperado.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Compra #{purchase?.id}</DialogTitle>
          <DialogDescription>Altere a quantidade dos produtos ou adicione novos itens à compra.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500" /> Data de Compra *</Label>
              <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carrier" className="flex items-center gap-2"><Truck className="h-4 w-4 text-gray-500" /> Transportadora *</Label>
              <Select value={formData.carrier || ''} onValueChange={(value: string) => setFormData({ ...formData, carrier: value })}>
                <SelectTrigger><SelectValue placeholder="Selecione a transportadora" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Correios">Correios</SelectItem>
                  <SelectItem value="Jadlog">Jadlog</SelectItem>
                  <SelectItem value="Total Express">Total Express</SelectItem>
                  <SelectItem value="Azul Cargo">Azul Cargo</SelectItem>
                  <SelectItem value="Braspress">Braspress</SelectItem>
                  <SelectItem value="Outra">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="storeName" className="flex items-center gap-2"><Package className="h-4 w-4 text-gray-500" /> Nome da Loja *</Label>
              <Input id="storeName" value={formData.storeName} onChange={(e) => setFormData({ ...formData, storeName: e.target.value })} placeholder="Ex: Mercado Livre" required/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName" className="flex items-center gap-2"><Package className="h-4 w-4 text-gray-500" /> Nome do Cliente (Opcional)</Label>
              <Input id="customerName" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingCode" className="flex items-center gap-2"><Package className="h-4 w-4 text-gray-500" /> Código de Rastreio *</Label>
              <Input id="trackingCode" value={formData.trackingCode} onChange={(e) => setFormData({ ...formData, trackingCode: e.target.value })} placeholder="Ex: AA123456789BR" required/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryFee" className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-gray-500" /> Taxa de Entrega *</Label>
              <Input id="deliveryFee" type="number" min="0" step="0.01" value={formData.delivery_fee} onChange={(e) => setFormData({ ...formData, delivery_fee: parseFloat(e.target.value) || 0 })} required/>
            </div>
          </div>
          <div className="space-y-2">
              <Label htmlFor="observation" className="flex items-center gap-2"><FileText className="h-4 w-4 text-gray-500" /> Observação (Opcional)</Label>
              <Textarea id="observation" value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} placeholder="Alguma observação sobre a compra..." rows={3} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Produtos</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct}><Plus className="h-4 w-4 mr-2" /> Adicionar Novo Produto</Button>
            </div>

            <TooltipProvider>
              {products.map((product, index) => {
                const isExistingProduct = !!product.id;
                // CORREÇÃO: Lógica para "congelar" produtos já processados
                const isProductLocked = !!product.is_verified || !!product.is_in_stock;
                
                return (
                  <div key={product.id || `new-${index}`} className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg items-end ${isExistingProduct ? 'bg-gray-50/50' : ''}`}>
                    <div className="md:col-span-2 space-y-2">
                      <Label>Nome do Produto *</Label>
                      {isExistingProduct ? (
                        <div className="flex items-center h-10 w-full rounded-md border border-input bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed">
                          {product.name || ''}
                        </div>
                      ) : (
                        <ProductAutocomplete
                          products={dbProducts}
                          value={product}
                          onSelect={(selectedProduct) => handleProductSelect(index, selectedProduct)}
                          onInputChange={(text) => handleProductFieldChange(index, 'name', text)}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>SKU *</Label>
                      <Input value={product.SKU || ''} disabled className="cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        Quantidade * {isProductLocked && (
                          <Tooltip>
                            <TooltipTrigger><Info className="h-3 w-3 text-gray-400" /></TooltipTrigger>
                            <TooltipContent>Este item não pode ser alterado pois já foi conferido ou adicionado ao estoque.</TooltipContent>
                          </Tooltip>
                        )}
                      </Label>
                      <Input 
                        type="number" 
                        min="1" 
                        value={product.quantity || 1} 
                        onChange={(e) => handleProductFieldChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                        disabled={isProductLocked} // CORREÇÃO: Desabilita se o produto estiver "congelado"
                        className={isProductLocked ? "cursor-not-allowed bg-gray-100" : ""}
                      />
                    </div>
                    <div className="space-y-2 flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="flex items-center gap-1">
                          {isExistingProduct && <Lock className="h-3 w-3 text-gray-400" />} Custo Unitário *
                        </Label>
                        <Input type="number" min="0" step="0.01" value={product.cost || 0} onChange={(e) => handleProductFieldChange(index, 'cost', parseFloat(e.target.value) || 0)}
                          disabled={isExistingProduct}
                          className={isExistingProduct ? "cursor-not-allowed" : ""}
                        />
                      </div>
                      {/* CORREÇÃO: Botão de lixeira só aparece se o produto não estiver "congelado" */}
                      {!isProductLocked && (
                        <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveProduct(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </TooltipProvider>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

