import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Supabase client setup
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Baselinker API URL
const BASELINKER_API_URL = "https://api.baselinker.com/connector.php";

// Helper function to make Baselinker API requests
async function callBaselinkerAPI(apiKey: string, method: string, parameters: Record<string, any> = {}) {
  const response = await fetch(BASELINKER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-BLToken': apiKey
    },
    body: new URLSearchParams({
      method,
      parameters: JSON.stringify(parameters)
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.status === 'ERROR') {
    throw new Error(result.error_message || 'Unknown Baselinker API error');
  }

  return result;
}

serve(async (req: Request) => {
  try {
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

    // Only accept POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Parse request data
    const requestData = await req.json();
    const { workspaceId, apiKey, syncType } = requestData;
    
    if (!workspaceId || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Update sync status
    await supabase
      .from("baselinker_sync")
      .upsert({
        workspace_id: workspaceId,
        sync_status: 'syncing',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id'
      });

    try {
      // Perform sync based on type
      if (syncType === 'orders' || syncType === 'all') {
        await syncOrders(workspaceId, apiKey);
      }
      
      if (syncType === 'customers' || syncType === 'all') {
        await syncCustomers(workspaceId, apiKey);
      }
      
      if (syncType === 'inventory' || syncType === 'all') {
        await syncInventory(workspaceId, apiKey);
      }
      
      // Update sync status to completed
      await supabase
        .from("baselinker_sync")
        .upsert({
          workspace_id: workspaceId,
          sync_status: 'idle',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id'
        });
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      // Update sync status to error
      await supabase
        .from("baselinker_sync")
        .upsert({
          workspace_id: workspaceId,
          sync_status: 'error',
          sync_errors: [{ message: error.message, timestamp: new Date().toISOString() }],
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workspace_id'
        });
      
      throw error;
    }
  } catch (error) {
    console.error("Error processing sync:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

// Sync functions
async function syncOrders(workspaceId: string, apiKey: string) {
  // Get last sync time
  const { data: syncData } = await supabase
    .from('baselinker_sync')
    .select('last_orders_sync')
    .eq('workspace_id', workspaceId)
    .single();
  
  const lastSyncTimestamp = syncData?.last_orders_sync 
    ? Math.floor(new Date(syncData.last_orders_sync).getTime() / 1000)
    : 0;
  
  // Get orders from Baselinker
  const response = await callBaselinkerAPI(apiKey, 'getOrders', {
    date_from: lastSyncTimestamp
  });
  
  const orders = response.data.orders || [];
  
  // Process each order
  for (const order of orders) {
    // Get detailed order info
    const orderDetails = await callBaselinkerAPI(apiKey, 'getOrderDetails', { order_id: order.order_id });
    const orderData = orderDetails.data;
    
    // Map Baselinker status to OmniCRM status
    let status = 'pending';
    if (['paid', 'ready_for_shipping'].includes(order.order_status_id)) {
      status = 'processing';
    } else if (['shipped', 'delivered'].includes(order.order_status_id)) {
      status = 'completed';
    } else if (['cancelled', 'returned'].includes(order.order_status_id)) {
      status = 'cancelled';
    }
    
    // Find or create client
    let clientId = null;
    if (orderData.email || orderData.phone) {
      const { data: existingClients } = await supabase
        .from('clients')
        .select('id')
        .or(`email.eq.${orderData.email},phone.eq.${orderData.phone}`)
        .eq('workspace_id', workspaceId);
      
      if (existingClients && existingClients.length > 0) {
        clientId = existingClients[0].id;
        
        // Update client info
        await supabase
          .from('clients')
          .update({
            name: orderData.delivery_fullname || orderData.invoice_fullname,
            email: orderData.email,
            phone: orderData.phone,
            metadata: {
              baselinker_data: {
                company: orderData.invoice_company,
                address: orderData.delivery_address,
                city: orderData.delivery_city,
                postcode: orderData.delivery_postcode,
                country: orderData.delivery_country,
                last_order_id: order.order_id
              }
            }
          })
          .eq('id', clientId);
      } else {
        // Create new client
        const { data: newClient } = await supabase
          .from('clients')
          .insert({
            name: orderData.delivery_fullname || orderData.invoice_fullname,
            email: orderData.email,
            phone: orderData.phone,
            workspace_id: workspaceId,
            metadata: {
              baselinker_data: {
                company: orderData.invoice_company,
                address: orderData.delivery_address,
                city: orderData.delivery_city,
                postcode: orderData.delivery_postcode,
                country: orderData.delivery_country,
                last_order_id: order.order_id
              }
            }
          })
          .select()
          .single();
        
        clientId = newClient?.id;
      }
    }
    
    if (!clientId) continue;
    
    // Check if order already exists
    const { data: existingOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('external_id', order.order_id);
    
    if (existingOrders && existingOrders.length > 0) {
      // Update existing order
      await supabase
        .from('orders')
        .update({
          total_amount: parseFloat(order.price),
          status,
          metadata: { baselinker_data: orderData }
        })
        .eq('external_id', order.order_id);
    } else {
      // Create new order
      await supabase
        .from('orders')
        .insert({
          client_id: clientId,
          total_amount: parseFloat(order.price),
          order_date: new Date(order.date_add * 1000).toISOString(),
          status,
          external_id: order.order_id,
          metadata: { baselinker_data: orderData }
        });
    }
  }
  
  // Update last sync time
  await supabase
    .from('baselinker_sync')
    .upsert({
      workspace_id: workspaceId,
      last_orders_sync: new Date().toISOString()
    }, {
      onConflict: 'workspace_id'
    });
}

async function syncCustomers(workspaceId: string, apiKey: string) {
  // Since Baselinker doesn't have a dedicated customers API,
  // we'll sync customers from orders
  
  // Get last sync time
  const { data: syncData } = await supabase
    .from('baselinker_sync')
    .select('last_customers_sync')
    .eq('workspace_id', workspaceId)
    .single();
  
  const lastSyncTimestamp = syncData?.last_customers_sync 
    ? Math.floor(new Date(syncData.last_customers_sync).getTime() / 1000)
    : 0;
  
  // Get orders from Baselinker
  const response = await callBaselinkerAPI(apiKey, 'getOrders', {
    date_from: lastSyncTimestamp
  });
  
  const orders = response.data.orders || [];
  
  // Process each order to extract customer data
  for (const order of orders) {
    // Get detailed order info
    const orderDetails = await callBaselinkerAPI(apiKey, 'getOrderDetails', { order_id: order.order_id });
    const orderData = orderDetails.data;
    
    if (!orderData.email && !orderData.phone) continue;
    
    // Find or create client
    const { data: existingClients } = await supabase
      .from('clients')
      .select('id')
      .or(`email.eq.${orderData.email},phone.eq.${orderData.phone}`)
      .eq('workspace_id', workspaceId);
    
    if (existingClients && existingClients.length > 0) {
      // Update client info
      await supabase
        .from('clients')
        .update({
          name: orderData.delivery_fullname || orderData.invoice_fullname,
          email: orderData.email,
          phone: orderData.phone,
          metadata: {
            baselinker_data: {
              company: orderData.invoice_company,
              address: orderData.delivery_address,
              city: orderData.delivery_city,
              postcode: orderData.delivery_postcode,
              country: orderData.delivery_country,
              last_order_id: order.order_id
            }
          }
        })
        .eq('id', existingClients[0].id);
    } else {
      // Create new client
      await supabase
        .from('clients')
        .insert({
          name: orderData.delivery_fullname || orderData.invoice_fullname,
          email: orderData.email,
          phone: orderData.phone,
          workspace_id: workspaceId,
          metadata: {
            baselinker_data: {
              company: orderData.invoice_company,
              address: orderData.delivery_address,
              city: orderData.delivery_city,
              postcode: orderData.delivery_postcode,
              country: orderData.delivery_country,
              last_order_id: order.order_id
            }
          }
        });
    }
  }
  
  // Update last sync time
  await supabase
    .from('baselinker_sync')
    .upsert({
      workspace_id: workspaceId,
      last_customers_sync: new Date().toISOString()
    }, {
      onConflict: 'workspace_id'
    });
}

async function syncInventory(workspaceId: string, apiKey: string) {
  // Get inventory ID from config
  const { data: configData } = await supabase
    .from('baselinker_sync')
    .select('metadata')
    .eq('workspace_id', workspaceId)
    .single();
  
  const inventoryId = configData?.metadata?.inventoryId;
  if (!inventoryId) {
    throw new Error('Inventory ID not configured');
  }
  
  // Get products from Baselinker
  let page = 1;
  let hasMore = true;
  const allProducts: any[] = [];
  
  while (hasMore) {
    const response = await callBaselinkerAPI(apiKey, 'getInventoryProductsList', {
      inventory_id: inventoryId,
      page
    });
    
    const products = response.data.products || [];
    allProducts.push(...products);
    
    hasMore = products.length > 0;
    page++;
    
    // Limit to 1000 products for safety
    if (page > 10) break;
  }
  
  // Process each product
  for (const product of allProducts) {
    // Get detailed product info
    const productDetails = await callBaselinkerAPI(apiKey, 'getInventoryProductsData', {
      inventory_id: inventoryId,
      products: [product.id]
    });
    
    const productData = productDetails.data.products[product.id];
    
    // Check if product already exists
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id')
      .eq('external_id', product.id)
      .eq('workspace_id', workspaceId);
    
    if (existingProducts && existingProducts.length > 0) {
      // Update existing product
      await supabase
        .from('products')
        .update({
          name: product.name,
          sku: product.sku,
          ean: product.ean,
          price: parseFloat(product.price),
          stock: parseInt(product.stock),
          description: productData.description || '',
          images: productData.images || [],
          metadata: { baselinker_data: productData },
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProducts[0].id);
    } else {
      // Create new product
      await supabase
        .from('products')
        .insert({
          name: product.name,
          sku: product.sku,
          ean: product.ean,
          price: parseFloat(product.price),
          stock: parseInt(product.stock),
          description: productData.description || '',
          images: productData.images || [],
          external_id: product.id,
          workspace_id: workspaceId,
          metadata: { baselinker_data: productData }
        });
    }
  }
  
  // Update last sync time
  await supabase
    .from('baselinker_sync')
    .upsert({
      workspace_id: workspaceId,
      last_inventory_sync: new Date().toISOString()
    }, {
      onConflict: 'workspace_id'
    });
}