// Send Scheduled Messages
// Runs daily (or hourly) to send pending scheduled messages
// This is the only function that needs a cron job
// Fetches Evolution API credentials from workspace settings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getEvolutionConfig } from '../_shared/workspace-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch messages to send (scheduled_for <= now and status = pending)
    const now = new Date().toISOString();
    const { data: messages, error: fetchError } = await supabaseClient
      .from('scheduled_messages')
      .select('*, clients(name, phone), workspaces(id)')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch messages: ${fetchError.message}`);
    }

    if (!messages || messages.length === 0) {
      console.log('No messages to send');
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${messages.length} messages to send`);

    const results = [];

    for (const msg of messages) {
      try {
        // Get WhatsApp instance for this workspace
        const { data: instance } = await supabaseClient
          .from('whatsapp_instances')
          .select('*')
          .eq('workspace_id', msg.workspace_id)
          .eq('status', 'connected')
          .limit(1)
          .maybeSingle();

        if (!instance) {
          console.error(`No WhatsApp instance for workspace ${msg.workspace_id}`);
          results.push({
            message_id: msg.id,
            status: 'failed',
            error: 'No WhatsApp instance connected',
          });

          await supabaseClient
            .from('scheduled_messages')
            .update({ status: 'failed' })
            .eq('id', msg.id);

          continue;
        }

        // Get Evolution API credentials from workspace settings
        const evolutionConfig = await getEvolutionConfig(supabaseClient, msg.workspace_id);

        // Send message via Evolution API
        const response = await fetch(
          `${evolutionConfig.api_url}/message/sendText/${instance.instance_name}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: evolutionConfig.api_key,
            },
            body: JSON.stringify({
              number: msg.clients.phone,
              text: msg.message_content,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        // Mark message as sent
        await supabaseClient
          .from('scheduled_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', msg.id);

        // Log message in messages table
        await supabaseClient.from('messages').insert({
          client_id: msg.client_id,
          content: msg.message_content,
          send_type: `automated_${msg.message_type}`,
          status: 'sent',
          channel_type: 'whatsapp',
          sender_type: 'bot',
          metadata: {
            scheduled_message_id: msg.id,
            ...msg.metadata,
          },
        });

        results.push({
          message_id: msg.id,
          status: 'sent',
          client: msg.clients.name,
        });

        console.log(`Sent message ${msg.id} to ${msg.clients.phone}`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error sending message ${msg.id}:`, error);

        // Mark as failed
        await supabaseClient
          .from('scheduled_messages')
          .update({
            status: 'failed',
            metadata: {
              ...msg.metadata,
              error: error.message,
              failed_at: new Date().toISOString(),
            },
          })
          .eq('id', msg.id);

        results.push({
          message_id: msg.id,
          status: 'failed',
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.status === 'sent').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    console.log(`Sent ${successCount} messages, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failedCount,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Fatal error in send-scheduled-messages:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
