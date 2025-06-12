import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { useCrmStore } from '@/store/crmStore';
import { useToast } from '@/hooks/use-toast';

export function AddOrderDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_id: '',
    total_amount: '',
    status: 'pending' as const,
  });
  const [loading, setLoading] = useState(false);
  const { clients, createOrder, fetchClients } = useCrmStore();
  const { toast } = useToast();

  useEffect(() => {
    if (open && clients.length === 0) {
      fetchClients();
    }
  }, [open, clients.length, fetchClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const totalAmount = parseFloat(formData.total_amount);
      
      // Validate that the amount fits within NUMERIC(10,2) constraint
      // Maximum value is 99,999,999.99 (10 digits total, 2 after decimal)
      if (totalAmount >= 100000000) {
        toast({
          title: 'Error',
          description: 'Total amount cannot exceed 99,999,999.99',
          variant: 'destructive',
        });
        return;
      }

      if (totalAmount < 0) {
        toast({
          title: 'Error',
          description: 'Total amount cannot be negative',
          variant: 'destructive',
        });
        return;
      }

      await createOrder({
        client_id: formData.client_id,
        total_amount: totalAmount,
        status: formData.status,
      });
      setOpen(false);
      setFormData({ client_id: '', total_amount: '', status: 'pending' });
      toast({
        title: 'Success',
        description: 'Order created successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create order',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Order
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Order</DialogTitle>
          <DialogDescription>
            Create a new order for a client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client">Client *</Label>
              <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Total Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max="99999999.99"
                value={formData.total_amount}
                onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                placeholder="0.00"
                required
              />
              <p className="text-xs text-muted-foreground">
                Maximum amount: 99,999,999.99
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !formData.client_id || !formData.total_amount}>
              {loading ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}