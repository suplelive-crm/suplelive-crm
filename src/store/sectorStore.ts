import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';

export interface Sector {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  color: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface SectorState {
  sectors: Sector[];
  loading: boolean;
  
  // Actions
  fetchSectors: () => Promise<void>;
  createSector: (data: { name: string; description?: string; color?: string; is_default?: boolean }) => Promise<Sector>;
  updateSector: (id: string, data: Partial<Sector>) => Promise<void>;
  deleteSector: (id: string) => Promise<void>;
  getDefaultSector: () => Sector | undefined;
}

export const useSectorStore = create<SectorState>((set, get) => ({
  sectors: [],
  loading: false,
  
  fetchSectors: async () => {
    await ErrorHandler.handleAsync(async () => {
      set({ loading: true });
      
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;
      
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      set({ sectors: data || [], loading: false });
    });
  },
  
  createSector: async (data) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');
      
      // If setting as default, unset any existing default
      if (data.is_default) {
        await supabase
          .from('sectors')
          .update({ is_default: false })
          .eq('workspace_id', currentWorkspace.id)
          .eq('is_default', true);
      }
      
      const { data: sectorData, error } = await supabase
        .from('sectors')
        .insert({
          ...data,
          workspace_id: currentWorkspace.id,
          color: data.color || '#3b82f6',
        })
        .select()
        .single();
        
      if (error) throw error;
      
      get().fetchSectors();
      ErrorHandler.showSuccess('Setor criado com sucesso!');
      return sectorData;
    }) || null;
  },
  
  updateSector: async (id, data) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;
      
      // If setting as default, unset any existing default
      if (data.is_default) {
        await supabase
          .from('sectors')
          .update({ is_default: false })
          .eq('workspace_id', currentWorkspace.id)
          .eq('is_default', true);
      }
      
      const { error } = await supabase
        .from('sectors')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
        
      if (error) throw error;
      
      get().fetchSectors();
      ErrorHandler.showSuccess('Setor atualizado com sucesso!');
    });
  },
  
  deleteSector: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      const sectors = get().sectors;
      const sectorToDelete = sectors.find(s => s.id === id);
      
      if (sectorToDelete?.is_default) {
        throw new Error('Não é possível excluir o setor padrão');
      }
      
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      get().fetchSectors();
      ErrorHandler.showSuccess('Setor excluído com sucesso!');
    });
  },
  
  getDefaultSector: () => {
    return get().sectors.find(s => s.is_default);
  },
}));