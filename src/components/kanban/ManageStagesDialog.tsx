import { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useKanbanStore } from '@/store/kanbanStore';

interface ManageStagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
}

const stageColors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export function ManageStagesDialog({ open, onOpenChange, boardId }: ManageStagesDialogProps) {
  const { stages, assignments, createStage, updateStage, deleteStage, reorderStages } = useKanbanStore();
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('#3b82f6');
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', color: '' });
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCreateStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStageName.trim()) return;

    setLoading(true);
    try {
      await createStage(boardId, {
        name: newStageName,
        color: newStageColor,
      });
      setNewStageName('');
      setNewStageColor('#3b82f6');
    } catch (error) {
      console.error('Error creating stage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStage = async (stageId: string) => {
    if (!editData.name.trim()) return;

    setLoading(true);
    try {
      await updateStage(stageId, editData);
      setEditingStage(null);
    } catch (error) {
      console.error('Error updating stage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    setLoading(true);
    try {
      await deleteStage(stageId);
    } catch (error) {
      console.error('Error deleting stage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const newStageOrder = Array.from(stages);
    const [reorderedStage] = newStageOrder.splice(result.source.index, 1);
    newStageOrder.splice(result.destination.index, 0, reorderedStage);

    const stageIds = newStageOrder.map(stage => stage.id);
    await reorderStages(boardId, stageIds);
  };

  const getStageClientCount = (stageId: string) => {
    return assignments.filter(assignment => assignment.stage_id === stageId).length;
  };

  const startEditing = (stage: any) => {
    setEditingStage(stage.id);
    setEditData({ name: stage.name, color: stage.color });
  };

  if (!mounted) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Gerenciar Fases
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Fases do Quadro</DialogTitle>
          <DialogDescription>
            Adicione, edite, remova e reordene as fases do seu quadro Kanban
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Create New Stage */}
          <div className="border rounded-lg p-4">
            <h3 className="font-medium mb-3">Criar Nova Fase</h3>
            <form onSubmit={handleCreateStage} className="space-y-3">
              <div>
                <Label htmlFor="stageName">Nome da Fase</Label>
                <Input
                  id="stageName"
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Ex: Proposta Enviada"
                />
              </div>
              <div>
                <Label>Cor da Fase</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stageColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        newStageColor === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewStageColor(color)}
                    />
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={loading || !newStageName.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Fase
              </Button>
            </form>
          </div>

          {/* Existing Stages */}
          <div>
            <h3 className="font-medium mb-3">Fases Existentes ({stages.length})</h3>
            
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="stages">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {stages.map((stage, index) => (
                      <Draggable key={stage.id} draggableId={stage.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={snapshot.isDragging ? 'opacity-50' : ''}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div {...provided.dragHandleProps}>
                                    <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                                  </div>
                                  
                                  <div 
                                    className="w-4 h-4 rounded-full" 
                                    style={{ backgroundColor: stage.color }}
                                  />
                                  
                                  {editingStage === stage.id ? (
                                    <div className="flex items-center space-x-2 flex-1">
                                      <Input
                                        value={editData.name}
                                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                        className="flex-1"
                                      />
                                      <div className="flex space-x-1">
                                        {stageColors.map((color) => (
                                          <button
                                            key={color}
                                            type="button"
                                            className={`w-6 h-6 rounded-full border ${
                                              editData.color === color ? 'border-gray-900' : 'border-gray-300'
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setEditData({ ...editData, color })}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium">{stage.name}</span>
                                      <Badge variant="secondary">
                                        {getStageClientCount(stage.id)} clientes
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex items-center space-x-1">
                                  {editingStage === stage.id ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleUpdateStage(stage.id)}
                                        disabled={loading}
                                      >
                                        Salvar
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setEditingStage(null)}
                                      >
                                        Cancelar
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => startEditing(stage)}
                                      >
                                        <Edit2 className="h-4 w-4" />
                                      </Button>
                                      
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button size="sm" variant="ghost">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Deletar Fase</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Tem certeza que deseja deletar a fase "{stage.name}"? 
                                              Todos os {getStageClientCount(stage.id)} clientes nesta fase serão removidos do quadro.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteStage(stage.id)}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              Deletar
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}