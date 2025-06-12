import { useState, useEffect } from 'react';
import { Users, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Client } from '@/types';
import { useKanbanStore } from '@/store/kanbanStore';

interface AddClientsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}

export function AddClientsDialog({ open, onOpenChange, boardId }: AddClientsDialogProps) {
  const { stages, assignClientsToStage, getUnassignedClients } = useKanbanStore();
  const [unassignedClients, setUnassignedClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadUnassignedClients();
      setSelectedClients([]);
      setSelectedStage('');
      setSearchTerm('');
    }
  }, [open]);

  const loadUnassignedClients = async () => {
    try {
      const clients = await getUnassignedClients();
      setUnassignedClients(clients);
    } catch (error) {
      console.error('Error loading unassigned clients:', error);
    }
  };

  const filteredClients = unassignedClients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone?.includes(searchTerm)
  );

  const handleClientToggle = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(client => client.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClients.length === 0 || !selectedStage) return;

    setLoading(true);
    try {
      await assignClientsToStage(boardId, selectedStage, selectedClients);
      onOpenChange(false);
    } catch (error) {
      console.error('Error assigning clients:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="h-4 w-4 mr-2" />
          Adicionar Clientes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Adicionar Clientes ao Quadro</DialogTitle>
          <DialogDescription>
            Selecione os clientes que deseja adicionar ao quadro Kanban
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="stage">Fase de Destino *</Label>
            <Select value={selectedStage} onValueChange={setSelectedStage}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma fase" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color }}
                      />
                      <span>{stage.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="search">Buscar Clientes</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, email ou telefone..."
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Clientes Disponíveis ({filteredClients.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedClients.length === filteredClients.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
            </div>
            
            <ScrollArea className="h-64 border rounded-md p-2">
              {filteredClients.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {unassignedClients.length === 0 
                    ? 'Todos os clientes já estão no quadro'
                    : 'Nenhum cliente encontrado'
                  }
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-md"
                    >
                      <Checkbox
                        checked={selectedClients.includes(client.id)}
                        onCheckedChange={() => handleClientToggle(client.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{client.name}</div>
                        <div className="text-sm text-gray-600">
                          {client.email && <span>{client.email}</span>}
                          {client.email && client.phone && <span> • </span>}
                          {client.phone && <span>{client.phone}</span>}
                        </div>
                        {client.tags && client.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {client.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {client.tags.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{client.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {selectedClients.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-md">
              <div className="text-sm font-medium text-blue-900">
                {selectedClients.length} cliente(s) selecionado(s)
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || selectedClients.length === 0 || !selectedStage}
            >
              {loading ? 'Adicionando...' : `Adicionar ${selectedClients.length} Cliente(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}