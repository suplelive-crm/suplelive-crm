# ✅ Estratégia de Sincronização Atualizada

## 📋 Mudanças Implementadas

### ANTES (Sistema Antigo - Polling):
```
┌─────────────────────┐
│   setInterval       │
│   (a cada X minutos)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Buscar TODOS os    │
│  pedidos do         │
│  Baselinker API     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Salvar no banco    │
│  (muitas duplicatas)│
└─────────────────────┘
```

**Problemas:**
- ❌ Polling constante (requisições desnecessárias)
- ❌ Alto custo de API
- ❌ Delay de minutos para atualizações
- ❌ Processamento de dados já conhecidos

---

### AGORA (Sistema Novo - Webhook + Manual):
```
┌─────────────────────┐
│   Baselinker        │
│   (evento acontece) │
└──────────┬──────────┘
           │ HTTP POST
           ▼
┌─────────────────────┐
│   Webhook           │
│   (tempo real)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Atualiza APENAS    │
│  o pedido alterado  │
└─────────────────────┘

       +

┌─────────────────────┐
│  Sincronização      │
│  Manual (botão)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sync Incremental   │
│  (apenas novos desde│
│   último order_date)│
└─────────────────────┘
```

**Vantagens:**
- ✅ **Tempo Real**: Webhooks processam em segundos
- ✅ **Econômico**: Menos requisições à API
- ✅ **Eficiente**: Processa apenas o que mudou
- ✅ **Backup**: Sync manual para casos especiais

---

## 🔧 Mudanças no Código

### Arquivo: `src/store/baselinkerStore.ts`

**Linha 137-138 - Desabilitado:**
```typescript
// ANTES:
get().startSyncInterval();
await get().syncAll(true);

// AGORA:
// DESABILITADO: Sincronização automática removida em favor de webhooks
// get().startSyncInterval();

// Sincronização inicial manual ao conectar
await get().syncAll(true);
```

**O que mudou:**
- ❌ **Removido**: `startSyncInterval()` não é mais chamado automaticamente
- ✅ **Mantido**: Sincronização inicial ao conectar (uma vez)
- ✅ **Mantido**: Botão de sincronização manual na interface

---

## 📊 Como Funciona Agora

### 1. Configuração Inicial (Uma vez)

```bash
1. Conectar ao Baselinker (salva API Key)
2. Sincronização inicial (busca até 500 pedidos mais recentes)
3. Se necessário, sincronizar novamente para buscar pedidos mais antigos
4. Configurar webhook no painel do Baselinker
```

**⚠️ LIMITE DE SEGURANÇA:**
- Cada sincronização busca **máximo 500 pedidos** (5 páginas de 100)
- Isso evita sobrecarga do navegador e timeout de requisições
- Se você tem mais de 500 pedidos, execute a sincronização múltiplas vezes
- Pedidos são sempre buscados do mais recente para o mais antigo

### 2. Operação Normal (Dia a Dia)

#### Webhook Processa Eventos em Tempo Real:

**Evento:** Pedido muda de status no Baselinker (ex: "Aguardando Pagamento" → "Pago")

```
Baselinker → Webhook → Banco de Dados
(evento)      (processa)  (atualiza status)
                            ⚡ INSTANTÂNEO
```

**Eventos Suportados:**
- `order_status_changed` - Atualiza status imediatamente
- `new_order` - Registra evento (será pego no próximo sync manual)
- `order_updated` - Atualiza dados do pedido (preço, etc.)

#### Sincronização Manual (Backup):

**Quando usar:**
- ✅ Para buscar novos pedidos que o webhook não capturou
- ✅ Após configurar o webhook pela primeira vez
- ✅ Se houver problemas de conexão temporários
- ✅ Para garantir que nada foi perdido

**Como funciona:**
1. Busca o último `order_date` no banco de dados
2. Pede à API apenas pedidos **desde essa data**
3. Salva apenas os novos (usa `order_id_base` para evitar duplicatas)

```typescript
// Sync incremental - apenas novos desde a última data
const { data: lastOrder } = await supabase
  .from('orders')
  .select('order_date')
  .order('order_date', { ascending: false })
  .limit(1)

const dateFrom = lastOrder
  ? Math.floor(new Date(lastOrder.order_date).getTime() / 1000) + 1
  : 0

// Busca apenas pedidos novos
const response = await baselinker.getOrders({
  date_from: dateFrom,
  ...
})
```

---

## 🎯 Fluxo Recomendado

### Setup Inicial:

1. ✅ Conectar Baselinker (feito)
2. ✅ Sincronizar tudo manualmente (primeira vez)
3. ⏳ Configurar webhook no Supabase Dashboard (desmarcar "Verify JWT")
4. ⏳ Configurar webhook no painel Baselinker

### Operação Diária:

1. **Eventos em Tempo Real**: Webhooks processam automaticamente
2. **Backup Periódico**: Sincronizar manualmente 1x/dia (opcional)
3. **Novos Pedidos**: Sincronizar quando quiser buscar novos

---

## 🔐 Segurança do Webhook

### Validações Implementadas:

```typescript
// 1. Header obrigatório
const workspaceId = req.headers.get('x-workspace-id')
if (!workspaceId) {
  return error 400
}

// 2. Payload válido
if (!event || !order_id) {
  return error 400
}

// 3. Pedido existe no banco
const { data: existingOrder } = await supabase
  .from('orders')
  .eq('order_id_base', parseInt(order_id))
  .eq('workspace_id', workspaceId)
```

---

## 📝 Instruções para o Usuário

### Como Sincronizar Manualmente:

1. Acesse **Integrações** na plataforma
2. Role até **"Configuração do Baselinker"**
3. Clique em **"Sincronizar Pedidos"**

### Como Configurar Webhook:

1. Acesse **Integrações** na plataforma
2. Role até **"Webhook do Baselinker"**
3. Siga as instruções passo a passo
4. Copie a URL e Workspace ID usando os botões
5. Configure no painel do Baselinker

---

## 🐛 Troubleshooting

### Problema: Pedidos não estão sendo atualizados

**Possíveis causas:**
1. Webhook não configurado no Baselinker
2. "Verify JWT" ainda ativado no Supabase
3. Header `x-workspace-id` incorreto

**Solução:**
1. Verifique a configuração do webhook no Baselinker
2. Desmarque "Verify JWT" no Supabase Dashboard
3. Use o Workspace ID correto (copie da interface)

### Problema: Sincronização manual muito lenta

**Causa:** Paginação buscando todos os pedidos

**Solução:** A sincronização incremental já está implementada - ela busca apenas desde o último `order_date`. Se ainda estiver lento:
1. Verifique se há muitos pedidos novos desde a última sync
2. Considere sincronizar mais frequentemente

---

## 📊 Monitoramento

### Ver Logs do Webhook:

```bash
npx supabase functions logs baselinker-webhook --tail
```

Ou acesse:
- Dashboard: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
- Função: baselinker-webhook
- Aba: Logs

### Verificar Últimas Atualizações:

```sql
-- Ver pedidos atualizados recentemente (webhook)
SELECT
  order_id_base,
  status,
  updated_at,
  created_at
FROM orders
WHERE updated_at > created_at + INTERVAL '5 minutes'
ORDER BY updated_at DESC
LIMIT 20;
```

---

## ✅ Resumo das Mudanças

| Aspecto | Antes | Agora |
|---------|-------|-------|
| **Sincronização Automática** | ✅ setInterval a cada X min | ❌ Desabilitado |
| **Webhook** | ❌ Não tinha | ✅ Deployado e configurável |
| **Sincronização Manual** | ✅ Botão (busca tudo) | ✅ Botão (incremental) |
| **Tempo de Atualização** | 5-10 minutos | Segundos (webhook) |
| **Custo de API** | Alto (polling) | Baixo (webhooks) |
| **Eficiência** | Baixa (processa tudo) | Alta (só o que mudou) |

---

**Data:** 2025-11-13
**Autor:** Claude Code
**Status:** ✅ Implementado
