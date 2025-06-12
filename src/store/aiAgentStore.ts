import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';
import { getOpenAI, initializeOpenAI } from '@/lib/openai-api';

export interface AIAgent {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
  description?: string;
  config: {
    model: string;
    temperature: number;
    systemPrompt: string;
    maxTokens?: number;
  };
  created_at: string;
  updated_at: string;
}

interface AIAgentState {
  agents: AIAgent[];
  loading: boolean;
  
  // Actions
  fetchAgents: () => Promise<void>;
  createAgent: (data: Omit<AIAgent, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>) => Promise<AIAgent>;
  updateAgent: (id: string, data: Partial<Omit<AIAgent, 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  testAgent: (id: string, message: string) => Promise<string>;
  getAgentById: (id: string) => AIAgent | undefined;
}

export const useAIAgentStore = create<AIAgentState>((set, get) => ({
  agents: [],
  loading: false,
  
  fetchAgents: async () => {
    await ErrorHandler.handleAsync(async () => {
      set({ loading: true });
      
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;
      
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      set({ agents: data || [], loading: false });
    });
  },
  
  createAgent: async (data) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');
      
      const { data: agentData, error } = await supabase
        .from('ai_agents')
        .insert({
          ...data,
          workspace_id: currentWorkspace.id,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      get().fetchAgents();
      return agentData;
    }) || null;
  },
  
  updateAgent: async (id, data) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('ai_agents')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
        
      if (error) throw error;
      
      get().fetchAgents();
    });
  },
  
  deleteAgent: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      get().fetchAgents();
    });
  },
  
  testAgent: async (id, message) => {
    return await ErrorHandler.handleAsync(async () => {
      const agent = get().agents.find(a => a.id === id);
      if (!agent) throw new Error('Agente não encontrado');
      
      // Get OpenAI API key from localStorage
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');
      
      const savedConfig = localStorage.getItem(`openai_config_${currentWorkspace.id}`);
      if (!savedConfig) throw new Error('Configuração OpenAI não encontrada');
      
      const { apiKey } = JSON.parse(savedConfig);
      if (!apiKey) throw new Error('Chave API OpenAI não configurada');
      
      // Initialize OpenAI with the agent's config
      const openai = initializeOpenAI(apiKey, {
        model: agent.config.model,
        temperature: agent.config.temperature,
        maxTokens: agent.config.maxTokens || 500,
      });
      
      // Generate response
      const response = await openai.generateChatbotResponse(
        message,
        [],
        {
          clientName: 'Cliente de Teste',
          businessInfo: {
            name: currentWorkspace.name,
            sector: 'Atendimento ao Cliente',
          },
        }
      );
      
      return response.message;
    }) || 'Erro ao gerar resposta';
  },
  
  getAgentById: (id) => {
    return get().agents.find(a => a.id === id);
  },
}));