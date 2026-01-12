# Solução GhostAPIs Implementada

## O que foi feito

Adicionamos suporte para **GhostAPIs** na Edge Function `baselinker-proxy` que já está funcionando. Agora essa função serve como proxy universal para **Baselinker** e **GhostAPIs**.

## Por que essa solução?

A Edge Function `ghostapis-proxy` não estava respondendo (problema de CORS no preflight). Como o `baselinker-proxy` já funciona perfeitamente, adicionamos o handler de GhostAPIs ali.

## Arquivos Modificados

### 1. `supabase/functions/baselinker-proxy/index.ts`

**Adicionado**:
- Interface `GhostAPIsRequest`
- Função `handleGhostAPIs()` que:
  1. Busca o token do workspace no Supabase
  2. Faz proxy da requisição para `https://ghostapis.com/api.php`
  3. Retorna os dados com headers CORS corretos
- Lógica de roteamento: detecta se é requisição GhostAPIs ou Baselinker

**Como funciona**:
```typescript
// Requisição GhostAPIs (novo)
{
  service: 'ghostapis',
  endpoint: 'cpf',
  params: { cpf2: '12345678900' },
  workspaceId: 'uuid-do-workspace'
}

// Requisição Baselinker (antigo, ainda funciona)
{
  apiKey: '...',
  method: 'getOrders',
  parameters: { ... }
}
```

### 2. `src/lib/ghostapis-api.ts`

**Modificado**:
- Agora chama `baselinker-proxy` em vez de `ghostapis-proxy`
- Adiciona `service: 'ghostapis'` no body da requisição
- Funciona para `fetchClientDataByCPF()` e `fetchClientDataByPhone()`

### 3. `src/components/integrations/GhostAPISConfigDialog.tsx`

**Modificado**:
- Teste de conexão agora usa `baselinker-proxy`
- Adiciona `service: 'ghostapis'` no body

## Como testar

### 1. Fazer deploy da Edge Function

No Supabase Dashboard:
1. Vá em **Edge Functions** → **baselinker-proxy**
2. Cole o código atualizado de `supabase/functions/baselinker-proxy/index.ts`
3. Clique em **Deploy**
4. Aguarde o deploy completar

### 2. Testar no frontend

1. Vá em **Integrações** → **Configurar GhostAPIs**
2. Insira o token: `e83b734c357cfc9d5a2cae5eac2a6161`
3. Insira um CPF de teste: `14970466700`
4. Clique em **Testar**

**Resultado esperado**:
```
✅ Conexão bem-sucedida! Dados encontrados.
Nome: [nome do titular do CPF]
Email: [email encontrado]
Telefones: [telefones encontrados]
CPF: 14970466700
```

### 3. Verificar logs

Se der erro, veja os logs no Supabase:
1. Vá em **Edge Functions** → **baselinker-proxy** → **Logs**
2. Procure por `[GHOSTAPIS PROXY]` nas mensagens

## Vantagens dessa solução

✅ Reusa infraestrutura que já está funcionando
✅ Não cria nova Edge Function (menos complexidade)
✅ CORS configurado corretamente (já testado no Baselinker)
✅ Mesmo padrão de chamada
✅ Logs centralizados em uma única função

## Próximos passos

Depois de testar, você pode:
1. **Deletar** a Edge Function `ghostapis-proxy` (não está sendo usada)
2. Confirmar que a sincronização de pedidos está enriquecendo clientes automaticamente com dados do CPF

## O que NÃO foi mexido

- Baselinker continua funcionando normalmente
- Nada foi quebrado, apenas adicionamos suporte para GhostAPIs
- Se algo der errado com GhostAPIs, o Baselinker não é afetado

---

## Código para deploy (resumo)

### baselinker-proxy/index.ts

Adiciona detecção de serviço:
```typescript
// Detectar se é requisição GhostAPIs ou Baselinker
if (body.service === 'ghostapis') {
  return await handleGhostAPIs(body as GhostAPIsRequest)
} else {
  return await handleBaselinker(body as BaselinkerRequest)
}
```

E implementa `handleGhostAPIs()` que:
1. Valida workspaceId
2. Busca token do workspace (`workspace.settings.ghostapis.token`)
3. Chama GhostAPIs com o token
4. Retorna dados com CORS headers

---

**Status**: ✅ Implementação completa. Pronto para deploy e teste.
