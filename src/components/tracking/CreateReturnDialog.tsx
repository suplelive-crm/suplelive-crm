import { useState } from 'react';
import { Calendar, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTrackingStore } from '@/store/trackingStore';
import { useToast } from '@/hooks/use-toast';

interface CreateReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateReturnDialog({ open, onOpenChange }: CreateReturnDialogProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    carrier: '',
    storeName: '',
    customer_name: '',
    trackingCode: '',
    observations: '',
  });
  
  const [loading, setLoading] = useState(false);
  const { createReturn } = useTrackingStore();
  const { toast } = useToast();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.date || !formData.carrier || !formData.storeName || !formData.customer_name || !formData.trackingCode) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    try {
      await createReturn(formData);
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        carrier: '',
        storeName: '',
        customer_name: '',
        trackingCode: '',
        observations: '',
      });
      
      onOpenChange(false);
      
      toast({
        title: 'Sucesso',
        description: 'Devolução criada com sucesso',
      });
    } catch (error) {
      console.error('Error creating return:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao criar devolução',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Devolução</DialogTitle>
          <DialogDescription>
            Adicione uma nova devolução para rastreamento
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                Data de Devolução *
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
  {/* A MUDANÇA É AQUI 👇, NA PRIMEIRA LINHA DO SELECT */}
  <Select modal={false} value={formData.carrier || ''} onValueChange={(value: string) => setFormData({ ...formData, carrier: value })}>
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
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observations" className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                Observações (Opcional)
              </Label>
              <Textarea
                id="observations"
                value={formData.observations || ''}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                placeholder="Adicione observações sobre esta devolução..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Devolução'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}