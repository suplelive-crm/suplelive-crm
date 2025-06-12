import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { MoreVertical, Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { KanbanClientCard } from './KanbanClientCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KanbanStage, KanbanClientAssignment } from '@/types';
import { useKanbanStore } from '@/store/kanbanStore';

interface KanbanColumnProps {
  stage: KanbanStage;
  assignments: KanbanClientAssignment[];
  dragHandleProps?: any;
}

const stageColors = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export function KanbanColumn({ stage, assignments, dragHandleProps }: KanbanColumnProps) {
  const { updateStage, deleteStage, currentBoard } = useKanbanStore();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState({
    name: stage.name,
    color: stage.color,
  });

  const handleUpdateStage = async () => {
    await updateStage(stage.id, editData);
    setEditDialogOpen(false);
  };

  const handleDeleteStage = async () => {
    await deleteStage(stage.id);
  };

  return (
    <Card className="w-80 h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: stage.color }}
            />
            <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {assignments.length}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-1">
            <div {...dragHandleProps} className="cursor-grab hover:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-gray-400" />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                  <DialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar Fase
                    </DropdownMenuItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Fase</DialogTitle>
                      <DialogDescription>
                        Altere o nome e a cor da fase
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="stageName">Nome da Fase</Label>
                        <Input
                          id="stageName"
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Cor da Fase</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {stageColors.map((color) => (
                            <button
                              key={color}
                              className={`w-8 h-8 rounded-full border-2 ${
                                editData.color === color ? 'border-gray-900' : 'border-gray-300'
                              }`}
                              style={{ backgroundColor: color }}
                              onClick={() => setEditData({ ...editData, color })}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUpdateStage}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Deletar Fase
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deletar Fase</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja deletar a fase "{stage.name}"? 
                        Todos os clientes nesta fase serão removidos do quadro.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteStage}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Deletar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-3">
        <Droppable droppableId={stage.id} type="client">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`h-full overflow-y-auto space-y-3 ${
                snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg' : ''
              }`}
            >
              {assignments.map((assignment, index) => (
                <Draggable
                  key={assignment.id}
                  draggableId={assignment.id}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={snapshot.isDragging ? 'opacity-50' : ''}
                    >
                      <KanbanClientCard assignment={assignment} />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              
              {assignments.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  Nenhum cliente nesta fase
                </div>
              )}
            </div>
          )}
        </Droppable>
      </CardContent>
    </Card>
  );
}