# Arquitetura Event-Driven para Background Jobs

## Visão Geral

Este documento descreve a arquitetura **orientada a eventos** para substituir os workflows n8n, onde ações são disparadas automaticamente quando eventos ocorrem, ao invés de rodar em intervalos fixos (cron).

## Mudança de Paradigma

### ❌ Antes (Cron-based)
```
Cron (a cada 10 min) → Buscar pedidos → Processar todos
```

### ✅ Agora (Event-driven)
```
Evento (novo pedido) → Webhook/Polling → Processar apenas o novo
```

---

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                         BASELINKER                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              getJournalList API                           │  │
│  │  - Últimos 3 dias de eventos                             │  │
│  │  - 21 tipos de eventos diferentes                        │  │
│  │  - Incremental sync via last_log_id                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Polling (a cada 30s - 1min)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase Edge Function: event-poller               │
│                                                                  │
│  ├─ Busca eventos novos (last_log_id armazenado no banco)      │
│  ├─ Filtra por tipos relevantes                                │
│  └─ Insere eventos na fila: event_queue                        │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Tabela: event_queue                          │
│                                                                  │
│  ├─ event_id, event_type, order_id, payload                    │
│  ├─ status: pending, processing, completed, failed             │
│  └─ Database Trigger → chama processador específico            │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Event Processors (Edge Functions)                  │
│                                                                  │
│  ├─ process-order-created        → Criar pedido + cliente      │
│  ├─ process-order-status-changed → Atualizar status            │
│  ├─ process-product-added        → Atualizar produtos          │
│  ├─ process-payment-received     → Registrar pagamento         │
│  └─ process-invoice-created      → Salvar nota fiscal          │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Business Logic Triggers                      │
│                                                                  │
│  ├─ Novo cliente? → Enviar mensagem de boas-vindas (WhatsApp)  │
│  ├─ Pedido criado? → Sugerir venda casada                      │
│  ├─ Produto entregue? → Agendar mensagem de recompra           │
│  └─ Estoque baixo? → Notificar administrador                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tipos de Eventos Baselinker

### Eventos que vamos processar:

| Event Type | ID | Ação na Plataforma |
|------------|----|--------------------|
| **Order created** | 1 | Criar pedido + cliente + enviar mensagem venda casada |
| **Payment received** | 3 | Atualizar status pagamento + trigger automações |
| **Order status changed** | 18 | Atualizar status + notificar cliente |
| **Invoice created** | 7 | Salvar nota fiscal + atualizar metadata |
| **Product added** | 12 | Adicionar produto ao pedido |
| **Product edited** | 13 | Atualizar produto do pedido |
| **Product removed** | 14 | Remover produto do pedido |
| **Package created** | 9 | Criar rastreamento de envio |
| **Receipt created** | 8 | Salvar comprovante |

### Eventos que vamos ignorar (por enquanto):
- Order merged (5), Order split (6)
- Order removed (4), Order copied (17)
- Buyer blacklisted (15)

---

## Estrutura de Tabelas

### 1. Tabela: `event_queue`
Fila de eventos para processar

```sql
CREATE TABLE event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_log_id BIGINT UNIQUE NOT NULL, -- ID do evento no Baselinker
  event_type INTEGER NOT NULL, -- Tipo do evento (1-21)
  event_name TEXT, -- Nome legível (ex: "order_created")
  order_id BIGINT, -- ID do pedido no Baselinker
  payload JSONB NOT NULL, -- Dados completos do evento
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_event_queue_status ON event_queue(status);
CREATE INDEX idx_event_queue_event_type ON event_queue(event_type);
```

### 2. Tabela: `baselinker_sync_state`
Armazena estado da sincronização

```sql
CREATE TABLE baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) UNIQUE,
  last_log_id BIGINT DEFAULT 0, -- Último event_log_id processado
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false,
  sync_errors JSONB DEFAULT '[]'::jsonb
);
```

### 3. Tabela: `scheduled_messages`
Mensagens agendadas (recompra, follow-up, etc)

```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  client_id UUID REFERENCES clients(id),
  message_type TEXT NOT NULL, -- 'reorder', 'upsell', 'follow_up'
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, cancelled
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_messages_scheduled_for ON scheduled_messages(scheduled_for)
  WHERE status = 'pending';
```

---

## Fluxo Detalhado: Novo Pedido

### 1. Event Poller (Roda a cada 30s-1min)

```typescript
// supabase/functions/baselinker-event-poller/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Buscar último log_id processado
  const { data: syncState } = await supabase
    .from('baselinker_sync_state')
    .select('last_log_id')
    .single()

  const lastLogId = syncState?.last_log_id || 0

  // 2. Buscar novos eventos do Baselinker
  const events = await fetchBaselinkerJournal(lastLogId)

  if (events.length === 0) {
    return new Response(JSON.stringify({ message: 'No new events' }))
  }

  // 3. Inserir eventos na fila
  const eventsToInsert = events.map(event => ({
    event_log_id: event.log_id,
    event_type: event.log_type,
    event_name: getEventName(event.log_type),
    order_id: event.order_id,
    payload: event,
    status: 'pending'
  }))

  await supabase
    .from('event_queue')
    .insert(eventsToInsert)
    .onConflict('event_log_id')
    .ignoreDuplicates()

  // 4. Atualizar last_log_id
  const maxLogId = Math.max(...events.map(e => e.log_id))
  await supabase
    .from('baselinker_sync_state')
    .update({ last_log_id: maxLogId, last_sync_at: new Date() })
    .eq('id', syncState.id)

  return new Response(JSON.stringify({
    processed: events.length,
    last_log_id: maxLogId
  }))
})

function getEventName(logType: number): string {
  const eventNames = {
    1: 'order_created',
    3: 'payment_received',
    7: 'invoice_created',
    8: 'receipt_created',
    9: 'package_created',
    12: 'product_added',
    13: 'product_edited',
    14: 'product_removed',
    18: 'status_changed'
  }
  return eventNames[logType] || `event_${logType}`
}
```

### 2. Database Trigger (Processa eventos automaticamente)

```sql
-- Trigger que chama Edge Function quando novo evento é inserido
CREATE OR REPLACE FUNCTION process_event_queue()
RETURNS TRIGGER AS $$
BEGIN
  -- Chama Edge Function via pg_net (extensão do Supabase)
  PERFORM net.http_post(
    url := 'https://[project-ref].supabase.co/functions/v1/process-event',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'event_id', NEW.id,
      'event_type', NEW.event_type,
      'event_name', NEW.event_name
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_queue_trigger
AFTER INSERT ON event_queue
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION process_event_queue();
```

### 3. Event Processor (Processa cada tipo de evento)

```typescript
// supabase/functions/process-event/index.ts

serve(async (req) => {
  const { event_id, event_name } = await req.json()

  const supabase = createClient(...)

  // 1. Buscar evento da fila
  const { data: event } = await supabase
    .from('event_queue')
    .select('*')
    .eq('id', event_id)
    .single()

  // 2. Marcar como processando
  await supabase
    .from('event_queue')
    .update({ status: 'processing' })
    .eq('id', event_id)

  try {
    // 3. Rotear para processador específico
    switch (event_name) {
      case 'order_created':
        await processOrderCreated(supabase, event)
        break
      case 'payment_received':
        await processPaymentReceived(supabase, event)
        break
      case 'status_changed':
        await processStatusChanged(supabase, event)
        break
      // ... outros eventos
    }

    // 4. Marcar como completo
    await supabase
      .from('event_queue')
      .update({
        status: 'completed',
        processed_at: new Date()
      })
      .eq('id', event_id)

  } catch (error) {
    // 5. Marcar como falha e incrementar retry
    await supabase
      .from('event_queue')
      .update({
        status: 'failed',
        error_message: error.message,
        retry_count: event.retry_count + 1
      })
      .eq('id', event_id)

    // Se falhou 3 vezes, enviar alerta
    if (event.retry_count >= 2) {
      await sendErrorAlert(event, error)
    }
  }
})
```

### 4. Processador de Pedido Criado

```typescript
async function processOrderCreated(supabase: any, event: any) {
  const orderData = event.payload
  const workspaceId = await getWorkspaceId() // Da config

  // 1. Buscar dados completos do pedido no Baselinker
  const fullOrder = await fetchBaselinkerOrder(orderData.order_id)

  // 2. Criar ou buscar cliente pelo CPF/email
  let client = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('cpf', fullOrder.delivery_company_id) // Pode ser CPF
    .maybeSingle()

  if (!client.data) {
    // Cliente não existe, criar
    const { data: newClient } = await supabase
      .from('clients')
      .insert({
        workspace_id: workspaceId,
        name: fullOrder.delivery_fullname,
        email: fullOrder.email,
        phone: formatPhone(fullOrder.phone),
        cpf: fullOrder.delivery_company_id,
        metadata: {
          source: 'baselinker',
          external_id: orderData.order_id
        }
      })
      .select()
      .single()

    client = { data: newClient }

    // Enviar mensagem de boas-vindas
    await sendWelcomeMessage(newClient)
  }

  // 3. Criar pedido
  const { data: order } = await supabase
    .from('orders')
    .insert({
      workspace_id: workspaceId,
      client_id: client.data.id,
      external_id: orderData.order_id.toString(),
      order_id_base: orderData.order_id,
      total_amount: fullOrder.order_total_price_brutto,
      status: fullOrder.order_status_name,
      order_date: new Date(fullOrder.date_add * 1000),
      canal_venda: fullOrder.order_source,
      metadata: {
        baselinker_data: fullOrder
      }
    })
    .select()
    .single()

  // 4. Criar produtos do pedido
  for (const product of fullOrder.products) {
    await supabase
      .from('orders_products')
      .insert({
        order_id: order.id,
        order_base_id: orderData.order_id,
        nome_produto: product.name,
        sku: product.sku,
        quantidade_produtos: product.quantity,
        receita_bruta: product.price_brutto * product.quantity
      })
  }

  // 5. Triggers automáticos após criar pedido
  await triggerPostOrderActions(supabase, order, client.data)
}

async function triggerPostOrderActions(supabase: any, order: any, client: any) {
  // 1. Sugerir venda casada imediatamente
  await sendUpsellMessage(supabase, order, client)

  // 2. Agendar mensagem de recompra (baseado na duração dos produtos)
  await scheduleReorderMessage(supabase, order, client)

  // 3. Atualizar RFM do cliente
  await updateClientRFM(supabase, client.id)
}
```

### 5. Enviar Mensagem de Venda Casada (Imediato)

```typescript
async function sendUpsellMessage(supabase: any, order: any, client: any) {
  // 1. Buscar produtos do pedido
  const { data: orderProducts } = await supabase
    .from('orders_products')
    .select('sku, nome_produto')
    .eq('order_id', order.id)

  // 2. Encontrar produtos complementares (lógica de ML ou regras simples)
  const upsellProducts = await findUpsellProducts(orderProducts)

  if (upsellProducts.length === 0) return

  // 3. Montar mensagem
  const message = `
Olá ${client.name}! 👋

Obrigado pelo seu pedido #${order.order_id_base}!

Clientes que compraram os mesmos produtos também gostaram de:

${upsellProducts.map(p => `• ${p.name} - R$ ${p.price}`).join('\n')}

Quer aproveitar? 😊
  `.trim()

  // 4. Enviar via WhatsApp (Evolution API)
  await sendWhatsAppMessage(client.phone, message)

  // 5. Registrar mensagem enviada
  await supabase
    .from('messages')
    .insert({
      client_id: client.id,
      content: message,
      send_type: 'automated_upsell',
      status: 'sent',
      channel_type: 'whatsapp',
      sender_type: 'bot'
    })
}
```

### 6. Agendar Mensagem de Recompra (Para o futuro)

```typescript
async function scheduleReorderMessage(supabase: any, order: any, client: any) {
  // 1. Buscar produtos e suas durações
  const { data: orderProducts } = await supabase
    .from('orders_products')
    .select('*, products(duracao)')
    .eq('order_id', order.id)

  for (const orderProduct of orderProducts) {
    if (!orderProduct.products?.duracao) continue

    // 2. Calcular data de recompra: data_pedido + (duracao * quantidade) - 15 dias
    const orderDate = new Date(order.order_date)
    const durationDays = orderProduct.products.duracao * orderProduct.quantidade_produtos
    const reorderDate = new Date(orderDate)
    reorderDate.setDate(reorderDate.getDate() + durationDays - 15)

    // 3. Agendar mensagem
    await supabase
      .from('scheduled_messages')
      .insert({
        workspace_id: order.workspace_id,
        client_id: client.id,
        message_type: 'reorder',
        message_content: `
Olá ${client.name}!

O produto "${orderProduct.nome_produto}" que você comprou está acabando!
Quer fazer uma nova compra? 🛒
        `.trim(),
        scheduled_for: reorderDate,
        metadata: {
          order_id: order.id,
          product_sku: orderProduct.sku,
          original_order_date: order.order_date
        }
      })
  }
}
```

### 7. Cron Job: Enviar Mensagens Agendadas

Este é um dos poucos que **precisa** de cron (diário ou a cada hora):

```typescript
// supabase/functions/send-scheduled-messages/index.ts

serve(async (req) => {
  const supabase = createClient(...)

  // 1. Buscar mensagens para enviar agora
  const now = new Date()
  const { data: messages } = await supabase
    .from('scheduled_messages')
    .select('*, clients(*)')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())

  for (const msg of messages) {
    try {
      // 2. Enviar mensagem
      await sendWhatsAppMessage(msg.clients.phone, msg.message_content)

      // 3. Marcar como enviada
      await supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          sent_at: new Date()
        })
        .eq('id', msg.id)

      // 4. Registrar na tabela de mensagens
      await supabase
        .from('messages')
        .insert({
          client_id: msg.client_id,
          content: msg.message_content,
          send_type: `automated_${msg.message_type}`,
          status: 'sent',
          channel_type: 'whatsapp',
          sender_type: 'bot'
        })

    } catch (error) {
      await supabase
        .from('scheduled_messages')
        .update({ status: 'failed' })
        .eq('id', msg.id)
    }
  }

  return new Response(JSON.stringify({ sent: messages.length }))
})
```

---

## Outros Eventos Event-Driven

### Tracking de Encomendas (Entrega)

Já existe `tracking-automation` mas precisa melhorar:

```typescript
// Quando status muda para "Objeto entregue"
// Trigger automático na tabela purchases/transfers

CREATE OR REPLACE FUNCTION on_delivery_confirmed()
RETURNS TRIGGER AS $$
BEGIN
  -- Se entregue, processar estoque automaticamente
  IF NEW.status = 'Objeto entregue' AND OLD.status != 'Objeto entregue' THEN
    -- Chamar edge function para processar
    PERFORM net.http_post(
      url := 'https://[project].supabase.co/functions/v1/process-delivery',
      body := jsonb_build_object(
        'purchase_id', NEW.id,
        'type', TG_TABLE_NAME
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_purchase_delivery
AFTER UPDATE ON purchases
FOR EACH ROW
EXECUTE FUNCTION on_delivery_confirmed();

CREATE TRIGGER on_transfer_delivery
AFTER UPDATE ON transfers
FOR EACH ROW
EXECUTE FUNCTION on_delivery_confirmed();
```

### Estoque Baixo (Alerta)

Trigger quando estoque fica abaixo de limite:

```sql
CREATE OR REPLACE FUNCTION check_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.stock_es + NEW.stock_sp) < 10 AND (OLD.stock_es + OLD.stock_sp) >= 10 THEN
    -- Inserir na fila de notificações
    INSERT INTO notifications (
      workspace_id,
      type,
      title,
      message,
      metadata
    ) VALUES (
      NEW.workspace_id,
      'low_stock',
      'Estoque Baixo',
      'O produto ' || NEW.name || ' está com estoque baixo!',
      jsonb_build_object('product_id', NEW.id, 'sku', NEW.sku)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_product_stock
AFTER UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION check_low_stock();
```

---

## Cronograma de Implementação (Revisado)

### Fase 1: Infraestrutura (Semana 1)
- [ ] Criar tabelas: `event_queue`, `baselinker_sync_state`, `scheduled_messages`
- [ ] Implementar `baselinker-event-poller` (Edge Function)
- [ ] Implementar `process-event` (router principal)
- [ ] Configurar trigger PostgreSQL para processar eventos

### Fase 2: Eventos de Pedido (Semana 2)
- [ ] Processador: `order_created` (criar pedido + cliente)
- [ ] Processador: `payment_received`
- [ ] Processador: `status_changed`
- [ ] Trigger: mensagem de venda casada imediata
- [ ] Agendar: mensagem de recompra futura

### Fase 3: Eventos de Produto (Semana 3)
- [ ] Processador: `product_added`, `product_edited`, `product_removed`
- [ ] Processador: `invoice_created`
- [ ] Processador: `package_created` (rastreamento)

### Fase 4: Sincronização de Estoque (Semana 4)
- [ ] Cron job diário: sync completo de estoque (fallback)
- [ ] Event-driven: atualizar estoque ao receber/transferir
- [ ] Trigger: alerta de estoque baixo

### Fase 5: Mensagens Agendadas (Semana 5)
- [ ] Cron job: `send-scheduled-messages` (a cada hora)
- [ ] Interface: visualizar mensagens agendadas
- [ ] Interface: cancelar/editar mensagens

### Fase 6: Monitoramento (Semana 6)
- [ ] Dashboard: fila de eventos
- [ ] Dashboard: eventos falhados (retry manual)
- [ ] Dashboard: performance (tempo de processamento)
- [ ] Alertas: Slack/Email quando muitas falhas

### Fase 7: Testes & Transição (Semana 7-8)
- [ ] Rodar em paralelo com n8n
- [ ] Validar dados sincronizados
- [ ] Desligar n8n gradualmente

---

## Vantagens da Arquitetura Event-Driven

1. **⚡ Tempo Real**: Ações acontecem segundos após o evento
2. **💰 Custo**: Processa apenas o necessário (não polling constante)
3. **🔄 Resiliência**: Retry automático em falhas
4. **📊 Rastreabilidade**: Cada evento fica registrado
5. **🎯 Precisão**: Sem risco de perder eventos entre polls

---

## Próximos Passos

Quer que eu implemente a **Fase 1** agora? Posso criar:
1. As tabelas SQL
2. O event-poller básico
3. O processador de eventos com roteamento
4. O exemplo completo de `order_created`
