import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Supabase client setup
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface WebhookData {
  event: string;
  instance: string;
  data: any;
  destination?: string;
  date_time: string;
  sender?: string;
  server_url: string;
  apikey: string;
}

serve(async (req: Request) => {
  try {
    // CORS headers
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Parse webhook data
    const webhookData: WebhookData = await req.json();
    console.log("Webhook received:", webhookData.event);

    // Process based on event type
    switch (webhookData.event) {
      case "QRCODE_UPDATED":
        await handleQRCodeUpdate(webhookData);
        break;
      case "CONNECTION_UPDATE":
        await handleConnectionUpdate(webhookData);
        break;
      case "MESSAGES_UPSERT":
        await handleMessageUpsert(webhookData);
        break;
      case "MESSAGES_UPDATE":
        await handleMessageUpdate(webhookData);
        break;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

// Handler functions
async function handleQRCodeUpdate(webhookData: WebhookData) {
  const { instance, data } = webhookData;
  
  if (!data.qrcode?.base64) return;
  
  // Update WhatsApp instance with new QR code
  const { error } = await supabase
    .from("whatsapp_instances")
    .update({ 
      qr_code: data.qrcode.base64,
      status: "connecting",
      updated_at: new Date().toISOString()
    })
    .eq("session_id", instance);
  
  if (error) {
    console.error("Error updating QR code:", error);
  }
}

async function handleConnectionUpdate(webhookData: WebhookData) {
  const { instance, data } = webhookData;
  
  // Get status from data
  let status = "disconnected";
  if (data.state === "open") {
    status = "connected";
  } else if (data.state === "connecting") {
    status = "connecting";
  }
  
  // Get phone number if available
  const phoneNumber = data.instance?.phone || data.instance?.number || data.instance?.profileName || null;
  
  // Update WhatsApp instance status
  const { error } = await supabase
    .from("whatsapp_instances")
    .update({ 
      status,
      phone_number: phoneNumber,
      updated_at: new Date().toISOString(),
      ...(status === "connected" ? { qr_code: null } : {})
    })
    .eq("session_id", instance);
  
  if (error) {
    console.error("Error updating connection status:", error);
  }
}

async function handleMessageUpsert(webhookData: WebhookData) {
  const { instance, data } = webhookData;
  
  if (!data.messages || !data.messages.length) return;
  
  // Process only incoming messages (not from me)
  const incomingMessages = data.messages.filter((msg: any) => !msg.key.fromMe);
  
  for (const message of incomingMessages) {
    await processIncomingMessage(instance, message);
  }
}

async function handleMessageUpdate(webhookData: WebhookData) {
  const { data } = webhookData;
  
  if (!data.messages || !data.messages.length) return;
  
  for (const message of data.messages) {
    // Update message status in database
    if (message.key?.id && message.status) {
      await supabase
        .from("messages")
        .update({ 
          status: message.status.toLowerCase(),
          metadata: { ...message.metadata, status_updated_at: new Date().toISOString() }
        })
        .eq("external_id", message.key.id);
    }
  }
}

async function processIncomingMessage(instance: string, message: any) {
  try {
    // Get instance details
    const { data: instanceData, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, workspace_id")
      .eq("session_id", instance)
      .single();
    
    if (instanceError || !instanceData) {
      throw new Error(`Instance not found: ${instanceError?.message}`);
    }
    
    // Extract phone number from JID
    const phoneNumber = message.key.remoteJid.split('@')[0];
    
    // Find or create client
    const client = await findOrCreateClient(phoneNumber, instanceData.workspace_id);
    
    // Find or create conversation
    const conversation = await findOrCreateConversation(
      client.id, 
      instanceData.workspace_id, 
      "whatsapp",
      message.key.remoteJid
    );
    
    // Extract message content
    const content = extractMessageContent(message);
    
    // Save message to database
    await saveMessage(
      client.id,
      conversation.id,
      content,
      message.key.id,
      message
    );
    
    // Process with automation if needed
    await processWithAutomation(conversation.id, content, client.id);
    
  } catch (error) {
    console.error("Error processing incoming message:", error);
  }
}

async function findOrCreateClient(phoneNumber: string, workspaceId: string) {
  // Try to find existing client by phone
  const { data: existingClients } = await supabase
    .from("clients")
    .select("*")
    .eq("phone", phoneNumber)
    .eq("workspace_id", workspaceId);
  
  if (existingClients && existingClients.length > 0) {
    return existingClients[0];
  }
  
  // Create new client
  const { data: newClient, error } = await supabase
    .from("clients")
    .insert({
      name: `Cliente ${phoneNumber.slice(-4)}`,
      phone: phoneNumber,
      workspace_id: workspaceId
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create client: ${error.message}`);
  }
  
  return newClient;
}

async function findOrCreateConversation(
  clientId: string, 
  workspaceId: string, 
  channelType: string,
  externalId: string
) {
  // Try to find existing conversation
  const { data: existingConversations } = await supabase
    .from("conversations")
    .select("*")
    .eq("client_id", clientId)
    .eq("channel_type", channelType)
    .eq("workspace_id", workspaceId);
  
  if (existingConversations && existingConversations.length > 0) {
    // Update last_message_at
    await supabase
      .from("conversations")
      .update({ 
        last_message_at: new Date().toISOString(),
        status: "open"
      })
      .eq("id", existingConversations[0].id);
    
    return existingConversations[0];
  }
  
  // Get default sector
  const { data: defaultSectors } = await supabase
    .from("sectors")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .limit(1);
  
  const defaultSectorId = defaultSectors && defaultSectors.length > 0 
    ? defaultSectors[0].id 
    : null;
  
  // Create new conversation
  const { data: newConversation, error } = await supabase
    .from("conversations")
    .insert({
      client_id: clientId,
      workspace_id: workspaceId,
      channel_type: channelType,
      external_id: externalId,
      status: "open",
      sector_id: defaultSectorId,
      last_message_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }
  
  return newConversation;
}

function extractMessageContent(message: any): string {
  // Extract text content from different message types
  if (message.message?.conversation) {
    return message.message.conversation;
  } else if (message.message?.extendedTextMessage?.text) {
    return message.message.extendedTextMessage.text;
  } else if (message.message?.imageMessage) {
    return message.message.imageMessage.caption || "[Imagem]";
  } else if (message.message?.videoMessage) {
    return message.message.videoMessage.caption || "[Vídeo]";
  } else if (message.message?.audioMessage) {
    return "[Áudio]";
  } else if (message.message?.documentMessage) {
    return `[Documento: ${message.message.documentMessage.fileName || "sem nome"}]`;
  } else if (message.message?.stickerMessage) {
    return "[Sticker]";
  } else if (message.message?.contactMessage) {
    return "[Contato]";
  } else if (message.message?.locationMessage) {
    return "[Localização]";
  } else {
    return "[Mensagem não suportada]";
  }
}

async function saveMessage(
  clientId: string,
  conversationId: string,
  content: string,
  externalId: string,
  originalMessage: any
) {
  // Prepare metadata
  const metadata: any = {
    messageType: getMessageType(originalMessage),
    timestamp: originalMessage.messageTimestamp,
  };
  
  // Add media info if present
  if (originalMessage.message?.imageMessage) {
    metadata.mediaType = "image";
    metadata.mediaUrl = originalMessage.message.imageMessage.url;
  } else if (originalMessage.message?.videoMessage) {
    metadata.mediaType = "video";
    metadata.mediaUrl = originalMessage.message.videoMessage.url;
  } else if (originalMessage.message?.audioMessage) {
    metadata.mediaType = "audio";
    metadata.mediaUrl = originalMessage.message.audioMessage.url;
  } else if (originalMessage.message?.documentMessage) {
    metadata.mediaType = "document";
    metadata.mediaUrl = originalMessage.message.documentMessage.url;
    metadata.fileName = originalMessage.message.documentMessage.fileName;
  }
  
  // Save message
  const { error } = await supabase
    .from("messages")
    .insert({
      client_id: clientId,
      conversation_id: conversationId,
      content,
      send_type: "incoming",
      sender_type: "client",
      channel_type: "whatsapp",
      status: "received",
      external_id: externalId,
      metadata,
      timestamp: new Date().toISOString()
    });
  
  if (error) {
    console.error("Error saving message:", error);
  }
}

function getMessageType(message: any): string {
  if (message.message?.conversation) return "text";
  if (message.message?.extendedTextMessage) return "text";
  if (message.message?.imageMessage) return "image";
  if (message.message?.videoMessage) return "video";
  if (message.message?.audioMessage) return "audio";
  if (message.message?.documentMessage) return "document";
  if (message.message?.stickerMessage) return "sticker";
  if (message.message?.contactMessage) return "contact";
  if (message.message?.locationMessage) return "location";
  return "unknown";
}

async function processWithAutomation(conversationId: string, content: string, clientId: string) {
  // Find automations with message_received trigger
  const { data: automations } = await supabase
    .from("automation_workflows")
    .select("*")
    .eq("status", "active")
    .eq("trigger_type", "message_received");
  
  if (!automations || automations.length === 0) return;
  
  // Create execution records for each matching automation
  for (const automation of automations) {
    await supabase
      .from("automation_executions")
      .insert({
        workflow_id: automation.id,
        trigger_data: {
          conversation_id: conversationId,
          message: content,
          client_id: clientId,
          timestamp: new Date().toISOString()
        },
        status: "running",
        started_at: new Date().toISOString(),
        client_id: clientId,
        conversation_id: conversationId
      });
    
    // Update execution count
    await supabase
      .from("automation_workflows")
      .update({ 
        execution_count: (automation.execution_count || 0) + 1,
        last_executed: new Date().toISOString()
      })
      .eq("id", automation.id);
  }
}