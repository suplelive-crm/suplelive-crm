import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Package, DollarSign, Truck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useTrackingStore } from '@/store/trackingStore';
import { useCrmStore } from '@/store/crmStore';
import { useToast } from '@/hooks/use-toast';
import { ProductAutocomplete } from './ProductAutocomplete';

interface CreatePurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// CORREÇÃO: A interface agora usa 'SKU' (maiúsculo)
type FormProduct = Partial<{
  id: string | number;
  name: string;
  SKU: string;
  quantity: number;
  cost: number;
}>

export function CreatePurchaseDialog({ open, onOpenChange }: CreatePurchaseDialogProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    carrier: '',
    storeName: '',
    customer_name: '',
    trackingCode: '',
    delivery_fee: 0,
    observation: ''
  });

  const [products, setProducts] = useState<FormProduct[]>([
    { name: '', quantity: 1, cost: 0, SKU: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const { createPurchase } = useTrackingStore();
  const { products: dbProducts, fetchProducts } = useCrmStore();
  const { toast } = useToast();
  
  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open, fetchProducts]);

  const handleAddProduct = () => {
    setProducts([...products, { name: '', quantity: 1, cost: 0, SKU: '' }]);
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
      // CORREÇÃO: Pega o SKU padronizado do ProductAutocomplete
      SKU: selectedProduct.SKU || '',
    };
    setProducts(newProducts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.carrier || !formData.storeName || !formData.trackingCode || formData.delivery_fee < 0) {
      toast({ title: 'Erro', description: 'Por favor, preencha todos os campos obrigatórios da compra', variant: 'destructive' });
      return;
    }

    if (products.length === 0 || products.some(p => !p.name || !p.SKU || (p.quantity ?? 0) <= 0 || (p.cost ?? -1) < 0)) {
      toast({ title: 'Erro', description: 'Por favor, preencha corretamente todos os produtos (Nome, SKU, Quantidade e Custo)', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      await createPurchase(formData, products as any);

      setFormData({ 
        date: new Date().toISOString().split('T')[0], 
        carrier: '', 
        storeName: '', 
        customer_name: '', 
        trackingCode: '', 
        delivery_fee: 0,
        observation: ''
      });
      setProducts([{ name: '', quantity: 1, cost: 0, SKU: '' }]);
      onOpenChange(false);
      toast({ title: 'Sucesso', description: 'Compra criada com sucesso' });
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast({ title: 'Erro', description: 'Falha ao criar compra', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Compra</DialogTitle>
          <DialogDescription>Adicione uma nova compra para rastreamento</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                Data de Compra *
              </Label>
              <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
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
              <Input id="storeName" value={formData.storeName} onChange={(e) => setFormData({ ...formData, storeName: e.target.value })} placeholder="Ex: Mercado Livre" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerName" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" /> Nome do Cliente (Opcional)
              </Label>
              <Input id="customerName" value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} placeholder="Ex: João Silva"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trackingCode" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" /> Código de Rastreio *
              </Label>
              <Input id="trackingCode" value={formData.trackingCode} onChange={(e) => setFormData({ ...formData, trackingCode: e.target.value })} placeholder="Ex: AA123456789BR" required/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deliveryFee" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-500" /> Taxa de Entrega *
              </Label>
              <Input id="deliveryFee" type="number" min="0" step="0.01" value={formData.delivery_fee} onChange={(e) => setFormData({ ...formData, delivery_fee: parseFloat(e.target.value) || 0 })} required/>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="observation" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" /> Observação (Opcional)
            </Label>
            <Textarea
              id="observation"
              value={formData.observation}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              placeholder="Adicione observações sobre a compra..."
              rows={3}
            />
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
                  <Input value={product.SKU || ''} placeholder="Selecione um produto" readOnly className="bg-gray-100 cursor-not-allowed"/>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={product.quantity || 1}
                    onChange={(e) => handleProductFieldChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    required
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
                      required
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
            <Button type="submit" disabled={loading}>{loading ? 'Criando...' : 'Criar Compra'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}