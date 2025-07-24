import { create } from 'zustand';
import { Workspace, Plan, Subscription, Channel, WhatsAppInstance, WorkspaceUser, UserInvitation } from '@/types';
import { supabase } from '@/lib/supabase';
import { getEvolutionAPI, formatPhoneNumber } from '@/lib/evolution-api';
import { ErrorHandler } from '@/lib/error-handler';

interface WorkspaceState {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  plans: Plan[];
  channels: Channel[];
  whatsappInstances: WhatsAppInstance[];
  workspaceUsers: WorkspaceUser[];
  userInvitations: UserInvitation[];
  loading: boolean;

  // Actions
  fetchWorkspaces: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchChannels: () => Promise<void>;
  fetchWhatsAppInstances: () => Promise<void>;
  fetchWorkspaceUsers: () => Promise<void>;
  fetchUserInvitations: () => Promise<void>;
  createWorkspace: (data: { name: string; plan_id: string }) => Promise<Workspace>;
  setCurrentWorkspace: (workspace: Workspace) => void;
  checkWorkspaceUniqueness: (name: string, slug: string) => Promise<{ nameExists: boolean; slugExists: boolean }>;
  
  // User management
  inviteUser: (email: string, role: 'admin' | 'operator') => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  updateUserRole: (userId: string, role: 'admin' | 'operator') => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  resendInvitation: (invitationId: string) => Promise<void>;
  registerUser: (userData: { name: string; email: string; password: string; role: 'admin' | 'operator' }) => Promise<void>;
  
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
  workspaceUsers: [],
  userInvitations: [],
  loading: false,

  fetchWorkspaces: async () => {
    await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('Fetching workspaces for user:', user.email);

      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          plan:plans(*),
          subscription:subscriptions(*)
        `)
        .eq('owner_id', user.id);

      if (error) throw error;
      
      // Add user role to each workspace
      const workspaces = (data || []).map(workspace => ({
        ...workspace,
        user_role: 'owner' as const
      }));
      
      console.log('Fetched workspaces:', workspaces.length, workspaces.map(w => ({ id: w.id, name: w.name })));
      set({ workspaces });

      // Don't automatically set workspace here - let App.tsx handle it
      console.log('Workspaces fetched successfully');
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

  fetchWorkspaceUsers: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace) return;

      // Since workspace_users table doesn't exist in current schema,
      // we'll return empty array for now
      const data: any[] = [];
      const error = null;

      if (error) throw error;
      set({ workspaceUsers: data || [] });
    });
  },

  fetchUserInvitations: async () => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace) return;

      // Since user_invitations table doesn't exist in current schema,
      // we'll return empty array for now
      const data: any[] = [];
      const error = null;

      if (error) throw error;
      set({ userInvitations: data || [] });
    });
  },

  checkWorkspaceUniqueness: async (name: string, slug: string) => {
    return await ErrorHandler.handleAsync(async () => {
      const { data, error } = await supabase
        .rpc('check_workspace_uniqueness', {
          workspace_name: name,
          workspace_slug: slug
        });

      if (error) throw error;
      
      return {
        nameExists: data[0]?.name_exists || false,
        slugExists: data[0]?.slug_exists || false
      };
    }) || { nameExists: false, slugExists: false };
  },

  createWorkspace: async (workspaceData) => {
    return await ErrorHandler.handleAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Generate slug from name
      const baseSlug = workspaceData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Check if workspace with this name or slug already exists
      const uniqueness = await get().checkWorkspaceUniqueness(workspaceData.name, baseSlug);
      
      if (uniqueness.nameExists) {
        // Check if user is already a member of the workspace with this name
        const { data: existingWorkspace } = await supabase
          .from('workspaces')
          .select(`
            *,
            users:workspace_users!inner(user_id)
          `)
          .ilike('name', workspaceData.name)
          .eq('users.user_id', user.id)
          .maybeSingle();

        if (existingWorkspace) {
          // User is already in this workspace, just set it as current
          const { data: fullWorkspace } = await supabase
            .from('workspaces')
            .select(`
              *,
              plan:plans(*),
              subscription:subscriptions(*)
            `)
            .eq('id', existingWorkspace.id)
            .single();

          if (fullWorkspace) {
            get().setCurrentWorkspace({ ...fullWorkspace, user_role: 'admin' });
            ErrorHandler.showSuccess('Bem-vindo de volta!', `Você já faz parte do workspace "${workspaceData.name}"`);
            return fullWorkspace;
          }
        }
        
        throw new Error(`Já existe um workspace com o nome "${workspaceData.name}". Escolha um nome diferente.`);
      }

      if (uniqueness.slugExists) {
        throw new Error(`A URL "${baseSlug}" já está em uso. Escolha um nome diferente.`);
      }

      // Create workspace
      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: workspaceData.name,
          slug: baseSlug,
          plan_id: workspaceData.plan_id,
          owner_id: user.id,
        })
        .select(`
          *,
          plan:plans(*),
          subscription:subscriptions(*)
        `)
        .single();

      if (error) throw error;

      // Create subscription
      await supabase
        .from('subscriptions')
        .insert({
          workspace_id: data.id,
          plan_id: workspaceData.plan_id,
          status: 'active',
        });

      // Add owner as admin user
      await supabase
        .from('workspace_users')
        .insert({
          workspace_id: data.id,
          user_id: user.id,
          role: 'admin',
          joined_at: new Date().toISOString(),
          status: 'active',
        });

      await get().fetchWorkspaces();
      return { ...data, user_role: 'owner' };
    }) || null;
  },

  setCurrentWorkspace: (workspace) => {
    if (workspace) {
      // Save to localStorage for persistence
      localStorage.setItem('currentWorkspaceId', workspace.id);
      console.log('Setting current workspace:', workspace.name, workspace.id);
      set({ currentWorkspace: workspace });
      get().fetchChannels();
      get().fetchWhatsAppInstances();
      // Skip user management fetches until tables are properly set up
      // get().fetchWorkspaceUsers();
      // get().fetchUserInvitations();
    } else {
      // Clear workspace
      localStorage.removeItem('currentWorkspaceId');
      console.log('Clearing current workspace');
      set({ 
        currentWorkspace: null,
        channels: [],
        whatsappInstances: [],
        workspaceUsers: [],
        userInvitations: []
      });
    }
  },

  inviteUser: async (email, role) => {
    await ErrorHandler.handleAsync(async () => {
      // User invitation functionality disabled until proper tables are created
      throw new Error('Funcionalidade de convite de usuários temporariamente indisponível');
    });
  },

  registerUser: async (userData) => {
    await ErrorHandler.handleAsync(async () => {
      const currentWorkspace = get().currentWorkspace;
      if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

      // Get current user session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      // Call the secure Edge Function to register the user
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          workspace_id: currentWorkspace.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao cadastrar usuário');
      }

      const result = await response.json();
      
      ErrorHandler.showSuccess(
        'Usuário cadastrado com sucesso!',
        `${userData.name} foi criado e pode fazer login com o email ${userData.email}`
      );

      // Refresh user list (when workspace_users table is available)
      get().fetchWorkspaceUsers();
    });
  },
  removeUser: async (userId) => {
    await ErrorHandler.handleAsync(async () => {
      // User management functionality disabled until proper tables are created
      throw new Error('Funcionalidade de gerenciamento de usuários temporariamente indisponível');
    });
  },

  updateUserRole: async (userId, role) => {
    await ErrorHandler.handleAsync(async () => {
      // User role management functionality disabled until proper tables are created
      throw new Error('Funcionalidade de alteração de roles temporariamente indisponível');
    });
  },

  cancelInvitation: async (invitationId) => {
    await ErrorHandler.handleAsync(async () => {
      // Invitation management functionality disabled until proper tables are created
      throw new Error('Funcionalidade de cancelamento de convites temporariamente indisponível');
    });
  },

  resendInvitation: async (invitationId) => {
    await ErrorHandler.handleAsync(async () => {
      // Invitation resend functionality disabled until proper tables are created
      throw new Error('Funcionalidade de reenvio de convites temporariamente indisponível');
    });
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