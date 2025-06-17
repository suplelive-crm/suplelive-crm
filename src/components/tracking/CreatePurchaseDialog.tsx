import { useState } from 'react';
import { Plus, Trash2, Calendar, Package, DollarSign, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTrackingStore } from '@/store/trackingStore';
import { useToast } from '@/hooks/use-toast';

interface CreatePurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePurchaseDialog({ open, onOpenChange }: CreatePurchaseDialogProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    carrier: '',
    storeName: '',
    customerName: '',
    trackingCode: '',
    deliveryFee: 0,
  });

  // ADICIONADO: 'sku' ao estado inicial do produto
  const [products, setProducts] = useState([
    { name: '', quantity: 1, cost: 0, sku: '' } // Adicionado sku
  ]);

  const [loading, setLoading] = useState(false);
  const { createPurchase } = useTrackingStore();
  const { toast } = useToast();

  const handleAddProduct = () => {
    // ADICIONADO: 'sku' ao novo produto
    setProducts([...products, { name: '', quantity: 1, cost: 0, sku: '' }]);
  };

  const handleRemoveProduct = (index: number) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, field: string, value: string | number) => {
    const newProducts = [...products];
    // Certifique-se que o 'cost' e 'quantity' são convertidos para número, e 'sku' e 'name' são strings
    newProducts[index] = {
      ...newProducts[index],
      [field]: field === 'quantity' ? parseInt(value as string) : (field === 'cost' ? parseFloat(value as string) : value)
    };
    setProducts(newProducts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.date || !formData.carrier || !formData.storeName || !formData.trackingCode || formData.deliveryFee < 0) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos obrigatórios da compra',
        variant: 'destructive',
      });
      return;
    }

    // Validate products - ADICIONADO: validação para 'sku'
    if (products.length === 0 || products.some(p => !p.name || p.quantity <= 0 || p.cost < 0 || !p.sku)) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha corretamente todos os produtos (Nome, Quantidade, Custo, SKU)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // A função createPurchase da store precisa ser atualizada para aceitar o SKU nos produtos.
      // Já está configurada para mapear de camelCase para snake_case no trackingStore.ts
      await createPurchase(formData, products);

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        carrier: '',
        storeName: '',
        customerName: '',
        trackingCode: '',
        deliveryFee: 0,
      });
      // ADICIONADO: 'sku' ao reset do produto
      setProducts([{ name: '', quantity: 1, cost: 0, sku: '' }]);

      onOpenChange(false);

      toast({
        title: 'Sucesso',
        description: 'Compra criada com sucesso',
      });
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao criar compra',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Compra</DialogTitle>
          <DialogDescription>
            Adicione uma nova compra para rastreamento
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                Data de Compra *
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
                <Truck className="h-4 w-4 text-gray-500" />
                Transportadora *
              </Label>
              <Select
                value={formData.carrier}
                onValueChange={(value) => setFormData({ ...formData, carrier: value })}
              >
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
                <Package className="h-4 w-4 text-gray-500" />
                Nome da Loja *
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
                <Package className="h-4 w-4 text-gray-500" />
                Nome do Cliente (Opcional)
              </Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trackingCode" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                Código de Rastreio *
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
                <DollarSign className="h-4 w-4 text-gray-500" />
                Taxa de Entrega *
              </Label>
              <Input
                id="deliveryFee"
                type="number"
                min="0"
                step="0.01"
                value={formData.deliveryFee}
                onChange={(e) => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Produtos</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            </div>

            {products.map((product, index) => (
              // Ajustado para grid-cols-1 md:grid-cols-5 para acomodar o SKU
              <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor={`product-${index}-name`}>Nome do Produto *</Label>
                  <Input
                    id={`product-${index}-name`}
                    value={product.name}
                    onChange={(e) => handleProductChange(index, 'name', e.target.value)}
                    placeholder="Ex: Camiseta Preta"
                    required
                  />
                </div>

                {/* NOVO CAMPO: SKU */}
                <div className="space-y-2">
                  <Label htmlFor={`product-${index}-sku`}>SKU *</Label>
                  <Input
                    id={`product-${index}-sku`}
                    value={product.sku}
                    onChange={(e) => handleProductChange(index, 'sku', e.target.value)}
                    placeholder="Ex: ABC-123"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`product-${index}-quantity`}>Quantidade *</Label>
                  <Input
                    id={`product-${index}-quantity`}
                    type="number"
                    min="1"
                    value={product.quantity}
                    onChange={(e) => handleProductChange(index, 'quantity', parseInt(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`product-${index}-cost`}>Custo Unitário *</Label>
                    <Input
                      id={`product-${index}-cost`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={product.cost}
                      onChange={(e) => handleProductChange(index, 'cost', parseFloat(e.target.value))}
                      required
                    />
                  </div>

                  {products.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveProduct(index)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Compra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}