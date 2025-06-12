import { create } from 'zustand';
import { Workspace, Plan, Subscription, Channel, WhatsAppInstance } from '@/types';
import { supabase } from '@/lib/supabase';
import { getEvolutionAPI, formatPhoneNumber } from '@/lib/evolution-api';
import { ErrorHandler } from '@/lib/error-handler';

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  plans: Plan[];
  channels: Channel[];
  whatsappInstances: WhatsAppInstance[];
  loading: boolean;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchChannels: () => Promise<void>;
  fetchWhatsAppInstances: () => Promise<void>;
  createWorkspace: (data: { name: string; plan_id: string }) => Promise<Workspace>;
  setCurrentWorkspace: (workspace: Workspace) => void;
  
  // WhatsApp management
  connectWhatsApp: (instanceName: string) => Promise<WhatsAppInstance>;
  disconnectWhatsApp: (instanceId: string) => Promise<void>;
  deleteWhatsApp: (instanceId: string) => Promise<void>;
  getWhatsAppQR: (instanceId: string) => Promise<string>;
  updateWhatsAppStatus: (instanceId: string, status: string, phoneNumber?: string) => Promise<void>;
  restartWhatsApp: (instanceId: string) => Promise<void>;
  syncWhatsAppStatus: (instanceId: string) => Promise<void>;
  syncAllWhatsAppInstances: () => Promise<void>;
  reconnectWhatsApp: (instanceId: string) => Promise<void>;
  
  // WhatsApp messaging
  sendWhatsAppMessage: (instanceId: string, number: string, message: string) => Promise<void>;
  sendWhatsAppMedia: (instanceId: string, number: string, mediaUrl: string, mediaType: 'image' | 'video' | 'audio' | 'document', caption?: string) => Promise<void>;
  
  // Channel connections
  connectChannel: (type: string, config: Record<string, any>) => Promise<Channel>;
  disconnectChannel: (channelId: string) => Promise<void>;
}

// Helper function to generate a unique workspace slug
const generateUniqueSlug = async (baseName: string): Promise<string> => {
  const baseSlug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data, error } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .limit(1);

    if (error) {
      console.error('Error checking slug uniqueness:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  workspaces: [],
  plans: [],
  channels: [],
  whatsappInstances: [],
  loading: false,

  fetchWorkspaces: async () => {
    await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          plan:plans(*),
          subscription:subscriptions(*)
        `)
        .eq('owner_id', user.id);

      if (error) throw error;
      
      const workspaces = data || [];
      set({ workspaces });

      const currentState = get();
      if (!currentState.currentWorkspace && workspaces.length > 0) {
        set({ currentWorkspace: workspaces[0] });
      }
    });
  },

  fetchPlans: async () => {
    await ErrorHandler.handleAsync(async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      set({ plans: data || [] });
    });
  },

  fetchChannels: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ channels: data || [] });
    });
  },

  fetchWhatsAppInstances: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace) return;

      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ whatsappInstances: data || [] });

      // Sync status for all instances after fetching
      setTimeout(() => {
        get().syncAllWhatsAppInstances();
      }, 1000);
    });
  },

  createWorkspace: async (workspaceData) => {
    return await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const maxRetries = 5;
      let lastError: any = null;

      // Retry mechanism to handle race conditions with slug generation
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const uniqueSlug = await generateUniqueSlug(workspaceData.name);

          const { data, error } = await supabase
            .from('workspaces')
            .insert({
              name: workspaceData.name,
              slug: uniqueSlug,
              plan_id: workspaceData.plan_id,
              owner_id: user.id,
            })
            .select(`
              *,
              plan:plans(*),
              subscription:subscriptions(*)
            `)
            .single();

          if (error) {
            // Check if this is a unique constraint violation on the slug
            if (error.code === '23505' && error.message.includes('workspaces_slug_key')) {
              lastError = error;
              console.log(`Slug collision detected on attempt ${attempt}, retrying...`);
              
              // Add a small random delay to reduce chance of repeated collisions
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
              continue;
            }
            throw error;
          }

          // Success! Create the subscription and return
          await supabase
            .from('subscriptions')
            .insert({
              workspace_id: data.id,
              plan_id: workspaceData.plan_id,
              status: 'active',
            });

          await get().fetchWorkspaces();
          return data;

        } catch (error: any) {
          // If it's not a slug collision error, throw immediately
          if (error.code !== '23505' || !error.message.includes('workspaces_slug_key')) {
            throw error;
          }
          lastError = error;
          
          // Add a small random delay before retrying
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        }
      }

      // If we've exhausted all retries, throw the last error
      throw new Error(`Falha ao criar workspace após ${maxRetries} tentativas. Tente novamente com um nome diferente.`);
    }) || null;
  },

  setCurrentWorkspace: (workspace) => {
    set({ currentWorkspace: workspace });
    get().fetchChannels();
    get().fetchWhatsAppInstances();
  },

  connectWhatsApp: async (instanceName) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      const sessionId = `${currentWorkspace.slug}_${instanceName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      
      // Always configure webhook for production
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;
      
      const { data: instanceRecord, error: dbError } = await supabase
        .from('whatsapp_instances')
        .insert({
          workspace_id: currentWorkspace.id,
          instance_name: instanceName,
          session_id: sessionId,
          status: 'connecting',
          webhook_url: webhookUrl,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      try {
        const evolutionAPI = getEvolutionAPI();
        
        // Check if instance already exists and get its status
        const instanceExists = await evolutionAPI.instanceExists(sessionId);
        if (instanceExists) {
          try {
            const status = await evolutionAPI.getInstanceStatus(sessionId);
            if (status.instance.state === 'open') {
              await supabase
                .from('whatsapp_instances')
                .update({
                  status: 'connected',
                  phone_number: status.instance.state || null,
                })
                .eq('id', instanceRecord.id);

              get().fetchWhatsAppInstances();
              return {
                ...instanceRecord,
                status: 'connected',
                phone_number: status.instance.state || null,
              };
            }
          } catch (statusError) {
            console.warn('Could not get instance status:', statusError);
          }
        }

        const response = await evolutionAPI.createInstance(sessionId, webhookUrl);
        
        const { error: updateError } = await supabase
          .from('whatsapp_instances')
          .update({
            qr_code: response.qrcode?.base64 || null,
            status: 'connecting',
          })
          .eq('id', instanceRecord.id);

        if (updateError) throw updateError;

        get().fetchWhatsAppInstances();
        
        // Start periodic status checking for this instance
        setTimeout(() => {
          get().syncWhatsAppStatus(instanceRecord.id);
        }, 5000);
        
        return {
          ...instanceRecord,
          qr_code: response.qrcode?.base64 || null,
        };
      } catch (evolutionError: any) {
        await supabase
          .from('whatsapp_instances')
          .update({ status: 'disconnected' })
          .eq('id', instanceRecord.id);
        
        let errorMessage = 'Falha ao criar instância na Evolution API';
        if (evolutionError.message) {
          if (evolutionError.message.includes('already exists')) {
            errorMessage = 'Uma instância com este nome já existe. Tente um nome diferente.';
          } else if (evolutionError.message.includes('Bad Request')) {
            errorMessage = 'Dados inválidos enviados para a API. Verifique o nome da instância.';
          } else if (evolutionError.message.includes('Unauthorized')) {
            errorMessage = 'Chave de API inválida ou expirada.';
          } else {
            errorMessage = `${errorMessage}: ${evolutionError.message}`;
          }
        }
        
        throw new Error(errorMessage);
      }
    }) || null;
  },

  reconnectWhatsApp: async (instanceId) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!instance) {
        console.log(`WhatsApp instance ${instanceId} not found in database`);
        return;
      }

      if (!instance.session_id) {
        throw new Error('Session ID não encontrado');
      }

      const evolutionAPI = getEvolutionAPI();

      try {
        // First, try to get the current status
        const status = await evolutionAPI.getInstanceStatus(instance.session_id);
        
        if (status.instance.state === 'open') {
          // Already connected, just update status
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'connected',
              qr_code: null,
            })
            .eq('id', instanceId);
        } else {
          // Need to reconnect - get new QR code
          const qrResponse = await evolutionAPI.connectInstance(instance.session_id);
          
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'connecting',
              qr_code: qrResponse.base64,
            })
            .eq('id', instanceId);

          // Start monitoring connection status
          setTimeout(() => {
            get().syncWhatsAppStatus(instanceId);
          }, 5000);
        }
      } catch (evolutionError: any) {
        if (evolutionError.message && evolutionError.message.includes('Not Found')) {
          // Instance doesn't exist in Evolution API, recreate it
          const currentWorkspace = get().currentWorkspace;
          if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

          const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evolution-webhook`;

          const response = await evolutionAPI.createInstance(instance.session_id, webhookUrl);
          
          await supabase
            .from('whatsapp_instances')
            .update({
              status: 'connecting',
              qr_code: response.qrcode?.base64 || null,
            })
            .eq('id', instanceId);

          // Start monitoring connection status
          setTimeout(() => {
            get().syncWhatsAppStatus(instanceId);
          }, 5000);
        } else {
          throw evolutionError;
        }
      }

      get().fetchWhatsAppInstances();
      ErrorHandler.showSuccess('Reconectando instância WhatsApp...');
    });
  },

  disconnectWhatsApp: async (instanceId) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('session_id')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!instance) {
        console.log(`WhatsApp instance ${instanceId} not found in database`);
        return;
      }

      if (instance.session_id) {
        try {
          const evolutionAPI = getEvolutionAPI();
          await evolutionAPI.logoutInstance(instance.session_id);
        } catch (evolutionError: any) {
          if (evolutionError.message && evolutionError.message.includes('Not Found')) {
            console.log('Instance not found in Evolution API - already disconnected');
          } else {
            console.warn('Evolution API disconnect failed:', evolutionError);
          }
        }
      }

      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ 
          status: 'disconnected', 
          qr_code: null,
          phone_number: null 
        })
        .eq('id', instanceId);

      if (error) throw error;
      get().fetchWhatsAppInstances();
    });
  },

  deleteWhatsApp: async (instanceId) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('session_id')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!instance) {
        console.log(`WhatsApp instance ${instanceId} not found in database`);
        return;
      }

      if (instance.session_id) {
        try {
          const evolutionAPI = getEvolutionAPI();
          await evolutionAPI.deleteInstance(instance.session_id);
        } catch (evolutionError: any) {
          if (evolutionError.message && evolutionError.message.includes('Not Found')) {
            console.log('Instance not found in Evolution API - already deleted');
          } else {
            console.warn('Evolution API delete failed:', evolutionError);
          }
        }
      }

      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', instanceId);

      if (error) throw error;
      get().fetchWhatsAppInstances();
    });
  },

  getWhatsAppQR: async (instanceId) => {
    return await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('session_id')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!instance) {
        throw new Error('Instância WhatsApp não encontrada');
      }

      if (!instance.session_id) {
        throw new Error('Session ID não encontrado');
      }

      const evolutionAPI = getEvolutionAPI();
      const qrResponse = await evolutionAPI.getQRCode(instance.session_id);

      await supabase
        .from('whatsapp_instances')
        .update({ qr_code: qrResponse.base64 })
        .eq('id', instanceId);

      get().fetchWhatsAppInstances();
      return qrResponse.base64;
    }) || '';
  },

  updateWhatsAppStatus: async (instanceId, status, phoneNumber) => {
    await ErrorHandler.handleAsync(async () => {
      const updateData: any = { status };
      if (phoneNumber) {
        updateData.phone_number = phoneNumber;
      }
      if (status === 'disconnected') {
        updateData.qr_code = null;
        updateData.phone_number = null;
      }

      const { error } = await supabase
        .from('whatsapp_instances')
        .update(updateData)
        .eq('id', instanceId);

      if (error) throw error;
      get().fetchWhatsAppInstances();
    });
  },

  restartWhatsApp: async (instanceId) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('session_id')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!instance) {
        throw new Error('Instância WhatsApp não encontrada');
      }

      if (!instance.session_id) {
        throw new Error('Session ID não encontrado');
      }

      const evolutionAPI = getEvolutionAPI();
      
      try {
        await evolutionAPI.restartInstance(instance.session_id);
      } catch (evolutionError: any) {
        if (evolutionError.message && evolutionError.message.includes('Not Found')) {
          // Instance doesn't exist, recreate it
          await get().reconnectWhatsApp(instanceId);
          return;
        } else {
          throw evolutionError;
        }
      }

      await supabase
        .from('whatsapp_instances')
        .update({ status: 'connecting' })
        .eq('id', instanceId);

      get().fetchWhatsAppInstances();
      
      // Start periodic status checking for this instance
      setTimeout(() => {
        get().syncWhatsAppStatus(instanceId);
      }, 5000);
    });
  },

  syncWhatsAppStatus: async (instanceId) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('session_id, status')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Handle case where instance doesn't exist in database
      if (!instance) {
        console.log(`WhatsApp instance ${instanceId} not found in database, skipping sync`);
        return;
      }

      if (!instance.session_id) return;

      const evolutionAPI = getEvolutionAPI();
      
      try {
        const status = await evolutionAPI.getInstanceStatus(instance.session_id);
        
        let newStatus = 'disconnected';
        let phoneNumber = null;
        
        if (status.instance.state === 'open') {
          newStatus = 'connected';
          // Try to get phone number from instance info
          try {
            const instances = await evolutionAPI.fetchInstances(instance.session_id);
            if (instances && instances.length > 0) {
              phoneNumber = instances[0].profileName || null;
            }
          } catch (infoError) {
            console.warn('Could not fetch instance info:', infoError);
          }
        } else if (status.instance.state === 'connecting') {
          newStatus = 'connecting';
        }
        
        // Only update if status changed
        if (newStatus !== instance.status) {
          await supabase
            .from('whatsapp_instances')
            .update({ 
              status: newStatus,
              phone_number: phoneNumber,
              qr_code: newStatus === 'connected' ? null : instance.qr_code
            })
            .eq('id', instanceId);
          
          get().fetchWhatsAppInstances();
        }
        
        // Continue checking if still connecting
        if (newStatus === 'connecting') {
          setTimeout(() => {
            get().syncWhatsAppStatus(instanceId);
          }, 10000); // Check again in 10 seconds
        }
        
      } catch (statusError: any) {
        if (statusError.message && statusError.message.includes('Not Found')) {
          // Instance doesn't exist in Evolution API
          await supabase
            .from('whatsapp_instances')
            .update({ status: 'disconnected', qr_code: null, phone_number: null })
            .eq('id', instanceId);
          
          get().fetchWhatsAppInstances();
        }
      }
    });
  },

  syncAllWhatsAppInstances: async () => {
    await ErrorHandler.handleAsync(async () => {
      const instances = get().whatsappInstances;
      
      // Sync status for all instances that are not disconnected
      const instancesToSync = instances.filter(instance => 
        instance.status !== 'disconnected' && instance.session_id
      );
      
      for (const instance of instancesToSync) {
        // Add a small delay between requests to avoid overwhelming the API
        setTimeout(() => {
          get().syncWhatsAppStatus(instance.id);
        }, Math.random() * 2000); // Random delay up to 2 seconds
      }
    });
  },

  sendWhatsAppMessage: async (instanceId, number, message) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('session_id')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!instance) {
        throw new Error('Instância WhatsApp não encontrada');
      }

      if (!instance.session_id) {
        throw new Error('Session ID não encontrado');
      }

      const evolutionAPI = getEvolutionAPI();
      const formattedNumber = formatPhoneNumber(number);
      
      await evolutionAPI.sendSimpleTextMessage(instance.session_id, formattedNumber, message);
    });
  },

  sendWhatsAppMedia: async (instanceId, number, mediaUrl, mediaType, caption) => {
    await ErrorHandler.handleAsync(async () => {
      const { data: instance, error: fetchError } = await supabase
        .from('whatsapp_instances')
        .select('session_id')
        .eq('id', instanceId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!instance) {
        throw new Error('Instância WhatsApp não encontrada');
      }

      if (!instance.session_id) {
        throw new Error('Session ID não encontrado');
      }

      const evolutionAPI = getEvolutionAPI();
      const formattedNumber = formatPhoneNumber(number);
      
      switch (mediaType) {
        case 'image':
          await evolutionAPI.sendImageMessage(instance.session_id, formattedNumber, mediaUrl, caption);
          break;
        case 'video':
          await evolutionAPI.sendVideoMessage(instance.session_id, formattedNumber, mediaUrl, caption);
          break;
        case 'audio':
          await evolutionAPI.sendVoiceMessage(instance.session_id, formattedNumber, mediaUrl);
          break;
        case 'document':
          const fileName = mediaUrl.split('/').pop() || 'document';
          await evolutionAPI.sendDocumentMessage(instance.session_id, formattedNumber, mediaUrl, fileName, caption);
          break;
        default:
          throw new Error('Tipo de mídia não suportado');
      }
    });
  },

  connectChannel: async (type, config) => {
    return await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      const { data, error } = await supabase
        .from('channels')
        .insert({
          workspace_id: currentWorkspace.id,
          type,
          name: `${type.charAt(0).toUpperCase() + type.slice(1)} Channel`,
          config,
          status: 'connected',
        })
        .select()
        .single();

      if (error) throw error;
      get().fetchChannels();
      return data;
    }) || null;
  },

  disconnectChannel: async (channelId) => {
    await ErrorHandler.handleAsync(async () => {
      const { error } = await supabase
        .from('channels')
        .update({ status: 'disconnected' })
        .eq('id', channelId);

      if (error) throw error;
      get().fetchChannels();
    });
  },
}));