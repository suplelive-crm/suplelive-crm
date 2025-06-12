export interface EvolutionAPIConfig {
  serverUrl: string;
  apiKey: string;
}

// Base interfaces for Evolution API
export interface EvolutionResponse<T = any> {
  status?: string;
  message?: string;
  data?: T;
}

// Instance Management
export interface CreateInstanceRequest {
  instanceName: string;
  token?: string;
  number?: string;
  qrcode?: boolean;
  integration?: 'WHATSAPP-BAILEYS' | 'WHATSAPP-BUSINESS' | 'EVOLUTION';
  rejectCall?: boolean;
  msgCall?: string;
  groupsIgnore?: boolean;
  alwaysOnline?: boolean;
  readMessages?: boolean;
  readStatus?: boolean;
  syncFullHistory?: boolean;
  webhook?: {
    url?: string;
    byEvents?: boolean;
    base64?: boolean;
    headers?: Record<string, string>;
    events?: string[];
  };
  rabbitmq?: {
    enabled?: boolean;
    events?: string[];
  };
  sqs?: {
    enabled?: boolean;
    events?: string[];
  };
  chatwootAccountId?: string;
  chatwootToken?: string;
  chatwootUrl?: string;
  chatwootSignMsg?: boolean;
  chatwootReopenConversation?: boolean;
  chatwootConversationPending?: boolean;
  chatwootImportContacts?: boolean;
  chatwootNameInbox?: string;
  chatwootMergeBrazilContacts?: boolean;
  chatwootImportMessages?: boolean;
  chatwootDaysLimitImportMessages?: number;
  chatwootOrganization?: string;
  chatwootLogo?: string;
}

export interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    instanceId: string;
    status: string;
  };
  hash: {
    apikey: string;
  };
  webhook?: string;
  events?: string[];
  qrcode?: {
    code: string;
    base64: string;
  };
}

export interface InstanceInfo {
  instanceName: string;
  instanceId: string;
  owner: string;
  profileName?: string;
  profilePictureUrl?: string;
  profileStatus?: string;
  status: 'open' | 'close' | 'connecting';
  serverUrl: string;
  apikey: string;
  webhook?: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  webhookEvents?: string[];
}

export interface ConnectionState {
  instance: {
    instanceName: string;
    state: 'open' | 'close' | 'connecting';
  };
}

export interface QRCodeResponse {
  base64: string;
  code: string;
  count: number;
}

// Message interfaces
export interface SendTextMessageRequest {
  number: string;
  text: string;
  delay?: number;
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message: any;
  };
  mentionsEveryOne?: boolean;
  mentioned?: string[];
}

export interface SendMediaMessageRequest {
  number: string;
  mediaMessage: {
    mediatype: 'image' | 'video' | 'audio' | 'document';
    media: string; // URL or base64
    caption?: string;
    fileName?: string;
  };
  delay?: number;
  quoted?: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message: any;
  };
}

export interface SendAudioMessageRequest {
  number: string;
  audioMessage: {
    audio: string; // URL or base64
    ptt?: boolean; // Push to talk
  };
  delay?: number;
}

export interface SendButtonMessageRequest {
  number: string;
  buttonMessage: {
    text: string;
    buttons: Array<{
      buttonId: string;
      buttonText: {
        displayText: string;
      };
      type: number;
    }>;
    headerType: number;
    footerText?: string;
  };
}

export interface SendListMessageRequest {
  number: string;
  listMessage: {
    title: string;
    description: string;
    buttonText: string;
    footerText?: string;
    sections: Array<{
      title: string;
      rows: Array<{
        title: string;
        description?: string;
        rowId: string;
      }>;
    }>;
  };
}

export interface SendLocationMessageRequest {
  number: string;
  locationMessage: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
}

export interface SendContactMessageRequest {
  number: string;
  contactMessage: Array<{
    fullName: string;
    wuid: string;
    phoneNumber: string;
    organization?: string;
    email?: string;
    url?: string;
  }>;
}

export interface MessageResponse {
  key: {
    id: string;
    remoteJid: string;
    fromMe: boolean;
  };
  message: any;
  messageTimestamp: number;
  status: 'PENDING' | 'SERVER_ACK' | 'DELIVERY_ACK' | 'READ' | 'PLAYED';
}

// Chat and Contact interfaces
export interface ChatInfo {
  id: string;
  name?: string;
  isGroup: boolean;
  isReadOnly: boolean;
  isAnnounce: boolean;
  participants?: Array<{
    id: string;
    admin?: 'admin' | 'superadmin';
  }>;
  unreadCount: number;
  lastMessage?: any;
}

export interface ContactInfo {
  id: string;
  name?: string;
  pushName?: string;
  profilePictureUrl?: string;
  status?: string;
  isMyContact: boolean;
  isWAContact: boolean;
  isBusiness: boolean;
}

// Group interfaces
export interface CreateGroupRequest {
  subject: string;
  description?: string;
  participants: string[];
  promoteParticipants?: boolean;
}

export interface UpdateGroupRequest {
  groupJid: string;
  action: 'add' | 'remove' | 'promote' | 'demote';
  participants: string[];
}

export interface GroupInfo {
  id: string;
  subject: string;
  subjectOwner?: string;
  subjectTime?: number;
  creation?: number;
  owner?: string;
  desc?: string;
  descId?: string;
  descTime?: number;
  descOwner?: string;
  restrict?: boolean;
  announce?: boolean;
  participants: Array<{
    id: string;
    admin?: 'admin' | 'superadmin';
  }>;
  size: number;
}

// Webhook interfaces
export interface WebhookData {
  event: string;
  instance: string;
  data: any;
  destination?: string;
  date_time: string;
  sender?: string;
  server_url: string;
  apikey: string;
}

export class EvolutionAPI {
  private config: EvolutionAPIConfig;

  constructor(config: EvolutionAPIConfig) {
    this.config = config;
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<T> {
    const url = `${this.config.serverUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.config.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      throw error;
    }
  }

  // ========== INSTANCE MANAGEMENT ==========

  async createInstance(instanceName: string, webhookUrl?: string): Promise<CreateInstanceResponse> {
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    const data: CreateInstanceRequest = {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      rejectCall: false,
      msgCall: '',
      groupsIgnore: false,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    };

    if (!isLocalhost && webhookUrl) {
      data.webhook = {
        url: webhookUrl,
        byEvents: true,
        base64: false,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        events: [
          'APPLICATION_STARTUP',
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
          'CONTACTS_SET',
          'CONTACTS_UPSERT',
          'CONTACTS_UPDATE',
          'PRESENCE_UPDATE',
          'CHATS_SET',
          'CHATS_UPSERT',
          'CHATS_UPDATE',
          'CHATS_DELETE',
          'GROUPS_UPSERT',
          'GROUP_UPDATE',
          'GROUP_PARTICIPANTS_UPDATE',
          'LABELS_EDIT',
          'LABELS_ASSOCIATION',
          'CALL'
        ]
      };
    }

    return this.makeRequest<CreateInstanceResponse>('/instance/create', 'POST', data);
  }

  async deleteInstance(instanceName: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/instance/delete/${instanceName}`, 'DELETE');
  }

  async restartInstance(instanceName: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/instance/restart/${instanceName}`, 'PUT');
  }

  async logoutInstance(instanceName: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/instance/logout/${instanceName}`, 'DELETE');
  }

  async connectInstance(instanceName: string): Promise<QRCodeResponse> {
    return this.makeRequest<QRCodeResponse>(`/instance/connect/${instanceName}`);
  }

  async getConnectionState(instanceName: string): Promise<ConnectionState> {
    return this.makeRequest<ConnectionState>(`/instance/connectionState/${instanceName}`);
  }

  async fetchInstances(instanceName?: string): Promise<InstanceInfo[]> {
    const endpoint = instanceName 
      ? `/instance/fetchInstances?instanceName=${instanceName}`
      : '/instance/fetchInstances';
    return this.makeRequest<InstanceInfo[]>(endpoint);
  }

  async setPresence(instanceName: string, presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/presence/${instanceName}`, 'PUT', { presence });
  }

  // ========== MESSAGING ==========

  async sendTextMessage(instanceName: string, data: SendTextMessageRequest): Promise<MessageResponse> {
    return this.makeRequest<MessageResponse>(`/message/sendText/${instanceName}`, 'POST', data);
  }

  async sendMediaMessage(instanceName: string, data: SendMediaMessageRequest): Promise<MessageResponse> {
    return this.makeRequest<MessageResponse>(`/message/sendMedia/${instanceName}`, 'POST', data);
  }

  async sendAudioMessage(instanceName: string, data: SendAudioMessageRequest): Promise<MessageResponse> {
    return this.makeRequest<MessageResponse>(`/message/sendWhatsAppAudio/${instanceName}`, 'POST', data);
  }

  async sendButtonMessage(instanceName: string, data: SendButtonMessageRequest): Promise<MessageResponse> {
    return this.makeRequest<MessageResponse>(`/message/sendButtons/${instanceName}`, 'POST', data);
  }

  async sendListMessage(instanceName: string, data: SendListMessageRequest): Promise<MessageResponse> {
    return this.makeRequest<MessageResponse>(`/message/sendList/${instanceName}`, 'POST', data);
  }

  async sendLocationMessage(instanceName: string, data: SendLocationMessageRequest): Promise<MessageResponse> {
    return this.makeRequest<MessageResponse>(`/message/sendLocation/${instanceName}`, 'POST', data);
  }

  async sendContactMessage(instanceName: string, data: SendContactMessageRequest): Promise<MessageResponse> {
    return this.makeRequest<MessageResponse>(`/message/sendContact/${instanceName}`, 'POST', data);
  }

  async sendReaction(instanceName: string, key: any, reaction: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/message/sendReaction/${instanceName}`, 'POST', {
      reactionMessage: {
        key,
        reaction
      }
    });
  }

  async markMessageAsRead(instanceName: string, remoteJid: string, messageId?: string): Promise<EvolutionResponse> {
    const data: any = { remoteJid };
    if (messageId) data.messageId = messageId;
    return this.makeRequest(`/chat/markMessageAsRead/${instanceName}`, 'PUT', data);
  }

  async deleteMessage(instanceName: string, messageId: string, remoteJid: string, fromMe: boolean): Promise<EvolutionResponse> {
    return this.makeRequest(`/message/delete/${instanceName}`, 'DELETE', {
      id: messageId,
      remoteJid,
      fromMe
    });
  }

  // ========== CHAT MANAGEMENT ==========

  async findChats(instanceName: string): Promise<ChatInfo[]> {
    return this.makeRequest<ChatInfo[]>(`/chat/findChats/${instanceName}`);
  }

  async findMessages(instanceName: string, remoteJid: string, limit?: number): Promise<any[]> {
    const params = new URLSearchParams({ remoteJid });
    if (limit) params.append('limit', limit.toString());
    return this.makeRequest<any[]>(`/chat/findMessages/${instanceName}?${params}`);
  }

  async archiveChat(instanceName: string, remoteJid: string, archive: boolean): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/archive/${instanceName}`, 'PUT', {
      remoteJid,
      archive
    });
  }

  async deleteChat(instanceName: string, remoteJid: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/delete/${instanceName}`, 'DELETE', { remoteJid });
  }

  async clearMessages(instanceName: string, remoteJid: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/clearMessages/${instanceName}`, 'DELETE', { remoteJid });
  }

  // ========== CONTACT MANAGEMENT ==========

  async findContacts(instanceName: string): Promise<ContactInfo[]> {
    return this.makeRequest<ContactInfo[]>(`/chat/findContacts/${instanceName}`);
  }

  async getProfilePicture(instanceName: string, number: string): Promise<{ profilePictureUrl: string }> {
    return this.makeRequest(`/chat/profilePicture/${instanceName}?number=${number}`);
  }

  async getStatus(instanceName: string, number: string): Promise<{ status: string }> {
    return this.makeRequest(`/chat/findStatusMessage/${instanceName}?number=${number}`);
  }

  async blockContact(instanceName: string, number: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/blockContact/${instanceName}`, 'PUT', { number });
  }

  async unblockContact(instanceName: string, number: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/unblockContact/${instanceName}`, 'PUT', { number });
  }

  async updateProfileName(instanceName: string, name: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/updateProfileName/${instanceName}`, 'PUT', { name });
  }

  async updateProfileStatus(instanceName: string, status: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/updateProfileStatus/${instanceName}`, 'PUT', { status });
  }

  async updateProfilePicture(instanceName: string, picture: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/updateProfilePicture/${instanceName}`, 'PUT', { picture });
  }

  async removeProfilePicture(instanceName: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/chat/removeProfilePicture/${instanceName}`, 'DELETE');
  }

  // ========== GROUP MANAGEMENT ==========

  async createGroup(instanceName: string, data: CreateGroupRequest): Promise<GroupInfo> {
    return this.makeRequest<GroupInfo>(`/group/create/${instanceName}`, 'POST', data);
  }

  async updateGroupParticipants(instanceName: string, data: UpdateGroupRequest): Promise<EvolutionResponse> {
    return this.makeRequest(`/group/updateParticipant/${instanceName}`, 'PUT', data);
  }

  async updateGroupSetting(instanceName: string, groupJid: string, action: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'): Promise<EvolutionResponse> {
    return this.makeRequest(`/group/updateSetting/${instanceName}`, 'PUT', {
      groupJid,
      action
    });
  }

  async updateGroupSubject(instanceName: string, groupJid: string, subject: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/group/updateSubject/${instanceName}`, 'PUT', {
      groupJid,
      subject
    });
  }

  async updateGroupDescription(instanceName: string, groupJid: string, description: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/group/updateDescription/${instanceName}`, 'PUT', {
      groupJid,
      description
    });
  }

  async findGroup(instanceName: string, groupJid: string): Promise<GroupInfo> {
    return this.makeRequest<GroupInfo>(`/group/findGroupInfo/${instanceName}?groupJid=${groupJid}`);
  }

  async findGroupParticipants(instanceName: string, groupJid: string): Promise<any[]> {
    return this.makeRequest<any[]>(`/group/participants/${instanceName}?groupJid=${groupJid}`);
  }

  async inviteCode(instanceName: string, groupJid: string): Promise<{ inviteCode: string }> {
    return this.makeRequest(`/group/inviteCode/${instanceName}?groupJid=${groupJid}`);
  }

  async revokeInviteCode(instanceName: string, groupJid: string): Promise<{ inviteCode: string }> {
    return this.makeRequest(`/group/revokeInviteCode/${instanceName}`, 'PUT', { groupJid });
  }

  async sendInvite(instanceName: string, groupJid: string, numbers: string[], description?: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/group/sendInvite/${instanceName}`, 'POST', {
      groupJid,
      numbers,
      description
    });
  }

  async leaveGroup(instanceName: string, groupJid: string): Promise<EvolutionResponse> {
    return this.makeRequest(`/group/leaveGroup/${instanceName}`, 'DELETE', { groupJid });
  }

  // ========== WEBHOOK MANAGEMENT ==========

  async setWebhook(instanceName: string, url: string, events?: string[], byEvents?: boolean, base64?: boolean): Promise<EvolutionResponse> {
    return this.makeRequest(`/webhook/set/${instanceName}`, 'POST', {
      url,
      events,
      byEvents,
      base64
    });
  }

  async findWebhook(instanceName: string): Promise<any> {
    return this.makeRequest(`/webhook/find/${instanceName}`);
  }

  // ========== UTILITY METHODS ==========

  async instanceExists(instanceName: string): Promise<boolean> {
    try {
      await this.getConnectionState(instanceName);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    return this.connectInstance(instanceName);
  }

  async getInstanceStatus(instanceName: string): Promise<ConnectionState> {
    return this.getConnectionState(instanceName);
  }

  // ========== CONVENIENCE METHODS ==========

  async sendSimpleTextMessage(instanceName: string, number: string, text: string): Promise<MessageResponse> {
    return this.sendTextMessage(instanceName, { number, text });
  }

  async sendImageMessage(instanceName: string, number: string, imageUrl: string, caption?: string): Promise<MessageResponse> {
    return this.sendMediaMessage(instanceName, {
      number,
      mediaMessage: {
        mediatype: 'image',
        media: imageUrl,
        caption
      }
    });
  }

  async sendDocumentMessage(instanceName: string, number: string, documentUrl: string, fileName: string, caption?: string): Promise<MessageResponse> {
    return this.sendMediaMessage(instanceName, {
      number,
      mediaMessage: {
        mediatype: 'document',
        media: documentUrl,
        fileName,
        caption
      }
    });
  }

  async sendVideoMessage(instanceName: string, number: string, videoUrl: string, caption?: string): Promise<MessageResponse> {
    return this.sendMediaMessage(instanceName, {
      number,
      mediaMessage: {
        mediatype: 'video',
        media: videoUrl,
        caption
      }
    });
  }

  async sendVoiceMessage(instanceName: string, number: string, audioUrl: string): Promise<MessageResponse> {
    return this.sendAudioMessage(instanceName, {
      number,
      audioMessage: {
        audio: audioUrl,
        ptt: true
      }
    });
  }
}

// Singleton instance with correct credentials
let evolutionAPI: EvolutionAPI | null = null;

export const getEvolutionAPI = (): EvolutionAPI => {
  if (!evolutionAPI) {
    evolutionAPI = new EvolutionAPI({
      serverUrl: 'https://evolution.suplelive.com.br',
      apiKey: '14793ff820dfc1ea9421e24722628426'
    });
  }
  return evolutionAPI;
};

// Webhook handler factory
export const createEvolutionWebhookHandler = (
  onQRCodeUpdate: (instanceName: string, qrCode: string) => void,
  onConnectionUpdate: (instanceName: string, status: string, phoneNumber?: string) => void,
  onMessageReceived: (instanceName: string, message: any) => void,
  onContactUpdate?: (instanceName: string, contacts: any[]) => void,
  onChatUpdate?: (instanceName: string, chats: any[]) => void,
  onGroupUpdate?: (instanceName: string, group: any) => void
) => {
  return (webhookData: WebhookData) => {
    const { event, instance, data } = webhookData;

    console.log(`Webhook received: ${event} for instance: ${instance}`, data);

    switch (event) {
      case 'QRCODE_UPDATED':
        if (data.qrcode) {
          onQRCodeUpdate(instance, data.qrcode.base64 || data.qrcode);
        }
        break;

      case 'CONNECTION_UPDATE':
        const status = data.state || data.status;
        const phoneNumber = data.instance?.profileName || data.instance?.number || data.profileName;
        onConnectionUpdate(instance, status, phoneNumber);
        break;

      case 'MESSAGES_UPSERT':
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach((message: any) => {
            if (!message.key.fromMe) {
              onMessageReceived(instance, message);
            }
          });
        }
        break;

      case 'MESSAGES_UPDATE':
        console.log('Message status updated:', data);
        break;

      case 'SEND_MESSAGE':
        console.log('Message sent:', data);
        break;

      case 'CONTACTS_SET':
      case 'CONTACTS_UPSERT':
      case 'CONTACTS_UPDATE':
        if (onContactUpdate && data.contacts) {
          onContactUpdate(instance, data.contacts);
        }
        break;

      case 'CHATS_SET':
      case 'CHATS_UPSERT':
      case 'CHATS_UPDATE':
        if (onChatUpdate && data.chats) {
          onChatUpdate(instance, data.chats);
        }
        break;

      case 'CHATS_DELETE':
        console.log('Chat deleted:', data);
        break;

      case 'GROUPS_UPSERT':
      case 'GROUP_UPDATE':
        if (onGroupUpdate && data.group) {
          onGroupUpdate(instance, data.group);
        }
        break;

      case 'GROUP_PARTICIPANTS_UPDATE':
        console.log('Group participants updated:', data);
        break;

      case 'PRESENCE_UPDATE':
        console.log('Presence updated:', data);
        break;

      case 'LABELS_EDIT':
      case 'LABELS_ASSOCIATION':
        console.log('Labels updated:', data);
        break;

      case 'CALL':
        console.log('Call received:', data);
        break;

      case 'APPLICATION_STARTUP':
        console.log('WhatsApp instance started:', instance);
        break;

      default:
        console.log('Unhandled webhook event:', event, data);
    }
  };
};

// Utility functions for message formatting
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (digits.length === 11 && digits.startsWith('55')) {
    return `${digits}@s.whatsapp.net`;
  } else if (digits.length === 11) {
    return `55${digits}@s.whatsapp.net`;
  } else if (digits.length === 10) {
    return `559${digits}@s.whatsapp.net`;
  }
  
  return `${digits}@s.whatsapp.net`;
};

export const extractPhoneFromJid = (jid: string): string => {
  return jid.split('@')[0];
};

export const isGroupJid = (jid: string): boolean => {
  return jid.includes('@g.us');
};

export const isPrivateJid = (jid: string): boolean => {
  return jid.includes('@s.whatsapp.net');
};