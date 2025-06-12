import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Sector, useSectorStore } from '@/store/sectorStore';
import { useConversationStore } from '@/store/conversationStore';

const sectorColors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

interface SectorSelectorProps {
  conversationId?: string;
}

export function SectorSelector({ conversationId }: SectorSelectorProps) {
  const { sectors, fetchSectors, createSector, updateSector, deleteSector } = useSectorStore();
  const { activeConversation, updateConversationSector } = useConversationStore();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSector, setSelectedSector] = useState<Sector | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    is_default: false,
  });
  
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);
  
  useEffect(() => {
    if (selectedSector) {
      setFormData({
        name: selectedSector.name,
        description: selectedSector.description || '',
        color: selectedSector.color,
        is_default: selectedSector.is_default,
      });
    }
  }, [selectedSector]);
  
  const handleCreateSector = async () => {
    if (!formData.name.trim()) return;
    
    setLoading(true);
    try {
      await createSector(formData);
      setFormData({
        name: '',
        description: '',
        color: '#3b82f6',
        is_default: false,
      });
      setCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating sector:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdateSector = async () => {
    if (!selectedSector || !formData.name.trim()) return;
    
    setLoading(true);
    try {
      await updateSector(selectedSector.id, formData);
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating sector:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteSector = async () => {
    if (!selectedSector) return;
    
    setLoading(true);
    try {
      await deleteSector(selectedSector.id);
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error deleting sector:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectSector = async (sectorId: string) => {
    if (!conversationId && !activeConversation) return;
    
    const id = conversationId || activeConversation?.id;
    if (!id) return;
    
    try {
      await updateConversationSector(id, sectorId);
    } catch (error) {
      console.error('Error updating conversation sector:', error);
    }
  };
  
  const currentSectorId = activeConversation?.sector_id;
  const currentSector = sectors.find(s => s.id === currentSectorId);
  
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <div 
              className="w-3 h-3 rounded-full mr-2" 
              style={{ backgroundColor: currentSector?.color || '#3b82f6' }}
            />
            {currentSector?.name || 'Sem setor'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sectors.map((sector) => (
            <DropdownMenuItem 
              key={sector.id}
              onClick={() => handleSelectSector(sector.id)}
            >
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: sector.color }}
                />
                <span>{sector.name}</span>
                {sector.id === currentSectorId && (
                  <Check className="h-4 w-4 ml-2" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Novo Setor
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Setor</DialogTitle>
                <DialogDescription>
                  Crie um novo setor para organizar seus atendimentos
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="sectorName">Nome do Setor *</Label>
                  <Input
                    id="sectorName"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Suporte Técnico"
                  />
                </div>
                <div>
                  <Label htmlFor="sectorDescription">Descrição (Opcional)</Label>
                  <Textarea
                    id="sectorDescription"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descreva a função deste setor..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Cor do Setor</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {sectorColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-gray-900' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  />
                  <Label htmlFor="isDefault">Definir como setor padrão</Label>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateSector} disabled={loading || !formData.name.trim()}>
                  {loading ? 'Criando...' : 'Criar Setor'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                  <Edit2 className="h-4 w-4 mr-2" />
                  Gerenciar Setores
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Gerenciar Setores</DialogTitle>
                  <DialogDescription>
                    Edite ou remova setores existentes
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {sectors.map((sector) => (
                    <div 
                      key={sector.id} 
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: sector.color }}
                        />
                        <div>
                          <div className="font-medium">{sector.name}</div>
                          {sector.is_default && (
                            <Badge variant="outline" className="text-xs">Padrão</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedSector(sector);
                            setEditDialogOpen(false);
                            setTimeout(() => setEditDialogOpen(true), 100);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        
                        {!sector.is_default && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Setor</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o setor "{sector.name}"?
                                  As conversas deste setor serão movidas para o setor padrão.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    setSelectedSector(sector);
                                    handleDeleteSector();
                                  }}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedSector && (
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-medium mb-3">Editar Setor</h3>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="editSectorName">Nome do Setor *</Label>
                        <Input
                          id="editSectorName"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="editSectorDescription">Descrição</Label>
                        <Textarea
                          id="editSectorDescription"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label>Cor do Setor</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {sectorColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`w-6 h-6 rounded-full border-2 ${
                                formData.color === color ? 'border-gray-900' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setFormData({ ...formData, color })}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="editIsDefault"
                          checked={formData.is_default}
                          onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                        />
                        <Label htmlFor="editIsDefault">Definir como setor padrão</Label>
                      </div>
                      <Button 
                        onClick={handleUpdateSector} 
                        disabled={loading || !formData.name.trim()}
                        className="w-full"
                      >
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}