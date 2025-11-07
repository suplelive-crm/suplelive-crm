// Event Processor Router
// Routes events from event_queue to specific processors
// Triggered automatically by database trigger when new event is inserted

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event_id, event_name, event_type } = await req.json();

    if (!event_id) {
      throw new Error('event_id is required');
    }

    console.log(`Processing event ${event_id}: ${event_name} (type ${event_type})`);

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

    // Fetch event from queue
    const { data: event, error: fetchError } = await supabaseClient
      .from('event_queue')
      .select('*')
      .eq('id', event_id)
      .single();

    if (fetchError || !event) {
      throw new Error(`Event not found: ${fetchError?.message}`);
    }

    // Check if already processing
    if (event.status === 'processing' || event.status === 'completed') {
      console.log(`Event ${event_id} already ${event.status}, skipping`);
      return new Response(
        JSON.stringify({ message: `Event already ${event.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as processing
    await supabaseClient
      .from('event_queue')
      .update({ status: 'processing' })
      .eq('id', event_id);

    try {
      // Route to specific processor based on event name
      let result;

      switch (event_name) {
        case 'order_created':
          result = await processOrderCreated(supabaseClient, event);
          break;

        case 'payment_received':
          result = await processPaymentReceived(supabaseClient, event);
          break;

        case 'status_changed':
          result = await processStatusChanged(supabaseClient, event);
          break;

        case 'product_added':
        case 'product_edited':
        case 'product_removed':
          result = await processProductChange(supabaseClient, event);
          break;

        case 'invoice_created':
          result = await processInvoiceCreated(supabaseClient, event);
          break;

        case 'package_created':
          result = await processPackageCreated(supabaseClient, event);
          break;

        default:
          console.log(`No processor for event type: ${event_name}`);
          result = { skipped: true, reason: 'No processor available' };
      }

      // Mark as completed
      await supabaseClient
        .from('event_queue')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', event_id);

      console.log(`Event ${event_id} processed successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          event_id,
          event_name,
          result,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (processingError) {
      console.error(`Error processing event ${event_id}:`, processingError);

      // Mark as failed and increment retry count
      const newRetryCount = (event.retry_count || 0) + 1;
      const maxRetries = 3;

      await supabaseClient
        .from('event_queue')
        .update({
          status: newRetryCount >= maxRetries ? 'failed' : 'pending',
          error_message: processingError.message,
          retry_count: newRetryCount,
        })
        .eq('id', event_id);

      // If max retries reached, send notification
      if (newRetryCount >= maxRetries) {
        await sendErrorNotification(supabaseClient, event, processingError);
      }

      throw processingError;
    }
  } catch (error) {
    console.error('Fatal error in process-event:', error);

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

// ============================================================================
// EVENT PROCESSORS
// ============================================================================

/**
 * Process order_created event
 * Imports full logic from process-order-created function
 */
async function processOrderCreated(supabase: any, event: any) {
  // Call dedicated function for complex logic
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-order-created`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ event }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to process order: ${error.message}`);
  }

  return await response.json();
}

/**
 * Process payment_received event
 */
async function processPaymentReceived(supabase: any, event: any) {
  const orderId = event.order_id;

  // Find order in database
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id_base', orderId)
    .single();

  if (!order) {
    console.log(`Order ${orderId} not found, skipping payment event`);
    return { skipped: true };
  }

  // Update payment status
  await supabase
    .from('orders')
    .update({
      metadata: {
        ...order.metadata,
        payment_received: true,
        payment_received_at: new Date().toISOString(),
      },
    })
    .eq('id', order.id);

  return { order_id: order.id, payment_updated: true };
}

/**
 * Process status_changed event
 */
async function processStatusChanged(supabase: any, event: any) {
  const orderId = event.order_id;
  const newStatus = event.payload.order_status_name || event.payload.status;

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id_base', orderId)
    .single();

  if (!order) {
    return { skipped: true };
  }

  await supabase
    .from('orders')
    .update({ status: newStatus })
    .eq('id', order.id);

  return { order_id: order.id, new_status: newStatus };
}

/**
 * Process product changes (added/edited/removed)
 */
async function processProductChange(supabase: any, event: any) {
  // For now, just log - can implement later if needed
  console.log(`Product change event: ${event.event_name} for order ${event.order_id}`);
  return { logged: true };
}

/**
 * Process invoice_created event
 */
async function processInvoiceCreated(supabase: any, event: any) {
  const orderId = event.order_id;

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id_base', orderId)
    .single();

  if (!order) {
    return { skipped: true };
  }

  await supabase
    .from('orders')
    .update({
      metadata: {
        ...order.metadata,
        invoice_created: true,
        invoice_data: event.payload,
      },
    })
    .eq('id', order.id);

  return { order_id: order.id, invoice_saved: true };
}

/**
 * Process package_created event (shipping)
 */
async function processPackageCreated(supabase: any, event: any) {
  const orderId = event.order_id;

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('order_id_base', orderId)
    .single();

  if (!order) {
    return { skipped: true };
  }

  await supabase
    .from('orders')
    .update({
      metadata: {
        ...order.metadata,
        package_created: true,
        tracking_code: event.payload.tracking_number,
        courier: event.payload.courier,
      },
    })
    .eq('id', order.id);

  return { order_id: order.id, package_info_saved: true };
}

/**
 * Send error notification when event fails after max retries
 */
async function sendErrorNotification(supabase: any, event: any, error: Error) {
  try {
    // Get workspace from sync state (assuming single workspace for now)
    const { data: syncState } = await supabase
      .from('baselinker_sync_state')
      .select('workspace_id')
      .limit(1)
      .single();

    if (!syncState) return;

    await supabase.from('notifications').insert({
      workspace_id: syncState.workspace_id,
      type: 'error',
      title: 'Falha ao processar evento',
      message: `Evento ${event.event_name} (ID: ${event.id}) falhou após 3 tentativas: ${error.message}`,
      metadata: {
        event_id: event.id,
        event_type: event.event_name,
        order_id: event.order_id,
        error: error.message,
      },
    });
  } catch (notifError) {
    console.error('Failed to send error notification:', notifError);
  }
}
