// Process Order Created Event
// Handles new orders from Baselinker:
// 1. Create or find client
// 2. Create order record
// 3. Create order products
// 4. Send upsell message immediately
// 5. Schedule reorder messages
// Fetches API keys from workspace settings in database

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  fetchOrderDetails,
  BaselinkerConfig
} from '../_shared/baselinker.ts';
import {
  getBaselinkerToken,
  getEvolutionConfig
} from '../_shared/workspace-config.ts';
import {
  getWelcomeMessage,
  getUpsellMessage,
  getReorderMessage,
  sendWhatsAppMessage
} from '../_shared/message-templates.ts';

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

    // Get workspace_id from event payload
    const workspaceId = event.workspace_id;
    if (!workspaceId) {
      throw new Error('No workspace_id in event data');
    }

    console.log(`Processing order creation: ${event.order_id} for workspace ${workspaceId}`);

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

    // Get Baselinker token from workspace settings
    const baselinkerToken = await getBaselinkerToken(supabaseClient, workspaceId);

    // Fetch full order details from Baselinker using shared helper
    console.log(`Fetching order ${event.order_id} details from Baselinker`);

    const baselinkerConfig: BaselinkerConfig = {
      token: baselinkerToken,
      workspace_id: workspaceId,
    };

    const fullOrder = await fetchOrderDetails(baselinkerConfig, event.order_id);

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
      await sendWelcomeMessage(supabaseClient, workspaceId, client, fullOrder);
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
 * Send welcome message to new client using template from database
 */
async function sendWelcomeMessage(supabase: any, workspaceId: string, client: any, order?: any) {
  try {
    if (!client.phone) {
      console.log('Client has no phone, skipping welcome message');
      return;
    }

    // Get welcome message from template system
    const message = await getWelcomeMessage(supabase, workspaceId, {
      client_name: client.name,
      order_id: order?.order_id_base?.toString() || ''
    });

    // Send via Evolution API (WhatsApp) using template helper
    await sendWhatsAppMessage(supabase, workspaceId, client.phone, message);

    // Log message
    await supabase.from('messages').insert({
      client_id: client.id,
      content: message,
      send_type: 'automated_welcome',
      status: 'sent',
      channel_type: 'whatsapp',
      sender_type: 'bot',
    });

    console.log(`✅ Sent welcome message to ${client.phone} using template from database`);
  } catch (error) {
    console.error('❌ Error sending welcome message:', error);
    // Don't fail the whole process
  }
}

/**
 * Send upsell message for second unit with 20% discount
 * Sends offer to buy additional unit of same product at discounted price
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

    // Check if order has products
    if (!fullOrder.products || fullOrder.products.length === 0) {
      console.log('Order has no products, skipping upsell message');
      return;
    }

    // Get first product from order
    const firstProduct = fullOrder.products[0];

    // Calculate prices: original price and 20% discount
    const originalPrice = firstProduct.price_brutto * firstProduct.quantity;
    const discountedPrice = originalPrice * 0.80; // 20% discount

    // Get upsell message from template system
    const message = await getUpsellMessage(supabase, workspaceId, {
      client_name: client.name,
      product_name: firstProduct.name,
      original_price: originalPrice.toFixed(2),
      discounted_price: discountedPrice.toFixed(2)
    });

    // Send via Evolution API using template helper
    await sendWhatsAppMessage(supabase, workspaceId, client.phone, message);

    // Update order: mark upsell message as sent
    await supabase
      .from('orders')
      .update({
        mensagem_enviada: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    // Log message
    await supabase.from('messages').insert({
      client_id: client.id,
      content: message,
      send_type: 'automated_upsell',
      status: 'sent',
      channel_type: 'whatsapp',
      sender_type: 'bot',
      metadata: {
        order_id: order.id,
        product_sku: firstProduct.sku,
        product_name: firstProduct.name,
        original_price: originalPrice,
        discounted_price: discountedPrice,
        discount_percentage: 20
      },
    });

    console.log(`✅ Sent upsell message (segunda unidade 20% off) to ${client.phone} using template from database`);
    console.log(`✅ Updated orders.mensagem_enviada = true for order ${order.id}`);
  } catch (error) {
    console.error('❌ Error sending upsell message:', error);
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

      // Get reorder message from template system
      const message = await getReorderMessage(supabase, workspaceId, {
        client_name: client.name,
        product_name: productData.name,
        product_sku: product.sku,
        order_date: new Date(order.order_date).toLocaleDateString('pt-BR'),
        duration_days: durationDays
      });

      // Insert scheduled message with processed template
      await supabase.from('scheduled_messages').insert({
        workspace_id: workspaceId,
        client_id: client.id,
        message_type: 'reorder',
        message_content: message, // Template already processed with variables
        scheduled_for: reorderDate.toISOString(),
        status: 'pending',
        metadata: {
          order_id: order.id,
          product_sku: product.sku,
          product_name: productData.name,
          duration_days: durationDays,
        },
      });

      // Update orders_products: mark reorder message as scheduled
      await supabase
        .from('orders_products')
        .update({ mensagem_recompra: true })
        .eq('order_id', order.id)
        .eq('sku', product.sku);

      console.log(`✅ Scheduled reorder message for ${product.sku} on ${reorderDate.toISOString()} using template from database`);
      console.log(`✅ Updated orders_products.mensagem_recompra = true for product ${product.sku}`);
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

// WhatsApp message sending is now handled by the imported sendWhatsAppMessage from message-templates.ts
