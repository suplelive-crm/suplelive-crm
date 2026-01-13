// =====================================================
// BASELINKER ORDERS POLLER
// =====================================================
// Polling contínuo de NOVOS PEDIDOS via getOrders
// Executa a cada 60 segundos via cron
// Usa travessia temporal com date_confirmed_from
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
const MAX_ITERATIONS_PER_RUN = 10; // Máximo 10 páginas (1000 pedidos) por execução
const SLEEP_BETWEEN_REQUESTS_MS = 1000; // 1 segundo entre requisições
const BATCH_INSERT_SIZE = 50; // Inserir em lotes de 50 eventos

// Event type for new orders (usado como fallback para event_log_id)
const ORDER_CREATED_EVENT_TYPE = 1;

interface SyncState {
  id: string;
  workspace_id: string;
  last_order_confirmed_timestamp: number;
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
        last_order_confirmed_timestamp: 0,
        last_log_id: 0,
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
 * Marca início de sincronização
 */
async function markSyncStart(workspaceId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("baselinker_sync_state")
    .update({ is_syncing: true, last_sync_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("is_syncing", false) // Optimistic lock
    .select();

  if (error) {
    console.error(`Failed to mark sync start for ${workspaceId}:`, error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Marca fim de sincronização
 */
async function markSyncEnd(
  workspaceId: string,
  success: boolean,
  lastTimestamp?: number,
  ordersSynced?: number,
  errorMessage?: string
): Promise<void> {
  const updates: any = {
    is_syncing: false,
    last_sync_at: new Date().toISOString(),
  };

  if (success && lastTimestamp !== undefined) {
    updates.last_order_confirmed_timestamp = lastTimestamp;
  }

  if (ordersSynced !== undefined) {
    // Incrementar contador
    const { data: currentState } = await supabase
      .from("baselinker_sync_state")
      .select("total_orders_synced")
      .eq("workspace_id", workspaceId)
      .single();

    const currentTotal = currentState?.total_orders_synced || 0;
    updates.total_orders_synced = currentTotal + ordersSynced;
  }

  if (!success && errorMessage) {
    // Adicionar erro ao array
    const { data: currentState } = await supabase
      .from("baselinker_sync_state")
      .select("sync_errors")
      .eq("workspace_id", workspaceId)
      .single();

    const currentErrors = currentState?.sync_errors || [];
    updates.sync_errors = [
      ...currentErrors.slice(-9), // Manter últimos 9 erros
      {
        timestamp: new Date().toISOString(),
        message: errorMessage,
        source: "orders-poller",
      },
    ];
  }

  await supabase
    .from("baselinker_sync_state")
    .update(updates)
    .eq("workspace_id", workspaceId);
}

/**
 * Insere pedidos na fila de sincronização em lote
 */
async function insertOrdersToQueue(
  workspaceId: string,
  orders: BaselinkerOrder[]
): Promise<number> {
  if (orders.length === 0) return 0;

  // Preparar eventos para inserção
  const events = orders.map((order) => ({
    workspace_id: workspaceId,
    // Para novos pedidos, usar order_id como event_log_id
    // Multiplicar por 1000000 + event_type para evitar conflitos com journal
    event_log_id: order.order_id * 1000000 + ORDER_CREATED_EVENT_TYPE,
    event_type: ORDER_CREATED_EVENT_TYPE,
    event_name: "order_created",
    order_id_base: order.order_id,
    source: "order_poll", // 🆕 Marca origem
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
 * Processa pedidos de um workspace específico
 */
async function syncWorkspaceOrders(
  config: WorkspaceConfig
): Promise<{ success: boolean; ordersSynced: number; lastTimestamp?: number }> {
  console.log(`\n[${config.name}] Starting order sync...`);

  // Garantir que existe sync state
  if (!config.syncState) {
    config.syncState = await ensureSyncState(config.id);
  }

  // Tentar marcar início de sync (lock otimista)
  const acquired = await markSyncStart(config.id);
  if (!acquired) {
    console.log(`[${config.name}] Sync already in progress, skipping...`);
    return { success: true, ordersSynced: 0 };
  }

  try {
    const baselinkerConfig: BaselinkerConfig = {
      token: config.apiKey,
      workspace_id: config.id,
    };

    let currentTimestamp = config.syncState.last_order_confirmed_timestamp;
    let totalOrdersSynced = 0;
    let lastOrderTimestamp = currentTimestamp;
    let iterations = 0;
    let hasMore = true;

    console.log(
      `[${config.name}] Starting from timestamp: ${currentTimestamp}`
    );

    // Loop de paginação com travessia temporal
    while (hasMore && iterations < MAX_ITERATIONS_PER_RUN) {
      iterations++;
      console.log(
        `[${config.name}] Iteration ${iterations}: fetching from ${currentTimestamp}...`
      );

      // Rate limiting
      await rateLimiter.throttle();

      // Buscar pedidos
      const response = await baselinkerRequest<{ orders: BaselinkerOrder[] }>(
        baselinkerConfig,
        "getOrders",
        {
          date_confirmed_from: currentTimestamp,
          get_unconfirmed_orders: false, // Apenas pedidos confirmados
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

      // Atualizar último timestamp
      const sortedOrders = [...orders].sort(
        (a, b) => a.date_confirmed - b.date_confirmed
      );
      lastOrderTimestamp = sortedOrders[sortedOrders.length - 1].date_confirmed;

      // Se retornou 100 pedidos (máximo da API), há mais dados
      if (orders.length === 100) {
        // Incrementar timestamp para próxima página
        currentTimestamp = lastOrderTimestamp + 1;

        // Sleep para respeitar rate limit
        if (iterations < MAX_ITERATIONS_PER_RUN) {
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
      `[${config.name}] Sync completed: ${totalOrdersSynced} orders synced, last timestamp: ${lastOrderTimestamp}`
    );

    // Marcar fim de sincronização com sucesso
    await markSyncEnd(
      config.id,
      true,
      lastOrderTimestamp,
      totalOrdersSynced
    );

    return {
      success: true,
      ordersSynced: totalOrdersSynced,
      lastTimestamp: lastOrderTimestamp,
    };
  } catch (error) {
    console.error(`[${config.name}] Error during sync:`, error);

    // Marcar fim de sincronização com erro
    await markSyncEnd(
      config.id,
      false,
      undefined,
      undefined,
      error.message
    );

    return { success: false, ordersSynced: 0 };
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
    console.log("=== BASELINKER ORDERS POLLER STARTED ===");

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
      const result = await syncWorkspaceOrders(workspace);
      results.push({
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        ...result,
      });
    }

    const totalSynced = results.reduce(
      (sum, r) => sum + r.ordersSynced,
      0
    );
    const successCount = results.filter((r) => r.success).length;

    console.log(
      `=== POLLER COMPLETED: ${totalSynced} orders synced across ${successCount}/${workspaces.length} workspaces ===`
    );

    return new Response(
      JSON.stringify({
        success: true,
        workspaces_processed: workspaces.length,
        workspaces_successful: successCount,
        total_orders_synced: totalSynced,
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
    console.error("Fatal error in orders poller:", error);

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
