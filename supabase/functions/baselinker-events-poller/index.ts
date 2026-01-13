// =====================================================
// BASELINKER EVENTS POLLER
// =====================================================
// Polling contínuo de EVENTOS via getJournalList
// Executa a cada 60 segundos via cron
// Captura mudanças: pagamentos, status, etc.
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  fetchJournalEvents,
  JournalEvent,
  BaselinkerConfig,
  getEventName,
  rateLimiter,
} from "../_shared/baselinker.ts";

// Supabase client setup
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Event types we care about (ordem de prioridade)
const ORDER_EVENT_TYPES = [
  1, // order_created (backup - principal é orders-poller)
  3, // payment_received (CRÍTICO)
  18, // status_changed (CRÍTICO)
  7, // invoice_created
  9, // package_created
  11, // delivery_updated
];

const BATCH_INSERT_SIZE = 50; // Inserir em lotes de 50 eventos

interface SyncState {
  id: string;
  workspace_id: string;
  last_log_id: number;
  is_syncing: boolean;
}

interface WorkspaceConfig {
  id: string;
  name: string;
  apiKey: string;
  syncState: SyncState | null;
}

/**
 * Busca workspaces com Baselinker configurado
 */
async function getWorkspacesWithBaselinker(): Promise<WorkspaceConfig[]> {
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, name, settings")
    .not("settings->baselinker_api_key", "is", null);

  if (error) {
    console.error("Error fetching workspaces:", error);
    return [];
  }

  const configs: WorkspaceConfig[] = [];

  for (const workspace of workspaces || []) {
    const apiKey = workspace.settings?.baselinker_api_key;
    if (!apiKey) continue;

    // Buscar sync state
    const { data: syncState } = await supabase
      .from("baselinker_sync_state")
      .select("*")
      .eq("workspace_id", workspace.id)
      .single();

    configs.push({
      id: workspace.id,
      name: workspace.name,
      apiKey,
      syncState: syncState || null,
    });
  }

  return configs;
}

/**
 * Cria ou atualiza sync state para um workspace
 */
async function ensureSyncState(workspaceId: string): Promise<SyncState> {
  const { data, error } = await supabase
    .from("baselinker_sync_state")
    .upsert(
      {
        workspace_id: workspaceId,
        last_log_id: 0,
        last_order_confirmed_timestamp: 0,
        is_syncing: false,
      },
      {
        onConflict: "workspace_id",
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to ensure sync state: ${error.message}`);
  }

  return data;
}

/**
 * Atualiza last_log_id após processamento
 */
async function updateLastLogId(
  workspaceId: string,
  lastLogId: number,
  eventsProcessed: number
): Promise<void> {
  // Buscar contador atual
  const { data: currentState } = await supabase
    .from("baselinker_sync_state")
    .select("total_events_processed")
    .eq("workspace_id", workspaceId)
    .single();

  const currentTotal = currentState?.total_events_processed || 0;

  await supabase
    .from("baselinker_sync_state")
    .update({
      last_log_id: lastLogId,
      total_events_processed: currentTotal + eventsProcessed,
      last_sync_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId);
}

/**
 * Registra erro no sync state
 */
async function logSyncError(
  workspaceId: string,
  errorMessage: string
): Promise<void> {
  const { data: currentState } = await supabase
    .from("baselinker_sync_state")
    .select("sync_errors")
    .eq("workspace_id", workspaceId)
    .single();

  const currentErrors = currentState?.sync_errors || [];

  await supabase
    .from("baselinker_sync_state")
    .update({
      sync_errors: [
        ...currentErrors.slice(-9), // Manter últimos 9 erros
        {
          timestamp: new Date().toISOString(),
          message: errorMessage,
          source: "events-poller",
        },
      ],
    })
    .eq("workspace_id", workspaceId);
}

/**
 * Insere eventos na fila de sincronização em lote
 */
async function insertEventsToQueue(
  workspaceId: string,
  events: JournalEvent[]
): Promise<number> {
  if (events.length === 0) return 0;

  // Preparar eventos para inserção
  const queueItems = events.map((event) => ({
    workspace_id: workspaceId,
    event_log_id: event.log_id,
    event_type: event.log_type,
    event_name: getEventName(event.log_type),
    order_id_base: event.order_id,
    source: "event_poll", // 🆕 Marca origem
    payload: event,
    status: "pending",
    created_at: new Date().toISOString(),
  }));

  // Inserir em lotes
  let insertedCount = 0;
  for (let i = 0; i < queueItems.length; i += BATCH_INSERT_SIZE) {
    const batch = queueItems.slice(i, i + BATCH_INSERT_SIZE);

    const { error } = await supabase
      .from("order_sync_queue")
      .upsert(batch, {
        onConflict: "event_log_id",
        ignoreDuplicates: true, // Não sobrescrever se já existe
      });

    if (error) {
      console.error(`Error inserting batch ${i / BATCH_INSERT_SIZE}:`, error);
    } else {
      insertedCount += batch.length;
    }
  }

  return insertedCount;
}

/**
 * Processa eventos de um workspace específico
 */
async function syncWorkspaceEvents(
  config: WorkspaceConfig
): Promise<{ success: boolean; eventsProcessed: number; lastLogId?: number }> {
  console.log(`\n[${config.name}] Starting event sync...`);

  // Garantir que existe sync state
  if (!config.syncState) {
    config.syncState = await ensureSyncState(config.id);
  }

  try {
    const baselinkerConfig: BaselinkerConfig = {
      token: config.apiKey,
      workspace_id: config.id,
    };

    const lastLogId = config.syncState.last_log_id;
    console.log(`[${config.name}] Fetching events from log_id: ${lastLogId}`);

    // Rate limiting
    await rateLimiter.throttle();

    // Buscar eventos
    const events = await fetchJournalEvents(
      baselinkerConfig,
      lastLogId,
      ORDER_EVENT_TYPES
    );

    console.log(`[${config.name}] Fetched ${events.length} events`);

    if (events.length === 0) {
      console.log(`[${config.name}] No new events`);
      return { success: true, eventsProcessed: 0 };
    }

    // Inserir na fila
    const inserted = await insertEventsToQueue(config.id, events);
    console.log(`[${config.name}] Inserted ${inserted} events to queue`);

    // Atualizar last_log_id
    const newLastLogId = Math.max(...events.map((e) => e.log_id));
    await updateLastLogId(config.id, newLastLogId, inserted);

    console.log(
      `[${config.name}] Sync completed: ${inserted} events, new log_id: ${newLastLogId}`
    );

    return {
      success: true,
      eventsProcessed: inserted,
      lastLogId: newLastLogId,
    };
  } catch (error) {
    console.error(`[${config.name}] Error during sync:`, error);
    await logSyncError(config.id, error.message);

    return { success: false, eventsProcessed: 0 };
  }
}

/**
 * Handler principal
 */
serve(async (req: Request) => {
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

  try {
    console.log("=== BASELINKER EVENTS POLLER STARTED ===");

    // Buscar workspaces com Baselinker configurado
    const workspaces = await getWorkspacesWithBaselinker();
    console.log(`Found ${workspaces.length} workspaces with Baselinker`);

    if (workspaces.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No workspaces with Baselinker configured",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Processar cada workspace
    const results = [];
    for (const workspace of workspaces) {
      const result = await syncWorkspaceEvents(workspace);
      results.push({
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        ...result,
      });
    }

    const totalProcessed = results.reduce(
      (sum, r) => sum + r.eventsProcessed,
      0
    );
    const successCount = results.filter((r) => r.success).length;

    console.log(
      `=== POLLER COMPLETED: ${totalProcessed} events across ${successCount}/${workspaces.length} workspaces ===`
    );

    return new Response(
      JSON.stringify({
        success: true,
        workspaces_processed: workspaces.length,
        workspaces_successful: successCount,
        total_events_processed: totalProcessed,
        results,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Fatal error in events poller:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
