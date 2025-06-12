import { create } from 'zustand';
import { Conversation, Message } from '@/types';
import { supabase } from '@/lib/supabase';
import { useWorkspaceStore } from './workspaceStore';
import { useSectorStore } from './sectorStore';
import { ErrorHandler } from '@/lib/error-handler';

interface ConversationState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  loading: boolean;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId: string) => Promise<void>;
  setActiveConversation: (conversation: Conversation) => void;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  createConversation: (clientId: string, channelType: string) => Promise<Conversation>;
  updateConversationStatus: (conversationId: string, status: 'open' | 'closed' | 'pending') => Promise<void>;
  updateConversationSector: (conversationId: string, sectorId: string) => Promise<void>;
  addIncomingMessage: (message: Message) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversation: null,
  messages: [],
  loading: false,

  fetchConversations: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          client:clients(*),
          channel:channels(*),
          sector:sectors(*)
        `)
        .eq('workspace_id', currentWorkspace.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get unread message counts
      const conversationsWithCounts = await Promise.all(
        (data || []).map(async (conversation) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversation.id)
            .eq('sender_type', 'client')
            .is('read_at', null);

          return {
            ...conversation,
            unread_count: count || 0,
          };
        })
      );

      set({ conversations: conversationsWithCounts });
    });
  },

  fetchMessages: async (conversationId) => {
    await ErrorHandler.handleAsync(async () => {
      set({ loading: true });

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          client:clients(*)
        `)
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      set({ messages: data || [], loading: false });
    });
  },

  setActiveConversation: (conversation) => {
    set({ activeConversation: conversation });
    get().fetchMessages(conversation.id);
    get().markAsRead(conversation.id);
  },

  sendMessage: async (conversationId, content) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const conversation = get().conversations.find(c => c.id === conversationId);
      if (!conversation) throw new Error('Conversa não encontrada');

      // Insert message in database
      const { data: messageData, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          client_id: conversation.client_id,
          content,
          sender_type: 'user',
          channel_type: conversation.channel_type,
          send_type: 'manual',
          status: 'pending',
        })
        .select(`
          *,
          client:clients(*)
        `)
        .single();

      if (error) throw error;

      // Add message to current messages if this is the active conversation
      if (get().activeConversation?.id === conversationId) {
        set({ messages: [...get().messages, messageData] });
      }

      // Send via WhatsApp if it's a WhatsApp conversation
      if (conversation.channel_type === 'whatsapp' && conversation.client?.phone) {
        try {
          const { whatsappInstances, sendWhatsAppMessage } = useWorkspaceStore.getState();
          const connectedInstance = whatsappInstances.find(i => i.status === 'connected');
          
          if (connectedInstance) {
            await sendWhatsAppMessage(connectedInstance.id, conversation.client.phone, content);
            
            // Update message status to sent
            await supabase
              .from('messages')
              .update({ status: 'sent' })
              .eq('id', messageData.id);

            // Update message in state
            if (get().activeConversation?.id === conversationId) {
              const updatedMessages = get().messages.map(msg => 
                msg.id === messageData.id ? { ...msg, status: 'sent' } : msg
              );
              set({ messages: updatedMessages });
            }
          } else {
            throw new Error('Nenhuma instância WhatsApp conectada');
          }
        } catch (whatsappError: any) {
          // Update message status to failed
          await supabase
            .from('messages')
            .update({ status: 'failed' })
            .eq('id', messageData.id);

          throw new Error(`Falha ao enviar WhatsApp: ${whatsappError.message}`);
        }
      }

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ 
          last_message_at: new Date().toISOString(),
          status: 'open' // Ensure conversation is marked as open when sending a message
        })
        .eq('id', conversationId);

      get().fetchConversations();
      ErrorHandler.showSuccess('Mensagem enviada com sucesso!');
    });
  },

  markAsRead: async (conversationId) => {
    await ErrorHandler.handleAsync(async () => {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'client')
        .is('read_at', null);

      get().fetchConversations();
    });
  },

  createConversation: async (clientId, channelType) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      // Get default sector
      const defaultSector = useSectorStore.getState().getDefaultSector();

      // Check if conversation already exists - handle the case where no rows are returned
      const { data: existingConversation, error: existingConversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('client_id', clientId)
        .eq('channel_type', channelType)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle zero rows gracefully

      // If there's an error other than no rows found, throw it
      if (existingConversationError) {
        throw existingConversationError;
      }

      // If conversation exists, return it
      if (existingConversation) {
        return existingConversation;
      }

      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          workspace_id: currentWorkspace.id,
          client_id: clientId,
          channel_type: channelType,
          status: 'open',
          sector_id: defaultSector?.id,
        })
        .select(`
          *,
          client:clients(*),
          channel:channels(*),
          sector:sectors(*)
        `)
        .single();

      if (error) throw error;
      get().fetchConversations();
      return data;
    }) || null;
  },

  updateConversationStatus: async (conversationId, status) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('conversations')
        .update({ status })
        .eq('id', conversationId);

      if (error) throw error;
      
      // Update in state
      const conversations = get().conversations.map(conv => 
        conv.id === conversationId ? { ...conv, status } : conv
      );
      
      set({ conversations });
      
      // Update active conversation if it's the one being updated
      const activeConversation = get().activeConversation;
      if (activeConversation?.id === conversationId) {
        set({ activeConversation: { ...activeConversation, status } });
      }
      
      ErrorHandler.showSuccess(`Conversa marcada como ${status}`);
    });
  },

  updateConversationSector: async (conversationId, sectorId) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('conversations')
        .update({ sector_id: sectorId })
        .eq('id', conversationId);

      if (error) throw error;
      
      // Fetch the sector data
      const { data: sectorData } = await supabase
        .from('sectors')
        .select('*')
        .eq('id', sectorId)
        .single();
      
      // Update in state
      const conversations = get().conversations.map(conv => 
        conv.id === conversationId ? { ...conv, sector_id: sectorId, sector: sectorData } : conv
      );
      
      set({ conversations });
      
      // Update active conversation if it's the one being updated
      const activeConversation = get().activeConversation;
      if (activeConversation?.id === conversationId) {
        set({ 
          activeConversation: { 
            ...activeConversation, 
            sector_id: sectorId,
            sector: sectorData
          } 
        });
      }
      
      ErrorHandler.showSuccess(`Conversa movida para o setor ${sectorData?.name}`);
    });
  },

  addIncomingMessage: (message) => {
    // Add incoming message to conversations
    const conversations = get().conversations;
    const conversationIndex = conversations.findIndex(c => c.id === message.conversation_id);
    
    if (conversationIndex !== -1) {
      const updatedConversations = [...conversations];
      updatedConversations[conversationIndex] = {
        ...updatedConversations[conversationIndex],
        last_message_at: message.timestamp,
        unread_count: (updatedConversations[conversationIndex].unread_count || 0) + 1,
      };
      set({ conversations: updatedConversations });
    }

    // Add to current messages if this is the active conversation
    if (get().activeConversation?.id === message.conversation_id) {
      set({ messages: [...get().messages, message] });
      // Mark as read immediately if this is the active conversation
      get().markAsRead(message.conversation_id);
    }
  },
}));