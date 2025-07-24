import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ErrorHandler } from '@/lib/error-handler';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  signIn: async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }

      ErrorHandler.showSuccess('Login realizado com sucesso!', 'Bem-vindo de volta!');
    } catch (error) {
      ErrorHandler.showError(error);
      throw error;
    }
  },

  signUp: async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }

      ErrorHandler.showSuccess('Conta criada com sucesso!', 'Bem-vindo ao OmniCRM!');
    } catch (error) {
      ErrorHandler.showError(error);
      throw error;
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      set({ user: null });
      ErrorHandler.showSuccess('Logout realizado', 'Até logo!');
    } catch (error) {
      ErrorHandler.showError(error);
      throw error;
    }
  },

  initialize: async () => {
    try {
      set({ loading: true });
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }
      
      set({ user: session?.user ?? null, loading: false });

      supabase.auth.onAuthStateChange((event, session) => {
        set({ user: session?.user ?? null, loading: false });
      });
    } catch (error) {
      set({ loading: false });
      ErrorHandler.showError(error);
    }
  },
}));

export interface User {
  id: string;
  email: string;
  name?: string;
  workspace_id?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan_id: string;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  plan?: Plan;
  subscription?: Subscription;
  users?: WorkspaceUser[];
  user_role?: 'owner' | 'admin' | 'operator';
}

export interface WorkspaceUser {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'admin' | 'operator';
  invited_by?: string;
  invited_at: string;
  joined_at?: string;
  status: 'pending' | 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
    user_metadata?: {
      name?: string;
    };
  };
  invited_by_user?: {
    email: string;
  };
}

export interface UserInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'operator';
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at?: string;
  status: 'pending' | 'accepted' | 'expired';
  created_at: string;
  workspace?: Workspace;
  invited_by_user?: {
    email: string;
  };
}

export interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  features: Record<string, any>;
  limits: Record<string, any>;
  created_at: string;
}

export interface Subscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  billing_info: Record<string, any>;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export interface Channel {
  id: string;
  workspace_id: string;
  type: 'whatsapp' | 'shopee' | 'mercado_livre' | 'rd_marketplace' | 'baselinker';
  name: string;
  config: Record<string, any>;
  status: 'connected' | 'disconnected' | 'error';
  last_sync?: string;
  created_at: string;
}

export interface WhatsAppInstance {
  id: string;
  workspace_id: string;
  instance_name: string;
  session_id?: string;
  qr_code?: string;
  status: 'connecting' | 'connected' | 'disconnected';
  phone_number?: string;
  webhook_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  workspace_id: string;
  client_id?: string;
  channel_id?: string;
  channel_type: string;
  external_id?: string;
  status: 'open' | 'closed' | 'pending';
  assigned_to?: string;
  sector_id?: string;
  last_message_at: string;
  metadata: Record<string, any>;
  created_at: string;
  client?: Client;
  channel?: Channel;
  sector?: Sector;
  messages?: Message[];
  unread_count?: number;
}

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

export interface Lead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  created_at: string;
  user_id: string;
  workspace_id: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  tags?: string[];
  created_at: string;
  user_id: string;
  workspace_id: string;
  rfm_analysis?: RFMAnalysis;
  total_orders?: number;
  total_spent?: number;
  last_order_date?: string;
  metadata?: Record<string, any>;
}

export interface Order {
  id: string;
  client_id: string;
  total_amount: number;
  order_date: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  external_id?: string;
  metadata?: Record<string, any>;
  client?: Client;
}

export interface Product {
  id: string;
  workspace_id: string;
  name: string;
  sku?: string;
  ean?: string;
  price: number;
  stock: number;
  description?: string;
  images?: string[];
  external_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  client_id?: string;
  conversation_id?: string;
  content: string;
  send_type: 'manual' | 'automated' | 'incoming';
  sender_type: 'user' | 'client' | 'system';
  channel_type: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'received' | 'read';
  timestamp: string;
  external_id?: string;
  metadata: Record<string, any>;
  read_at?: string;
  client?: Client;
}

export interface Campaign {
  id: string;
  name: string;
  segment: string;
  message: string;
  scheduled_at?: string;
  created_at: string;
  user_id: string;
  workspace_id: string;
  status?: 'draft' | 'scheduled' | 'running' | 'completed';
  target_count?: number;
  sent_count?: number;
}

export interface Automation {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  n8n_webhook_url?: string;
  status: 'active' | 'inactive';
  execution_count: number;
  last_executed?: string;
  created_at: string;
}

export interface RFMAnalysis {
  client_id: string;
  recency: number;
  frequency: number;
  monetary: number;
  rfm_score: string;
  category: 'Champions' | 'Loyal Customers' | 'Potential Loyalists' | 'New Customers' | 'Promising' | 'Need Attention' | 'About to Sleep' | 'At Risk' | 'Cannot Lose Them' | 'Hibernating' | 'Lost';
}

export interface DashboardStats {
  totalLeads: number;
  totalClients: number;
  totalOrders: number;
  totalRevenue: number;
  totalConversations: number;
  activeChannels: number;
  lastMessageSent?: string;
  avgOrderValue?: number;
  conversionRate?: number;
  activeClients?: number;
}

// Kanban Types
export interface KanbanBoard {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  stages?: KanbanStage[];
}

export interface KanbanStage {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
  clients?: KanbanClientAssignment[];
}

export interface KanbanClientAssignment {
  id: string;
  board_id: string;
  stage_id: string;
  client_id: string;
  position: number;
  assigned_at: string;
  client?: Client;
}

// Automation Types
export interface AutomationWorkflow {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  trigger_type: 'manual' | 'time_based' | 'event_based' | 'webhook';
  workflow_data: WorkflowData;
  settings: Record<string, any>;
  execution_count: number;
  last_executed?: string;
  created_at: string;
  updated_at: string;
  ai_config?: Record<string, any>;
  n8n_webhook_url?: string;
}

export interface WorkflowData {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  viewport: { x: number; y: number; zoom: number };
}

export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay' | 'webhook' | 'chatbot' | 'classifier';
  position: { x: number; y: number };
  data: NodeData;
}

export interface NodeData {
  label: string;
  config: Record<string, any>;
  nodeType: string;
}

export interface WorkflowConnection {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface AutomationTrigger {
  id: string;
  workflow_id: string;
  type: 'new_lead' | 'stage_change' | 'message_received' | 'time_delay' | 'webhook' | 'manual';
  config: Record<string, any>;
  position: { x: number; y: number };
  created_at: string;
}

export interface AutomationAction {
  id: string;
  workflow_id: string;
  trigger_id: string;
  type: 'send_message' | 'move_stage' | 'create_task' | 'webhook' | 'delay' | 'condition' | 'move_sector' | 'chatbot_response' | 'text_classification';
  config: Record<string, any>;
  position: { x: number; y: number };
  order_index: number;
  created_at: string;
}

export interface AutomationCondition {
  id: string;
  workflow_id: string;
  action_id: string;
  type: 'client_tag' | 'client_value' | 'time_condition' | 'custom' | 'chatbot_intent' | 'classification_category';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: string;
  config: Record<string, any>;
  created_at: string;
}

export interface AutomationExecution {
  id: string;
  workflow_id: string;
  trigger_data: Record<string, any>;
  execution_data: Record<string, any>;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
  started_at: string;
  completed_at?: string;
  client_id?: string;
  conversation_id?: string;
  workflow?: AutomationWorkflow;
  client?: Client;
  conversation?: Conversation;
}

export interface AutomationTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'lead_nurturing' | 'customer_support' | 'sales' | 'marketing';
  template_data: WorkflowData;
  is_public: boolean;
  created_by?: string;
  created_at: string;
}

// Baselinker Types
export interface BaselinkerSync {
  id: string;
  workspace_id: string;
  last_orders_sync?: string;
  last_customers_sync?: string;
  last_inventory_sync?: string;
  sync_status: 'idle' | 'syncing' | 'error';
  sync_errors: any[];
  created_at: string;
  updated_at: string;
}

// Evolution API Types
export interface EvolutionWebhookEvent {
  event: string;
  instance: string;
  data: any;
  destination?: string;
  date_time: string;
  sender?: string;
  server_url: string;
  apikey: string;
}

export interface WhatsAppMessage {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
      url: string;
    };
    videoMessage?: {
      caption?: string;
      url: string;
    };
    audioMessage?: {
      url: string;
    };
    documentMessage?: {
      caption?: string;
      url: string;
      fileName: string;
    };
  };
  messageTimestamp: number;
  pushName?: string;
  status?: 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED';
}