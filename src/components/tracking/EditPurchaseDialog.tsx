// src/components/tracking/EditPurchaseDialog.tsx

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
    customer_name: '',
    trackingCode: '',
    delivery_fee: 0,
    observation: '', // Adicionando observation ao estado inicial
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
        observation: purchase.observation || '', // Carregando a observation
      });
      setProducts(structuredClone(purchase.products || []));
    }
    if (open) {
      fetchProducts();
    }
  }, [purchase, open, fetchProducts]);

  // ... (outras funções handle... permanecem as mesmas)
  const handleAddProduct = () => setProducts([...products, { name: '', quantity: 1, cost: 0, sku: '' }]);
  const handleRemoveProduct = (index: number) => setProducts(products.filter((_, i) => i !== index));
  const handleProductFieldChange = (index: number, field: keyof FormProduct, value: any) => setProducts(products.map((p, i) => i === index ? { ...p, [field]: value } : p));
  const handleProductSelect = (index: number, selectedProduct: any) => setProducts(products.map((p, i) => i === index ? { ...p, id: selectedProduct.id, name: selectedProduct.name, sku: selectedProduct.sku || '' } : p));


  const handleSubmit = async (e: React.FormEvent) => {
    console.log('--- PASSO 1: handleSubmit FOI CHAMADO ---');
    
    e.preventDefault();
    if (!purchase) return;

    // Validações...
    if (!formData.date || !formData.carrier || !formData.storeName || !formData.trackingCode) {
      toast({ title: 'Erro de Validação', description: 'Por favor, preencha todos os campos da compra.', variant: 'destructive' });
      return;
    }
    if (products.length === 0 || products.some(p => !p.name || !p.sku || (p.quantity ?? 0) <= 0 || (p.cost ?? -1) < 0)) {
      toast({ title: 'Erro nos Produtos', description: 'Preencha corretamente todos os produtos.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      console.log('--- PASSO 2: CHAMANDO updatePurchase com estes dados: ---', {
        id: purchase.id,
        formData: formData,
        products: products
      });

      await updatePurchase(purchase.id, formData as any, products as any);
      
      onOpenChange(false);
    } catch (error: any) {
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
           {/* Adicionei um campo para a 'observation', já que estava na lógica da store */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ... Seus outros inputs ... */}
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
             {/* ... Seção de produtos ... */}
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