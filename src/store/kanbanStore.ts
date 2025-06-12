import { create } from 'zustand';
import { KanbanBoard, KanbanStage, KanbanClientAssignment, Client } from '@/types';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';

interface KanbanState {
  boards: KanbanBoard[];
  currentBoard: KanbanBoard | null;
  stages: KanbanStage[];
  assignments: KanbanClientAssignment[];
  loading: boolean;

  // Actions
  fetchBoards: () => Promise<void>;
  fetchBoardData: (boardId: string) => Promise<void>;
  createBoard: (data: { name: string; description?: string }) => Promise<KanbanBoard>;
  updateBoard: (boardId: string, data: Partial<KanbanBoard>) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  setCurrentBoard: (board: KanbanBoard) => void;

  // Stage actions
  createStage: (boardId: string, data: { name: string; color?: string }) => Promise<KanbanStage>;
  updateStage: (stageId: string, data: Partial<KanbanStage>) => Promise<void>;
  deleteStage: (stageId: string) => Promise<void>;
  reorderStages: (boardId: string, stageIds: string[]) => Promise<void>;

  // Client assignment actions
  assignClientsToStage: (boardId: string, stageId: string, clientIds: string[]) => Promise<void>;
  moveClientToStage: (assignmentId: string, newStageId: string, newPosition: number) => Promise<void>;
  removeClientFromBoard: (assignmentId: string) => Promise<void>;
  reorderClientsInStage: (stageId: string, assignmentIds: string[]) => Promise<void>;

  // Utility actions
  getUnassignedClients: () => Promise<Client[]>;
}

export const useKanbanStore = create<KanbanState>((set, get) => ({
  boards: [],
  currentBoard: null,
  stages: [],
  assignments: [],
  loading: false,

  fetchBoards: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('kanban_boards')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ boards: data || [] });
    });
  },

  fetchBoardData: async (boardId) => {
    await ErrorHandler.handleAsync(async () => {
      set({ loading: true });

      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('kanban_stages')
        .select('*')
        .eq('board_id', boardId)
        .order('position', { ascending: true });

      if (stagesError) throw stagesError;

      // Fetch assignments with client data
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('kanban_client_assignments')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('board_id', boardId)
        .order('position', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      set({ 
        stages: stagesData || [], 
        assignments: assignmentsData || [],
        loading: false 
      });
    });
  },

  createBoard: async (data) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      const { data: boardData, error } = await supabase
        .from('kanban_boards')
        .insert({
          ...data,
          workspace_id: currentWorkspace.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default stages
      const defaultStages = [
        { name: 'Novo Lead', color: '#3b82f6', position: 0 },
        { name: 'Contatado', color: '#f59e0b', position: 1 },
        { name: 'Qualificado', color: '#10b981', position: 2 },
        { name: 'Cliente', color: '#8b5cf6', position: 3 },
      ];

      for (const stage of defaultStages) {
        await supabase
          .from('kanban_stages')
          .insert({
            ...stage,
            board_id: boardData.id,
          });
      }

      get().fetchBoards();
      ErrorHandler.showSuccess('Quadro Kanban criado com sucesso!');
      return boardData;
    }) || null;
  },

  updateBoard: async (boardId, data) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('kanban_boards')
        .update(data)
        .eq('id', boardId);

      if (error) throw error;
      get().fetchBoards();
      ErrorHandler.showSuccess('Quadro atualizado com sucesso!');
    });
  },

  deleteBoard: async (boardId) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('kanban_boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;
      
      const currentBoard = get().currentBoard;
      if (currentBoard?.id === boardId) {
        set({ currentBoard: null, stages: [], assignments: [] });
      }
      
      get().fetchBoards();
      ErrorHandler.showSuccess('Quadro deletado com sucesso!');
    });
  },

  setCurrentBoard: (board) => {
    set({ currentBoard: board });
    get().fetchBoardData(board.id);
  },

  createStage: async (boardId, data) => {
    return await ErrorHandler.handleAsync(async () => {
      const stages = get().stages;
      const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position)) : -1;

      const { data: stageData, error } = await supabase
        .from('kanban_stages')
        .insert({
          ...data,
          board_id: boardId,
          position: maxPosition + 1,
          color: data.color || '#3b82f6',
        })
        .select()
        .single();

      if (error) throw error;
      get().fetchBoardData(boardId);
      ErrorHandler.showSuccess('Fase criada com sucesso!');
      return stageData;
    }) || null;
  },

  updateStage: async (stageId, data) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('kanban_stages')
        .update(data)
        .eq('id', stageId);

      if (error) throw error;
      
      const currentBoard = get().currentBoard;
      if (currentBoard) {
        get().fetchBoardData(currentBoard.id);
      }
      ErrorHandler.showSuccess('Fase atualizada com sucesso!');
    });
  },

  deleteStage: async (stageId) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('kanban_stages')
        .delete()
        .eq('id', stageId);

      if (error) throw error;
      
      const currentBoard = get().currentBoard;
      if (currentBoard) {
        get().fetchBoardData(currentBoard.id);
      }
      ErrorHandler.showSuccess('Fase deletada com sucesso!');
    });
  },

  reorderStages: async (boardId, stageIds) => {
    await ErrorHandler.handleAsync(async () => {
      const updates = stageIds.map((stageId, index) => ({
        id: stageId,
        position: index,
      }));

      for (const update of updates) {
        await supabase
          .from('kanban_stages')
          .update({ position: update.position })
          .eq('id', update.id);
      }

      get().fetchBoardData(boardId);
    });
  },

  assignClientsToStage: async (boardId, stageId, clientIds) => {
    await ErrorHandler.handleAsync(async () => {
      const assignments = get().assignments.filter(a => a.stage_id === stageId);
      const maxPosition = assignments.length > 0 ? Math.max(...assignments.map(a => a.position)) : -1;

      const insertData = clientIds.map((clientId, index) => ({
        board_id: boardId,
        stage_id: stageId,
        client_id: clientId,
        position: maxPosition + 1 + index,
      }));

      const { error } = await supabase
        .from('kanban_client_assignments')
        .upsert(insertData, { 
          onConflict: 'board_id,client_id',
          ignoreDuplicates: false 
        });

      if (error) throw error;
      get().fetchBoardData(boardId);
      ErrorHandler.showSuccess(`${clientIds.length} cliente(s) adicionado(s) ao quadro!`);
    });
  },

  moveClientToStage: async (assignmentId, newStageId, newPosition) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('kanban_client_assignments')
        .update({
          stage_id: newStageId,
          position: newPosition,
        })
        .eq('id', assignmentId);

      if (error) throw error;
      
      const currentBoard = get().currentBoard;
      if (currentBoard) {
        get().fetchBoardData(currentBoard.id);
      }
    });
  },

  removeClientFromBoard: async (assignmentId) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('kanban_client_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;
      
      const currentBoard = get().currentBoard;
      if (currentBoard) {
        get().fetchBoardData(currentBoard.id);
      }
      ErrorHandler.showSuccess('Cliente removido do quadro!');
    });
  },

  reorderClientsInStage: async (stageId, assignmentIds) => {
    await ErrorHandler.handleAsync(async () => {
      const updates = assignmentIds.map((assignmentId, index) => ({
        id: assignmentId,
        position: index,
      }));

      for (const update of updates) {
        await supabase
          .from('kanban_client_assignments')
          .update({ position: update.position })
          .eq('id', update.id);
      }

      const currentBoard = get().currentBoard;
      if (currentBoard) {
        get().fetchBoardData(currentBoard.id);
      }
    });
  },

  getUnassignedClients: async () => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      const currentBoard = get().currentBoard;
      
      if (!currentWorkspace || !currentBoard) return [];

      // Get all clients in workspace
      const { data: allClients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('workspace_id', currentWorkspace.id);

      if (clientsError) throw clientsError;

      // Get assigned client IDs for current board
      const { data: assignments, error: assignmentsError } = await supabase
        .from('kanban_client_assignments')
        .select('client_id')
        .eq('board_id', currentBoard.id);

      if (assignmentsError) throw assignmentsError;

      const assignedClientIds = new Set(assignments?.map(a => a.client_id) || []);
      
      return (allClients || []).filter(client => !assignedClientIds.has(client.id));
    }) || [];
  },
}));