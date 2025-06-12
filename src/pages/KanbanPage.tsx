import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Settings, Trash2, Edit2, Users, MoreVertical } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { CreateBoardDialog } from '@/components/kanban/CreateBoardDialog';
import { AddClientsDialog } from '@/components/kanban/AddClientsDialog';
import { ManageStagesDialog } from '@/components/kanban/ManageStagesDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useKanbanStore } from '@/store/kanbanStore';

export function KanbanPage() {
  const {
    boards,
    currentBoard,
    stages,
    assignments,
    loading,
    fetchBoards,
    setCurrentBoard,
    deleteBoard,
  } = useKanbanStore();

  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [addClientsOpen, setAddClientsOpen] = useState(false);
  const [manageStagesOpen, setManageStagesOpen] = useState(false);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  // Set first board as current if none selected
  useEffect(() => {
    if (!currentBoard && boards.length > 0) {
      setCurrentBoard(boards[0]);
    }
  }, [boards, currentBoard, setCurrentBoard]);

  const handleBoardChange = (boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (board) {
      setCurrentBoard(board);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    await deleteBoard(boardId);
    if (currentBoard?.id === boardId && boards.length > 1) {
      const remainingBoards = boards.filter(b => b.id !== boardId);
      if (remainingBoards.length > 0) {
        setCurrentBoard(remainingBoards[0]);
      }
    }
  };

  const totalClients = assignments.length;
  const stagesWithClients = stages.filter(stage => 
    assignments.some(assignment => assignment.stage_id === stage.id)
  ).length;

  return (
    <DashboardLayout>
      <div className="w-full h-full">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full h-full flex flex-col"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Kanban</h1>
              <p className="text-gray-600 mt-2">Gerencie clientes através de fases personalizáveis</p>
            </div>
            
            <div className="flex items-center gap-2">
              <CreateBoardDialog 
                open={createBoardOpen} 
                onOpenChange={setCreateBoardOpen}
              />
              
              {currentBoard && (
                <>
                  <AddClientsDialog 
                    open={addClientsOpen} 
                    onOpenChange={setAddClientsOpen}
                    boardId={currentBoard.id}
                  />
                  
                  <ManageStagesDialog
                    open={manageStagesOpen}
                    onOpenChange={setManageStagesOpen}
                    boardId={currentBoard.id}
                  />
                </>
              )}
            </div>
          </div>

          {/* Board Selection and Stats */}
          {boards.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-4 mb-6">
              <Card className="flex-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Quadro Atual</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <Select 
                      value={currentBoard?.id || ''} 
                      onValueChange={handleBoardChange}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="Selecione um quadro" />
                      </SelectTrigger>
                      <SelectContent>
                        {boards.map((board) => (
                          <SelectItem key={board.id} value={board.id}>
                            {board.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {currentBoard && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => setManageStagesOpen(true)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Gerenciar Fases
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAddClientsOpen(true)}>
                            <Users className="h-4 w-4 mr-2" />
                            Adicionar Clientes
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Deletar Quadro
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deletar Quadro</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja deletar o quadro "{currentBoard.name}"? 
                                  Esta ação não pode ser desfeita e todos os dados do quadro serão perdidos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteBoard(currentBoard.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Deletar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  
                  {currentBoard?.description && (
                    <p className="text-sm text-gray-600 mt-2">{currentBoard.description}</p>
                  )}
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="flex gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">{totalClients}</div>
                    <div className="text-sm text-gray-600">Total de Clientes</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">{stages.length}</div>
                    <div className="text-sm text-gray-600">Fases</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-purple-600">{stagesWithClients}</div>
                    <div className="text-sm text-gray-600">Fases Ativas</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : currentBoard ? (
              <KanbanBoard />
            ) : boards.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Nenhum quadro Kanban
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Crie seu primeiro quadro Kanban para começar a organizar seus clientes
                  </p>
                  <Button onClick={() => setCreateBoardOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Quadro
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Selecione um quadro
                  </h3>
                  <p className="text-gray-500">
                    Escolha um quadro Kanban para visualizar e gerenciar seus clientes
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}