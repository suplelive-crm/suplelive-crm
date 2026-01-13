// =====================================================
// PROCESS ORDER EVENT
// =====================================================
// Processa fila de eventos/pedidos do Baselinker
// Executa a cada minuto via cron
// Cria/atualiza: clientes, pedidos, produtos
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  fetchOrderDetails,
  BaselinkerConfig,
  BaselinkerOrder,
  formatPhoneNumber,
  extractCPF,
  rateLimiter,
} from "../_shared/baselinker.ts";

// Supabase client setup
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Processing constants
const BATCH_SIZE = 10; // Processar 10 eventos por vez
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hora máximo

interface QueueItem {
  id: string;
  workspace_id: string;
  event_log_id: number;
  event_type: number;
  event_name: string;
  order_id_base: number;
  source: string;
  payload: any;
  retry_count: number;
  max_retries: number;
}

interface WorkspaceConfig {
  id: string;
  apiKey: string;
}

/**
 * Busca próximos eventos a processar
 */
async function getNextEvents(limit: number = BATCH_SIZE): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from("order_sync_queue")
    .select("*")
    .in("status", ["pending", "retry"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching queue items:", error);
    return [];
  }

  return data || [];
}

/**
 * Busca configuração de um workspace
 */
async function getWorkspaceConfig(
  workspaceId: string
): Promise<WorkspaceConfig | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, settings")
    .eq("id", workspaceId)
    .single();

  if (error || !data) {
    console.error(`Workspace ${workspaceId} not found`);
    return null;
  }

  const apiKey = data.settings?.baselinker_api_key;
  if (!apiKey) {
    console.error(`Workspace ${workspaceId} missing Baselinker API key`);
    return null;
  }

  return { id: data.id, apiKey };
}

/**
 * Marca evento como processando
 */
async function markEventProcessing(eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("order_sync_queue")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", eventId)
    .in("status", ["pending", "retry"]) // Optimistic lock
    .select();

  if (error) {
    console.error(`Failed to mark event ${eventId} as processing:`, error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Marca evento como completado
 */
async function markEventCompleted(eventId: string): Promise<void> {
  await supabase
    .from("order_sync_queue")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}

/**
 * Marca evento como falho e agenda retry
 */
async function markEventFailed(
  eventId: string,
  retryCount: number,
  maxRetries: number,
  errorMessage: string
): Promise<void> {
  const shouldRetry = retryCount < maxRetries;

  if (shouldRetry) {
    // Backoff exponencial: 1min, 5min, 15min
    const delayMs = Math.min(
      Math.pow(5, retryCount) * 60 * 1000,
      MAX_RETRY_DELAY_MS
    );
    const nextRetryAt = new Date(Date.now() + delayMs);

    await supabase
      .from("order_sync_queue")
      .update({
        status: "retry",
        retry_count: retryCount + 1,
        error_message: errorMessage,
        next_retry_at: nextRetryAt.toISOString(),
      })
      .eq("id", eventId);

    console.log(
      `Event ${eventId} scheduled for retry ${retryCount + 1}/${maxRetries} at ${nextRetryAt.toISOString()}`
    );
  } else {
    await supabase
      .from("order_sync_queue")
      .update({
        status: "failed",
        retry_count: retryCount + 1,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    console.error(`Event ${eventId} permanently failed after ${maxRetries} retries`);
  }
}

/**
 * Mapeia status do Baselinker para status do OmniCRM
 */
function mapOrderStatus(baselinkerStatusId: number): string {
  // Mapeamento baseado nos status comuns do Baselinker
  // Pode precisar ser ajustado conforme configuração do cliente
  const statusMap: Record<number, string> = {
    // Status iniciais
    1: "pending", // Novo
    2: "pending", // Aguardando pagamento

    // Status de pagamento
    100: "processing", // Pagamento confirmado
    101: "processing", // Pago

    // Status de preparação
    200: "processing", // Em preparação
    201: "processing", // Pronto para envio

    // Status de envio
    300: "shipped", // Enviado
    301: "shipped", // Em transporte

    // Status finais
    400: "completed", // Entregue

    // Status de cancelamento
    500: "cancelled", // Cancelado
    501: "cancelled", // Devolvido
  };

  return statusMap[baselinkerStatusId] || "pending";
}

/**
 * Encontra ou cria cliente a partir de dados do pedido
 */
async function findOrCreateClient(
  workspaceId: string,
  order: BaselinkerOrder
): Promise<string | null> {
  // Extrair dados do cliente
  const email = order.email?.trim() || null;
  const phone = order.phone ? formatPhoneNumber(order.phone) : null;
  const cpf = extractCPF(order);

  if (!email && !phone) {
    console.warn(`Order ${order.order_id} has no email or phone`);
    return null;
  }

  // Buscar cliente existente
  let query = supabase
    .from("clients")
    .select("id")
    .eq("workspace_id", workspaceId);

  if (email && phone) {
    query = query.or(`email.eq.${email},phone.eq.${phone}`);
  } else if (email) {
    query = query.eq("email", email);
  } else if (phone) {
    query = query.eq("phone", phone);
  }

  const { data: existingClients } = await query;

  const clientName = order.delivery_fullname || order.invoice_fullname || "Cliente Baselinker";

  if (existingClients && existingClients.length > 0) {
    // Atualizar cliente existente
    const clientId = existingClients[0].id;

    await supabase
      .from("clients")
      .update({
        name: clientName,
        email: email,
        phone: phone,
        cpf: cpf,
        metadata: {
          baselinker_data: {
            company: order.invoice_company,
            nip: order.invoice_nip,
            address: order.delivery_address,
            city: order.delivery_city,
            state: order.delivery_state,
            postcode: order.delivery_postcode,
            country: order.delivery_country_code,
            last_order_id: order.order_id,
            updated_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", clientId);

    return clientId;
  } else {
    // Criar novo cliente
    const { data: newClient, error } = await supabase
      .from("clients")
      .insert({
        name: clientName,
        email: email,
        phone: phone,
        cpf: cpf,
        workspace_id: workspaceId,
        metadata: {
          baselinker_data: {
            company: order.invoice_company,
            nip: order.invoice_nip,
            address: order.delivery_address,
            city: order.delivery_city,
            state: order.delivery_state,
            postcode: order.delivery_postcode,
            country: order.delivery_country_code,
            first_order_id: order.order_id,
            created_at: new Date().toISOString(),
          },
        },
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating client:", error);
      return null;
    }

    return newClient?.id || null;
  }
}

/**
 * Calcula valor total do pedido
 */
function calculateOrderTotal(order: BaselinkerOrder): number {
  let total = 0;

  // Somar produtos
  if (order.products && Array.isArray(order.products)) {
    total = order.products.reduce(
      (sum, product) => sum + (product.price_brutto * product.quantity),
      0
    );
  }

  // Adicionar frete
  if (order.delivery_price) {
    total += order.delivery_price;
  }

  return total;
}

/**
 * Cria ou atualiza pedido
 */
async function upsertOrder(
  workspaceId: string,
  clientId: string,
  order: BaselinkerOrder
): Promise<void> {
  const status = mapOrderStatus(order.order_status_id);
  const totalAmount = calculateOrderTotal(order);

  // Verificar se pedido já existe
  const { data: existingOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("order_id_base", order.order_id)
    .eq("workspace_id", workspaceId);

  const orderData = {
    client_id: clientId,
    total_amount: totalAmount,
    order_date: new Date(order.date_add * 1000).toISOString(),
    status: status,
    order_id_base: order.order_id,
    date_confirmed: order.date_confirmed || order.date_add,
    order_status_id: order.order_status_id,
    external_id: `baselinker_${order.order_id}`,
    metadata: {
      baselinker_data: {
        ...order,
        synced_at: new Date().toISOString(),
      },
    },
  };

  if (existingOrders && existingOrders.length > 0) {
    // Atualizar pedido existente
    await supabase
      .from("orders")
      .update(orderData)
      .eq("id", existingOrders[0].id);

    console.log(`Updated order ${order.order_id}`);
  } else {
    // Criar novo pedido
    await supabase.from("orders").insert({
      ...orderData,
      workspace_id: workspaceId,
    });

    console.log(`Created order ${order.order_id}`);
  }
}

/**
 * Processa um evento individual
 */
async function processEvent(item: QueueItem): Promise<void> {
  console.log(
    `\nProcessing event ${item.id}: ${item.event_name} (order: ${item.order_id_base}, source: ${item.source})`
  );

  // Buscar config do workspace
  const config = await getWorkspaceConfig(item.workspace_id);
  if (!config) {
    throw new Error(`Workspace ${item.workspace_id} not configured`);
  }

  // Buscar detalhes completos do pedido
  await rateLimiter.throttle();

  const order = await fetchOrderDetails(
    { token: config.apiKey, workspace_id: item.workspace_id },
    item.order_id_base
  );

  if (!order) {
    throw new Error(`Order ${item.order_id_base} not found in Baselinker`);
  }

  // Encontrar ou criar cliente
  const clientId = await findOrCreateClient(item.workspace_id, order);
  if (!clientId) {
    throw new Error(`Failed to find or create client for order ${item.order_id_base}`);
  }

  // Criar ou atualizar pedido
  await upsertOrder(item.workspace_id, clientId, order);

  console.log(`Event ${item.id} processed successfully`);
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
    console.log("=== PROCESS ORDER EVENT STARTED ===");

    // Buscar próximos eventos
    const events = await getNextEvents(BATCH_SIZE);
    console.log(`Found ${events.length} events to process`);

    if (events.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No events to process",
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

    // Processar cada evento
    const results = [];
    for (const event of events) {
      // Tentar marcar como processando (lock otimista)
      const acquired = await markEventProcessing(event.id);
      if (!acquired) {
        console.log(`Event ${event.id} already being processed, skipping...`);
        continue;
      }

      try {
        await processEvent(event);
        await markEventCompleted(event.id);

        results.push({
          event_id: event.id,
          order_id: event.order_id_base,
          success: true,
        });
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);

        await markEventFailed(
          event.id,
          event.retry_count,
          event.max_retries,
          error.message
        );

        results.push({
          event_id: event.id,
          order_id: event.order_id_base,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    console.log(
      `=== PROCESSOR COMPLETED: ${successCount}/${events.length} events processed ===`
    );

    return new Response(
      JSON.stringify({
        success: true,
        events_processed: events.length,
        events_successful: successCount,
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
    console.error("Fatal error in event processor:", error);

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
