// =====================================================
// BASELINKER FULL SYNC
// =====================================================
// Sincronização completa diária como fallback
// Executa às 3:00 AM via cron
// Garante que nenhum pedido foi perdido
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  baselinkerRequest,
  BaselinkerConfig,
  BaselinkerOrder,
  rateLimiter,
} from "../_shared/baselinker.ts";

// Supabase client setup
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Constants
const DAYS_TO_SYNC = 7; // Sincronizar últimos 7 dias
const MAX_ITERATIONS = 50; // Máximo 50 páginas (5000 pedidos)
const SLEEP_BETWEEN_REQUESTS_MS = 1000; // 1 segundo entre requisições
const BATCH_INSERT_SIZE = 50; // Inserir em lotes de 50 eventos

// Event type for full sync
const FULL_SYNC_EVENT_TYPE = 999; // Tipo especial para sync completo

interface WorkspaceConfig {
  id: string;
  name: string;
  apiKey: string;
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

    configs.push({
      id: workspace.id,
      name: workspace.name,
      apiKey,
    });
  }

  return configs;
}

/**
 * Insere pedidos na fila de sincronização
 */
async function insertOrdersToQueue(
  workspaceId: string,
  orders: BaselinkerOrder[]
): Promise<number> {
  if (orders.length === 0) return 0;

  // Preparar eventos para inserção
  const events = orders.map((order) => ({
    workspace_id: workspaceId,
    // Para full sync, usar order_id + tipo especial
    event_log_id: order.order_id * 1000000 + FULL_SYNC_EVENT_TYPE,
    event_type: FULL_SYNC_EVENT_TYPE,
    event_name: "full_sync",
    order_id_base: order.order_id,
    source: "full_sync", // Marca origem
    payload: order,
    status: "pending",
    created_at: new Date().toISOString(),
  }));

  // Inserir em lotes
  let insertedCount = 0;
  for (let i = 0; i < events.length; i += BATCH_INSERT_SIZE) {
    const batch = events.slice(i, i + BATCH_INSERT_SIZE);

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
 * Registra resultado do sync no workspace
 */
async function logSyncResult(
  workspaceId: string,
  success: boolean,
  ordersSynced: number,
  errorMessage?: string
): Promise<void> {
  const { data: currentState } = await supabase
    .from("baselinker_sync_state")
    .select("total_orders_synced, sync_errors")
    .eq("workspace_id", workspaceId)
    .single();

  const updates: any = {
    last_sync_at: new Date().toISOString(),
  };

  if (success && ordersSynced > 0) {
    const currentTotal = currentState?.total_orders_synced || 0;
    updates.total_orders_synced = currentTotal + ordersSynced;
  }

  if (!success && errorMessage) {
    const currentErrors = currentState?.sync_errors || [];
    updates.sync_errors = [
      ...currentErrors.slice(-9),
      {
        timestamp: new Date().toISOString(),
        message: errorMessage,
        source: "full-sync",
      },
    ];
  }

  await supabase
    .from("baselinker_sync_state")
    .update(updates)
    .eq("workspace_id", workspaceId);
}

/**
 * Executa sync completo para um workspace
 */
async function syncWorkspace(
  config: WorkspaceConfig
): Promise<{ success: boolean; ordersSynced: number }> {
  console.log(`\n[${config.name}] Starting full sync...`);

  try {
    const baselinkerConfig: BaselinkerConfig = {
      token: config.apiKey,
      workspace_id: config.id,
    };

    // Calcular timestamp de início (últimos N dias)
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - DAYS_TO_SYNC);
    const startTimestamp = Math.floor(daysAgo.getTime() / 1000);

    console.log(
      `[${config.name}] Syncing orders from ${daysAgo.toISOString()} (${startTimestamp})`
    );

    let currentTimestamp = startTimestamp;
    let totalOrdersSynced = 0;
    let iterations = 0;
    let hasMore = true;

    // Loop de paginação
    while (hasMore && iterations < MAX_ITERATIONS) {
      iterations++;
      console.log(
        `[${config.name}] Iteration ${iterations}: fetching from ${currentTimestamp}...`
      );

      // Rate limiting
      await rateLimiter.throttle();

      // Buscar pedidos confirmados
      const response = await baselinkerRequest<{ orders: BaselinkerOrder[] }>(
        baselinkerConfig,
        "getOrders",
        {
          date_confirmed_from: currentTimestamp,
          get_unconfirmed_orders: false,
        }
      );

      const orders = response.orders || [];
      console.log(`[${config.name}] Fetched ${orders.length} orders`);

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      // Inserir na fila
      const inserted = await insertOrdersToQueue(config.id, orders);
      totalOrdersSynced += inserted;
      console.log(`[${config.name}] Inserted ${inserted} orders to queue`);

      // Se retornou 100 pedidos, há mais dados
      if (orders.length === 100) {
        // Encontrar último timestamp
        const sortedOrders = [...orders].sort(
          (a, b) => a.date_confirmed - b.date_confirmed
        );
        currentTimestamp =
          sortedOrders[sortedOrders.length - 1].date_confirmed + 1;

        // Sleep para respeitar rate limit
        if (iterations < MAX_ITERATIONS) {
          console.log(
            `[${config.name}] Sleeping ${SLEEP_BETWEEN_REQUESTS_MS}ms...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, SLEEP_BETWEEN_REQUESTS_MS)
          );
        }
      } else {
        hasMore = false;
      }
    }

    console.log(
      `[${config.name}] Full sync completed: ${totalOrdersSynced} orders synced in ${iterations} iterations`
    );

    await logSyncResult(config.id, true, totalOrdersSynced);

    return { success: true, ordersSynced: totalOrdersSynced };
  } catch (error) {
    console.error(`[${config.name}] Error during full sync:`, error);
    await logSyncResult(config.id, false, 0, error.message);

    return { success: false, ordersSynced: 0 };
  }
}

/**
 * Limpa entradas antigas da fila (>30 dias)
 */
async function cleanupOldQueueEntries(): Promise<number> {
  const { data, error } = await supabase.rpc("cleanup_old_sync_queue_entries");

  if (error) {
    console.error("Error cleaning up old queue entries:", error);
    return 0;
  }

  console.log("Cleaned up old queue entries");
  return 0;
}

/**
 * Reseta eventos travados (>1 hora em processing)
 */
async function resetStuckEntries(): Promise<number> {
  const { data, error } = await supabase.rpc("reset_stuck_sync_queue_entries");

  if (error) {
    console.error("Error resetting stuck entries:", error);
    return 0;
  }

  console.log("Reset stuck queue entries");
  return 0;
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
    console.log("=== BASELINKER FULL SYNC STARTED ===");

    // Manutenção: limpar e resetar
    await cleanupOldQueueEntries();
    await resetStuckEntries();

    // Buscar workspaces
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
      const result = await syncWorkspace(workspace);
      results.push({
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        ...result,
      });
    }

    const totalSynced = results.reduce((sum, r) => sum + r.ordersSynced, 0);
    const successCount = results.filter((r) => r.success).length;

    console.log(
      `=== FULL SYNC COMPLETED: ${totalSynced} orders across ${successCount}/${workspaces.length} workspaces ===`
    );

    return new Response(
      JSON.stringify({
        success: true,
        workspaces_processed: workspaces.length,
        workspaces_successful: successCount,
        total_orders_synced: totalSynced,
        days_synced: DAYS_TO_SYNC,
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
    console.error("Fatal error in full sync:", error);

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
