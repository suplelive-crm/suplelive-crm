import { create } from 'zustand';
import { Lead, Client, Order, Message, Campaign, DashboardStats, RFMAnalysis, Product } from '@/types';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { ErrorHandler } from '@/lib/error-handler';

interface CrmState {
  // Data
  leads: Lead[];
  clients: Client[];
  products: Product[];
  orders: Order[];
  messages: Message[];
  campaigns: Campaign[];
  stats: DashboardStats;
  
  // Loading states
  loading: boolean;
  
  // Actions
  fetchStats: () => Promise<void>;
  fetchLeads: () => Promise<void>;
  fetchClients: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchOrders: () => Promise<void>;
  fetchMessages: () => Promise<void>;
  fetchCampaigns: () => Promise<void>;
  
  // CRUD operations
  createLead: (lead: Omit<Lead, 'id' | 'created_at' | 'user_id' | 'workspace_id'>) => Promise<void>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  convertLeadToClient: (leadId: string) => Promise<void>;
  
  createClient: (client: Omit<Client, 'id' | 'created_at' | 'user_id' | 'workspace_id'>) => Promise<void>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  
  createOrder: (order: Omit<Order, 'id' | 'order_date'>) => Promise<void>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  deleteOrders: (ids: string[]) => Promise<void>;
  
  sendMessage: (clientId: string, content: string, sendType?: 'manual' | 'automated') => Promise<void>;
  
  createCampaign: (campaign: Omit<Campaign, 'id' | 'created_at' | 'user_id' | 'workspace_id'>) => Promise<void>;
  
  // RFM Analysis
  fetchClientRFMAnalysis: (clientId: string) => Promise<RFMAnalysis>;
  calculateRFMScores: () => Promise<void>;

  // --- ADIÇÃO NECESSÁRIA ---
  // Função para buscar todos os pedidos de um cliente específico
  fetchClientOrders: (clientId: string) => Promise<Order[]>;
}

// RFM Analysis helper functions
const calculateRFMScore = (recency: number, frequency: number, monetary: number): string => {
  // Simple RFM scoring (1-5 scale)
  const rScore = recency <= 30 ? 5 : recency <= 60 ? 4 : recency <= 90 ? 3 : recency <= 180 ? 2 : 1;
  const fScore = frequency >= 10 ? 5 : frequency >= 5 ? 4 : frequency >= 3 ? 3 : frequency >= 2 ? 2 : 1;
  const mScore = monetary >= 1000 ? 5 : monetary >= 500 ? 4 : monetary >= 200 ? 3 : monetary >= 100 ? 2 : 1;
  
  return `${rScore}${fScore}${mScore}`;
};

const getRFMCategory = (rfmScore: string): RFMAnalysis['category'] => {
  const [r, f, m] = rfmScore.split('').map(Number);
  
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
  if (r >= 3 && f >= 3 && m >= 3) return 'Loyal Customers';
  if (r >= 4 && f <= 2) return 'New Customers';
  if (r >= 3 && f >= 3 && m <= 2) return 'Potential Loyalists';
  if (r >= 3 && f <= 2 && m >= 3) return 'Promising';
  if (r <= 2 && f >= 3 && m >= 3) return 'Need Attention';
  if (r <= 2 && f <= 2 && m >= 3) return 'Cannot Lose Them';
  if (r <= 2 && f >= 3 && m <= 2) return 'At Risk';
  if (r >= 3 && f <= 2 && m <= 2) return 'About to Sleep';
  if (r <= 2 && f <= 2 && m <= 2) return 'Hibernating';
  
  return 'Lost';
};

export const useCrmStore = create<CrmState>((set, get) => ({
  leads: [],
  clients: [],
  products: [],
  orders: [],
  messages: [],
  campaigns: [],
  stats: {
    totalLeads: 0,
    totalClients: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalConversations: 0,
    activeChannels: 0,
  },
  loading: false,

  fetchStats: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // NOTE: Orders doesn't have workspace_id, filter through clients relationship
      const [
        { count: leadsCount },
        { count: clientsCount },
        { count: ordersCount },
        { count: conversationsCount },
        { count: activeChannelsCount },
        { data: revenueData },
        { data: lastMessage }
      ] = await Promise.all([
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('orders').select('*, clients!inner(workspace_id)', { count: 'exact', head: true }).eq('clients.workspace_id', currentWorkspace.id),
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id),
        supabase.from('channels').select('*', { count: 'exact', head: true }).eq('workspace_id', currentWorkspace.id).eq('status', 'connected'),
        supabase.from('orders').select('total_amount, status, clients!inner(workspace_id)').eq('clients.workspace_id', currentWorkspace.id),
        supabase.from('messages').select('timestamp').order('timestamp', { ascending: false }).limit(1)
      ]);

      const completedOrders = revenueData?.filter(order => order.status === 'completed') || [];
      const totalRevenue = completedOrders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
      const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
      
      set({
        stats: {
          totalLeads: leadsCount || 0,
          totalClients: clientsCount || 0,
          totalOrders: ordersCount || 0,
          totalRevenue,
          totalConversations: conversationsCount || 0,
          activeChannels: activeChannelsCount || 0,
          lastMessageSent: lastMessage?.[0]?.timestamp,
          avgOrderValue,
          conversionRate: leadsCount ? ((clientsCount || 0) / leadsCount) * 100 : 0,
          activeClients: clientsCount || 0,
        }
      });
    });
  },

  fetchLeads: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ leads: data || [] });
    });
  },

  fetchClients: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          orders(total_amount, order_date, status)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate aggregated data for each client
      const clientsWithStats = (data || []).map(client => {
        const orders = client.orders || [];
        const completedOrders = orders.filter((order: any) => order.status === 'completed');
        
        return {
          ...client,
          total_orders: orders.length,
          total_spent: completedOrders.reduce((sum: number, order: any) => sum + parseFloat(order.total_amount), 0),
          last_order_date: orders.length > 0 
            ? orders.sort((a: any, b: any) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())[0].order_date
            : null,
        };
      });

      set({ clients: clientsWithStats });
    });
  },

  fetchProducts: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('name', { ascending: true });

      if (error) throw error;
      set({ products: data || [] });
    });
  },

  fetchOrders: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          client:clients!inner(*, workspace_id)
        `)
        .eq('client.workspace_id', currentWorkspace.id)
        .order('order_date', { ascending: false });

      if (error) throw error;
      set({ orders: data || [] });
    });
  },

  fetchMessages: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          client:clients!inner(*, workspace_id)
        `)
        .eq('client.workspace_id', currentWorkspace.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;
      set({ messages: data || [] });
    });
  },

  fetchCampaigns: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ campaigns: data || [] });
    });
  },

  createLead: async (leadData) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      
      if (!user || !currentWorkspace) {
        throw ErrorHandler.createError(
          'Erro de Autenticação',
          'Você precisa estar logado e ter um workspace selecionado.'
        );
      }

      const { error } = await supabase
        .from('leads')
        .insert({ 
          ...leadData, 
          user_id: user.id,
          workspace_id: currentWorkspace.id 
        });

      if (error) throw error;
      
      get().fetchLeads();
      get().fetchStats();
      ErrorHandler.showSuccess('Lead criado com sucesso!');
    });
  },

  updateLead: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      get().fetchLeads();
      ErrorHandler.showSuccess('Lead atualizado com sucesso!');
    });
  },

  deleteLead: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      get().fetchLeads();
      get().fetchStats();
      ErrorHandler.showSuccess('Lead excluído com sucesso!');
    });
  },

  convertLeadToClient: async (leadId) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      
      if (!user || !currentWorkspace) {
        throw ErrorHandler.createError(
          'Erro de Autenticação',
          'Você precisa estar logado e ter um workspace selecionado.'
        );
      }

      const lead = get().leads.find(l => l.id === leadId);
      if (!lead) {
        throw ErrorHandler.createError(
          'Lead Não Encontrado',
          'O lead selecionado não foi encontrado.'
        );
      }

      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          user_id: user.id,
          workspace_id: currentWorkspace.id,
        });

      if (clientError) throw clientError;

      const { error: leadError } = await supabase
        .from('leads')
        .update({ status: 'converted' })
        .eq('id', leadId);

      if (leadError) throw leadError;

      get().fetchLeads();
      get().fetchClients();
      get().fetchStats();
      ErrorHandler.showSuccess('Lead convertido para cliente com sucesso!');
    });
  },

  createClient: async (clientData) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      
      if (!user || !currentWorkspace) {
        throw ErrorHandler.createError(
          'Erro de Autenticação',
          'Você precisa estar logado e ter um workspace selecionado.'
        );
      }

      const { error } = await supabase
        .from('clients')
        .insert({ 
          ...clientData, 
          user_id: user.id,
          workspace_id: currentWorkspace.id 
        });

      if (error) throw error;
      get().fetchClients();
      get().fetchStats();
      ErrorHandler.showSuccess('Cliente criado com sucesso!');
    });
  },

  updateClient: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      get().fetchClients();
      ErrorHandler.showSuccess('Cliente atualizado com sucesso!');
    });
  },

  deleteClient: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      get().fetchClients();
      get().fetchStats();
      ErrorHandler.showSuccess('Cliente excluído com sucesso!');
    });
  },

  createOrder: async (orderData) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('orders')
        .insert(orderData);

      if (error) throw error;
      
      get().fetchOrders();
      get().fetchClients(); // Refresh to update client stats
      get().fetchStats();
      ErrorHandler.showSuccess('Pedido criado com sucesso!');
    });
  },

  updateOrder: async (id, updates) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      get().fetchOrders();
      get().fetchStats();
      ErrorHandler.showSuccess('Pedido atualizado com sucesso!');
    });
  },

  deleteOrder: async (id) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      get().fetchOrders();
      get().fetchStats();
      ErrorHandler.showSuccess('Pedido excluído com sucesso!');
    });
  },

  deleteOrders: async (ids) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', ids);

      if (error) throw error;
      get().fetchOrders();
      get().fetchStats();
      ErrorHandler.showSuccess(`${ids.length} pedido(s) excluído(s) com sucesso!`);
    });
  },

  sendMessage: async (clientId, content, sendType = 'manual') => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('messages')
        .insert({
          client_id: clientId,
          content,
          send_type: sendType,
          sender_type: 'user',
          channel_type: 'whatsapp',
          status: 'pending',
        });

      if (error) throw error;
      get().fetchMessages();
      get().fetchStats();
      ErrorHandler.showSuccess('Mensagem enviada com sucesso!');
    });
  },

  createCampaign: async (campaignData) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      
      if (!user || !currentWorkspace) {
        throw ErrorHandler.createError(
          'Erro de Autenticação',
          'Você precisa estar logado e ter um workspace selecionado.'
        );
      }

      const { error } = await supabase
        .from('campaigns')
        .insert({ 
          ...campaignData, 
          user_id: user.id,
          workspace_id: currentWorkspace.id 
        });

      if (error) throw error;
      get().fetchCampaigns();
      ErrorHandler.showSuccess('Campanha criada com sucesso!');
    });
  },

  fetchClientRFMAnalysis: async (clientId) => {
    return await ErrorHandler.handleAsync(async () => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('total_amount, order_date, status')
        .eq('client_id', clientId)
        .eq('status', 'completed');

      if (error) throw error;

      if (!orders || orders.length === 0) {
        return {
          client_id: clientId,
          recency: 999,
          frequency: 0,
          monetary: 0,
          rfm_score: '111',
          category: 'New Customers' as const,
        };
      }

      // Calculate RFM metrics
      const now = new Date();
      const lastOrderDate = new Date(Math.max(...orders.map(o => new Date(o.order_date).getTime())));
      const recency = Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
      const frequency = orders.length;
      const monetary = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);

      const rfmScore = calculateRFMScore(recency, frequency, monetary);
      const category = getRFMCategory(rfmScore);

      return {
        client_id: clientId,
        recency,
        frequency,
        monetary,
        rfm_score: rfmScore,
        category,
      };
    }) || {
      client_id: clientId,
      recency: 999,
      frequency: 0,
      monetary: 0,
      rfm_score: '111',
      category: 'New Customers' as const,
    };
  },

  calculateRFMScores: async () => {
    await ErrorHandler.handleAsync(async () => {
      const clients = get().clients;
      const rfmAnalyses = await Promise.all(
        clients.map(client => get().fetchClientRFMAnalysis(client.id))
      );
      
      // Update clients with RFM data
      const clientsWithRFM = clients.map(client => {
        const rfm = rfmAnalyses.find(r => r?.client_id === client.id);
        return { ...client, rfm_analysis: rfm };
      });
      
      set({ clients: clientsWithRFM });
    });
  },
  
  // --- IMPLEMENTAÇÃO DA NOVA FUNÇÃO ---
  fetchClientOrders: async (clientId) => {
    return await ErrorHandler.handleAsync(async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*') // Seleciona todos os campos do pedido
        .eq('client_id', clientId)
        .order('order_date', { ascending: false });

      if (error) throw error;

      return data || [];
    }) || []; // Retorna um array vazio em caso de erro na manipulação
  },
}));