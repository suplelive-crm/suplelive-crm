# Código Corrigido - register-user Function

## Problema Identificado

O erro 404 ocorre porque a função tem um **import incorreto** que causa falha na inicialização:

```typescript
// ❌ ERRADO (formato npm: não funciona no Supabase Cloud)
import { createClient } from 'npm:@supabase/supabase-js@2';

// ✅ CORRETO (formato ESM)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
```

Por isso os logs mostram apenas "booted" e "shutdown" - a função está crashando na inicialização.

## Código Corrigido Completo

Cole este código **completo** no Supabase Dashboard:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RegisterUserRequest {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'operator';
  workspace_id: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create regular client to verify the requesting user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Verify the requesting user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const body: RegisterUserRequest = await req.json();
    const { name, email, password, role, workspace_id } = body;

    // Validate required fields
    if (!name || !email || !password || !role || !workspace_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify that the requesting user has permission to manage this workspace
    const { data: workspace, error: workspaceError } = await supabaseClient
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspace_id)
      .single();

    if (workspaceError || !workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if user is the workspace owner (for now, only owners can register users)
    if (workspace.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Permission denied. Only workspace owners can register users.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create the new user using admin client
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        name,
        workspace_id,
        role
      },
      email_confirm: true // Auto-confirm email
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({
          error: createError.message || 'Failed to create user'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create client record for the new user in the workspace
    const { error: clientError } = await supabaseClient
      .from('clients')
      .insert({
        name,
        email,
        workspace_id,
        user_id: newUser.user.id,
        metadata: {
          user_type: 'workspace_member',
          role,
          created_by: user.id,
          created_via: 'admin_registration'
        }
      });

    if (clientError) {
      console.warn('Could not create client record:', clientError);
      // Don't fail the request as user creation was successful
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          name,
          role
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
```

## Passo a Passo para Deploy Manual

1. **Acesse o Supabase Dashboard**
   - https://supabase.com/dashboard
   - Projeto: **oqwstanztqdiexgrpdta**
   - Edge Functions → **register-user**

2. **Substitua o código**
   - Clique em **Edit** ou no editor de código
   - **Apague TUDO** que está lá
   - **Cole** o código corrigido acima (completo, todas as 199 linhas)

3. **Deploy**
   - Clique em **Deploy** ou **Save & Deploy**
   - Aguarde a confirmação de sucesso

4. **Aguarde 30 segundos**
   - A função precisa de tempo para inicializar

5. **Teste no Frontend**
   - Faça **hard reload** (Ctrl+Shift+R) no navegador
   - Tente cadastrar um novo usuário
   - Deve funcionar agora!

## Como Verificar se Funcionou

### No Supabase Dashboard - Logs

Acesse: Edge Functions → register-user → **Logs**

**Antes da correção** (erro):
```
booted (time: 27ms)
shutdown
booted (time: 21ms)
shutdown
```

**Depois da correção** (sucesso):
```
booted (time: 27ms)
[requisição aparece aqui com status 200 ou 400 dependendo dos dados]
```

### No Console do Navegador

**Antes** (erro):
```
POST .../register-user 404 (Not Found)
```

**Depois** (sucesso):
```
POST .../register-user 200 (OK)
✅ Usuário criado com sucesso
```

## O que foi corrigido

| Linha | Antes (Errado) | Depois (Correto) |
|-------|---------------|------------------|
| 1 | `import { createClient } from 'npm:@supabase/supabase-js@2';` | `import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';` |

Essa única mudança corrige o problema de inicialização que causava o 404.

---

**Status**: Código corrigido, pronto para deploy manual via Dashboard.
