// Update Baselinker Stock
// Edge Function to update stock in Baselinker and log all changes
// Fetches Baselinker token from workspace settings

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  baselinkerRequest,
  BaselinkerConfig
} from '../_shared/baselinker.ts';
import { getBaselinkerToken } from '../_shared/workspace-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStockRequest {
  workspace_id: string;
  warehouse_id: string;
  sku: string;
  new_quantity: number;
  reason: string;
  reference_id?: string;
  reference_type?: 'purchase' | 'transfer' | 'order' | 'manual' | 'adjustment';
  user_id?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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

    const requestData: UpdateStockRequest = await req.json();
    const {
      workspace_id,
      warehouse_id,
      sku,
      new_quantity,
      reason,
      reference_id,
      reference_type,
      user_id,
      metadata = {},
    } = requestData;

    console.log(`Updating stock for SKU ${sku} in warehouse ${warehouse_id} to ${new_quantity}`);

    // 1. Verify warehouse is active for updates
    const { data: isActive, error: checkError } = await supabaseClient.rpc(
      'is_warehouse_active',
      {
        p_workspace_id: workspace_id,
        p_warehouse_id: warehouse_id,
      }
    );

    if (checkError) {
      throw new Error(`Failed to check warehouse status: ${checkError.message}`);
    }

    // Get warehouse details for additional checks
    const { data: warehouse, error: warehouseError } = await supabaseClient
      .from('baselinker_warehouses')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('warehouse_id', warehouse_id)
      .maybeSingle();

    if (warehouseError) {
      throw new Error(`Failed to fetch warehouse config: ${warehouseError.message}`);
    }

    // Check if warehouse exists and allows stock updates
    if (warehouse && !warehouse.allow_stock_updates) {
      throw new Error(`Warehouse ${warehouse_id} does not allow stock updates`);
    }

    if (warehouse && warehouse.sync_direction === 'read_only') {
      throw new Error(`Warehouse ${warehouse_id} is configured as read-only`);
    }

    if (!isActive && warehouse) {
      throw new Error(`Warehouse ${warehouse_id} is not active for updates`);
    }

    // 2. Get current stock from products table
    const { data: product, error: productError } = await supabaseClient
      .from('products')
      .select('id, sku, name, stock_es, stock_sp')
      .eq('workspace_id', workspace_id)
      .eq('sku', sku)
      .maybeSingle();

    if (productError) {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    if (!product) {
      throw new Error(`Product with SKU ${sku} not found`);
    }

    // Determine which stock field to use based on warehouse_id
    // Assuming 'bl_1' maps to stock_es and 'bl_2' maps to stock_sp
    const stockField = warehouse_id === 'bl_1' ? 'stock_es' : 'stock_sp';
    const previousQty = product[stockField] || 0;

    console.log(`Current stock for ${sku}: ${previousQty}, New stock: ${new_quantity}`);

    // 3. Get Baselinker token from workspace settings
    const baselinkerToken = await getBaselinkerToken(supabaseClient, workspace_id);

    // 4. Update stock in Baselinker using shared helper
    console.log(`Updating stock in Baselinker via API`);

    const baselinkerConfig: BaselinkerConfig = {
      token: baselinkerToken,
      workspace_id: workspace_id,
    };

    const baselinkerResult = await baselinkerRequest(
      baselinkerConfig,
      'updateInventoryProductsQuantity',
      {
        inventory_id: warehouse_id,
        products: {
          [sku]: {
            stock: new_quantity,
          },
        },
      }
    );

    console.log('Baselinker update result:', baselinkerResult);

    // 5. Update local products table
    const { error: updateError } = await supabaseClient
      .from('products')
      .update({ [stockField]: new_quantity })
      .eq('id', product.id);

    if (updateError) {
      console.error('Failed to update local product stock:', updateError);
      // Don't throw - Baselinker is source of truth, but log the error
    }

    // 6. Log the stock change using helper function
    const { data: logId, error: logError } = await supabaseClient.rpc('log_stock_change', {
      p_workspace_id: workspace_id,
      p_sku: sku,
      p_warehouse_id: warehouse_id,
      p_previous_qty: previousQty,
      p_new_qty: new_quantity,
      p_action_type: reference_type === 'purchase' ? 'add' : reference_type === 'transfer' ? 'transfer_in' : 'adjust',
      p_source: reference_type || 'system',
      p_reason: reason,
      p_reference_id: reference_id || null,
      p_reference_type: reference_type || null,
      p_user_id: user_id || null,
      p_metadata: metadata,
    });

    if (logError) {
      console.error('Failed to log stock change:', logError);
      // Don't throw - stock was updated successfully
    }

    console.log(`Successfully updated stock and logged change: ${logId}`);

    return new Response(
      JSON.stringify({
        success: true,
        sku,
        warehouse_id,
        previous_quantity: previousQty,
        new_quantity,
        quantity_change: new_quantity - previousQty,
        log_id: logId,
        baselinker_result: baselinkerResult,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in update-baselinker-stock:', error);

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
