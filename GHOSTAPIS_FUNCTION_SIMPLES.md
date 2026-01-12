# Edge Function GhostAPIs - Versão Mais Simples

Copie e cole este código **EXATAMENTE** como está no Supabase:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('Function initialized')

serve(async (req) => {
  console.log('Request received:', req.method, req.url)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    })
  }

  try {
    console.log('Processing POST request...')

    // Get request body
    let body
    try {
      body = await req.json()
      console.log('Body parsed:', body)
    } catch (e) {
      console.error('Failed to parse body:', e)
      throw new Error('Invalid JSON body')
    }

    const { endpoint, params, workspaceId } = body

    if (!workspaceId) {
      throw new Error('workspaceId is required')
    }

    console.log('Creating Supabase client...')

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    console.log('Env vars:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    })

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Fetching workspace settings...')

    // Get workspace settings
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single()

    if (workspaceError) {
      console.error('Workspace error:', workspaceError)
      throw new Error(`Workspace error: ${workspaceError.message}`)
    }

    console.log('Workspace found:', !!workspace)

    // Get token
    const token = workspace?.settings?.ghostapis?.token
    if (!token) {
      console.error('Token not found in workspace settings')
      throw new Error('GhostAPIs token not configured')
    }

    console.log('Token found, calling GhostAPIs...')

    // Build URL
    const url = new URL('https://ghostapis.com/api.php')
    url.searchParams.set('token', token)

    for (const [key, value] of Object.entries(params || {})) {
      url.searchParams.set(key, String(value))
    }

    console.log('Calling URL:', url.toString().replace(token, '***'))

    // Call GhostAPIs
    const response = await fetch(url.toString())

    if (!response.ok) {
      console.error('GhostAPIs error:', response.status)
      throw new Error(`GhostAPIs error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Response received successfully')

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
  } catch (error: any) {
    console.error('Error:', error.message, error.stack)

    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.stack || error.toString(),
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

console.log('Function ready')
```

## ⚠️ IMPORTANTE

Depois de colar:
1. ✅ Clique em **"Deploy updates"**
2. ✅ Aguarde o deploy completar (vai aparecer mensagem de sucesso)
3. ✅ Aguarde 30 segundos
4. ✅ Hard reload no navegador (Ctrl+Shift+R)
5. ✅ Teste novamente

## 🔍 Se ainda der erro

Vá em **Logs** da função e me mostre o que aparece quando você tenta testar.

Os logs vão mostrar linha por linha o que está acontecendo:
- `Function initialized`
- `Request received: OPTIONS ...`
- `Handling OPTIONS request`

Ou mostrará onde está o erro.
