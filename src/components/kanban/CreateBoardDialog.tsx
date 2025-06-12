import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useKanbanStore } from '@/store/kanbanStore';

interface CreateBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBoardDialog({ open, onOpenChange }: CreateBoardDialogProps) {
  const { createBoard } = useKanbanStore();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      await createBoard(formData);
      setFormData({ name: '', description: '' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating board:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Novo Quadro
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Quadro Kanban</DialogTitle>
          <DialogDescription>
            Crie um novo quadro para organizar seus clientes em fases personalizadas
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="boardName">Nome do Quadro *</Label>
              <Input
                id="boardName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Pipeline de Vendas"
                required
              />
            </div>
            <div>
              <Label htmlFor="boardDescription">Descrição (Opcional)</Label>
              <Textarea
                id="boardDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o propósito deste quadro..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? 'Criando...' : 'Criar Quadro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}