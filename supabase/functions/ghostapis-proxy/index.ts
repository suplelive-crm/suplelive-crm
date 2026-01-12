import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body (only for POST requests)
    const { endpoint, params, workspaceId } = await req.json()

    console.log(`[GHOSTAPIS PROXY] Request received:`, { endpoint, params, workspaceId })

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase environment variables not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get workspace settings to retrieve GhostAPIs token
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single()

    if (workspaceError) {
      console.error('[GHOSTAPIS PROXY] Workspace error:', workspaceError)
      throw new Error(`Erro ao buscar workspace: ${workspaceError.message}`)
    }

    // Get token from workspace settings
    const token = workspace?.settings?.ghostapis?.token
    if (!token) {
      console.error('[GHOSTAPIS PROXY] Token not found in workspace settings')
      throw new Error('Token GhostAPIs não configurado no workspace')
    }

    console.log(`[GHOSTAPIS PROXY] Token found, making request to GhostAPIs...`)

    // Build URL with token and parameters
    const url = new URL('https://ghostapis.com/api.php')
    url.searchParams.set('token', token)

    // Add all parameters to URL
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }

    console.log(`[GHOSTAPIS PROXY] Request URL: ${url.toString().replace(token, '***')}`)

    // Make request to GhostAPIs
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[GHOSTAPIS PROXY] GhostAPIs error: ${response.status}`)
      throw new Error(`GhostAPIs HTTP error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    console.log(`[GHOSTAPIS PROXY] Response received successfully`)

    // Return response
    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      },
    )
  } catch (error) {
    console.error('[GHOSTAPIS PROXY] Error:', error)

    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 400,
      },
    )
  }
})
