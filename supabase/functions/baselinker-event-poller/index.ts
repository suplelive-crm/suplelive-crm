// Baselinker Event Poller
// Polls Baselinker getJournalList API for new events every 30s-1min
// This should be triggered by a cron job or invoked periodically
// Uses existing baselinker-proxy function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get event name from event type
function getEventName(eventType: number): string {
  const eventNames: Record<number, string> = {
    1: 'order_created',
    2: 'order_edited',
    3: 'payment_received',
    4: 'payment_edited',
    5: 'order_status_changed',
    6: 'order_product_quantity_changed',
    7: 'invoice_created',
    8: 'receipt_created',
    9: 'package_created',
    10: 'package_edited',
    11: 'package_removed',
    12: 'product_added',
    13: 'product_edited',
    14: 'product_removed',
    15: 'product_quantity_changed',
    16: 'product_price_changed',
    17: 'inventory_product_quantity_changed',
    18: 'status_changed',
    19: 'order_note_added',
    20: 'order_label_added',
    21: 'order_label_removed',
  };
  return eventNames[eventType] || `unknown_event_${eventType}`;
}

// Simple rate limiter
class RateLimiter {
  private lastRequestTime = 0;
  private minInterval = 632; // ~95 requests per minute (60000ms / 95 = 632ms)

  async throttle() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const delay = this.minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }
}

const rateLimiter = new RateLimiter();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
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

    // Get Baselinker token from workspace settings or env
    const baselinkerToken = Deno.env.get('BASELINKER_TOKEN');
    if (!baselinkerToken) {
      throw new Error('BASELINKER_TOKEN not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Get all workspaces with Baselinker sync enabled
    const { data: syncStates, error: syncError } = await supabaseClient
      .from('baselinker_sync_state')
      .select('*')
      .eq('is_syncing', false);

    if (syncError) {
      throw new Error(`Failed to fetch sync states: ${syncError.message}`);
    }

    if (!syncStates || syncStates.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No workspaces to sync' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = [];

    // Process each workspace
    for (const syncState of syncStates) {
      try {
        // Mark as syncing
        await supabaseClient
          .from('baselinker_sync_state')
          .update({ is_syncing: true })
          .eq('id', syncState.id);

        // Apply rate limiting
        await rateLimiter.throttle();

        // Fetch new events from Baselinker
        const lastLogId = syncState.last_log_id || 0;

        // Filter only relevant event types (orders and payments)
        const relevantEventTypes = [
          1,  // order_created
          3,  // payment_received
          7,  // invoice_created
          8,  // receipt_created
          9,  // package_created
          12, // product_added
          13, // product_edited
          14, // product_removed
          18, // status_changed
        ];

        console.log(`Fetching events from Baselinker for workspace ${syncState.workspace_id}, last_log_id: ${lastLogId}`);

        // Call existing baselinker-proxy function to get journal events
        const baselinkerResponse = await fetch(`${supabaseUrl}/functions/v1/baselinker-proxy`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: baselinkerToken,
            method: 'getJournalList',
            parameters: {
              last_log_id: lastLogId,
              logs_types: relevantEventTypes,
              limit: 100,
            },
          }),
        });

        if (!baselinkerResponse.ok) {
          const errorText = await baselinkerResponse.text();
          throw new Error(`Baselinker proxy error: ${baselinkerResponse.status} - ${errorText}`);
        }

        const baselinkerResult = await baselinkerResponse.json();

        if (baselinkerResult.status === 'ERROR') {
          throw new Error(`Baselinker API error: ${baselinkerResult.error_message || 'Unknown error'}`);
        }

        // Extract events from response
        const events = baselinkerResult.logs || [];

        console.log(`Workspace ${syncState.workspace_id}: Found ${events.length} new events`);

        if (events.length === 0) {
          results.push({
            workspace_id: syncState.workspace_id,
            events_processed: 0,
            last_log_id: lastLogId,
          });

          // Update last sync time
          await supabaseClient
            .from('baselinker_sync_state')
            .update({
              is_syncing: false,
              last_sync_at: new Date().toISOString(),
            })
            .eq('id', syncState.id);

          continue;
        }

        // Insert events into queue
        const eventsToInsert = events.map((event) => ({
          event_log_id: event.log_id,
          event_type: event.log_type,
          event_name: getEventName(event.log_type),
          order_id: event.order_id || null,
          payload: event,
          status: 'pending',
        }));

        const { error: insertError } = await supabaseClient
          .from('event_queue')
          .insert(eventsToInsert)
          .onConflict('event_log_id')
          .ignoreDuplicates();

        if (insertError) {
          console.error('Error inserting events:', insertError);
          throw insertError;
        }

        // Update last_log_id
        const maxLogId = Math.max(...events.map((e) => e.log_id));

        await supabaseClient
          .from('baselinker_sync_state')
          .update({
            last_log_id: maxLogId,
            last_sync_at: new Date().toISOString(),
            is_syncing: false,
            sync_errors: [],
          })
          .eq('id', syncState.id);

        results.push({
          workspace_id: syncState.workspace_id,
          events_processed: events.length,
          last_log_id: maxLogId,
        });

        console.log(`Workspace ${syncState.workspace_id}: Processed ${events.length} events, last_log_id: ${maxLogId}`);
      } catch (error) {
        console.error(`Error processing workspace ${syncState.workspace_id}:`, error);

        // Update sync state with error
        await supabaseClient
          .from('baselinker_sync_state')
          .update({
            is_syncing: false,
            sync_errors: [
              {
                timestamp: new Date().toISOString(),
                error: error.message,
              },
            ],
          })
          .eq('id', syncState.id);

        results.push({
          workspace_id: syncState.workspace_id,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        total_events: results.reduce((sum, r) => sum + (r.events_processed || 0), 0),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Fatal error in event poller:', error);

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
