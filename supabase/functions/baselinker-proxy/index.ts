// supabase/functions/baselinker-proxy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

// Headers CORS para permitir a comunicação com seu front-end
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, X-BLToken',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface BaselinkerRequest {
  apiKey: string;
  method: string;
  parameters?: Record<string, any>;
}

interface GhostAPIsRequest {
  service: 'ghostapis';
  endpoint: string;
  params: Record<string, any>;
  workspaceId: string;
}

serve(async (req) => {
  // Trata a requisição de preflight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Detectar se é requisição GhostAPIs ou Baselinker
    if (body.service === 'ghostapis') {
      return await handleGhostAPIs(body as GhostAPIsRequest)
    } else {
      return await handleBaselinker(body as BaselinkerRequest)
    }

  } catch (error) {
    console.error('An unexpected error occurred in the proxy function:', error)
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: 'Internal Server Error: ' + error.message,
        error_code: 'PROXY_INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Handler para requisições Baselinker
async function handleBaselinker(body: BaselinkerRequest): Promise<Response> {
  const { apiKey, method, parameters = {} } = body

  // Validação básica dos dados recebidos
  if (!apiKey || !method) {
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: 'API key and method are required',
        error_code: 'MISSING_PARAMETERS'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Monta o formulário para a API da Baselinker conforme a documentação
  const formData = new URLSearchParams();
  formData.append('method', method);
  formData.append('parameters', JSON.stringify(parameters));

  // Faz a chamada para a API da Baselinker
  const response = await fetch('https://api.baselinker.com/connector.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-BLToken': apiKey
    },
    body: formData.toString()
  })

  // Tratamento de erros HTTP e da API
  if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ status: 'ERROR', error_message: `HTTP Error: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
  }

  const result = await response.json();

  if (result.status === 'ERROR') {
      console.error('Baselinker API returned an error:', result);
  }

  // Retorna a resposta final para o cliente
  return new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

// Handler para requisições GhostAPIs
async function handleGhostAPIs(body: GhostAPIsRequest): Promise<Response> {
  const { endpoint, params, workspaceId } = body

  console.log('[GHOSTAPIS PROXY] Processing request:', { endpoint, workspaceId })

  if (!workspaceId) {
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: 'workspaceId is required',
        error_code: 'MISSING_PARAMETERS'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Buscar token do workspace
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: 'Missing Supabase environment variables',
        error_code: 'CONFIG_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single()

  if (workspaceError) {
    console.error('[GHOSTAPIS PROXY] Workspace error:', workspaceError)
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: `Workspace error: ${workspaceError.message}`,
        error_code: 'WORKSPACE_ERROR'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const token = workspace?.settings?.ghostapis?.token
  if (!token) {
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: 'GhostAPIs token not configured for this workspace',
        error_code: 'TOKEN_NOT_CONFIGURED'
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Montar URL da GhostAPIs
  const url = new URL('https://ghostapis.com/api.php')
  url.searchParams.set('token', token)

  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, String(value))
  }

  console.log('[GHOSTAPIS PROXY] Calling GhostAPIs...')

  // Chamar GhostAPIs
  const response = await fetch(url.toString())

  if (!response.ok) {
    console.error('[GHOSTAPIS PROXY] GhostAPIs error:', response.status)
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_message: `GhostAPIs error: ${response.status}`,
        error_code: 'GHOSTAPIS_ERROR'
      }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const data = await response.json()
  console.log('[GHOSTAPIS PROXY] Response received successfully')

  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}