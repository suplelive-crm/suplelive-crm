// Process Order Created Event
// Handles new orders from Baselinker:
// 1. Create or find client
// 2. Create order record
// 3. Create order products
// 4. Send upsell message immediately
// 5. Schedule reorder messages
// Uses existing baselinker-proxy and Evolution API integration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper functions
function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  // Ensure it has country code (55 for Brazil)
  if (cleaned.length === 11) return `55${cleaned}`;
  if (cleaned.length === 10) return `55${cleaned}`;
  return cleaned;
}

function extractCPF(order: any): string | null {
  // Try to extract CPF from various fields
  const possibleFields = [
    order.invoice_nip,
    order.extra_field_1,
    order.extra_field_2,
    order.buyer_company,
  ];

  for (const field of possibleFields) {
    if (field && typeof field === 'string') {
      const cpfMatch = field.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
      if (cpfMatch) {
        return cpfMatch[0].replace(/\D/g, '');
      }
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { event } = await req.json();

    if (!event || !event.order_id) {
      throw new Error('Invalid event data');
    }

    console.log(`Processing order creation: ${event.order_id}`);

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

    // Get Baselinker config
    const baselinkerToken = Deno.env.get('BASELINKER_TOKEN');
    if (!baselinkerToken) {
      throw new Error('BASELINKER_TOKEN not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Get workspace (for now, get first one - in production, map from Baselinker account)
    const { data: syncState } = await supabaseClient
      .from('baselinker_sync_state')
      .select('workspace_id')
      .limit(1)
      .single();

    if (!syncState) {
      throw new Error('No workspace configured');
    }

    const workspaceId = syncState.workspace_id;

    // Fetch full order details from Baselinker using existing proxy
    console.log(`Fetching order ${event.order_id} details from Baselinker`);

    const orderResponse = await fetch(`${supabaseUrl}/functions/v1/baselinker-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: baselinkerToken,
        method: 'getOrders',
        parameters: {
          order_id: event.order_id,
        },
      }),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      throw new Error(`Failed to fetch order from Baselinker: ${orderResponse.status} - ${errorText}`);
    }

    const orderResult = await orderResponse.json();

    if (orderResult.status === 'ERROR') {
      throw new Error(`Baselinker API error: ${orderResult.error_message || 'Unknown error'}`);
    }

    const orders = orderResult.orders || [];
    const fullOrder = orders[0];

    if (!fullOrder) {
      throw new Error(`Order ${event.order_id} not found in Baselinker`);
    }

    console.log(`Fetched order details: ${fullOrder.delivery_fullname}`);

    // ========================================================================
    // STEP 1: Create or find client
    // ========================================================================

    const cpf = extractCPF(fullOrder);
    const phone = formatPhoneNumber(fullOrder.phone);
    const email = fullOrder.email;

    let client = null;

    // Try to find existing client by CPF first
    if (cpf) {
      const { data: existingClient } = await supabaseClient
        .from('clients')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('cpf', cpf)
        .maybeSingle();

      client = existingClient;
    }

    // If not found by CPF, try by phone
    if (!client && phone) {
      const { data: existingClient } = await supabaseClient
        .from('clients')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('phone', phone)
        .maybeSingle();

      client = existingClient;
    }

    // Create new client if not found
    if (!client) {
      console.log('Creating new client');

      const { data: newClient, error: clientError } = await supabaseClient
        .from('clients')
        .insert({
          workspace_id: workspaceId,
          name: fullOrder.delivery_fullname || fullOrder.invoice_fullname || 'Cliente',
          phone: phone,
          email: email || null,
          cpf: cpf,
          metadata: {
            source: 'baselinker',
            first_order_id: fullOrder.order_id,
            delivery_address: fullOrder.delivery_address,
            delivery_city: fullOrder.delivery_city,
            delivery_state: fullOrder.delivery_state,
            delivery_postcode: fullOrder.delivery_postcode,
          },
        })
        .select()
        .single();

      if (clientError) {
        throw new Error(`Failed to create client: ${clientError.message}`);
      }

      client = newClient;

      // Send welcome message for new client
      await sendWelcomeMessage(supabaseClient, workspaceId, client);
    } else {
      console.log(`Found existing client: ${client.id}`);
    }

    // ========================================================================
    // STEP 2: Check if order already exists
    // ========================================================================

    const { data: existingOrder } = await supabaseClient
      .from('orders')
      .select('id')
      .eq('order_id_base', fullOrder.order_id)
      .maybeSingle();

    if (existingOrder) {
      console.log(`Order ${fullOrder.order_id} already exists, skipping`);
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Order already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // STEP 3: Create order
    // ========================================================================

    console.log('Creating order record');

    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        workspace_id: workspaceId,
        client_id: client.id,
        external_id: fullOrder.order_id.toString(),
        order_id_base: fullOrder.order_id,
        total_amount: fullOrder.order_total_price_brutto || 0,
        status: fullOrder.order_status_name || 'pending',
        order_date: new Date(fullOrder.date_add * 1000).toISOString(),
        canal_venda: fullOrder.order_source || 'unknown',
        cpf: cpf,
        metadata: {
          baselinker_data: fullOrder,
          payment_method: fullOrder.payment_method,
          delivery_method: fullOrder.delivery_method,
          delivery_price: fullOrder.delivery_price,
        },
      })
      .select()
      .single();

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`);
    }

    console.log(`Created order: ${order.id}`);

    // ========================================================================
    // STEP 4: Create order products
    // ========================================================================

    if (fullOrder.products && fullOrder.products.length > 0) {
      const productsToInsert = fullOrder.products.map((product) => ({
        order_id: order.id,
        order_base_id: fullOrder.order_id,
        nome_produto: product.name,
        sku: product.sku,
        quantidade_produtos: product.quantity,
        receita_bruta: product.price_brutto * product.quantity,
        taxas_produto: (product.price_brutto * product.quantity * product.tax_rate) / 100,
      }));

      const { error: productsError } = await supabaseClient
        .from('orders_products')
        .insert(productsToInsert);

      if (productsError) {
        console.error('Error creating order products:', productsError);
        // Don't fail the whole process if products fail
      } else {
        console.log(`Created ${productsToInsert.length} order products`);
      }
    }

    // ========================================================================
    // STEP 5: Send upsell message immediately
    // ========================================================================

    await sendUpsellMessage(supabaseClient, workspaceId, order, client, fullOrder);

    // ========================================================================
    // STEP 6: Schedule reorder messages
    // ========================================================================

    await scheduleReorderMessages(supabaseClient, workspaceId, order, client, fullOrder);

    // ========================================================================
    // STEP 7: Update client stats
    // ========================================================================

    await updateClientStats(supabaseClient, client.id);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        client_id: client.id,
        client_is_new: existingOrder === null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-order-created:', error);

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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Send welcome message to new client
 */
async function sendWelcomeMessage(supabase: any, workspaceId: string, client: any) {
  try {
    if (!client.phone) {
      console.log('Client has no phone, skipping welcome message');
      return;
    }

    const message = `
Olá ${client.name}! 👋

Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.

Qualquer dúvida, estou à disposição! 😊
    `.trim();

    // Send via Evolution API (WhatsApp)
    await sendWhatsAppMessage(workspaceId, client.phone, message);

    // Log message
    await supabase.from('messages').insert({
      client_id: client.id,
      content: message,
      send_type: 'automated_welcome',
      status: 'sent',
      channel_type: 'whatsapp',
      sender_type: 'bot',
    });

    console.log(`Sent welcome message to ${client.phone}`);
  } catch (error) {
    console.error('Error sending welcome message:', error);
    // Don't fail the whole process
  }
}

/**
 * Send upsell message suggesting complementary products
 */
async function sendUpsellMessage(
  supabase: any,
  workspaceId: string,
  order: any,
  client: any,
  fullOrder: any
) {
  try {
    if (!client.phone) {
      console.log('Client has no phone, skipping upsell message');
      return;
    }

    // Get products from this order
    const orderSkus = fullOrder.products.map((p: any) => p.sku);

    // Find complementary products (simple rule-based for now)
    const { data: complementaryProducts } = await supabase
      .from('products')
      .select('name, sku, price')
      .eq('workspace_id', workspaceId)
      .not('sku', 'in', `(${orderSkus.join(',')})`)
      .limit(3);

    if (!complementaryProducts || complementaryProducts.length === 0) {
      console.log('No complementary products found');
      return;
    }

    const productList = complementaryProducts
      .map((p: any) => `• ${p.name} - R$ ${p.price.toFixed(2)}`)
      .join('\n');

    const message = `
Olá ${client.name}! 🎉

Obrigado pelo seu pedido!

Clientes que compraram os mesmos produtos também gostaram de:

${productList}

Quer aproveitar? Posso adicionar ao seu pedido! 😊
    `.trim();

    await sendWhatsAppMessage(workspaceId, client.phone, message);

    await supabase.from('messages').insert({
      client_id: client.id,
      content: message,
      send_type: 'automated_upsell',
      status: 'sent',
      channel_type: 'whatsapp',
      sender_type: 'bot',
      metadata: {
        order_id: order.id,
        suggested_products: complementaryProducts.map((p: any) => p.sku),
      },
    });

    console.log(`Sent upsell message to ${client.phone}`);
  } catch (error) {
    console.error('Error sending upsell message:', error);
  }
}

/**
 * Schedule reorder reminder messages based on product duration
 */
async function scheduleReorderMessages(
  supabase: any,
  workspaceId: string,
  order: any,
  client: any,
  fullOrder: any
) {
  try {
    for (const product of fullOrder.products) {
      // Get product details including duration
      const { data: productData } = await supabase
        .from('products')
        .select('duracao, name')
        .eq('workspace_id', workspaceId)
        .eq('sku', product.sku)
        .maybeSingle();

      if (!productData || !productData.duracao) {
        console.log(`Product ${product.sku} has no duration, skipping reorder schedule`);
        continue;
      }

      // Calculate reorder date: order_date + (duration * quantity) - 15 days buffer
      const orderDate = new Date(order.order_date);
      const durationDays = productData.duracao * product.quantity;
      const reorderDate = new Date(orderDate);
      reorderDate.setDate(reorderDate.getDate() + durationDays - 15);

      // Don't schedule if date is in the past
      if (reorderDate < new Date()) {
        console.log(`Reorder date for ${product.sku} is in the past, skipping`);
        continue;
      }

      const message = `
Olá ${client.name}!

O produto "${productData.name}" que você comprou está acabando! 🏁

Quer fazer uma nova compra para não ficar sem? 🛒

É só me chamar! 😊
      `.trim();

      await supabase.from('scheduled_messages').insert({
        workspace_id: workspaceId,
        client_id: client.id,
        message_type: 'reorder',
        message_content: message,
        scheduled_for: reorderDate.toISOString(),
        status: 'pending',
        metadata: {
          order_id: order.id,
          product_sku: product.sku,
          product_name: productData.name,
          duration_days: durationDays,
        },
      });

      console.log(`Scheduled reorder message for ${product.sku} on ${reorderDate.toISOString()}`);
    }
  } catch (error) {
    console.error('Error scheduling reorder messages:', error);
  }
}

/**
 * Update client statistics (total spent, total orders)
 */
async function updateClientStats(supabase: any, clientId: string) {
  try {
    const { data: stats } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('client_id', clientId);

    if (!stats) return;

    const totalSpent = stats.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
    const totalOrders = stats.length;

    await supabase
      .from('clients')
      .update({
        total_gasto: totalSpent,
        total_pedidos: totalOrders,
        ultima_att: new Date().toISOString(),
      })
      .eq('id', clientId);

    console.log(`Updated client stats: ${totalOrders} orders, R$ ${totalSpent}`);
  } catch (error) {
    console.error('Error updating client stats:', error);
  }
}

/**
 * Send WhatsApp message via Evolution API
 */
async function sendWhatsAppMessage(workspaceId: string, phone: string, message: string) {
  // Get WhatsApp instance for workspace
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle();

  if (!instance) {
    console.log('No WhatsApp instance connected for workspace');
    return;
  }

  // Call Evolution API
  const evolutionUrl = Deno.env.get('EVOLUTION_API_URL');
  const evolutionKey = Deno.env.get('EVOLUTION_API_KEY');

  if (!evolutionUrl || !evolutionKey) {
    console.log('Evolution API not configured');
    return;
  }

  const response = await fetch(`${evolutionUrl}/message/sendText/${instance.instance_name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: evolutionKey,
    },
    body: JSON.stringify({
      number: phone,
      text: message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send WhatsApp message: ${response.statusText}`);
  }

  console.log(`WhatsApp message sent to ${phone}`);
}
