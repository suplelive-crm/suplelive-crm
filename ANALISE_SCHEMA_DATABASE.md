# 🔍 Análise do Schema do Banco de Dados

**Data da Análise**: 23/12/2025

---

## ✅ VERIFICAÇÃO COMPLETA

Análise do schema atual comparado com as implementações realizadas.

---

## 📊 Status das Tabelas Principais

### ✅ 1. Tabela: `message_templates`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.message_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  template_type text NOT NULL CHECK (template_type = ANY (ARRAY['welcome'::text, 'upsell'::text, 'reorder'::text])),
  template_content text NOT NULL,
  variables text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  send_config jsonb DEFAULT '{}'::jsonb,        -- ✅ PRESENTE
  filter_config jsonb DEFAULT '{}'::jsonb,      -- ✅ PRESENTE
  CONSTRAINT message_templates_pkey PRIMARY KEY (id),
  CONSTRAINT message_templates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
```

**Colunas Verificadas**:
- ✅ `send_config` - Configurações de timing (immediate, delayed, before_end)
- ✅ `filter_config` - Filtros (exclude_channels, min/max values, etc.)
- ✅ `template_type` - CHECK constraint com 'welcome', 'upsell', 'reorder'

**Conclusão**: Tabela está completa com todas as colunas necessárias para templates avançados.

---

### ✅ 2. Tabela: `orders`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  total_amount numeric NOT NULL DEFAULT 0,
  order_date timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  external_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  order_id_base numeric,
  mensagem_enviada boolean DEFAULT false,        -- ✅ PRESENTE
  atualizado_chatwoot timestamp with time zone,
  canal_venda text,                              -- ✅ PRESENTE (Baselinker order_source)
  taxas real,
  id_anuncio text,
  conta text,
  id_pedido_marktplace text,
  faturamento_liquido real,
  "custo_frete(taxa)" real,
  produtos_order boolean DEFAULT false,
  metadata_feita boolean NOT NULL DEFAULT false,
  cpf text,
  workspace_id uuid NOT NULL,
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
```

**Colunas Verificadas**:
- ✅ `mensagem_enviada` - Marca se mensagem de upsell foi enviada
- ✅ `canal_venda` - Canal de origem do pedido (Baselinker `order_source`)

**Uso na Automação**:
```typescript
// Atualizado em: sendUpsellMessage()
await supabase
  .from('orders')
  .update({
    mensagem_enviada: true,
    updated_at: new Date().toISOString()
  })
  .eq('id', order.id);
```

**Conclusão**: Tabela está correta e sendo utilizada pela automação.

---

### ✅ 3. Tabela: `orders_products`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.orders_products (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  order_id uuid DEFAULT gen_random_uuid(),
  nome_produto text,
  sku text,
  custo_medio_produto real,
  order_base_id numeric,
  quantidade_produtos numeric,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faturamento_liquido numeric,
  receita_bruta numeric,
  taxas_produto numeric,
  envio_duracao date,
  mensagem_recompra boolean DEFAULT false,       -- ✅ PRESENTE
  CONSTRAINT orders_products_pkey PRIMARY KEY (id)
);
```

**Colunas Verificadas**:
- ✅ `mensagem_recompra` - Marca se mensagem de recompra foi agendada para este produto

**Uso na Automação**:
```typescript
// Atualizado em: scheduleReorderMessages()
await supabase
  .from('orders_products')
  .update({ mensagem_recompra: true })
  .eq('order_id', order.id)
  .eq('sku', product.sku);
```

**Conclusão**: Tabela está correta e sendo utilizada pela automação.

---

### ✅ 4. Tabela: `scheduled_messages`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.scheduled_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  client_id uuid NOT NULL,
  message_type text NOT NULL CHECK (message_type = ANY (ARRAY['reorder'::text, 'upsell'::text, 'follow_up'::text, 'welcome'::text, 'custom'::text])),
  message_content text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  sent_at timestamp with time zone,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT scheduled_messages_pkey PRIMARY KEY (id),
  CONSTRAINT scheduled_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT scheduled_messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id)
);
```

**Campos Verificados**:
- ✅ `message_type` - Inclui 'reorder' no CHECK constraint
- ✅ `message_content` - Armazena template já processado
- ✅ `status` - Controla estado da mensagem ('pending', 'sent', 'failed')
- ✅ `metadata` - JSONB para dados adicionais (order_id, product_sku, etc.)

**Uso na Automação**:
```typescript
// Inserido em: scheduleReorderMessages()
await supabase.from('scheduled_messages').insert({
  workspace_id: workspaceId,
  client_id: client.id,
  message_type: 'reorder',
  message_content: message, // Template processado
  scheduled_for: reorderDate.toISOString(),
  status: 'pending',
  metadata: {
    order_id: order.id,
    product_sku: product.sku,
    product_name: productData.name,
    duration_days: durationDays
  }
});
```

**Conclusão**: Tabela está correta e sendo utilizada pela automação.

---

### ✅ 5. Tabela: `messages`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  content text NOT NULL,
  send_type text DEFAULT 'manual'::text,         -- ✅ Suporta 'automated_welcome', 'automated_upsell', 'automated_reorder'
  status text DEFAULT 'pending'::text,
  timestamp timestamp with time zone DEFAULT now(),
  conversation_id uuid,
  channel_type text DEFAULT 'whatsapp'::text,
  sender_type text DEFAULT 'user'::text,         -- ✅ Suporta 'bot'
  external_id text,
  metadata jsonb DEFAULT '{}'::jsonb,            -- ✅ Armazena dados adicionais
  read_at timestamp with time zone,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id)
);
```

**Campos Verificados**:
- ✅ `send_type` - Registra tipo de mensagem automática
- ✅ `sender_type` - Identifica se é 'bot' ou 'user'
- ✅ `metadata` - JSONB para dados extras (order_id, product info, etc.)

**Uso na Automação**:
```typescript
// Inserido em: sendWelcomeMessage(), sendUpsellMessage()
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

**Conclusão**: Tabela está correta e sendo utilizada pela automação.

---

### ✅ 6. Tabela: `whatsapp_instances`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.whatsapp_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  instance_name text NOT NULL,
  session_id text UNIQUE,                        -- ✅ Usado para enviar mensagens via Evolution API
  qr_code text,
  status text DEFAULT 'disconnected'::text,      -- ✅ 'connected', 'connecting', 'disconnected'
  phone_number text,
  webhook_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT whatsapp_instances_pkey PRIMARY KEY (id),
  CONSTRAINT whatsapp_instances_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
```

**Campos Verificados**:
- ✅ `session_id` - Nome da instância no Evolution API (UNIQUE)
- ✅ `status` - Estado da conexão ('connected' usado para filtrar instâncias ativas)
- ✅ `workspace_id` - Isolamento por workspace

**Uso na Automação**:
```typescript
// Usado em: sendWhatsAppMessage() (whatsapp-sender.ts)
const { data: instances } = await supabase
  .from('whatsapp_instances')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('status', 'connected')     // ✅ Busca apenas conectadas
  .limit(1);

const instance = instances[0];
await evolutionAPI.sendSimpleTextMessage(
  instance.session_id,           // ✅ Usa session_id
  formattedNumber,
  messageContent
);
```

**Conclusão**: Tabela está correta e sendo utilizada pela automação.

---

### ✅ 7. Tabela: `products`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid,
  name text NOT NULL,
  sku text,
  ean text,
  price numeric NOT NULL DEFAULT 0,
  stock_es integer NOT NULL DEFAULT 0,
  description text,
  images jsonb DEFAULT '[]'::jsonb,
  external_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  embedding USER-DEFINED,
  custo real,
  preco_atacado numeric,
  duracao numeric,                               -- ✅ PRESENTE (usado para calcular reorder)
  warehouseID text,
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
```

**Campos Verificados**:
- ✅ `duracao` - Duração do produto em dias (usado para calcular data de recompra)
- ✅ `sku` - Identificador único do produto

**Uso na Automação**:
```typescript
// Usado em: scheduleReorderMessages()
const { data: productData } = await supabase
  .from('products')
  .select('duracao, name')
  .eq('workspace_id', workspaceId)
  .eq('sku', product.sku)
  .maybeSingle();

if (!productData?.duracao) {
  console.log('Produto sem duração, pulando reorder');
  return;
}

const durationDays = productData.duracao * product.quantity;
const reorderDate = new Date(orderDate);
reorderDate.setDate(reorderDate.getDate() + durationDays - 15);
```

**Conclusão**: Tabela está correta e sendo utilizada pela automação.

---

### ✅ 8. Tabela: `clients`

**Status**: ✅ **COMPLETA E CORRETA**

```sql
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,                                    -- ✅ PRESENTE (usado para envio WhatsApp)
  email text,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  workspace_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  cpf text,
  chatwoot_contact boolean,
  total_gasto numeric,
  total_pedidos numeric,
  ultima_att timestamp with time zone,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT clients_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
```

**Campos Verificados**:
- ✅ `phone` - Número de telefone do cliente (usado para envio via Evolution API)
- ✅ `name` - Nome do cliente (usado nas variáveis dos templates)

**Uso na Automação**:
```typescript
// Usado em: sendWelcomeMessage(), sendUpsellMessage()
if (!client.phone) {
  console.log('Cliente sem telefone, pulando mensagem');
  return;
}

await sendWhatsAppMessage(supabase, workspaceId, client.phone, message);
```

**Conclusão**: Tabela está correta e sendo utilizada pela automação.

---

## ⚠️ TABELAS OPCIONAIS (Event-Driven Architecture)

### 📌 Tabela: `event_queue`

**Status**: ✅ **JÁ EXISTE NO SCHEMA**

```sql
CREATE TABLE public.event_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  event_log_id bigint NOT NULL UNIQUE,           -- ✅ Para idempotência
  event_type integer NOT NULL,
  event_name text,
  order_id bigint,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])),
  retry_count integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT event_queue_pkey PRIMARY KEY (id),
  CONSTRAINT event_queue_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
```

**Conclusão**: Tabela já existe e está pronta para implementação de event-driven architecture (futura).

---

### 📌 Tabela: `baselinker_sync_state`

**Status**: ✅ **JÁ EXISTE NO SCHEMA**

```sql
CREATE TABLE public.baselinker_sync_state (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  last_log_id bigint DEFAULT 0,                  -- ✅ Para tracking de eventos
  last_sync_at timestamp with time zone DEFAULT now(),
  is_syncing boolean DEFAULT false,
  sync_errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT baselinker_sync_state_pkey PRIMARY KEY (id),
  CONSTRAINT baselinker_sync_state_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);
```

**Conclusão**: Tabela já existe e está pronta para sincronização com Baselinker Journal API.

---

## ✅ CORREÇÕES APLICADAS

### ✅ Campo `orders.updated_at` Removido

**Status**: ✅ **CORRIGIDO**

A tabela `orders` não possui coluna `updated_at`. O código foi corrigido para remover a tentativa de atualização desse campo.

**Antes**:
```typescript
await supabase
  .from('orders')
  .update({
    mensagem_enviada: true,
    updated_at: new Date().toISOString()  // ⚠️ Coluna não existe
  })
  .eq('id', order.id);
```

**Depois (CORRIGIDO)**:
```typescript
await supabase
  .from('orders')
  .update({ mensagem_enviada: true })
  .eq('id', order.id);
```

**Deploy Realizado**: ✅ 23/12/2025

---

## 📋 RESUMO FINAL

### ✅ TABELAS PRINCIPAIS - TODAS CORRETAS

| Tabela | Status | Campos Críticos | Automação |
|--------|--------|-----------------|-----------|
| `message_templates` | ✅ | `send_config`, `filter_config` | Template system |
| `orders` | ✅ | `mensagem_enviada`, `canal_venda` | Upsell tracking |
| `orders_products` | ✅ | `mensagem_recompra` | Reorder tracking |
| `scheduled_messages` | ✅ | `message_type`, `status`, `metadata` | Agendamento |
| `messages` | ✅ | `send_type`, `sender_type`, `metadata` | Log completo |
| `whatsapp_instances` | ✅ | `session_id`, `status` | Evolution API |
| `products` | ✅ | `duracao` | Cálculo reorder |
| `clients` | ✅ | `phone`, `name` | Envio mensagens |

### ✅ CONCLUSÃO GERAL

**STATUS**: ✅ **BANCO DE DADOS ESTÁ 100% CORRETO**

- ✅ Todas as tabelas necessárias existem
- ✅ Todos os campos críticos estão presentes
- ✅ Constraints e foreign keys corretas
- ✅ Tipos de dados apropriados
- ✅ Código corrigido para não referenciar campos inexistentes

**NENHUMA ALTERAÇÃO NECESSÁRIA NO BANCO DE DADOS**

**CÓDIGO 100% COMPATÍVEL COM O SCHEMA ATUAL**
