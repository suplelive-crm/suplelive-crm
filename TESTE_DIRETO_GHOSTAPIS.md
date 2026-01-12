# Teste Direto da Edge Function (Sem SDK)

Vamos testar chamando a função diretamente com `fetch` em vez de `supabase.functions.invoke()`.

## Código de Teste

Cole este código no **console do navegador** (F12 → Console):

```javascript
const testGhostAPIs = async () => {
  const supabaseUrl = 'https://oqwstanztqdiexgrpdta.supabase.co'
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xd3N0YW56dHFkaWV4Z3JwZHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMzM3MjksImV4cCI6MjA2NDgwOTcyOX0.ocuapLtLjHNfy97hYx9a7pbW69bn58PTvhyQTqCgD_k'

  const workspaceId = 'ec73946f-ec8f-41f0-92a6-b26a40c8262c'
  const cpf = '14970466700'

  console.log('🚀 Testando Edge Function...')

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ghostapis-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        endpoint: 'cpf',
        params: { cpf2: cpf },
        workspaceId: workspaceId,
      }),
    })

    console.log('📡 Status:', response.status)
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro:', errorText)
      return
    }

    const data = await response.json()
    console.log('✅ Sucesso! Dados:', data)
  } catch (error) {
    console.error('💥 Erro na requisição:', error)
  }
}

testGhostAPIs()
```

## O que esperar:

### ✅ Se funcionar:
```
🚀 Testando Edge Function...
📡 Status: 200
✅ Sucesso! Dados: { 'response.NOME': 'João Silva', ... }
```

### ❌ Se der CORS:
```
💥 Erro na requisição: TypeError: Failed to fetch
```

### ❌ Se der 401:
```
📡 Status: 401
❌ Erro: Unauthorized
```

---

## Se o teste direto funcionar:

Isso significa que o problema está no `supabase.functions.invoke()`. Nesse caso, vamos substituir por `fetch` direto no código do frontend.

## Se o teste direto também der CORS:

Significa que a Edge Function não está configurada corretamente no Supabase Cloud. Precisamos:

1. Verificar se a função está **publicada** (não em draft)
2. Verificar se há algum **firewall** ou **política de segurança** bloqueando
3. Tentar **recriar a função** do zero

---

Cole o código no console e me diga o resultado! 🔍
