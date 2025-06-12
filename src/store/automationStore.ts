import { create } from 'zustand';
import { AutomationWorkflow, AutomationTemplate, AutomationExecution, WorkflowData, WorkflowNode, WorkflowConnection } from '@/types';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';

interface AutomationState {
  workflows: AutomationWorkflow[];
  templates: AutomationTemplate[];
  executions: AutomationExecution[];
  currentWorkflow: AutomationWorkflow | null;
  loading: boolean;

  // Actions
  fetchWorkflows: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  fetchExecutions: (workflowId?: string) => Promise<void>;
  createWorkflow: (data: { name: string; description?: string; template_id?: string }) => Promise<AutomationWorkflow>;
  updateWorkflow: (workflowId: string, data: Partial<AutomationWorkflow>) => Promise<void>;
  deleteWorkflow: (workflowId: string) => Promise<void>;
  setCurrentWorkflow: (workflow: AutomationWorkflow | null) => void;
  
  // Workflow builder actions
  updateWorkflowData: (workflowId: string, workflowData: WorkflowData) => Promise<void>;
  addNode: (workflowId: string, node: WorkflowNode) => Promise<void>;
  updateNode: (workflowId: string, nodeId: string, data: Partial<WorkflowNode>) => Promise<void>;
  deleteNode: (workflowId: string, nodeId: string) => Promise<void>;
  addConnection: (workflowId: string, connection: WorkflowConnection) => Promise<void>;
  deleteConnection: (workflowId: string, connectionId: string) => Promise<void>;
  
  // Execution actions
  executeWorkflow: (workflowId: string, triggerData?: Record<string, any>) => Promise<void>;
  pauseWorkflow: (workflowId: string) => Promise<void>;
  resumeWorkflow: (workflowId: string) => Promise<void>;
  
  // Template actions
  createTemplate: (workflowId: string, templateData: { name: string; description?: string; category: string }) => Promise<void>;
  importTemplate: (templateId: string) => Promise<AutomationWorkflow>;
}

export const useAutomationStore = create<AutomationState>((set, get) => ({
  workflows: [],
  templates: [],
  executions: [],
  currentWorkflow: null,
  loading: false,

  fetchWorkflows: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('automation_workflows')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      set({ workflows: data || [] });
    });
  },

  fetchTemplates: async () => {
    await ErrorHandler.handleAsync(async () => {
      const { data, error } = await supabase
        .from('automation_templates')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ templates: data || [] });
    });
  },

  fetchExecutions: async (workflowId) => {
    await ErrorHandler.handleAsync(async () => {
      let query = supabase
        .from('automation_executions')
        .select(`
          *,
          workflow:automation_workflows(name),
          client:clients(name),
          conversation:conversations(*)
        `)
        .order('started_at', { ascending: false })
        .limit(100);

      if (workflowId) {
        query = query.eq('workflow_id', workflowId);
      } else {
        const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
        if (!currentWorkspace) return;
        
        query = query.in('workflow_id', 
          get().workflows.map(w => w.id)
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      set({ executions: data || [] });
    });
  },

  createWorkflow: async (data) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      let workflowData: WorkflowData = {
        nodes: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 }
      };

      // If creating from template
      if (data.template_id) {
        const template = get().templates.find(t => t.id === data.template_id);
        if (template) {
          workflowData = template.template_data;
        }
      }

      // Destructure to exclude template_id from the data sent to the database
      const { template_id, ...workflowCreateData } = data;

      const { data: workflowRecord, error } = await supabase
        .from('automation_workflows')
        .insert({
          ...workflowCreateData,
          workspace_id: currentWorkspace.id,
          workflow_data: workflowData,
          trigger_type: 'event_based',
        })
        .select()
        .single();

      if (error) throw error;
      
      get().fetchWorkflows();
      ErrorHandler.showSuccess('Automação criada com sucesso!');
      return workflowRecord;
    }) || null;
  },

  updateWorkflow: async (workflowId, data) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('automation_workflows')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', workflowId);

      if (error) throw error;
      
      get().fetchWorkflows();
      
      // Update current workflow if it's the one being updated
      const currentWorkflow = get().currentWorkflow;
      if (currentWorkflow?.id === workflowId) {
        set({ currentWorkflow: { ...currentWorkflow, ...data } });
      }
      
      ErrorHandler.showSuccess('Automação atualizada com sucesso!');
    });
  },

  deleteWorkflow: async (workflowId) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('automation_workflows')
        .delete()
        .eq('id', workflowId);

      if (error) throw error;
      
      const currentWorkflow = get().currentWorkflow;
      if (currentWorkflow?.id === workflowId) {
        set({ currentWorkflow: null });
      }
      
      get().fetchWorkflows();
      ErrorHandler.showSuccess('Automação deletada com sucesso!');
    });
  },

  setCurrentWorkflow: (workflow) => {
    set({ currentWorkflow: workflow });
  },

  updateWorkflowData: async (workflowId, workflowData) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('automation_workflows')
        .update({ 
          workflow_data: workflowData,
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId);

      if (error) throw error;
      
      const currentWorkflow = get().currentWorkflow;
      if (currentWorkflow?.id === workflowId) {
        set({ 
          currentWorkflow: { 
            ...currentWorkflow, 
            workflow_data: workflowData 
          } 
        });
      }
    });
  },

  addNode: async (workflowId, node) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkflow = get().currentWorkflow;
      if (!currentWorkflow || currentWorkflow.id !== workflowId) return;

      const updatedWorkflowData = {
        ...currentWorkflow.workflow_data,
        nodes: [...(currentWorkflow.workflow_data.nodes || []), node]
      };

      await get().updateWorkflowData(workflowId, updatedWorkflowData);
    });
  },

  updateNode: async (workflowId, nodeId, data) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkflow = get().currentWorkflow;
      if (!currentWorkflow || currentWorkflow.id !== workflowId) return;

      const updatedWorkflowData = {
        ...currentWorkflow.workflow_data,
        nodes: (currentWorkflow.workflow_data.nodes || []).map(node =>
          node.id === nodeId ? { ...node, ...data } : node
        )
      };

      await get().updateWorkflowData(workflowId, updatedWorkflowData);
    });
  },

  deleteNode: async (workflowId, nodeId) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkflow = get().currentWorkflow;
      if (!currentWorkflow || currentWorkflow.id !== workflowId) return;

      const updatedWorkflowData = {
        ...currentWorkflow.workflow_data,
        nodes: (currentWorkflow.workflow_data.nodes || []).filter(node => node.id !== nodeId),
        connections: (currentWorkflow.workflow_data.connections || []).filter(
          conn => conn.source !== nodeId && conn.target !== nodeId
        )
      };

      await get().updateWorkflowData(workflowId, updatedWorkflowData);
    });
  },

  addConnection: async (workflowId, connection) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkflow = get().currentWorkflow;
      if (!currentWorkflow || currentWorkflow.id !== workflowId) return;

      const updatedWorkflowData = {
        ...currentWorkflow.workflow_data,
        connections: [...(currentWorkflow.workflow_data.connections || []), connection]
      };

      await get().updateWorkflowData(workflowId, updatedWorkflowData);
    });
  },

  deleteConnection: async (workflowId, connectionId) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkflow = get().currentWorkflow;
      if (!currentWorkflow || currentWorkflow.id !== workflowId) return;

      const updatedWorkflowData = {
        ...currentWorkflow.workflow_data,
        connections: (currentWorkflow.workflow_data.connections || []).filter(
          conn => conn.id !== connectionId
        )
      };

      await get().updateWorkflowData(workflowId, updatedWorkflowData);
    });
  },

  executeWorkflow: async (workflowId, triggerData = {}) => {
    await ErrorHandler.handleAsync(async () => {
      const { data, error } = await supabase
        .from('automation_executions')
        .insert({
          workflow_id: workflowId,
          trigger_data: triggerData,
          status: 'running',
        })
        .select()
        .single();

      if (error) throw error;
      
      // Increment execution count
      const workflow = get().workflows.find(w => w.id === workflowId);
      if (workflow) {
        await supabase
          .from('automation_workflows')
          .update({ 
            execution_count: (workflow.execution_count || 0) + 1,
            last_executed: new Date().toISOString()
          })
          .eq('id', workflowId);
      }
      
      // Update execution status to completed after a delay (simulating execution)
      setTimeout(async () => {
        await supabase
          .from('automation_executions')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            execution_data: { success: true, steps_completed: true }
          })
          .eq('id', data.id);
          
        get().fetchExecutions(workflowId);
      }, 5000);
      
      ErrorHandler.showSuccess('Automação executada com sucesso!');
      get().fetchExecutions(workflowId);
      get().fetchWorkflows();
    });
  },

  pauseWorkflow: async (workflowId) => {
    await get().updateWorkflow(workflowId, { status: 'paused' });
  },

  resumeWorkflow: async (workflowId) => {
    await get().updateWorkflow(workflowId, { status: 'active' });
  },

  createTemplate: async (workflowId, templateData) => {
    await ErrorHandler.handleAsync(async () => {
      const workflow = get().workflows.find(w => w.id === workflowId);
      if (!workflow) throw new Error('Workflow não encontrado');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('automation_templates')
        .insert({
          ...templateData,
          template_data: workflow.workflow_data,
          created_by: user.id,
          is_public: false,
        });

      if (error) throw error;
      
      get().fetchTemplates();
      ErrorHandler.showSuccess('Template criado com sucesso!');
    });
  },

  importTemplate: async (templateId) => {
    return await ErrorHandler.handleAsync(async () => {
      const template = get().templates.find(t => t.id === templateId);
      if (!template) throw new Error('Template não encontrado');

      const workflow = await get().createWorkflow({
        name: `${template.name} (Importado)`,
        description: template.description,
        template_id: templateId,
      });

      ErrorHandler.showSuccess('Template importado com sucesso!');
      return workflow;
    }) || null;
  },
}));