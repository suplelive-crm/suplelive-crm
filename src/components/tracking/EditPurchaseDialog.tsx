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
        customer_name: purchase.customer_name || '',
        trackingCode: purchase.trackingCode || '',
        delivery_fee: purchase.delivery_fee || 0,
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
    const newProducts = [...products];
    const product = newProducts[index];
    if (product) {
      (product as any)[field] = value;
      setProducts(newProducts);
    }
  };
  
  const handleProductSelect = (index: number, selectedProduct: any) => {
    const newProducts = [...products];
    const existingProduct = newProducts[index];
    if (existingProduct) {
        existingProduct.id = selectedProduct.id; // Pode ser o ID do produto no CRM, mas não o da linha de compra
        existingProduct.name = selectedProduct.name;
        existingProduct.sku = selectedProduct.sku || '';
        // Opcional: buscar e preencher o custo padrão do produto aqui
    }
    setProducts(newProducts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

    // Validações...
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
      toast({ title: 'Sucesso', description: 'Compra atualizada com sucesso!' });
      onOpenChange(false);
    } catch (error) {
      // O ErrorHandler na store já deve tratar o erro, mas podemos logar aqui.
      console.error('Falha ao submeter a atualização:', error);
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
          {/* Campos do formulário principal (data, transportadora, etc.) - Sem alterações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ... os inputs de data, carrier, etc. continuam aqui ... */}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Produtos</h3>
              <Button type="button" variant="outline" size="sm" onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar Novo Produto
              </Button>
            </div>

            {/* AQUI ESTÁ A LÓGICA ATUALIZADA */}
            {products.map((product, index) => {
              // Verifica se o produto já existia na compra (se tem um ID da tabela 'purchase_products')
              const isExistingProduct = !!product.id;

              return (
                <div key={index} className={`grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg items-end ${isExistingProduct ? 'bg-gray-50/50' : ''}`}>
                  
                  {/* --- CAMPO NOME DO PRODUTO --- */}
                  <div className="md:col-span-2 space-y-2">
                    <Label>Nome do Produto *</Label>
                    {isExistingProduct ? (
                      <Input value={product.name || ''} disabled className="cursor-not-allowed" />
                    ) : (
                      <ProductAutocomplete
                        products={dbProducts}
                        value={product}
                        onSelect={(selectedProduct) => handleProductSelect(index, selectedProduct)}
                        onInputChange={(text) => handleProductFieldChange(index, 'name', text)}
                      />
                    )}
                  </div>

                  {/* --- CAMPO SKU --- */}
                  <div className="space-y-2">
                    <Label>SKU *</Label>
                    <Input value={product.sku || ''} disabled className="cursor-not-allowed" />
                  </div>

                  {/* --- CAMPO QUANTIDADE (SEMPRE EDITÁVEL) --- */}
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
                    {/* --- CAMPO CUSTO UNITÁRIO --- */}
                    <div className="flex-1">
                      <Label className="flex items-center gap-1">
                        {isExistingProduct && <Lock className="h-3 w-3 text-gray-400" />}
                        Custo Unitário *
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.cost || 0}
                        onChange={(e) => handleProductFieldChange(index, 'cost', parseFloat(e.target.value) || 0)}
                        disabled={isExistingProduct} // Bloqueado se for produto existente
                        className={isExistingProduct ? "cursor-not-allowed" : ""}
                      />
                    </div>

                    {/* --- BOTÃO REMOVER (SÓ PARA NOVOS PRODUTOS) --- */}
                    {!isExistingProduct && (
                      <Button type="button" variant="destructive" size="icon" onClick={() => handleRemoveProduct(index)} >
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