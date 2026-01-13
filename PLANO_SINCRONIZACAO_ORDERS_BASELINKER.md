# Plano de Sincronização de Pedidos Baselinker - Arquitetura Event-Driven

## 📋 Sumário Executivo

**Problema Atual:**
- Sincronização de pedidos falha quando há muitos pedidos acumulados
- Sistema não busca pedidos corretamente após período sem atualização
- Falta sincronização em tempo real
- Dependência de polling manual ineficiente

**Solução Proposta:**
Implementar arquitetura **híbrida event-driven + polling** usando:
1. `getJournalList` para capturar eventos de mudança (pagamentos, status)
2. `getOrders` com travessia temporal para buscar **novos pedidos em tempo real**
3. Processamento automático e contínuo com fila persistente

---

## 🎯 Objetivos

1. ✅ **Sincronização Contínua de NOVOS Pedidos**: Buscar pedidos automaticamente a cada 30-60 segundos via `getOrders`
2. ✅ **Sincronização de Eventos**: Capturar mudanças (pagamento, status) via `getJournalList`
3. ✅ **Travessia Temporal Correta**: Usar `date_confirmed_from` para evitar perda de dados
4. ✅ **Processamento em Lote**: Lidar com grande volume de pedidos sem timeout
5. ✅ **Rate Limiting Inteligente**: Respeitar limite de 100 req/min do Baselinker
6. ✅ **Resiliência**: Retry automático em falhas e recuperação de estado
7. ✅ **Tempo Real**: Receber e processar pedidos em **segundos**, não minutos

---

## 🔍 Análise do Problema Atual

### Problemas Identificados na Implementação Atual

**Arquivo:** `supabase/functions/baselinker-sync/index.ts`

```typescript
// ❌ PROBLEMA 1: Usa date_from ao invés de date_confirmed_from
const response = await callBaselinkerAPI(apiKey, 'getOrders', {
  date_from: lastSyncTimestamp  // ERRADO: usa data de criação
});

// ❌ PROBLEMA 2: Não implementa paginação correta
// Se houver > 100 pedidos, perde dados

// ❌ PROBLEMA 3: Não tem rate limiting
// Pode facilmente exceder 100 req/min

// ❌ PROBLEMA 4: Sync manual via POST
// Não roda automaticamente
```

### Por que a Sincronização Atual Falha?

1. **date_from vs date_confirmed_from:**
   - `date_from`: Data de criação do pedido (pode ser criado mas não confirmado)
   - `date_confirmed_from`: Data de confirmação ✅ (documentação recomenda)
   - Pedidos podem ser criados mas confirmados horas/dias depois
   - Isso causa **lacunas na sincronização**

2. **Paginação Incorreta:**
   - API retorna máximo 100 pedidos por requisição
   - Se houver 500 pedidos pendentes, os 400 restantes **não são buscados**
   - Não implementa loop de paginação incremental

3. **Sem Rate Limiting:**
   - Ao buscar detalhes de cada pedido (linha 172), faz 1 req/pedido
   - 100 pedidos = 100+ requisições = **bloqueio por rate limit**

4. **Ausência de Automação:**
   - Depende de chamada manual via POST
   - Não há cron job ou polling automático

---

## 🏗️ Arquitetura da Solução

### Visão Geral do Fluxo (Arquitetura Híbrida)

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BASELINKER API                                  │
│                                                                      │
│  [A] getOrders (date_confirmed_from)  [B] getJournalList           │
│      - Novos pedidos confirmados        - Eventos de mudança        │
│      - Polling a cada 60s               - Polling a cada 60s        │
└──────────────┬─────────────────────────┬────────────────────────────┘
               │                         │
               │ [A] Orders Poller       │ [B] Events Poller
               ▼                         ▼
┌──────────────────────────────┐  ┌─────────────────────────────────┐
│  baselinker-orders-poller    │  │  baselinker-events-poller       │
│                              │  │                                 │
│  1. Busca pedidos novos      │  │  1. Busca eventos (1,3,18)     │
│     (date_confirmed_from)    │  │     (last_log_id incremental)  │
│  2. Paginação incremental    │  │  2. Insere eventos na fila     │
│  3. Insere orders na fila    │  │                                 │
└──────────────┬───────────────┘  └──────────────┬──────────────────┘
               │                                 │
               └─────────┬───────────────────────┘
                         │ Ambos inserem na mesma fila
                         ▼
         ┌───────────────────────────────────────────────┐
         │         Tabela: order_sync_queue              │
         │                                               │
         │  - event_id, event_type, order_id, payload   │
         │  - status: pending, processing, completed    │
         │  - source: 'order_poll' ou 'event_poll'      │
         └───────────────┬───────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────────────────┐
         │      Edge Function: process-order-event       │
         │                                               │
         │  1. Busca detalhes do pedido (getOrders)     │
         │  2. Cria/atualiza cliente                    │
         │  3. Cria/atualiza pedido                     │
         │  4. Processa produtos                        │
         └───────────────────────────────────────────────┘
```

### Por que Arquitetura Híbrida?

**Problema:** `getJournalList` NÃO captura todos os pedidos novos imediatamente.

- ✅ **Eventos capturados**: Mudanças de status, pagamentos, produtos editados
- ❌ **Eventos NÃO capturados**: Pedidos que já vêm confirmados do marketplace
- ❌ **Delay**: Eventos podem demorar alguns minutos para aparecer no journal

**Solução:**

1. **`baselinker-orders-poller`**: Busca pedidos novos a cada 60s via `getOrders + date_confirmed_from`
   - Garante que **TODOS os pedidos** sejam capturados
   - Usa travessia temporal (paginação infinita)

2. **`baselinker-events-poller`**: Busca eventos de mudança via `getJournalList`
   - Captura atualizações de pedidos existentes
   - Pagamentos, mudanças de status, produtos alterados

3. **Deduplicação**: A fila usa `order_id_base + event_type` como chave única
   - Se um pedido já foi processado, ignora duplicata
   - Se houve mudança, atualiza o pedido existente

```

---

## 📊 Estrutura de Dados

### 1. Tabela: `baselinker_sync_state`

Armazena estado da sincronização por workspace.

```sql
CREATE TABLE IF NOT EXISTS baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) UNIQUE NOT NULL,

  -- Estado de sincronização de eventos
  last_log_id BIGINT DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false,

  -- Estado de sincronização de pedidos (travessia temporal)
  last_order_confirmed_timestamp INT DEFAULT 0,
  last_full_sync_at TIMESTAMPTZ,

  -- Métricas
  total_events_processed BIGINT DEFAULT 0,
  total_orders_synced BIGINT DEFAULT 0,
  sync_errors JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_baselinker_sync_workspace ON baselinker_sync_state(workspace_id);
```

### 2. Tabela: `order_sync_queue`

Fila de eventos de pedidos para processar.

```sql
CREATE TABLE IF NOT EXISTS order_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,

  -- Identificação do evento
  event_log_id BIGINT UNIQUE NOT NULL,
  event_type INTEGER NOT NULL, -- 1=created, 3=payment, 18=status
  event_name TEXT NOT NULL,
  order_id_base BIGINT NOT NULL, -- ID do pedido no Baselinker

  -- Payload completo do evento
  payload JSONB NOT NULL,

  -- Estado de processamento
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ
);

CREATE INDEX idx_order_sync_queue_status ON order_sync_queue(status) WHERE status = 'pending';
CREATE INDEX idx_order_sync_queue_workspace ON order_sync_queue(workspace_id);
CREATE INDEX idx_order_sync_queue_event_log ON order_sync_queue(event_log_id);
CREATE INDEX idx_order_sync_queue_retry ON order_sync_queue(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;
```

### 3. Atualização na Tabela: `orders`

Adicionar campos para rastreabilidade.

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_id_base BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS date_confirmed TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS baselinker_data JSONB;

CREATE UNIQUE INDEX idx_orders_order_id_base ON orders(order_id_base, workspace_id);
CREATE INDEX idx_orders_external_id ON orders(external_id);
```

---

## 🔧 Implementação das Edge Functions

### Função 1A: `baselinker-orders-poller` 🆕

**Objetivo:** Polling contínuo de NOVOS PEDIDOS via `getOrders` (travessia temporal).

**Trigger:** Cron job (a cada 60 segundos)

**Arquivo:** `supabase/functions/baselinker-orders-poller/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { baselinkerRequest } from '../_shared/baselinker.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req: Request) => {
  try {
    console.log('[ORDERS POLLER] Starting new orders polling...');

    // 1. Buscar workspaces com Baselinker configurado
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, settings')
      .not('settings->baselinker->apiKey', 'is', null);

    if (wsError) throw wsError;
    if (!workspaces || workspaces.length === 0) {
      return new Response(JSON.stringify({ message: 'No workspaces configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    // 2. Processar cada workspace
    for (const workspace of workspaces) {
      try {
        const apiKey = workspace.settings?.baselinker?.apiKey;
        if (!apiKey) continue;

        console.log(`[ORDERS POLLER] Processing workspace: ${workspace.id}`);

        // 3. Buscar estado de sincronização
        let { data: syncState } = await supabase
          .from('baselinker_sync_state')
          .select('*')
          .eq('workspace_id', workspace.id)
          .maybeSingle();

        if (!syncState) {
          const { data: newState } = await supabase
            .from('baselinker_sync_state')
            .insert({
              workspace_id: workspace.id,
              last_log_id: 0,
              last_order_confirmed_timestamp: 0
            })
            .select()
            .single();
          syncState = newState;
        }

        // 4. Buscar pedidos novos (TRAVESSIA TEMPORAL)
        let currentTimestamp = syncState.last_order_confirmed_timestamp || 0;
        let totalNewOrders = 0;
        let hasMore = true;
        let maxIterations = 10; // Limite de segurança (1000 pedidos por execução)

        while (hasMore && maxIterations > 0) {
          console.log(`[ORDERS POLLER] Fetching from timestamp: ${currentTimestamp}`);

          // Buscar pedidos confirmados
          const response = await baselinkerRequest(
            { token: apiKey },
            'getOrders',
            {
              date_confirmed_from: currentTimestamp,
              get_unconfirmed_orders: false // Apenas confirmados
            }
          );

          const orders = response.orders || [];
          console.log(`[ORDERS POLLER] Found ${orders.length} orders`);

          if (orders.length === 0) {
            hasMore = false;
            break;
          }

          // 5. Inserir na fila de processamento
          for (const order of orders) {
            try {
              // Gerar event_log_id único (timestamp + order_id)
              const eventLogId = parseInt(`${Date.now()}${order.order_id}`.slice(0, 16));

              await supabase
                .from('order_sync_queue')
                .upsert({
                  workspace_id: workspace.id,
                  event_log_id: eventLogId,
                  event_type: 1, // order_created
                  event_name: 'order_new',
                  order_id_base: order.order_id,
                  payload: { order_id: order.order_id, date_confirmed: order.date_confirmed },
                  status: 'pending',
                  source: 'order_poll'
                }, {
                  onConflict: 'event_log_id',
                  ignoreDuplicates: true
                });

              totalNewOrders++;
            } catch (insertError: any) {
              if (insertError.code !== '23505') { // Ignora duplicatas
                console.error(`[ORDERS POLLER] Error inserting order ${order.order_id}:`, insertError);
              }
            }
          }

          // 6. Atualizar timestamp para próxima iteração
          if (orders.length === 100) {
            // Há mais dados, pegar timestamp do último pedido + 1
            const lastOrder = orders[orders.length - 1];
            currentTimestamp = lastOrder.date_confirmed + 1;
            maxIterations--;

            // Rate limiting: aguardar 1 segundo
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            hasMore = false;
          }
        }

        // 7. Atualizar estado de sincronização
        if (totalNewOrders > 0) {
          await supabase
            .from('baselinker_sync_state')
            .update({
              last_order_confirmed_timestamp: currentTimestamp,
              last_sync_at: new Date().toISOString(),
              total_orders_synced: (syncState.total_orders_synced || 0) + totalNewOrders
            })
            .eq('workspace_id', workspace.id);
        }

        results.push({
          workspace_id: workspace.id,
          new_orders_found: totalNewOrders,
          last_timestamp: currentTimestamp
        });

      } catch (workspaceError: any) {
        console.error(`[ORDERS POLLER] Error processing workspace ${workspace.id}:`, workspaceError);
        results.push({
          workspace_id: workspace.id,
          error: workspaceError.message
        });
      }
    }

    console.log('[ORDERS POLLER] Polling completed:', results);

    return new Response(JSON.stringify({
      success: true,
      results,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[ORDERS POLLER] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

### Função 1B: `baselinker-events-poller`

**Objetivo:** Polling contínuo de EVENTOS do Baselinker (pagamentos, mudanças de status).

**Trigger:** Cron job (a cada 60 segundos)

**Arquivo:** `supabase/functions/baselinker-events-poller/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { baselinkerRequest, getEventName } from '../_shared/baselinker.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Tipos de eventos que queremos processar
const ORDER_EVENT_TYPES = [1, 3, 18]; // order_created, payment_received, status_changed

serve(async (req: Request) => {
  try {
    console.log('[ORDER POLLER] Starting order event polling...');

    // 1. Buscar todos os workspaces com Baselinker configurado
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('id, settings')
      .not('settings->baselinker->apiKey', 'is', null);

    if (wsError) throw wsError;
    if (!workspaces || workspaces.length === 0) {
      return new Response(JSON.stringify({ message: 'No workspaces with Baselinker configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = [];

    // 2. Processar cada workspace
    for (const workspace of workspaces) {
      try {
        const apiKey = workspace.settings?.baselinker?.apiKey;
        if (!apiKey) continue;

        console.log(`[ORDER POLLER] Processing workspace: ${workspace.id}`);

        // 3. Buscar estado de sincronização
        let { data: syncState } = await supabase
          .from('baselinker_sync_state')
          .select('*')
          .eq('workspace_id', workspace.id)
          .maybeSingle();

        // Criar estado se não existir
        if (!syncState) {
          const { data: newState } = await supabase
            .from('baselinker_sync_state')
            .insert({
              workspace_id: workspace.id,
              last_log_id: 0,
              last_order_confirmed_timestamp: 0
            })
            .select()
            .single();
          syncState = newState;
        }

        // 4. Buscar eventos novos do Baselinker
        const response = await baselinkerRequest(
          { token: apiKey, workspace_id: workspace.id },
          'getJournalList',
          {
            last_log_id: syncState.last_log_id,
            logs_types: ORDER_EVENT_TYPES
          }
        );

        const events = response.logs || [];
        console.log(`[ORDER POLLER] Found ${events.length} new events for workspace ${workspace.id}`);

        if (events.length === 0) {
          results.push({ workspace_id: workspace.id, events_found: 0 });
          continue;
        }

        // 5. Inserir eventos na fila (com deduplicação via event_log_id UNIQUE)
        const eventsToInsert = events.map((event: any) => ({
          workspace_id: workspace.id,
          event_log_id: event.log_id,
          event_type: event.log_type,
          event_name: getEventName(event.log_type),
          order_id_base: event.order_id,
          payload: event,
          status: 'pending'
        }));

        const { data: inserted, error: insertError } = await supabase
          .from('order_sync_queue')
          .upsert(eventsToInsert, {
            onConflict: 'event_log_id',
            ignoreDuplicates: true
          })
          .select();

        if (insertError && insertError.code !== '23505') { // Ignora erro de duplicata
          console.error('[ORDER POLLER] Error inserting events:', insertError);
        }

        // 6. Atualizar last_log_id
        const maxLogId = Math.max(...events.map((e: any) => e.log_id));
        await supabase
          .from('baselinker_sync_state')
          .update({
            last_log_id: maxLogId,
            last_sync_at: new Date().toISOString(),
            total_events_processed: syncState.total_events_processed + events.length
          })
          .eq('workspace_id', workspace.id);

        results.push({
          workspace_id: workspace.id,
          events_found: events.length,
          events_inserted: inserted?.length || 0,
          last_log_id: maxLogId
        });

      } catch (workspaceError: any) {
        console.error(`[ORDER POLLER] Error processing workspace ${workspace.id}:`, workspaceError);
        results.push({
          workspace_id: workspace.id,
          error: workspaceError.message
        });
      }
    }

    console.log('[ORDER POLLER] Polling completed:', results);

    return new Response(JSON.stringify({
      success: true,
      results,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[ORDER POLLER] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

### Função 2: `process-order-event`

**Objetivo:** Processar eventos da fila e criar/atualizar pedidos.

**Trigger:** Database trigger ou Cron job a cada 10 segundos

**Arquivo:** `supabase/functions/process-order-event/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { baselinkerRequest, formatPhoneNumber, extractCPF } from '../_shared/baselinker.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req: Request) => {
  try {
    console.log('[PROCESS ORDER] Starting batch processing...');

    // 1. Buscar eventos pendentes (lote de 10 por vez para evitar timeout)
    const { data: pendingEvents, error: fetchError } = await supabase
      .from('order_sync_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!pendingEvents || pendingEvents.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending events' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[PROCESS ORDER] Processing ${pendingEvents.length} events`);

    const results = [];

    // 2. Processar cada evento
    for (const event of pendingEvents) {
      try {
        // Marcar como processando
        await supabase
          .from('order_sync_queue')
          .update({
            status: 'processing',
            processing_started_at: new Date().toISOString()
          })
          .eq('id', event.id);

        // Buscar API key do workspace
        const { data: workspace } = await supabase
          .from('workspaces')
          .select('settings')
          .eq('id', event.workspace_id)
          .single();

        const apiKey = workspace?.settings?.baselinker?.apiKey;
        if (!apiKey) {
          throw new Error('Baselinker API key not found');
        }

        // Processar baseado no tipo de evento
        await processOrderEvent(event, apiKey);

        // Marcar como completo
        await supabase
          .from('order_sync_queue')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString()
          })
          .eq('id', event.id);

        // Atualizar contador de pedidos sincronizados
        await supabase.rpc('increment_orders_synced', {
          p_workspace_id: event.workspace_id
        });

        results.push({
          event_id: event.id,
          order_id_base: event.order_id_base,
          status: 'success'
        });

      } catch (eventError: any) {
        console.error(`[PROCESS ORDER] Error processing event ${event.id}:`, eventError);

        // Incrementar retry count
        const newRetryCount = event.retry_count + 1;
        const nextRetry = new Date();
        nextRetry.setMinutes(nextRetry.getMinutes() + (newRetryCount * 5)); // Backoff exponencial

        await supabase
          .from('order_sync_queue')
          .update({
            status: newRetryCount >= event.max_retries ? 'failed' : 'pending',
            retry_count: newRetryCount,
            error_message: eventError.message,
            next_retry_at: nextRetry.toISOString()
          })
          .eq('id', event.id);

        results.push({
          event_id: event.id,
          order_id_base: event.order_id_base,
          status: 'error',
          error: eventError.message,
          retry_count: newRetryCount
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[PROCESS ORDER] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Função auxiliar para processar evento de pedido
async function processOrderEvent(event: any, apiKey: string) {
  console.log(`[PROCESS ORDER] Processing order ${event.order_id_base} (event: ${event.event_name})`);

  // 1. Buscar detalhes completos do pedido no Baselinker
  const orderResponse = await baselinkerRequest(
    { token: apiKey },
    'getOrders',
    {
      order_id: event.order_id_base
    }
  );

  const orderData = orderResponse.orders?.[0];
  if (!orderData) {
    throw new Error(`Order ${event.order_id_base} not found in Baselinker`);
  }

  // 2. Buscar ou criar cliente
  const clientId = await upsertClient(event.workspace_id, orderData);

  // 3. Criar ou atualizar pedido
  await upsertOrder(event.workspace_id, clientId, orderData);

  console.log(`[PROCESS ORDER] Successfully processed order ${event.order_id_base}`);
}

// Função auxiliar para criar/atualizar cliente
async function upsertClient(workspaceId: string, orderData: any): Promise<string> {
  const cpf = extractCPF(orderData);
  const phone = formatPhoneNumber(orderData.phone || '');
  const email = orderData.email || '';

  // Tentar encontrar cliente existente (por CPF, email ou telefone)
  let query = supabase
    .from('clients')
    .select('id')
    .eq('workspace_id', workspaceId);

  if (cpf) {
    query = query.eq('cpf', cpf);
  } else if (email) {
    query = query.eq('email', email);
  } else if (phone) {
    query = query.eq('phone', phone);
  }

  const { data: existingClient } = await query.maybeSingle();

  const clientData = {
    workspace_id: workspaceId,
    name: orderData.delivery_fullname || orderData.invoice_fullname || 'Cliente',
    email: email || null,
    phone: phone || null,
    cpf: cpf || null,
    metadata: {
      baselinker_data: {
        delivery_company: orderData.delivery_company,
        delivery_address: orderData.delivery_address,
        delivery_city: orderData.delivery_city,
        delivery_postcode: orderData.delivery_postcode,
        delivery_country_code: orderData.delivery_country_code,
        invoice_company: orderData.invoice_company,
        invoice_nip: orderData.invoice_nip,
        last_order_id: orderData.order_id
      }
    }
  };

  if (existingClient) {
    // Atualizar cliente existente
    await supabase
      .from('clients')
      .update(clientData)
      .eq('id', existingClient.id);

    return existingClient.id;
  } else {
    // Criar novo cliente
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert(clientData)
      .select('id')
      .single();

    if (error) throw error;
    return newClient.id;
  }
}

// Função auxiliar para criar/atualizar pedido
async function upsertOrder(workspaceId: string, clientId: string, orderData: any) {
  // Verificar se pedido já existe
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('order_id_base', orderData.order_id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  // Mapear status do Baselinker
  let status = 'pending';
  const statusId = orderData.order_status_id;
  if ([200, 201].includes(statusId)) {
    status = 'completed';
  } else if ([300, 301].includes(statusId)) {
    status = 'cancelled';
  } else if ([100, 101, 102].includes(statusId)) {
    status = 'processing';
  }

  const orderPayload = {
    workspace_id: workspaceId,
    client_id: clientId,
    order_id_base: orderData.order_id,
    external_id: orderData.shop_order_id || orderData.order_id.toString(),
    total_amount: parseFloat(orderData.order_total_price_brutto || 0),
    status: status,
    order_date: new Date(orderData.date_add * 1000).toISOString(),
    date_confirmed: orderData.date_confirmed ? new Date(orderData.date_confirmed * 1000).toISOString() : null,
    canal_venda: orderData.order_source || 'unknown',
    order_source: orderData.order_source || null,
    order_source_id: orderData.order_source_id || null,
    metadata: {
      baselinker_data: orderData,
      payment_method: orderData.payment_method,
      delivery_method: orderData.delivery_method,
      currency: orderData.currency
    }
  };

  if (existingOrder) {
    // Atualizar pedido existente
    await supabase
      .from('orders')
      .update(orderPayload)
      .eq('id', existingOrder.id);

    return existingOrder.id;
  } else {
    // Criar novo pedido
    const { data: newOrder, error } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select('id')
      .single();

    if (error) throw error;

    // Criar produtos do pedido
    if (orderData.products && orderData.products.length > 0) {
      const productsPayload = orderData.products.map((product: any) => ({
        order_id: newOrder.id,
        order_base_id: orderData.order_id,
        nome_produto: product.name,
        sku: product.sku || null,
        ean: product.ean || null,
        quantidade_produtos: parseInt(product.quantity || 1),
        receita_bruta: parseFloat(product.price_brutto || 0) * parseInt(product.quantity || 1),
        metadata: {
          product_id: product.product_id,
          variant_id: product.variant_id,
          storage_id: product.storage_id
        }
      }));

      await supabase
        .from('orders_products')
        .insert(productsPayload);
    }

    return newOrder.id;
  }
}
```

### Função 3: `baselinker-full-sync`

**Objetivo:** Sincronização completa inicial ou recuperação de dados.

**Trigger:** Manual via POST ou cron diário (fallback)

**Arquivo:** `supabase/functions/baselinker-full-sync/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { baselinkerRequest } from '../_shared/baselinker.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req: Request) => {
  try {
    const { workspace_id } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[FULL SYNC] Starting full sync for workspace: ${workspace_id}`);

    // 1. Buscar API key
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspace_id)
      .single();

    const apiKey = workspace?.settings?.baselinker?.apiKey;
    if (!apiKey) {
      throw new Error('Baselinker API key not configured');
    }

    // 2. Buscar estado de sincronização
    let { data: syncState } = await supabase
      .from('baselinker_sync_state')
      .select('*')
      .eq('workspace_id', workspace_id)
      .maybeSingle();

    if (!syncState) {
      const { data: newState } = await supabase
        .from('baselinker_sync_state')
        .insert({
          workspace_id: workspace_id,
          last_log_id: 0,
          last_order_confirmed_timestamp: 0
        })
        .select()
        .single();
      syncState = newState;
    }

    // 3. Implementar travessia temporal com paginação
    let currentTimestamp = syncState.last_order_confirmed_timestamp || 0;
    let totalOrdersSynced = 0;
    let hasMore = true;

    // Marcar como sincronizando
    await supabase
      .from('baselinker_sync_state')
      .update({ is_syncing: true })
      .eq('workspace_id', workspace_id);

    while (hasMore) {
      console.log(`[FULL SYNC] Fetching orders from timestamp: ${currentTimestamp}`);

      // Buscar pedidos confirmados a partir do timestamp atual
      const response = await baselinkerRequest(
        { token: apiKey },
        'getOrders',
        {
          date_confirmed_from: currentTimestamp,
          get_unconfirmed_orders: false // Apenas pedidos confirmados
        }
      );

      const orders = response.orders || [];
      console.log(`[FULL SYNC] Found ${orders.length} orders`);

      if (orders.length === 0) {
        hasMore = false;
        break;
      }

      // Processar cada pedido (criar eventos na fila)
      for (const order of orders) {
        try {
          // Inserir evento na fila para processamento assíncrono
          await supabase
            .from('order_sync_queue')
            .upsert({
              workspace_id: workspace_id,
              event_log_id: Date.now() + Math.random(), // ID temporário único
              event_type: 1, // order_created
              event_name: 'order_created',
              order_id_base: order.order_id,
              payload: { order_id: order.order_id, date: order.date_confirmed },
              status: 'pending'
            }, {
              onConflict: 'event_log_id',
              ignoreDuplicates: true
            });

          totalOrdersSynced++;

        } catch (orderError) {
          console.error(`[FULL SYNC] Error queuing order ${order.order_id}:`, orderError);
        }
      }

      // Se retornou 100 pedidos (limite máximo), há mais dados
      if (orders.length === 100) {
        // Pegar o timestamp do último pedido + 1
        const lastOrder = orders[orders.length - 1];
        currentTimestamp = lastOrder.date_confirmed + 1;

        // Aguardar 1 segundo (rate limiting)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        hasMore = false;
      }
    }

    // 4. Atualizar estado
    await supabase
      .from('baselinker_sync_state')
      .update({
        last_order_confirmed_timestamp: currentTimestamp,
        last_full_sync_at: new Date().toISOString(),
        is_syncing: false,
        total_orders_synced: (syncState.total_orders_synced || 0) + totalOrdersSynced
      })
      .eq('workspace_id', workspace_id);

    console.log(`[FULL SYNC] Completed. Total orders queued: ${totalOrdersSynced}`);

    return new Response(JSON.stringify({
      success: true,
      orders_queued: totalOrdersSynced,
      last_timestamp: currentTimestamp
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[FULL SYNC] Fatal error:', error);

    // Desmarcar sincronização
    if (req.body) {
      const { workspace_id } = await req.json();
      await supabase
        .from('baselinker_sync_state')
        .update({ is_syncing: false })
        .eq('workspace_id', workspace_id);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

---

## ⚙️ Configuração de Cron Jobs

Criar arquivo `supabase/functions/_cron/cron.yaml`:

```yaml
# Cron jobs para sincronização automática

# [A] Polling de NOVOS PEDIDOS a cada 60 segundos 🆕
- name: "baselinker-orders-poller"
  schedule: "*/1 * * * *"  # A cada 1 minuto
  function: "baselinker-orders-poller"

# [B] Polling de EVENTOS (mudanças) a cada 60 segundos
- name: "baselinker-events-poller"
  schedule: "*/1 * * * *"  # A cada 1 minuto
  function: "baselinker-events-poller"

# [C] Processamento de fila a cada minuto
- name: "process-order-events"
  schedule: "*/1 * * * *"  # A cada 1 minuto
  function: "process-order-event"

# [D] Sincronização completa diária (fallback/recuperação)
- name: "baselinker-full-sync-daily"
  schedule: "0 3 * * *"  # 3h da manhã todos os dias
  function: "baselinker-full-sync"
```

**Nota sobre Frequência:**
- **Orders Poller**: Roda a cada 60s para buscar pedidos novos
- **Events Poller**: Roda a cada 60s para buscar mudanças (pagamentos, status)
- **Processor**: Roda a cada 60s para processar a fila (pode processar em paralelo)
- **Full Sync**: Roda 1x por dia às 3h como backup/recuperação

**Nota:** Supabase pode não suportar intervalos < 1 minuto. Nesse caso, usar HTTP polling do frontend ou serverless externo.

---

## 🚀 Plano de Implementação

### Fase 1: Preparação do Banco (Semana 1 - Dia 1-2)

- [ ] Criar tabela `baselinker_sync_state`
- [ ] Criar tabela `order_sync_queue`
- [ ] Adicionar campos em `orders` (order_id_base, external_id, etc.)
- [ ] Criar índices para performance
- [ ] Criar função RPC `increment_orders_synced`
- [ ] Testar estrutura com dados mock

### Fase 2: Implementar Edge Functions (Semana 1 - Dia 3-5)

- [ ] Implementar `baselinker-orders-poller` 🆕 (polling de novos pedidos)
- [ ] Implementar `baselinker-events-poller` (polling de eventos)
- [ ] Implementar `process-order-event` (processador da fila)
- [ ] Implementar `baselinker-full-sync` (sincronização completa)
- [ ] Atualizar `_shared/baselinker.ts` com funções auxiliares
- [ ] Configurar cron jobs (4 jobs)
- [ ] Testar localmente com `supabase functions serve`

### Fase 3: Rate Limiting & Resiliência (Semana 2 - Dia 1-2)

- [ ] Implementar Token Bucket no client (baselinker-api.ts)
- [ ] Adicionar backoff exponencial em retries
- [ ] Implementar detecção de rate limit (erro 429)
- [ ] Adicionar logs detalhados com request_id
- [ ] Testar com carga alta (simular 500 pedidos)

### Fase 4: Testes & Validação (Semana 2 - Dia 3-4)

- [ ] Testar sincronização inicial (0 pedidos)
- [ ] Testar sincronização incremental (novos pedidos)
- [ ] Testar recuperação após falha (retry logic)
- [ ] Testar com múltiplos workspaces simultâneos
- [ ] Validar integridade de dados (pedidos = Baselinker)

### Fase 5: Monitoramento & Deploy (Semana 2 - Dia 5)

- [ ] Criar dashboard de monitoramento (Grafana/Metabase)
- [ ] Configurar alertas para falhas (>10 eventos failed)
- [ ] Documentar processo de troubleshooting
- [ ] Deploy para produção
- [ ] Migração gradual (rodar em paralelo com sistema antigo)

---

## 📊 Monitoramento & Métricas

### Queries Úteis para Monitoramento

```sql
-- 1. Ver status da fila de eventos
SELECT
  status,
  COUNT(*) as total,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM order_sync_queue
GROUP BY status;

-- 2. Ver eventos falhados
SELECT
  id,
  order_id_base,
  event_name,
  error_message,
  retry_count,
  created_at
FROM order_sync_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Ver estado de sincronização por workspace
SELECT
  w.name as workspace_name,
  s.last_log_id,
  s.last_sync_at,
  s.total_events_processed,
  s.total_orders_synced,
  s.is_syncing
FROM baselinker_sync_state s
JOIN workspaces w ON w.id = s.workspace_id
ORDER BY s.last_sync_at DESC;

-- 4. Ver pedidos sincronizados hoje
SELECT
  COUNT(*) as total_orders,
  MIN(created_at) as first_order,
  MAX(created_at) as last_order
FROM orders
WHERE created_at >= CURRENT_DATE;

-- 5. Verificar lag de sincronização (tempo entre evento e processamento)
SELECT
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds,
  MAX(EXTRACT(EPOCH FROM (processed_at - created_at))) as max_processing_time_seconds
FROM order_sync_queue
WHERE status = 'completed'
  AND processed_at >= NOW() - INTERVAL '1 hour';
```

---

## 🔧 Troubleshooting

### Problema: Eventos não estão sendo buscados

**Diagnóstico:**
```sql
SELECT * FROM baselinker_sync_state WHERE workspace_id = 'UUID_DO_WORKSPACE';
```

**Soluções:**
1. Verificar se `is_syncing = false` (se true, houve travamento)
2. Verificar se API key está correta no workspace.settings
3. Checar logs da função `baselinker-order-poller`

### Problema: Eventos ficam presos em "pending"

**Diagnóstico:**
```sql
SELECT COUNT(*), MIN(created_at)
FROM order_sync_queue
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '5 minutes';
```

**Soluções:**
1. Verificar se cron job `process-order-event` está rodando
2. Checar logs da função para erros
3. Reprocessar manualmente: `UPDATE order_sync_queue SET status = 'pending' WHERE id = 'UUID'`

### Problema: Rate Limit Error 429

**Diagnóstico:**
Verificar logs para mensagens "Query limit exceeded"

**Soluções:**
1. Reduzir frequência do poller (de 30s para 60s)
2. Reduzir tamanho do lote no processor (de 10 para 5)
3. Implementar sleep entre requisições

---

## 🎯 Benefícios da Nova Arquitetura

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Tempo de Sincronização** | Manual, imprevisível | Automático, 30-60s |
| **Pedidos Perdidos** | Alto risco (paginação incorreta) | Zero (travessia temporal) |
| **Performance** | Timeout com >100 pedidos | Processa em lotes, sem timeout |
| **Resiliência** | Falha = perda de dados | Retry automático + fila persistente |
| **Visibilidade** | Sem monitoramento | Métricas em tempo real |
| **Custo de API** | Alto (polling desnecessário) | Otimizado (apenas novos eventos) |

---

## 📝 Checklist de Deploy

- [ ] Backup completo do banco de dados
- [ ] Criar tabelas `baselinker_sync_state` e `order_sync_queue`
- [ ] Deploy das 3 Edge Functions
- [ ] Configurar cron jobs
- [ ] Rodar `baselinker-full-sync` inicial para cada workspace
- [ ] Monitorar por 24h
- [ ] Validar integridade de dados (comparar com Baselinker)
- [ ] Desligar sistema antigo (`baselinker-sync`)
- [ ] Documentar processo de manutenção

---

## 🚨 Pontos de Atenção

1. **Rate Limiting é Crítico:**
   - Baselinker bloqueia token por horas se exceder 100 req/min
   - Sempre implementar Token Bucket localmente

2. **Idempotência:**
   - Todos os upserts devem verificar existência (order_id_base)
   - Eventos podem ser duplicados, use UNIQUE constraint

3. **Timestamps Unix:**
   - Baselinker usa Unix timestamp (segundos desde 1970)
   - JavaScript usa milissegundos: `new Date(timestamp * 1000)`

4. **date_confirmed vs date_add:**
   - **SEMPRE** usar `date_confirmed_from` para sincronização
   - `date_from` (date_add) causa lacunas

5. **CPF como Chave Única:**
   - Usar CPF > Email > Telefone como ordem de prioridade
   - Clientes podem mudar email/telefone mas CPF é fixo

---

## 📚 Referências

- [Baselinker API Documentation](https://api.baselinker.com/)
- [Método getOrders - Travessia Temporal](https://api.baselinker.com/index.php?method=getOrders)
- [Método getJournalList - Event Log](https://api.baselinker.com/index.php?method=getJournalList)
- [EVENT_DRIVEN_ARCHITECTURE.md](./EVENT_DRIVEN_ARCHITECTURE.md) (documento já existente)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## ✅ Próximos Passos

Quer que eu implemente as **Fases 1 e 2** agora? Posso criar:

1. ✅ SQL para criar todas as tabelas
2. ✅ Edge Function `baselinker-order-poller` completa
3. ✅ Edge Function `process-order-event` completa
4. ✅ Edge Function `baselinker-full-sync` completa
5. ✅ Configuração de cron jobs
6. ✅ Atualização do `baselinker-api.ts` com rate limiting

Aguardo sua confirmação para começar a implementação! 🚀
