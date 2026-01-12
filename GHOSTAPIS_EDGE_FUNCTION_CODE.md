# GhostAPIs Edge Function - Código Completo

## ⚠️ IMPORTANTE: Como Atualizar a Função

Você criou a função pela interface do Supabase, mas precisa garantir que o código está correto.

### Passo 1: Verificar se a função está deployada

No Supabase Dashboard:
1. Vá em **Edge Functions** no menu lateral
2. Procure por `ghostapis-proxy`
3. Clique nela para editar

### Passo 2: Copiar e Colar o Código Abaixo

**SUBSTITUA TODO O CONTEÚDO** do arquivo `index.ts` por este código:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get request body
    const { endpoint, params, workspaceId } = await req.json()

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get workspace settings to retrieve GhostAPIs token
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single()

    if (workspaceError) {
      throw new Error(`Erro ao buscar workspace: ${workspaceError.message}`)
    }

    // Get token from workspace settings
    const token = workspace?.settings?.ghostapis?.token
    if (!token) {
      throw new Error('Token GhostAPIs não configurado no workspace')
    }

    console.log(`[GHOSTAPIS PROXY] Endpoint: ${endpoint}, Params:`, params)

    // Build URL with token and parameters
    const url = new URL('https://ghostapis.com/api.php')
    url.searchParams.set('token', token)

    // Add all parameters to URL
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }

    console.log(`[GHOSTAPIS PROXY] Request URL: ${url.toString()}`)

    // Make request to GhostAPIs
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`GhostAPIs HTTP error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    console.log(`[GHOSTAPIS PROXY] Response:`, data)

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
```

### Passo 3: Clicar em "Deploy updates" (botão verde no canto inferior direito)

### Passo 4: Aguardar Deploy Completar

Você verá uma mensagem de sucesso quando o deploy terminar.

---

## 🔍 Verificar Logs da Função

Depois de deployar, você pode ver os logs em tempo real:

1. No Supabase Dashboard, vá em **Edge Functions**
2. Clique em `ghostapis-proxy`
3. Vá na aba **Logs**
4. Tente fazer um teste novamente no frontend

Os logs vão mostrar:
- `[GHOSTAPIS PROXY] Endpoint: cpf, Params: ...`
- `[GHOSTAPIS PROXY] Request URL: https://ghostapis.com/...`
- `[GHOSTAPIS PROXY] Response: ...`

Ou, se houver erro:
- `[GHOSTAPIS PROXY] Error: ...`

---

## 🧪 Testar Direto no Supabase (Sem Frontend)

Você pode testar a função diretamente no Supabase:

1. Vá na aba **Test** da função
2. Cole este JSON como body:

```json
{
  "endpoint": "cpf",
  "params": {
    "cpf2": "14970466700"
  },
  "workspaceId": "ec73946f-ec8f-41f0-92a6-b26a40c8262c"
}
```

3. Clique em **Run**

**Resposta esperada** (sucesso):
```json
{
  "response.NOME": "Nome do Cliente",
  "response.EMAIL": "email@exemplo.com",
  "response.TELEFONES": "11999999999",
  ...
}
```

**Resposta de erro**:
```json
{
  "error": "Token GhostAPIs não configurado no workspace"
}
```

---

## 🆘 Troubleshooting

### Erro: "SUPABASE_URL is not defined"

**Causa**: Variáveis de ambiente não configuradas.

**Solução**: No Supabase, essas variáveis são automáticas. Certifique-se de que a função foi deployada corretamente.

### Erro: "Failed to send a request to the Edge Function"

**Causa**: A função tem erro de sintaxe ou não foi deployada.

**Solução**:
1. Copie o código acima novamente
2. Cole na função
3. Clique em "Deploy updates"
4. Aguarde o deploy completar

### Erro: "Token GhostAPIs não configurado no workspace"

**Causa**: O workspace não tem o token salvo nas configurações.

**Solução**:
1. Vá em **Integrações** no frontend
2. Configure o GhostAPIs com o token
3. Salve
4. Tente novamente

### Erro CORS ainda aparece

**Causa**: A função antiga (com erro) ainda está em cache.

**Solução**:
1. Aguarde 1-2 minutos após o deploy
2. Hard reload no navegador (Ctrl+Shift+R)
3. Tente novamente

---

## ✅ Checklist

- [ ] Copiei o código completo acima
- [ ] Colei na função `ghostapis-proxy` no Supabase
- [ ] Cliquei em "Deploy updates"
- [ ] Aguardei o deploy completar
- [ ] Recarreguei o frontend (Ctrl+Shift+R)
- [ ] Testei novamente

---

## 🎯 Após Deploy Bem-Sucedido

Você deve ver nos logs do Supabase:

```
[GHOSTAPIS PROXY] Endpoint: cpf, Params: { cpf2: '14970466700' }
[GHOSTAPIS PROXY] Request URL: https://ghostapis.com/api.php?token=e83b...&cpf2=14970466700
[GHOSTAPIS PROXY] Response: { 'response.NOME': 'João Silva', ... }
```

E no frontend, o teste deve mostrar:
- ✅ **Conexão bem-sucedida! Dados encontrados.**
- Nome, email, telefones do CPF consultado

---

**Importante**: Certifique-se de clicar em **"Deploy updates"** após colar o código!
