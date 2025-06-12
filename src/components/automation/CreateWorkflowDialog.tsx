import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAutomationStore } from '@/store/automationStore';

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkflowDialog({ open, onOpenChange }: CreateWorkflowDialogProps) {
  const { createWorkflow, setCurrentWorkflow } = useAutomationStore();
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
      const workflow = await createWorkflow(formData);
      if (workflow) {
        setCurrentWorkflow(workflow);
      }
      setFormData({ name: '', description: '' });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating workflow:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova Automação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Nova Automação</DialogTitle>
          <DialogDescription>
            Crie um fluxo de automação personalizado para otimizar seus processos
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflowName">Nome da Automação *</Label>
              <Input
                id="workflowName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Boas-vindas para Novos Leads"
                required
              />
            </div>
            <div>
              <Label htmlFor="workflowDescription">Descrição (Opcional)</Label>
              <Textarea
                id="workflowDescription"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o que esta automação faz..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? 'Criando...' : 'Criar Automação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}