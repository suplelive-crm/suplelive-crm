// Baselinker Event Poller
// Polls Baselinker getJournalList API for new events every 30s-1min
// This should be triggered by a cron job or invoked periodically
// Fetches API keys from workspace settings in database

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  fetchJournalEvents,
  baselinkerRequest,
  BaselinkerConfig
} from '../_shared/baselinker.ts';
import {
  getWorkspacesWithIntegration,
  getBaselinkerToken
} from '../_shared/workspace-config.ts';

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

    // Get all workspaces with Baselinker integration enabled
    const workspaces = await getWorkspacesWithIntegration(supabaseClient, 'baselinker');

    if (workspaces.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No workspaces with Baselinker enabled' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${workspaces.length} workspaces with Baselinker enabled`);

    const results = [];

    // Process each workspace
    for (const workspace of workspaces) {
      const workspaceId = workspace.workspace_id;

      try {
        // Get Baselinker token from workspace settings
        const baselinkerToken = await getBaselinkerToken(supabaseClient, workspaceId);

        // Get or create sync state for this workspace
        let { data: syncState, error: syncError } = await supabaseClient
          .from('baselinker_sync_state')
          .select('*')
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (syncError) {
          throw new Error(`Failed to fetch sync state: ${syncError.message}`);
        }

        // Create sync state if doesn't exist
        if (!syncState) {
          const { data: newSyncState, error: createError } = await supabaseClient
            .from('baselinker_sync_state')
            .insert({
              workspace_id: workspaceId,
              last_log_id: 0,
              is_syncing: false,
            })
            .select()
            .single();

          if (createError) {
            throw new Error(`Failed to create sync state: ${createError.message}`);
          }

          syncState = newSyncState;
        }

        // Skip if already syncing
        if (syncState.is_syncing) {
          console.log(`Workspace ${workspaceId} already syncing, skipping`);
          continue;
        }

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

        console.log(`Fetching events from Baselinker for workspace ${workspaceId}, last_log_id: ${lastLogId}`);

        // Use shared Baselinker helper to fetch journal events
        const baselinkerConfig: BaselinkerConfig = {
          token: baselinkerToken,
          workspace_id: workspaceId,
        };

        const events = await fetchJournalEvents(
          baselinkerConfig,
          lastLogId,
          relevantEventTypes
        );

        console.log(`Workspace ${workspaceId}: Found ${events.length} new events`);

        if (events.length === 0) {
          results.push({
            workspace_id: workspaceId,
            workspace_name: workspace.workspace_name,
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

        // Insert events into queue with workspace context
        const eventsToInsert = events.map((event) => ({
          workspace_id: workspaceId,
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
          workspace_id: workspaceId,
          workspace_name: workspace.workspace_name,
          events_processed: events.length,
          last_log_id: maxLogId,
        });

        console.log(`Workspace ${workspaceId} (${workspace.workspace_name}): Processed ${events.length} events, last_log_id: ${maxLogId}`);
      } catch (error) {
        console.error(`Error processing workspace ${workspaceId}:`, error);

        // Get sync state to update error
        const { data: syncStateForError } = await supabaseClient
          .from('baselinker_sync_state')
          .select('id')
          .eq('workspace_id', workspaceId)
          .maybeSingle();

        if (syncStateForError) {
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
            .eq('id', syncStateForError.id);
        }

        results.push({
          workspace_id: workspaceId,
          workspace_name: workspace.workspace_name,
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
