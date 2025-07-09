// src/components/tracking/EditPurchaseDialog.tsx

import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Package, DollarSign, Truck } from 'lucide-react';
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

type FormProduct = Partial<{
    id: string | number;
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
    customerName: '',
    trackingCode: '',
    deliveryFee: 0,
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
        customerName: purchase.customerName || '',
        trackingCode: purchase.trackingCode || '',
        deliveryFee: purchase.delivery_fee || 0, // Corrigido para snake_case do DB
      });
      setProducts(purchase.products.map(p => ({...p})) || []);
    }
    if (open) {
      fetchProducts();
    }
  }, [purchase, open, fetchProducts]);

  const handleAddProduct = () => {
    setProducts([...products, { name: '', quantity: 1, cost: 0, sku: '' }]);
  };

  const handleRemoveProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleProductFieldChange = (index: number, field: keyof FormProduct, value: any) => {
    const newProducts = [...products];
    const product = newProducts[index];
    if (product) {
      (product as any)[field] = value;
      setProducts(newProducts);
    }
  };
  
  const handleProductSelect = (index: number, selectedProduct: any) => {
    const newProducts = [...products];
    newProducts[index] = {
      ...newProducts[index],
      id: selectedProduct.id,
      name: selectedProduct.name,
      sku: selectedProduct.sku || '',
    };
    setProducts(newProducts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

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
      toast({ title: 'Sucesso', description: 'Compra atualizada com sucesso' });
    } catch (error) {
      console.error('Error updating purchase:', error);
      toast({ title: 'Erro no Servidor', description: 'Falha ao atualizar a compra.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Editar Compra</DialogTitle>
          <DialogDescription>Altere os detalhes da compra selecionada.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                Data de Compra *
              </Label>
              <Input id="edit-date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-carrier" className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-gray-500" /> Transportadora *
                </Label>
                <Select value={formData.carrier} onValueChange={(value) => setFormData({ ...formData, carrier: value })}>
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
                <Label htmlFor="edit-storeName" className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" /> Nome da Loja *
                </Label>
                <Input id="edit-storeName" value={formData.storeName} onChange={(e) => setFormData({ ...formData, storeName: e.target.value })} placeholder="Ex: Mercado Livre" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-customerName" className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" /> Nome do Cliente (Opcional)
                </Label>
                <Input id="edit-customerName" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} placeholder="Ex: João Silva"/>
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-trackingCode" className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-gray-500" /> Código de Rastreio *
                </Label>
                <Input id="edit-trackingCode" value={formData.trackingCode} onChange={(e) => setFormData({ ...formData, trackingCode: e.target.value })} placeholder="Ex: AA123456789BR" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="edit-deliveryFee" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500" /> Taxa de Entrega
                </Label>
                <Input id="edit-deliveryFee" type="number" min="0" step="0.01" value={formData.deliveryFee} onChange={(e) => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Produtos</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Produto
              </Button>
            </div>

            {products.map((product, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg items-end">
                <div className="md:col-span-2 space-y-2">
                  <Label>Nome do Produto *</Label>
                  <ProductAutocomplete
                    products={dbProducts}
                    value={product}
                    onSelect={(selectedProduct) => handleProductSelect(index, selectedProduct)}
                    onInputChange={(text) => handleProductFieldChange(index, 'name', text)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SKU *</Label>
                  <Input value={product.sku || ''} placeholder="Selecione um produto" readOnly className="bg-gray-100 cursor-not-allowed"/>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={product.quantity || 1}
                    onChange={(e) => handleProductFieldChange(index, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Custo Unitário *</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={product.cost || 0}
                      onChange={(e) => handleProductFieldChange(index, 'cost', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  {products.length > 1 && (
                    <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveProduct(index)} >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}