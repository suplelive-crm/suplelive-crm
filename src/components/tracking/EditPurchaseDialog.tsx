import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Package, DollarSign, Truck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTrackingStore } from '@/store/trackingStore';
import { useCrmStore } from '@/store/crmStore';
import { useToast } from '@/hooks/use-toast';
import { ProductAutocomplete } from './ProductAutocomplete';
import { Purchase } from '@/types/tracking';

interface EditPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase: Purchase | null;
}

// O tipo de produto do formulário
type FormProduct = Partial<{
    id: string | number; // ID existe para produtos que já estavam na compra
    name: string;
    sku: string;
    quantity: number;
    cost: number;
}>

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
      // structuredClone é uma forma segura de copiar o array sem referenciar o original
      setProducts(structuredClone(purchase.products || []));
    }
    if (open) {
      fetchProducts();
    }
  }, [purchase, open, fetchProducts]);

  const handleAddProduct = () => {
    // Adiciona um produto "novo" (sem id) à lista
    setProducts([...products, { name: '', quantity: 1, cost: 0, sku: '' }]);
  };

  const handleRemoveProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleProductFieldChange = (index: number, field: keyof FormProduct, value: any) => {
    // Usando .map para garantir a imutabilidade e evitar bugs de renderização
    const newProducts = products.map((p, i) => (i === index ? { ...p, [field]: value } : p));
    setProducts(newProducts);
  };
  
  const handleProductSelect = (index: number, selectedProduct: any) => {
    const newProducts = products.map((p, i) => {
      if (i === index) {
        return {
          ...p,
          id: selectedProduct.id,
          name: selectedProduct.name,
          sku: selectedProduct.sku || '',
        };
      }
      return p;
    });
    setProducts(newProducts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

    // Validações
    if (!formData.date || !formData.carrier || !formData.storeName || !formData.trackingCode) {
      toast({ title: 'Erro de Validação', description: 'Por favor, preencha todos os campos da compra (Data, Transportadora, Loja, Rastreio).', variant: 'destructive' });
      return;
    }
    if (products.length === 0 || products.some(p => !p.name || !p.sku || (p.quantity ?? 0) <= 0 || (p.cost ?? -1) < 0)) {
      toast({ title: 'Erro nos Produtos', description: 'Por favor, preencha corretamente todos os produtos (Nome, SKU, Quantidade e Custo).', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await updatePurchase(purchase.id, formData, products as any);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Falha ao submeter a atualização:', error);
      toast({ 
        title: 'Erro ao Salvar', 
        description: error.message || 'Ocorreu um erro inesperado. Tente novamente.', 
        variant: 'destructive' 
      });
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
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" /> Data de Compra *
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carrier" className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-500" /> Transportadora *
              </Label>
              <Select value={formData.carrier || ''} onValueChange={(value: string) => setFormData({ ...formData, carrier: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a transportadora" />
                </SelectTrigger>
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
              <Label htmlFor="storeName" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" /> Nome da Loja *
              </Label>
              <Input
                id="storeName"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                placeholder="Ex: Mercado Livre"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" /> Nome do Cliente (Opcional)
              </Label>
              <Input
                id="customerName"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingCode" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" /> Código de Rastreio *
              </Label>
              <Input
                id="trackingCode"
                value={formData.trackingCode}
                onChange={(e) => setFormData({ ...formData, trackingCode: e.target.value })}
                placeholder="Ex: AA123456789BR"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryFee" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-500" /> Taxa de Entrega *
              </Label>
              <Input
                id="deliveryFee"
                type="number"
                min="0"
                step="0.01"
                value={formData.delivery_fee}
                onChange={(e) => setFormData({ ...formData, delivery_fee: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observation" className="flex items-center gap-2">
                Observação (Opcional)
              </Label>
              <Input
                id="observation"
                value={formData.observation}
                onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                placeholder="Alguma observação sobre a compra..."
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Produtos</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Novo Produto
              </Button>
            </div>

            {products.map((product, index) => {
              const isExistingProduct = !!product.id;
              return (
                <div key={index} className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg items-end ${isExistingProduct ? 'bg-gray-50/50' : ''}`}>
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
                    <Input value={product.sku || ''} disabled className="cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={product.quantity || 1}
                      onChange={(e) => handleProductFieldChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                  <div className="space-y-2 flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="flex items-center gap-1">
                        {isExistingProduct && <Lock className="h-3 w-3 text-gray-400" />} Custo Unitário *
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.cost || 0}
                        onChange={(e) => handleProductFieldChange(index, 'cost', parseFloat(e.target.value) || 0)}
                        disabled={isExistingProduct}
                        className={isExistingProduct ? "cursor-not-allowed" : ""}
                      />
                    </div>
                    {!isExistingProduct && (
                      <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveProduct(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
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