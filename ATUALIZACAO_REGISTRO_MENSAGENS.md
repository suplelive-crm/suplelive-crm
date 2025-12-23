# ✅ Atualização - Registro de Mensagens no Banco de Dados

## 📋 Resumo das Alterações

Implementado sistema completo de rastreamento de mensagens automáticas nas tabelas `orders` e `orders_products`, além de registro detalhado na tabela `messages`.

---

## 🗂️ Estrutura de Dados

### Tabela: `orders`
```sql
mensagem_enviada BOOLEAN DEFAULT false
```
**Propósito**: Indica se a mensagem de **upsell** (segunda unidade) foi enviada para este pedido.

### Tabela: `orders_products`
```sql
mensagem_recompra BOOLEAN DEFAULT false
```
**Propósito**: Indica se a mensagem de **recompra** foi **agendada** para este produto específico.

### Tabela: `messages`
**Campos principais**:
- `client_id` - Cliente destinatário
- `content` - Conteúdo da mensagem enviada
- `send_type` - Tipo: `'automated_welcome'`, `'automated_upsell'`, `'automated_reorder'`
- `status` - Status: `'sent'`, `'failed'`, `'pending'`
- `channel_type` - Canal: `'whatsapp'`
- `sender_type` - Remetente: `'bot'`
- `metadata` - Dados adicionais (JSON)

---

## 🚀 Fluxo de Envio e Registro

### 1️⃣ Mensagem de Boas-Vindas (Welcome)

**Quando**: Cliente novo realiza primeira compra

**Edge Function**: `process-order-created` → `sendWelcomeMessage()`

#### Ações Executadas:
```typescript
// 1. Busca template do banco
const message = await getWelcomeMessage(supabase, workspaceId, {
  client_name: client.name,
  order_id: order.order_id_base
});

// 2. Envia via Evolution API
await sendWhatsAppMessage(supabase, workspaceId, client.phone, message);

// 3. Registra na tabela messages
await supabase.from('messages').insert({
  client_id: client.id,
  content: message,
  send_type: 'automated_welcome',
  status: 'sent',
  channel_type: 'whatsapp',
  sender_type: 'bot'
});
```

**Logs Console**:
```
✅ Sent welcome message to 5511999999999 using template from database
```

**Registros no Banco**:
- ✅ Tabela `messages`: 1 registro com `send_type = 'automated_welcome'`
- ⚠️ Não atualiza `orders` (apenas welcome não precisa flag)

---

### 2️⃣ Mensagem de Upsell (Segunda Unidade com 20% Desconto)

**Quando**: Pedido de qualquer canal (exceto canais configurados em `filter_config`)

**Edge Function**: `process-order-created` → `sendUpsellMessage()`

#### Ações Executadas:
```typescript
// 1. Calcula preços
const firstProduct = fullOrder.products[0];
const originalPrice = firstProduct.price_brutto * firstProduct.quantity;
const discountedPrice = originalPrice * 0.80; // 20% desconto

// 2. Busca template do banco
const message = await getUpsellMessage(supabase, workspaceId, {
  client_name: client.name,
  product_name: firstProduct.name,
  original_price: originalPrice.toFixed(2),
  discounted_price: discountedPrice.toFixed(2)
});

// 3. Envia via Evolution API
await sendWhatsAppMessage(supabase, workspaceId, client.phone, message);

// 4. ✅ MARCA NO BANCO: orders.mensagem_enviada = true
await supabase
  .from('orders')
  .update({
    mensagem_enviada: true,
    updated_at: new Date().toISOString()
  })
  .eq('id', order.id);

// 5. Registra na tabela messages
await supabase.from('messages').insert({
  client_id: client.id,
  content: message,
  send_type: 'automated_upsell',
  status: 'sent',
  channel_type: 'whatsapp',
  sender_type: 'bot',
  metadata: {
    order_id: order.id,
    product_sku: firstProduct.sku,
    product_name: firstProduct.name,
    original_price: originalPrice,
    discounted_price: discountedPrice,
    discount_percentage: 20
  }
});
```

**Logs Console**:
```
✅ Sent upsell message (segunda unidade 20% off) to 5511999999999 using template from database
✅ Updated orders.mensagem_enviada = true for order {order_id}
```

**Registros no Banco**:
- ✅ Tabela `orders`: `mensagem_enviada = true`
- ✅ Tabela `messages`: 1 registro com `send_type = 'automated_upsell'`

**Query de Verificação**:
```sql
SELECT
  o.id,
  o.order_id_base,
  o.mensagem_enviada,
  o.canal_venda,
  o.total_amount,
  m.content as mensagem_conteudo,
  m.created_at as mensagem_enviada_em
FROM orders o
LEFT JOIN messages m ON m.metadata->>'order_id' = o.id::text
  AND m.send_type = 'automated_upsell'
WHERE o.mensagem_enviada = true
ORDER BY o.created_at DESC;
```

---

### 3️⃣ Mensagem de Recompra (Agendada)

**Quando**: Produto possui duração cadastrada (`products.duracao`)

**Data de Envio**: `order_date + (duracao * quantidade) - 15 dias`

**Edge Function**:
- **Agendamento**: `process-order-created` → `scheduleReorderMessages()`
- **Envio**: `send-scheduled-messages` (cron job)

#### Ações Executadas (Agendamento):
```typescript
// 1. Verifica se produto tem duração
const { data: productData } = await supabase
  .from('products')
  .select('duracao, name')
  .eq('sku', product.sku)
  .maybeSingle();

if (!productData?.duracao) {
  console.log('Produto sem duração, pulando');
  return;
}

// 2. Calcula data de recompra
const durationDays = productData.duracao * product.quantity;
const reorderDate = new Date(order.order_date);
reorderDate.setDate(reorderDate.getDate() + durationDays - 15);

// 3. Processa template
const message = await getReorderMessage(supabase, workspaceId, {
  client_name: client.name,
  product_name: productData.name,
  product_sku: product.sku,
  order_date: new Date(order.order_date).toLocaleDateString('pt-BR'),
  duration_days: durationDays
});

// 4. Agenda mensagem
await supabase.from('scheduled_messages').insert({
  workspace_id: workspaceId,
  client_id: client.id,
  message_type: 'reorder',
  message_content: message,
  scheduled_for: reorderDate.toISOString(),
  status: 'pending',
  metadata: {
    order_id: order.id,
    product_sku: product.sku,
    product_name: productData.name,
    duration_days: durationDays
  }
});

// 5. ✅ MARCA NO BANCO: orders_products.mensagem_recompra = true
await supabase
  .from('orders_products')
  .update({ mensagem_recompra: true })
  .eq('order_id', order.id)
  .eq('sku', product.sku);
```

**Logs Console (Agendamento)**:
```
✅ Scheduled reorder message for {sku} on {date} using template from database
✅ Updated orders_products.mensagem_recompra = true for product {sku}
```

**Registros no Banco (Agendamento)**:
- ✅ Tabela `scheduled_messages`: 1 registro com `status = 'pending'`
- ✅ Tabela `orders_products`: `mensagem_recompra = true`

---

#### Ações Executadas (Envio Futuro):

**Edge Function**: `send-scheduled-messages` (executada por cron)

```typescript
// 1. Busca mensagens pendentes (scheduled_for <= now)
const { data: messages } = await supabase
  .from('scheduled_messages')
  .select('*, clients(name, phone)')
  .eq('status', 'pending')
  .lte('scheduled_for', now);

// Para cada mensagem:
for (const msg of messages) {
  // 2. Busca instância WhatsApp conectada
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('workspace_id', msg.workspace_id)
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle();

  // 3. Envia via Evolution API
  await fetch(`${evolutionAPI}/message/sendText/${instance.instance_name}`, {
    method: 'POST',
    body: JSON.stringify({
      number: msg.clients.phone,
      text: msg.message_content
    })
  });

  // 4. Atualiza scheduled_messages
  await supabase
    .from('scheduled_messages')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString()
    })
    .eq('id', msg.id);

  // 5. Registra na tabela messages
  await supabase.from('messages').insert({
    client_id: msg.client_id,
    content: msg.message_content,
    send_type: 'automated_reorder',
    status: 'sent',
    channel_type: 'whatsapp',
    sender_type: 'bot',
    metadata: {
      scheduled_message_id: msg.id,
      ...msg.metadata
    }
  });
}
```

**Logs Console (Envio)**:
```
Found {N} messages to send
Sent message {id} to {phone}
Sent {N} messages, 0 failed
```

**Registros no Banco (Envio)**:
- ✅ Tabela `scheduled_messages`: `status = 'sent'`, `sent_at = timestamp`
- ✅ Tabela `messages`: 1 registro com `send_type = 'automated_reorder'`

**Query de Verificação**:
```sql
-- Ver produtos com mensagem de recompra agendada
SELECT
  op.id,
  op.sku,
  op.nome_produto,
  op.mensagem_recompra,
  sm.scheduled_for,
  sm.status,
  sm.sent_at,
  m.content as mensagem_enviada
FROM orders_products op
JOIN scheduled_messages sm ON sm.metadata->>'product_sku' = op.sku
LEFT JOIN messages m ON m.metadata->>'scheduled_message_id' = sm.id::text
WHERE op.mensagem_recompra = true
ORDER BY sm.scheduled_for DESC;
```

---

## 📊 Tabela de Resumo

| Tipo de Mensagem | Quando Enviada | Campo Marcado | Tabela de Log |
|------------------|----------------|---------------|---------------|
| **Boas-Vindas** | Imediato (cliente novo) | - (não tem flag) | `messages` |
| **Upsell** | Imediato (após pedido) | `orders.mensagem_enviada = true` | `messages` |
| **Recompra** | Agendada (15 dias antes do fim) | `orders_products.mensagem_recompra = true` (no agendamento) | `messages` (no envio) |

---

## 🔍 Queries de Verificação

### 1. Pedidos com Mensagem de Upsell Enviada
```sql
SELECT
  o.id,
  o.order_id_base,
  o.canal_venda,
  o.total_amount,
  o.mensagem_enviada,
  o.created_at as pedido_criado_em,
  m.created_at as mensagem_enviada_em,
  m.content as mensagem_conteudo
FROM orders o
LEFT JOIN messages m ON m.metadata->>'order_id' = o.id::text
  AND m.send_type = 'automated_upsell'
WHERE o.mensagem_enviada = true
ORDER BY o.created_at DESC
LIMIT 50;
```

### 2. Produtos com Mensagem de Recompra Agendada
```sql
SELECT
  op.sku,
  op.nome_produto,
  op.quantidade_produtos,
  op.mensagem_recompra,
  o.order_date as pedido_em,
  sm.scheduled_for as envio_agendado_para,
  sm.status as status_agendamento,
  sm.sent_at as enviado_em
FROM orders_products op
JOIN orders o ON o.id = op.order_id
JOIN scheduled_messages sm ON sm.metadata->>'product_sku' = op.sku
  AND sm.metadata->>'order_id' = o.id::text
WHERE op.mensagem_recompra = true
ORDER BY sm.scheduled_for DESC
LIMIT 50;
```

### 3. Histórico Completo de Mensagens por Cliente
```sql
SELECT
  c.name as cliente,
  c.phone,
  m.send_type,
  m.status,
  m.content,
  m.created_at as enviada_em,
  m.metadata
FROM messages m
JOIN clients c ON c.id = m.client_id
WHERE c.id = 'CLIENT_ID_AQUI'
ORDER BY m.created_at DESC;
```

### 4. Dashboard de Mensagens Automáticas (Últimos 30 dias)
```sql
SELECT
  send_type,
  status,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sent') as enviadas,
  COUNT(*) FILTER (WHERE status = 'failed') as falhas,
  MIN(created_at) as primeira,
  MAX(created_at) as ultima
FROM messages
WHERE sender_type = 'bot'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY send_type, status
ORDER BY send_type;
```

---

## ✅ Confirmação de Implementação

### ✅ Arquivos Modificados e Deployados

1. **supabase/functions/process-order-created/index.ts**
   - Linha 389-396: Atualiza `orders.mensagem_enviada = true` após envio upsell
   - Linha 485-490: Atualiza `orders_products.mensagem_recompra = true` ao agendar recompra
   - Linha 417: Log de confirmação upsell
   - Linha 493: Log de confirmação recompra

2. **supabase/functions/send-scheduled-messages/index.ts** (JÁ ESTAVA CORRETO)
   - Linha 120-131: Registra mensagens enviadas na tabela `messages`

### ✅ Deploy Realizado

```bash
npx supabase functions deploy process-order-created
```

**Status**: ✅ Deploy concluído com sucesso

**Dashboard**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions/process-order-created

**Logs**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/logs/edge-functions

---

## 🧪 Como Testar

### Teste 1: Mensagem de Upsell

1. Criar pedido de teste no Baselinker
2. Verificar logs da Edge Function
3. Confirmar no banco:
```sql
SELECT mensagem_enviada FROM orders WHERE order_id_base = {ORDER_ID};
-- Esperado: true

SELECT * FROM messages WHERE send_type = 'automated_upsell'
ORDER BY created_at DESC LIMIT 1;
-- Esperado: 1 registro com conteúdo da mensagem
```

### Teste 2: Mensagem de Recompra (Agendamento)

1. Criar pedido com produto que tem `duracao` configurada
2. Verificar logs da Edge Function
3. Confirmar no banco:
```sql
SELECT mensagem_recompra FROM orders_products
WHERE order_id = (SELECT id FROM orders WHERE order_id_base = {ORDER_ID})
  AND sku = '{SKU}';
-- Esperado: true

SELECT * FROM scheduled_messages WHERE message_type = 'reorder'
ORDER BY created_at DESC LIMIT 1;
-- Esperado: 1 registro com status = 'pending'
```

### Teste 3: Envio de Mensagem Agendada

1. Criar mensagem agendada para data passada (teste)
2. Executar manualmente: `send-scheduled-messages`
3. Confirmar no banco:
```sql
SELECT status, sent_at FROM scheduled_messages WHERE id = '{ID}';
-- Esperado: status = 'sent', sent_at = timestamp

SELECT * FROM messages WHERE send_type = 'automated_reorder'
ORDER BY created_at DESC LIMIT 1;
-- Esperado: 1 registro com conteúdo da mensagem
```

---

## 📝 Resumo Final

✅ **Sistema Completo de Rastreamento Implementado**

**Funcionalidades**:
1. ✅ Marca `orders.mensagem_enviada` quando upsell é enviado
2. ✅ Marca `orders_products.mensagem_recompra` quando recompra é agendada
3. ✅ Registra todas as mensagens na tabela `messages` com metadados completos
4. ✅ Logs detalhados no console das Edge Functions
5. ✅ Queries de verificação prontas para uso

**Próximos Passos**:
- Testar com pedidos reais do Baselinker
- Monitorar logs das Edge Functions
- Criar dashboard de métricas de mensagens automáticas

---

**Data da Atualização**: 23/12/2025
**Versão**: 1.0
**Status**: ✅ Implementado e Deployado
