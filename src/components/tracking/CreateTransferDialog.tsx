import { useState, useEffect } from 'react';
import { Calendar, Package, Truck, Plus, Trash2, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTrackingStore } from '@/store/trackingStore';
import { useCrmStore } from '@/store/crmStore';
import { useToast } from '@/hooks/use-toast';
import { ProductAutocomplete } from './ProductAutocomplete';

interface CreateTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormProduct = {
  name: string;
  quantity: number;
  sku: string;
};

const stockLocations = [
  { value: 'vitoria', label: 'Vitória' },
  { value: 'sao_paulo', label: 'São Paulo' },
];

export function CreateTransferDialog({ open, onOpenChange }: CreateTransferDialogProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    carrier: '',
    storeName: '',
    customer_name: '',
    trackingCode: '',
    source_stock: '',
    destination_stock: '',
  });

  const [products, setProducts] = useState<FormProduct[]>([
    { name: '', quantity: 1, sku: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const { createTransfer } = useTrackingStore();
  const { products: dbProducts, fetchProducts } = useCrmStore();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchProducts();
    }
  }, [open, fetchProducts]);

  const handleAddProduct = () => {
    setProducts([...products, { name: '', quantity: 1, sku: '' }]);
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
      name: selectedProduct.name,
      sku: selectedProduct.SKU || selectedProduct.sku || '',
    };
    setProducts(newProducts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.date || !formData.carrier || !formData.storeName || !formData.customer_name || !formData.trackingCode) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos obrigatórios da transferência',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.source_stock || !formData.destination_stock) {
      toast({
        title: 'Erro',
        description: 'Por favor, selecione os estoques de origem e destino',
        variant: 'destructive',
      });
      return;
    }

    if (formData.source_stock === formData.destination_stock) {
      toast({
        title: 'Erro',
        description: 'O estoque de origem deve ser diferente do estoque de destino',
        variant: 'destructive',
      });
      return;
    }

    if (products.length === 0 || products.some(p => !p.name || !p.sku || p.quantity <= 0)) {
      toast({
        title: 'Erro',
        description: 'Por favor, adicione pelo menos um produto válido (Nome, SKU e Quantidade)',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await createTransfer({
        ...formData,
        products,
      });

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        carrier: '',
        storeName: '',
        customer_name: '',
        trackingCode: '',
        source_stock: '',
        destination_stock: '',
      });
      setProducts([{ name: '', quantity: 1, sku: '' }]);

      onOpenChange(false);

      toast({
        title: 'Sucesso',
        description: 'Transferência criada com sucesso',
      });
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao criar transferência',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transferência</DialogTitle>
          <DialogDescription>
            Adicione uma nova transferência entre estoques para rastreamento
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                Data de Transferência *
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
                Nome do Cliente *
              </Label>
              <Input
                id="customerName"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Ex: João Silva"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
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
          </div>

          {/* Stock Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="space-y-2">
              <Label htmlFor="sourceStock" className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                Estoque que está retirando *
              </Label>
              <Select 
                value={formData.source_stock} 
                onValueChange={(value) => setFormData({ ...formData, source_stock: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estoque de origem" />
                </SelectTrigger>
                <SelectContent>
                  {stockLocations.map((location) => (
                    <SelectItem key={location.value} value={location.value}>
                      {location.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="destinationStock" className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                Estoque que está recebendo *
              </Label>
              <Select 
                value={formData.destination_stock} 
                onValueChange={(value) => setFormData({ ...formData, destination_stock: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estoque de destino" />
                </SelectTrigger>
                <SelectContent>
                  {stockLocations
                    .filter(location => location.value !== formData.source_stock)
                    .map((location) => (
                      <SelectItem key={location.value} value={location.value}>
                        {location.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Products Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Produtos em Transferência</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Produto
              </Button>
            </div>

            {products.map((product, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg items-end">
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
                  <Input 
                    value={product.sku || ''} 
                    placeholder="Selecione um produto" 
                    readOnly 
                    className="bg-gray-100 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Quantidade *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={product.quantity || 1}
                      onChange={(e) => handleProductFieldChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      required
                    />
                  </div>
                  {products.length > 1 && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      onClick={() => handleRemoveProduct(index)}
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
              {loading ? 'Criando...' : 'Criar Transferência'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}