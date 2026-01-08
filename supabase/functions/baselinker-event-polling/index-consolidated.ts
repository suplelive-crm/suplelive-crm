// ============================================================================
// CONSOLIDATED VERSION FOR MANUAL DEPLOYMENT VIA SUPABASE DASHBOARD
// ============================================================================
// Edge Function: Baselinker Event Polling
// Busca novos eventos do Baselinker e insere na fila de processamento
// Executado via Supabase Cron a cada 1 minuto

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// BASELINKER API HELPERS
// ============================================================================

const BASELINKER_API_URL = 'https://api.baselinker.com/connector.php';

interface BaselinkerEvent {
  log_id: number;
  log_type: number;
  order_id: number;
  date: number;
  [key: string]: any;
}

async function baselinkerRequest(token: string, method: string, parameters: Record<string, any> = {}) {
  const body = new URLSearchParams({
    method,
    parameters: JSON.stringify(parameters),
  });

  const response = await fetch(BASELINKER_API_URL, {
    method: 'POST',
    headers: {
      'X-BLToken': token,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`Baselinker API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status === 'ERROR') {
    throw new Error(`Baselinker error: ${data.error_message} (${data.error_code})`);
  }

  return data;
}

function getEventName(eventType: number): string {
  const eventNames: Record<number, string> = {
    1: 'order_created',
    3: 'payment_received',
    4: 'order_removed',
    5: 'order_merged',
    6: 'order_split',
    7: 'invoice_created',
    8: 'receipt_created',
    9: 'package_created',
    10: 'package_deleted',
    11: 'delivery_updated',
    12: 'product_added',
    13: 'product_edited',
    14: 'product_removed',
    15: 'buyer_blacklisted',
    17: 'order_copied',
    18: 'status_changed',
    19: 'invoice_corrected',
    20: 'receipt_printed',
    21: 'invoice_cancelled',
  };

  return eventNames[eventType] || `unknown_event_${eventType}`;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Iniciando polling de eventos do Baselinker...');

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
    // STEP 1: Buscar workspaces com Baselinker habilitado
    // ========================================================================

    const { data: workspaces, error: workspacesError } = await supabaseClient
      .from('workspaces')
      .select('id, name, settings')
      .not('settings->baselinker->token', 'is', null)
      .eq('settings->baselinker->enabled', true);

    if (workspacesError) {
      throw new Error(`Failed to fetch workspaces: ${workspacesError.message}`);
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('✅ Nenhum workspace com Baselinker habilitado');
      return new Response(
        JSON.stringify({
          success: true,
          workspaces_processed: 0,
          message: 'No workspaces with Baselinker enabled'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📦 Encontrados ${workspaces.length} workspace(s) com Baselinker`);

    // ========================================================================
    // STEP 2: Processar cada workspace
    // ========================================================================

    const results = {
      workspaces_processed: 0,
      total_events: 0,
      new_events: 0,
      duplicate_events: 0,
      errors: [] as any[],
    };

    for (const workspace of workspaces) {
      try {
        const workspaceId = workspace.id;
        const baselinkerToken = workspace.settings?.baselinker?.token;

        if (!baselinkerToken) {
          console.log(`⚠️ Workspace ${workspace.name} sem token Baselinker`);
          continue;
        }

        console.log(`\n📊 Processando workspace: ${workspace.name}`);

        // Buscar estado de sincronização
        let { data: syncState, error: syncStateError } = await supabaseClient
          .from('baselinker_sync_state')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (syncStateError && syncStateError.code !== 'PGRST116') {
          throw syncStateError;
        }

        // Criar estado inicial se não existir
        if (!syncState) {
          const { data: newSyncState, error: createError } = await supabaseClient
            .from('baselinker_sync_state')
            .insert({
              workspace_id: workspaceId,
              last_log_id: 0,
              last_sync_at: new Date().toISOString(),
              is_syncing: false,
            })
            .select()
            .single();

          if (createError) {
            throw createError;
          }

          syncState = newSyncState;
        }

        // Verificar se já está sincronizando (lock otimista)
        if (syncState.is_syncing) {
          console.log(`⏳ Workspace ${workspace.name} já está sincronizando, pulando...`);
          continue;
        }

        // Marcar como sincronizando
        await supabaseClient
          .from('baselinker_sync_state')
          .update({ is_syncing: true })
          .eq('workspace_id', workspaceId);

        const lastLogId = syncState.last_log_id || 0;
        console.log(`📍 Último log_id processado: ${lastLogId}`);

        // Buscar novos eventos no Baselinker
        const response = await baselinkerRequest(baselinkerToken, 'getJournalList', {
          last_log_id: lastLogId,
        });

        const events: BaselinkerEvent[] = response.logs || [];
        console.log(`📨 Eventos retornados: ${events.length}`);

        results.total_events += events.length;

        // Inserir eventos na fila
        let newEventsCount = 0;
        let duplicateCount = 0;
        let maxLogId = lastLogId;

        for (const event of events) {
          try {
            const eventName = getEventName(event.log_type);

            const { error: insertError } = await supabaseClient
              .from('event_queue')
              .insert({
                workspace_id: workspaceId,
                event_log_id: event.log_id,
                event_type: event.log_type,
                event_name: eventName,
                order_id: event.order_id || null,
                payload: event,
                status: 'pending',
              });

            if (insertError) {
              // Erro de duplicata (UNIQUE constraint)
              if (insertError.code === '23505') {
                duplicateCount++;
              } else {
                throw insertError;
              }
            } else {
              newEventsCount++;
              console.log(`  ✅ Evento ${event.log_id}: ${eventName} (order: ${event.order_id})`);
            }

            // Atualizar max log_id
            if (event.log_id > maxLogId) {
              maxLogId = event.log_id;
            }

          } catch (error) {
            console.error(`  ❌ Erro ao processar evento ${event.log_id}:`, error);
            results.errors.push({
              workspace_id: workspaceId,
              event_log_id: event.log_id,
              error: error.message,
            });
          }
        }

        // Atualizar estado de sincronização
        await supabaseClient
          .from('baselinker_sync_state')
          .update({
            last_log_id: maxLogId,
            last_sync_at: new Date().toISOString(),
            is_syncing: false,
          })
          .eq('workspace_id', workspaceId);

        console.log(`✅ Workspace ${workspace.name}: ${newEventsCount} novos, ${duplicateCount} duplicados`);

        results.workspaces_processed++;
        results.new_events += newEventsCount;
        results.duplicate_events += duplicateCount;

      } catch (error) {
        console.error(`❌ Erro ao processar workspace ${workspace.name}:`, error);

        // Liberar lock em caso de erro
        await supabaseClient
          .from('baselinker_sync_state')
          .update({ is_syncing: false })
          .eq('workspace_id', workspace.id);

        results.errors.push({
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          error: error.message,
        });
      }
    }

    // ========================================================================
    // STEP 3: Retornar resumo
    // ========================================================================

    console.log('\n📊 Polling concluído:');
    console.log(`  🏢 Workspaces processados: ${results.workspaces_processed}`);
    console.log(`  📨 Total de eventos: ${results.total_events}`);
    console.log(`  ✅ Eventos novos: ${results.new_events}`);
    console.log(`  ⚠️  Duplicados: ${results.duplicate_events}`);
    console.log(`  ❌ Erros: ${results.errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Erro fatal no polling:', error);

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
