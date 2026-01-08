// ============================================================================
// CONSOLIDATED VERSION FOR MANUAL DEPLOYMENT VIA SUPABASE DASHBOARD
// ============================================================================
// Edge Function: Send Scheduled Messages
// Processa e envia mensagens agendadas da tabela scheduled_messages
// Executado via Supabase Cron a cada 5 minutos

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// WHATSAPP SENDER
// ============================================================================

class EvolutionAPI {
  private baseURL = 'https://evolution.suplelive.com.br';
  private apiKey = '14793ff820dfc1ea9421e24722628426';

  async sendSimpleTextMessage(instance: string, number: string, text: string) {
    const response = await fetch(`${this.baseURL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      },
      body: JSON.stringify({ number, text })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Evolution API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }
}

function formatPhoneNumberForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    return `${digits}@s.whatsapp.net`;
  }

  if (digits.length === 11 && digits.startsWith('55')) {
    return `${digits}@s.whatsapp.net`;
  }

  if (digits.length === 11) {
    return `55${digits}@s.whatsapp.net`;
  }

  if (digits.length === 10) {
    return `559${digits}@s.whatsapp.net`;
  }

  return `${digits}@s.whatsapp.net`;
}

async function getConnectedInstance(supabase: any, workspaceId: string) {
  const { data: instances, error } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !instances || instances.length === 0) {
    throw new Error('Nenhuma instância WhatsApp conectada');
  }

  return instances[0];
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🕐 Iniciando processamento de mensagens agendadas...');

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

    // ========================================================================
    // STEP 1: Buscar mensagens pendentes que chegaram no horário
    // ========================================================================

    const { data: pendingMessages, error: fetchError } = await supabaseClient
      .from('scheduled_messages')
      .select(`
        id,
        workspace_id,
        client_id,
        message_type,
        message_content,
        scheduled_for,
        retry_count,
        metadata,
        clients (
          id,
          name,
          phone
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .lt('retry_count', 3)
      .order('scheduled_for', { ascending: true })
      .limit(50); // Processar no máximo 50 por vez

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled messages: ${fetchError.message}`);
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('✅ Nenhuma mensagem pendente para processar');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'No pending messages to process'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📨 Encontradas ${pendingMessages.length} mensagens para processar`);

    // ========================================================================
    // STEP 2: Processar cada mensagem
    // ========================================================================

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as any[],
    };

    for (const scheduledMessage of pendingMessages) {
      const { id, workspace_id, client_id, message_type, message_content, clients } = scheduledMessage;

      try {
        // Validar se cliente tem telefone
        if (!clients || !clients.phone) {
          console.log(`⚠️ Cliente ${client_id} não possui telefone - Marcando como failed`);

          await supabaseClient
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: 'Cliente não possui número de telefone',
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);

          results.skipped++;
          continue;
        }

        console.log(`📤 Enviando mensagem para ${clients.name} (${clients.phone})`);

        // Buscar instância WhatsApp conectada
        const instance = await getConnectedInstance(supabaseClient, workspace_id);

        if (!instance.session_id) {
          throw new Error('Instância não possui session_id');
        }

        // Formatar número e enviar mensagem
        const formattedNumber = formatPhoneNumberForWhatsApp(clients.phone);
        const evolutionAPI = new EvolutionAPI();

        await evolutionAPI.sendSimpleTextMessage(
          instance.session_id,
          formattedNumber,
          message_content
        );

        console.log(`✅ Mensagem enviada com sucesso para ${clients.name}`);

        // Atualizar scheduled_message como enviada
        await supabaseClient
          .from('scheduled_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        // Registrar no log de mensagens
        await supabaseClient
          .from('messages')
          .insert({
            workspace_id: workspace_id,
            client_id: client_id,
            content: message_content,
            send_type: `scheduled_${message_type}`,
            status: 'sent',
            channel_type: 'whatsapp',
            sender_type: 'bot',
            metadata: {
              scheduled_message_id: id,
              scheduled_for: scheduledMessage.scheduled_for,
              sent_at: new Date().toISOString(),
            },
          });

        results.success++;

        // Pequeno delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`❌ Erro ao enviar mensagem ${id}:`, error);

        const newRetryCount = (scheduledMessage.retry_count || 0) + 1;
        const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';

        await supabaseClient
          .from('scheduled_messages')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        results.failed++;
        results.errors.push({
          message_id: id,
          client_id: client_id,
          error: error.message,
          retry_count: newRetryCount,
        });
      }
    }

    // ========================================================================
    // STEP 3: Retornar resumo
    // ========================================================================

    console.log('📊 Processamento concluído:');
    console.log(`  ✅ Sucesso: ${results.success}`);
    console.log(`  ❌ Falhas: ${results.failed}`);
    console.log(`  ⚠️  Ignoradas: ${results.skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingMessages.length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Erro fatal no processamento:', error);

    return new Response(
      JSON.stringify({
        success: false,
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
