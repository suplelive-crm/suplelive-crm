import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const payload = await req.json()
    console.log('[BASELINKER WEBHOOK] Received:', JSON.stringify(payload, null, 2))

    // Baselinker webhook payload format:
    // {
    //   "event": "order_status_changed",
    //   "order_id": "12345",
    //   "status_id": "123",
    //   ...other data
    // }

    const { event, order_id, status_id } = payload

    if (!event || !order_id) {
      return new Response(
        JSON.stringify({ error: 'Invalid payload: missing event or order_id' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    console.log(`[WEBHOOK] Processing event: ${event} for order ${order_id}`)

    // Buscar o workspace baseado na configuração do Baselinker
    // (assumindo que só há um workspace configurado ou que o webhook tem algum identificador)
    // Você pode adicionar um parâmetro na URL do webhook para identificar o workspace

    const workspaceId = req.headers.get('x-workspace-id') // Passar via header

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'Missing workspace_id header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Buscar o pedido no banco
    const { data: existingOrder, error: fetchError } = await supabaseClient
      .from('orders')
      .select('id, status')
      .eq('order_id_base', parseInt(order_id))
      .eq('workspace_id', workspaceId)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[WEBHOOK] Error fetching order:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Database error', details: fetchError.message }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Processar evento baseado no tipo
    switch (event) {
      case 'order_status_changed':
        await handleOrderStatusChanged(supabaseClient, order_id, status_id, workspaceId, existingOrder)
        break

      case 'new_order':
        await handleNewOrder(supabaseClient, payload, workspaceId)
        break

      case 'order_updated':
        await handleOrderUpdated(supabaseClient, payload, workspaceId, existingOrder)
        break

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: `Event ${event} processed` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('[WEBHOOK] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function handleOrderStatusChanged(
  supabaseClient: any,
  orderId: string,
  statusId: string,
  workspaceId: string,
  existingOrder: any
) {
  if (!existingOrder) {
    console.log(`[WEBHOOK] Order ${orderId} not found, skipping status update`)
    return
  }

  // Map Baselinker status to our status
  let status = 'pending'
  const statusName = statusId.toString().toLowerCase()

  if (['paid', 'ready_for_shipping'].includes(statusName)) {
    status = 'processing'
  } else if (['shipped', 'delivered'].includes(statusName)) {
    status = 'completed'
  } else if (['cancelled', 'returned'].includes(statusName)) {
    status = 'cancelled'
  }

  const { error } = await supabaseClient
    .from('orders')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingOrder.id)

  if (error) {
    console.error('[WEBHOOK] Error updating order status:', error)
    throw error
  }

  console.log(`[WEBHOOK] Updated order ${orderId} status to ${status}`)
}

async function handleNewOrder(
  supabaseClient: any,
  payload: any,
  workspaceId: string
) {
  console.log(`[WEBHOOK] Handling new order ${payload.order_id}`)

  // Você pode chamar a função de sincronização aqui
  // ou apenas logar que há um novo pedido e deixar a sincronização periódica pegar

  console.log(`[WEBHOOK] New order ${payload.order_id} will be synced in next sync cycle`)
}

async function handleOrderUpdated(
  supabaseClient: any,
  payload: any,
  workspaceId: string,
  existingOrder: any
) {
  if (!existingOrder) {
    console.log(`[WEBHOOK] Order ${payload.order_id} not found, will be created in next sync`)
    return
  }

  const { error } = await supabaseClient
    .from('orders')
    .update({
      total_amount: payload.price ? parseFloat(payload.price) : existingOrder.total_amount,
      metadata: { baselinker_data: payload },
      updated_at: new Date().toISOString()
    })
    .eq('id', existingOrder.id)

  if (error) {
    console.error('[WEBHOOK] Error updating order:', error)
    throw error
  }

  console.log(`[WEBHOOK] Updated order ${payload.order_id}`)
}
