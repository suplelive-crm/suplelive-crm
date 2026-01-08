// ============================================================================
// CONSOLIDATED VERSION FOR MANUAL DEPLOYMENT VIA SUPABASE DASHBOARD
// ============================================================================
// Edge Function: Process Event Queue
// Processa eventos da fila e chama as Edge Functions apropriadas
// Executado via Supabase Cron a cada 1 minuto

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// EVENT ROUTING
// ============================================================================

const EVENT_HANDLERS: Record<number, string> = {
  1: 'process-order-created',       // ✅ JÁ EXISTE
  3: 'process-payment-received',    // TODO: Fase 2
  18: 'process-status-changed',     // TODO: Fase 2
  11: 'update-tracking-status',     // TODO: Fase 2
  4: 'process-order-removed',       // TODO: Fase 3
  // Outros eventos: apenas log
};

const PRIORITY_EVENTS = [1, 3, 18]; // Eventos de alta prioridade

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('⚙️  Iniciando processamento da fila de eventos...');

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // ========================================================================
    // STEP 1: Buscar eventos pendentes (priorizar eventos importantes)
    // ========================================================================

    const { data: pendingEvents, error: fetchError } = await supabaseClient
      .from('event_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(20); // Processar no máximo 20 por vez

    if (fetchError) {
      throw new Error(`Failed to fetch events: ${fetchError.message}`);
    }

    if (!pendingEvents || pendingEvents.length === 0) {
      console.log('✅ Nenhum evento pendente para processar');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: 'No pending events to process'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`📨 Encontrados ${pendingEvents.length} eventos para processar`);

    // Ordenar: prioridade alta primeiro
    const sortedEvents = pendingEvents.sort((a, b) => {
      const aPriority = PRIORITY_EVENTS.includes(a.event_type) ? 0 : 1;
      const bPriority = PRIORITY_EVENTS.includes(b.event_type) ? 0 : 1;
      return aPriority - bPriority;
    });

    // ========================================================================
    // STEP 2: Processar cada evento
    // ========================================================================

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as any[],
    };

    for (const event of sortedEvents) {
      const { id, event_type, event_name, event_log_id, workspace_id, order_id, payload } = event;

      try {
        console.log(`\n🔄 Processando evento ${event_log_id}: ${event_name} (type: ${event_type})`);

        // Verificar se existe handler para este tipo de evento
        const handlerFunction = EVENT_HANDLERS[event_type];

        if (!handlerFunction) {
          console.log(`⚠️  Sem handler para evento tipo ${event_type} - Marcando como processed (log apenas)`);

          await supabaseClient
            .from('event_queue')
            .update({
              status: 'processed',
              processed_at: new Date().toISOString(),
              error_message: 'No handler configured - logged only',
            })
            .eq('id', id);

          results.skipped++;
          continue;
        }

        // Verificar se a Edge Function existe
        const functionExists = handlerFunction === 'process-order-created'; // Por enquanto só essa existe

        if (!functionExists) {
          console.log(`⚠️  Handler ${handlerFunction} ainda não implementado - Adiando evento`);
          results.skipped++;
          continue;
        }

        // Invocar Edge Function correspondente
        console.log(`📤 Invocando: ${handlerFunction}`);

        const functionUrl = `${supabaseUrl}/functions/v1/${handlerFunction}`;

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            event: {
              order_id: order_id,
              workspace_id: workspace_id,
              event_data: payload,
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        console.log(`✅ Evento processado com sucesso: ${event_name}`);

        // Marcar evento como processado
        await supabaseClient
          .from('event_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', id);

        results.success++;

        // Pequeno delay para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Erro ao processar evento ${event_log_id}:`, error);

        const newRetryCount = (event.retry_count || 0) + 1;
        const newStatus = newRetryCount >= 3 ? 'failed' : 'pending';

        await supabaseClient
          .from('event_queue')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: error.message,
          })
          .eq('id', id);

        results.failed++;
        results.errors.push({
          event_id: id,
          event_log_id: event_log_id,
          event_name: event_name,
          error: error.message,
          retry_count: newRetryCount,
        });
      }
    }

    // ========================================================================
    // STEP 3: Retornar resumo
    // ========================================================================

    console.log('\n📊 Processamento concluído:');
    console.log(`  ✅ Sucesso: ${results.success}`);
    console.log(`  ❌ Falhas: ${results.failed}`);
    console.log(`  ⚠️  Ignorados: ${results.skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pendingEvents.length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('💥 Erro fatal no processamento da fila:', error);

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
