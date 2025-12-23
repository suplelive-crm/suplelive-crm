# 📱 Documentação Completa de Automações e Mensagens

> **Data de Criação**: 23 de Dezembro de 2025
> **Versão**: 1.0
> **Objetivo**: Documentar como funcionam todas as automações de mensagens, sincronizações e processamento de pedidos do SupleLive CRM

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Fluxo de Processamento de Pedidos](#fluxo-de-processamento-de-pedidos)
3. [Sistema de Mensagens Automáticas](#sistema-de-mensagens-automáticas)
4. [Sincronização de Estoque](#sincronização-de-estoque)
5. [Mensagens Agendadas (Recompra)](#mensagens-agendadas-recompra)
6. [Configuração e Credenciais](#configuração-e-credenciais)
7. [Melhorias Futuras](#melhorias-futuras)

---

## 🏗️ Visão Geral da Arquitetura

### Mudança de Paradigma: De n8n para Event-Driven

#### ❌ Antes (Sistema baseado em Cron - n8n)
```
Cron (a cada 10 minutos) → Buscar todos os pedidos → Processar duplicados
```

**Problemas:**
- ⏰ Latência de até 10 minutos
- 💰 Processamento desnecessário de pedidos já processados
- 🔄 Possibilidade de duplicação
- 📊 Difícil rastreabilidade

#### ✅ Agora (Sistema Event-Driven - Supabase Edge Functions)
```
Evento (novo pedido) → Webhook/Polling → Processar apenas o novo → Ações imediatas
```

**Benefícios:**
- ⚡ Processamento em tempo real (segundos)
- 💰 Redução de custos (apenas eventos novos)
- 🔄 Idempotência garantida (event_log_id único)
- 📊 Rastreabilidade completa
- 🎯 Zero pedidos perdidos

---

## 🔄 Fluxo de Processamento de Pedidos

### Arquivo: `process-order-created/index.ts`

Este é o **coração do sistema**. Quando um novo pedido é criado no Baselinker, este Edge Function executa automaticamente.

### Etapas do Processamento

```
┌─────────────────────────────────────────────────────────────┐
│  1. RECEBE EVENTO                                           │
│     ├─ order_id do Baselinker                              │
│     ├─ workspace_id                                        │
│     └─ event_log_id (para idempotência)                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. BUSCA DETALHES DO PEDIDO                                │
│     ├─ Chama API Baselinker getOrders                      │
│     ├─ Token obtido de workspace.settings                  │
│     └─ Retorna pedido completo com produtos                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. CRIA OU ENCONTRA CLIENTE                                │
│     ├─ Extrai CPF (de invoice_nip ou extra_field_1/2)      │
│     ├─ Formata telefone (adiciona código 55 se necessário) │
│     ├─ Busca por CPF primeiro                              │
│     ├─ Se não encontrar, busca por telefone                │
│     └─ Se não encontrar, cria novo cliente                 │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. VERIFICA SE PEDIDO JÁ EXISTE                            │
│     ├─ Busca na tabela orders por order_id_base            │
│     └─ Se existe, retorna "skipped" (idempotência)         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. CRIA REGISTRO DO PEDIDO                                 │
│     ├─ Insere na tabela orders                             │
│     ├─ Salva dados do Baselinker em metadata (JSONB)       │
│     └─ Registra: status, valor, data, canal de venda       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. CRIA PRODUTOS DO PEDIDO                                 │
│     ├─ Insere na tabela orders_products                    │
│     ├─ Para cada produto: nome, SKU, quantidade, valor     │
│     └─ Calcula receita bruta e taxas                       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  7. ENVIA MENSAGEM DE VENDA CASADA (IMEDIATO)               │
│     ├─ Busca produtos complementares no estoque            │
│     ├─ Monta mensagem com sugestões de produtos            │
│     ├─ Envia via WhatsApp (Evolution API)                  │
│     └─ Marca orders.mensagem_enviada = true                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  8. AGENDA MENSAGENS DE RECOMPRA                            │
│     ├─ Para cada produto comprado:                         │
│     │   ├─ Busca "duracao" do produto na tabela products   │
│     │   ├─ Calcula: data_pedido + (duração × qtd) - 15     │
│     │   └─ Insere em scheduled_messages                    │
│     ├─ Marca orders_products.mensagem_recompra = true      │
│     └─ Status: pending (será enviada por cron)             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  9. ATUALIZA ESTATÍSTICAS DO CLIENTE                        │
│     ├─ total_gasto (soma de todos os pedidos)              │
│     ├─ total_pedidos (contagem)                            │
│     └─ ultima_att (timestamp)                              │
└─────────────────────────────────────────────────────────────┘
```

### Código Fonte Explicado

#### 1. Extração de CPF
```typescript
function extractCPF(order: any): string | null {
  const possibleFields = [
    order.invoice_nip,      // Campo principal de CPF no Baselinker
    order.extra_field_1,    // Campos personalizados
    order.extra_field_2,
    order.buyer_company,    // Às vezes o CPF vem aqui
  ];

  // Busca por padrão: 123.456.789-01 ou 12345678901
  for (const field of possibleFields) {
    const cpfMatch = field.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
    if (cpfMatch) {
      return cpfMatch[0].replace(/\D/g, ''); // Remove pontos e traços
    }
  }
  return null;
}
```

#### 2. Formatação de Telefone
```typescript
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, ''); // Remove caracteres não numéricos

  // Adiciona código do país (55 para Brasil) se não tiver
  if (cleaned.length === 11) return `55${cleaned}`; // Celular: 55119999999
  if (cleaned.length === 10) return `55${cleaned}`; // Fixo: 5511999999999

  return cleaned;
}
```

#### 3. Busca ou Criação de Cliente
```typescript
// PRIORIDADE 1: Buscar por CPF (identificador único)
if (cpf) {
  const { data: existingClient } = await supabaseClient
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('cpf', cpf)
    .maybeSingle();
  client = existingClient;
}

// PRIORIDADE 2: Se não encontrou por CPF, buscar por telefone
if (!client && phone) {
  const { data: existingClient } = await supabaseClient
    .from('clients')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('phone', phone)
    .maybeSingle();
  client = existingClient;
}

// CRIAR NOVO: Se não encontrou de jeito nenhum
if (!client) {
  const { data: newClient } = await supabaseClient
    .from('clients')
    .insert({
      workspace_id: workspaceId,
      name: fullOrder.delivery_fullname || 'Cliente',
      phone: phone,
      email: email || null,
      cpf: cpf,
      metadata: {
        source: 'baselinker',
        first_order_id: fullOrder.order_id,
        delivery_address: fullOrder.delivery_address,
        // ... outros dados de entrega
      },
    })
    .select()
    .single();

  client = newClient;

  // ENVIAR BOAS-VINDAS para clientes novos
  await sendWelcomeMessage(supabaseClient, workspaceId, client);
}
```

---

## 📨 Sistema de Mensagens Automáticas

### 1. Mensagem de Boas-Vindas (Novos Clientes)

**Quando é enviada**: Imediatamente após criar um novo cliente

**Arquivo**: `process-order-created/index.ts` → função `sendWelcomeMessage()`

**Condições**:
- ✅ Cliente foi criado pela primeira vez
- ✅ Cliente possui telefone válido

**Template da Mensagem**:
```
Olá [NOME_DO_CLIENTE]! 👋

Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.

Qualquer dúvida, estou à disposição! 😊
```

**Como funciona**:
```typescript
async function sendWelcomeMessage(supabase: any, workspaceId: string, client: any) {
  if (!client.phone) return; // Não envia se não tem telefone

  const message = `
Olá ${client.name}! 👋
Obrigado por escolher nossa loja!
Seu pedido foi recebido e já estamos processando.
Qualquer dúvida, estou à disposição! 😊
  `.trim();

  // 1. Envia via WhatsApp
  await sendWhatsAppMessage(workspaceId, client.phone, message);

  // 2. Registra no histórico de mensagens
  await supabase.from('messages').insert({
    client_id: client.id,
    content: message,
    send_type: 'automated_welcome',
    status: 'sent',
    channel_type: 'whatsapp',
    sender_type: 'bot',
  });
}
```

---

### 2. Mensagem de Venda Casada (Upsell)

**Quando é enviada**: Imediatamente após criar o pedido

**Arquivo**: `process-order-created/index.ts` → função `sendUpsellMessage()`

**Condições**:
- ✅ Pedido foi criado com sucesso
- ✅ Cliente possui telefone válido
- ✅ Existem produtos complementares disponíveis

**Lógica de Seleção de Produtos**:
1. Pega SKUs dos produtos do pedido atual
2. Busca produtos no estoque que **não estão** no pedido
3. Seleciona até 3 produtos complementares
4. Monta lista formatada com nome e preço

**Template da Mensagem**:
```
Olá [NOME_DO_CLIENTE]! 🎉

Obrigado pelo seu pedido!

Clientes que compraram os mesmos produtos também gostaram de:

• [PRODUTO 1] - R$ [PREÇO]
• [PRODUTO 2] - R$ [PREÇO]
• [PRODUTO 3] - R$ [PREÇO]

Quer aproveitar? Posso adicionar ao seu pedido! 😊
```

**Como funciona**:
```typescript
async function sendUpsellMessage(
  supabase: any,
  workspaceId: string,
  order: any,
  client: any,
  fullOrder: any
) {
  if (!client.phone) return;

  // 1. Pega SKUs do pedido atual
  const orderSkus = fullOrder.products.map((p: any) => p.sku);

  // 2. Busca produtos complementares (que NÃO estão no pedido)
  const { data: complementaryProducts } = await supabase
    .from('products')
    .select('name, sku, price')
    .eq('workspace_id', workspaceId)
    .not('sku', 'in', `(${orderSkus.join(',')})`)
    .limit(3);

  if (!complementaryProducts || complementaryProducts.length === 0) {
    console.log('Sem produtos complementares');
    return;
  }

  // 3. Monta lista de produtos
  const productList = complementaryProducts
    .map((p: any) => `• ${p.name} - R$ ${p.price.toFixed(2)}`)
    .join('\n');

  // 4. Monta mensagem
  const message = `
Olá ${client.name}! 🎉
Obrigado pelo seu pedido!

Clientes que compraram os mesmos produtos também gostaram de:

${productList}

Quer aproveitar? Posso adicionar ao seu pedido! 😊
  `.trim();

  // 5. Envia via WhatsApp
  await sendWhatsAppMessage(workspaceId, client.phone, message);

  // 6. Registra no histórico
  await supabase.from('messages').insert({
    client_id: client.id,
    content: message,
    send_type: 'automated_upsell',
    status: 'sent',
    channel_type: 'whatsapp',
    sender_type: 'bot',
    metadata: {
      order_id: order.id,
      suggested_products: complementaryProducts.map((p: any) => p.sku),
    },
  });

  // 7. Marca que a mensagem foi enviada
  await supabase
    .from('orders')
    .update({ mensagem_enviada: true })
    .eq('id', order.id);
}
```

**Melhorias Futuras**:
- 🤖 IA para sugerir produtos baseado em histórico de compras
- 📊 Análise de produtos mais vendidos juntos
- 🎯 Personalização por perfil do cliente (RFM)
- 💰 Desconto automático para combo

---

### 3. Mensagem de Recompra (Agendada)

**Quando é agendada**: Imediatamente após criar o pedido

**Quando é enviada**: De acordo com a duração do produto (via cron)

**Arquivo de Agendamento**: `process-order-created/index.ts` → função `scheduleReorderMessages()`

**Arquivo de Envio**: `send-scheduled-messages/index.ts`

**Condições para Agendar**:
- ✅ Produto possui campo `duracao` preenchido na tabela `products`
- ✅ Data calculada não está no passado
- ✅ Cliente possui telefone válido

**Cálculo da Data de Envio**:
```typescript
// Fórmula:
data_envio = data_pedido + (duracao_produto × quantidade) - 15 dias

// Exemplo:
// - Pedido feito em: 01/12/2025
// - Produto: Vitamina C (duração: 30 dias)
// - Quantidade: 2 unidades
// - Cálculo: 01/12 + (30 × 2) - 15 = 01/12 + 60 - 15 = 46 dias
// - Data de envio: 16/01/2026 (quando o cliente estará perto de terminar)
```

**Template da Mensagem**:
```
Olá [NOME_DO_CLIENTE]!

O produto "[NOME_DO_PRODUTO]" que você comprou está acabando! 🏁

Quer fazer uma nova compra para não ficar sem? 🛒

É só me chamar! 😊
```

**Como funciona o Agendamento**:
```typescript
async function scheduleReorderMessages(
  supabase: any,
  workspaceId: string,
  order: any,
  client: any,
  fullOrder: any
) {
  // Para cada produto do pedido
  for (const product of fullOrder.products) {
    // 1. Busca duração do produto na tabela products
    const { data: productData } = await supabase
      .from('products')
      .select('duracao, name')
      .eq('workspace_id', workspaceId)
      .eq('sku', product.sku)
      .maybeSingle();

    // Se produto não tem duração configurada, pula
    if (!productData || !productData.duracao) {
      console.log(`Produto ${product.sku} sem duração configurada`);
      continue;
    }

    // 2. Calcula data da mensagem
    const orderDate = new Date(order.order_date);
    const durationDays = productData.duracao * product.quantity;
    const reorderDate = new Date(orderDate);
    reorderDate.setDate(reorderDate.getDate() + durationDays - 15); // -15 dias de buffer

    // 3. Não agenda se a data calculada já passou
    if (reorderDate < new Date()) {
      console.log(`Data de recompra no passado, pulando`);
      continue;
    }

    // 4. Monta mensagem
    const message = `
Olá ${client.name}!

O produto "${productData.name}" que você comprou está acabando! 🏁

Quer fazer uma nova compra para não ficar sem? 🛒

É só me chamar! 😊
    `.trim();

    // 5. Insere na tabela de mensagens agendadas
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
        duration_days: durationDays,
      },
    });

    // 6. Marca que a recompra foi agendada
    await supabase
      .from('orders_products')
      .update({ mensagem_recompra: true })
      .eq('order_id', order.id)
      .eq('sku', product.sku);

    console.log(`Mensagem de recompra agendada para ${reorderDate.toISOString()}`);
  }
}
```

**Como funciona o Envio (Cron Job)**:
```typescript
// Arquivo: send-scheduled-messages/index.ts
// Executado: A cada hora ou dia (configurável via Supabase Cron)

serve(async (req) => {
  // 1. Busca mensagens pendentes onde scheduled_for <= agora
  const now = new Date().toISOString();
  const { data: messages } = await supabaseClient
    .from('scheduled_messages')
    .select('*, clients(name, phone), workspaces(id)')
    .eq('status', 'pending')
    .lte('scheduled_for', now) // Apenas mensagens que já devem ser enviadas
    .order('scheduled_for', { ascending: true });

  // 2. Para cada mensagem pendente
  for (const msg of messages) {
    try {
      // 3. Busca instância WhatsApp ativa do workspace
      const { data: instance } = await supabaseClient
        .from('whatsapp_instances')
        .select('*')
        .eq('workspace_id', msg.workspace_id)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();

      if (!instance) {
        // Marca como falhou por falta de instância
        await supabaseClient
          .from('scheduled_messages')
          .update({ status: 'failed' })
          .eq('id', msg.id);
        continue;
      }

      // 4. Envia mensagem via Evolution API
      await sendWhatsAppMessage(msg.workspace_id, msg.clients.phone, msg.message_content);

      // 5. Marca como enviada
      await supabaseClient
        .from('scheduled_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', msg.id);

      // 6. Registra no histórico
      await supabaseClient.from('messages').insert({
        client_id: msg.client_id,
        content: msg.message_content,
        send_type: `automated_${msg.message_type}`,
        status: 'sent',
        channel_type: 'whatsapp',
        sender_type: 'bot',
        metadata: {
          scheduled_message_id: msg.id,
          ...msg.metadata,
        },
      });

      // Delay de 1 segundo para evitar rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      // Marca como falhou
      await supabaseClient
        .from('scheduled_messages')
        .update({ status: 'failed' })
        .eq('id', msg.id);
    }
  }
});
```

**Configuração do Cron**:
```sql
-- No Supabase Dashboard → Database → Cron Jobs
-- Executar a cada hora:
SELECT cron.schedule(
  'send-scheduled-messages',
  '0 * * * *',  -- A cada hora no minuto 0
  $$ SELECT net.http_post(
      url:='https://[PROJECT_ID].supabase.co/functions/v1/send-scheduled-messages',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer [ANON_KEY]"}'::jsonb
  ) $$
);
```

---

## 📦 Sincronização de Estoque

### Arquivo: `update-baselinker-stock/index.ts`

Esta Edge Function atualiza o estoque tanto no Baselinker quanto no banco de dados local, com **logging completo**.

### Fluxo de Atualização

```
┌─────────────────────────────────────────────────────────────┐
│  1. RECEBE REQUISIÇÃO                                       │
│     ├─ workspace_id                                        │
│     ├─ warehouse_id (bl_1 ou bl_2)                         │
│     ├─ sku                                                 │
│     ├─ new_quantity                                        │
│     ├─ reason (motivo da alteração)                       │
│     ├─ reference_type (purchase, transfer, order, etc)    │
│     └─ reference_id (ID da compra, transferência, etc)    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  2. VALIDAÇÕES                                              │
│     ├─ Warehouse está ativo? (is_warehouse_active)         │
│     ├─ Permite atualizações? (allow_stock_updates)         │
│     ├─ Não é read-only? (sync_direction !== 'read_only')   │
│     └─ Produto existe? (busca na tabela products)          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  3. CAPTURA QUANTIDADE ANTERIOR                             │
│     ├─ warehouse_id = 'bl_1' → stock_es                    │
│     └─ warehouse_id = 'bl_2' → stock_sp                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  4. ATUALIZA NO BASELINKER                                  │
│     ├─ Chama API: updateInventoryProductsQuantity          │
│     ├─ Passa: inventory_id, sku, new_quantity              │
│     └─ Token de workspace.settings                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  5. ATUALIZA LOCALMENTE                                     │
│     ├─ UPDATE products SET stock_xx = new_quantity         │
│     └─ Baselinker é a fonte da verdade                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  6. REGISTRA LOG COMPLETO                                   │
│     ├─ Chama: log_stock_change() (database function)       │
│     ├─ Salva: SKU, warehouse, qty anterior, qty nova       │
│     ├─ Salva: motivo, tipo, referência, usuário            │
│     └─ View: v_recent_stock_changes (para consulta)        │
└─────────────────────────────────────────────────────────────┘
```

### Código Fonte Explicado

```typescript
// 1. Validações
const { data: warehouse } = await supabaseClient
  .from('baselinker_warehouses')
  .select('*')
  .eq('workspace_id', workspace_id)
  .eq('warehouse_id', warehouse_id)
  .maybeSingle();

if (!warehouse.allow_stock_updates) {
  throw new Error(`Warehouse ${warehouse_id} não permite atualizações`);
}

if (warehouse.sync_direction === 'read_only') {
  throw new Error(`Warehouse ${warehouse_id} é somente leitura`);
}

// 2. Busca produto e quantidade atual
const { data: product } = await supabaseClient
  .from('products')
  .select('id, sku, name, stock_es, stock_sp')
  .eq('workspace_id', workspace_id)
  .eq('sku', sku)
  .maybeSingle();

// Determina qual campo usar (ES ou SP)
const stockField = warehouse_id === 'bl_1' ? 'stock_es' : 'stock_sp';
const previousQty = product[stockField] || 0;

// 3. Atualiza no Baselinker
const baselinkerResult = await baselinkerRequest(
  baselinkerConfig,
  'updateInventoryProductsQuantity',
  {
    inventory_id: warehouse_id,
    products: {
      [sku]: {
        stock: new_quantity,
      },
    },
  }
);

// 4. Atualiza localmente
await supabaseClient
  .from('products')
  .update({ [stockField]: new_quantity })
  .eq('id', product.id);

// 5. Registra log
const { data: logId } = await supabaseClient.rpc('log_stock_change', {
  p_workspace_id: workspace_id,
  p_sku: sku,
  p_warehouse_id: warehouse_id,
  p_previous_qty: previousQty,
  p_new_qty: new_quantity,
  p_action_type: reference_type === 'purchase' ? 'add' : 'adjust',
  p_source: reference_type || 'system',
  p_reason: reason,
  p_reference_id: reference_id || null,
  p_reference_type: reference_type || null,
  p_user_id: user_id || null,
  p_metadata: metadata,
});
```

### Tipos de Atualização de Estoque

| Tipo | Origem | Exemplo |
|------|--------|---------|
| `purchase` | Chegada de compra no atacado | Comprou 100 unidades de fornecedor |
| `transfer` | Transferência entre estoques | 50 unidades de ES para SP |
| `order` | Venda processada | Cliente comprou 3 unidades |
| `manual` | Ajuste manual do usuário | Correção de inventário |
| `adjustment` | Ajuste automático do sistema | Sincronização com Baselinker |

### Database Function para Logging

```sql
CREATE OR REPLACE FUNCTION log_stock_change(
  p_workspace_id UUID,
  p_sku TEXT,
  p_warehouse_id TEXT,
  p_previous_qty NUMERIC,
  p_new_qty NUMERIC,
  p_action_type TEXT,
  p_source TEXT,
  p_reason TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_product_id UUID;
  v_product_name TEXT;
BEGIN
  -- Busca informações do produto
  SELECT id, name INTO v_product_id, v_product_name
  FROM products
  WHERE workspace_id = p_workspace_id AND sku = p_sku
  LIMIT 1;

  -- Insere log
  INSERT INTO stock_change_logs (
    workspace_id,
    product_id,
    sku,
    product_name,
    warehouse_id,
    previous_quantity,
    new_quantity,
    quantity_change,
    action_type,
    source,
    change_reason,
    reference_id,
    reference_type,
    user_id,
    metadata
  ) VALUES (
    p_workspace_id,
    v_product_id,
    p_sku,
    v_product_name,
    p_warehouse_id,
    p_previous_qty,
    p_new_qty,
    p_new_qty - p_previous_qty,  -- Calcula diferença
    p_action_type,
    p_source,
    p_reason,
    p_reference_id,
    p_reference_type,
    p_user_id,
    p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## ⚙️ Configuração e Credenciais

### Onde Ficam as Credenciais?

Todas as credenciais ficam armazenadas em **`workspaces.settings`** (coluna JSONB).

```typescript
// Estrutura do campo settings na tabela workspaces:
{
  "baselinker": {
    "token": "1234567-ABCDEF-...",
    "warehouse_es": "bl_1",
    "warehouse_sp": "bl_2"
  },
  "evolution": {
    "api_url": "https://evolution-api.com",
    "api_key": "XXXXXXX",
    "global_api_key": "YYYYYYY"
  },
  "n8n": {
    "webhook_url": "https://n8n.com/webhook/...",
    "api_key": "ZZZZZZZ"
  }
}
```

### Funções Helper para Buscar Credenciais

**Arquivo**: `supabase/functions/_shared/workspace-config.ts`

```typescript
// Buscar token do Baselinker
export async function getBaselinkerToken(
  supabase: any,
  workspaceId: string
): Promise<string> {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.settings?.baselinker?.token) {
    throw new Error('Baselinker token not configured for workspace');
  }

  return workspace.settings.baselinker.token;
}

// Buscar configuração do Evolution API
export async function getEvolutionConfig(
  supabase: any,
  workspaceId: string
): Promise<{ api_url: string; api_key: string }> {
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.settings?.evolution) {
    throw new Error('Evolution API not configured for workspace');
  }

  return {
    api_url: workspace.settings.evolution.api_url,
    api_key: workspace.settings.evolution.global_api_key,
  };
}
```

### Como Enviar Mensagens WhatsApp

```typescript
async function sendWhatsAppMessage(
  workspaceId: string,
  phone: string,
  message: string
) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 1. Busca instância WhatsApp ativa do workspace
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected')
    .limit(1)
    .maybeSingle();

  if (!instance) {
    throw new Error('Nenhuma instância WhatsApp conectada');
  }

  // 2. Busca credenciais do Evolution API
  const evolutionConfig = await getEvolutionConfig(supabase, workspaceId);

  // 3. Envia mensagem
  const response = await fetch(
    `${evolutionConfig.api_url}/message/sendText/${instance.instance_name}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionConfig.api_key,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Falha ao enviar mensagem: ${response.statusText}`);
  }

  console.log(`Mensagem enviada para ${phone}`);
}
```

---

## 🚀 Melhorias Futuras

### 1. Sistema de Mensagens

#### Mensagens de Venda Casada (Upsell)
- [ ] **IA para Recomendações**: Usar histórico de compras para sugerir produtos
  - Algoritmo: "Quem comprou X também comprou Y"
  - ML para detectar padrões de compra
  - Personalização por perfil RFM do cliente

- [ ] **Segmentação de Clientes**: Mensagens diferentes por categoria
  - Champions: Produtos premium
  - At Risk: Descontos especiais
  - New Customers: Produtos populares

- [ ] **Testes A/B**: Testar diferentes templates de mensagem
  - Medir taxa de conversão por template
  - Otimizar automaticamente

- [ ] **Timing Inteligente**: Melhor hora para enviar
  - Análise de quando o cliente geralmente responde
  - Evitar horários de baixa conversão

#### Mensagens de Recompra
- [ ] **Notificações Progressivas**: Múltiplas mensagens
  - 15 dias antes do fim: "Está acabando!"
  - 5 dias antes: "Última chance para garantir!"
  - Dia do fim: "Acabou! Quer repor?"

- [ ] **Desconto Automático**: Oferecer desconto na recompra
  - 10% de desconto se comprar antes de acabar
  - Frete grátis para clientes recorrentes

- [ ] **Ajuste de Duração Inteligente**: Aprender com o comportamento
  - Se cliente comprou de novo em 40 dias (não 60), ajustar duração
  - ML para prever quando o cliente realmente vai precisar

#### Mensagens de Boas-Vindas
- [ ] **Sequência de Onboarding**: Não apenas uma mensagem
  - Dia 1: Boas-vindas
  - Dia 3: "Como está indo?"
  - Dia 7: "Precisa de ajuda?"

- [ ] **Cupom de Primeira Compra**: Incentivar segunda compra
  - 10% OFF na próxima compra
  - Válido por 7 dias

---

### 2. Sistema de Estoque

#### Automação de Reposição
- [ ] **Alerta de Estoque Baixo**: Notificar quando estoque < mínimo
  - Webhook para Slack/Discord
  - WhatsApp para administrador
  - Email automático

- [ ] **Sugestão de Compra Automática**: IA prediz demanda
  - Análise de vendas dos últimos 3 meses
  - Sazonalidade (fim de ano, verão, etc)
  - Tendências de crescimento

- [ ] **Pedido Automático para Fornecedor**: Integração direta
  - Quando estoque atinge mínimo, cria pedido automaticamente
  - Envia email/webhook para fornecedor
  - Rastreamento automático de entrega

#### Otimização de Transferências
- [ ] **Balanceamento Automático**: ES ↔ SP
  - Se ES tem excesso e SP está baixo, sugerir transferência
  - Cálculo de custo-benefício do frete

- [ ] **Previsão de Demanda Regional**:
  - ES vende mais Produto A
  - SP vende mais Produto B
  - Ajustar distribuição automaticamente

---

### 3. Sistema de Eventos (Event-Driven)

#### Processamento em Tempo Real
- [ ] **Webhook do Baselinker**: Substituir polling
  - Baselinker pode enviar webhooks para novos pedidos
  - Latência < 1 segundo

- [ ] **Filas de Prioridade**: Processar eventos críticos primeiro
  - Pedidos pagos: ALTA prioridade
  - Atualização de estoque: MÉDIA
  - Logs: BAIXA

- [ ] **Retry Inteligente**: Tentar novamente em caso de falha
  - Exponential backoff: 1s, 2s, 4s, 8s...
  - Dead Letter Queue para eventos que falharam 5x
  - Alertas para administrador

#### Rastreabilidade
- [ ] **Dashboard de Eventos**: Visualizar tudo em tempo real
  - Gráfico de eventos processados por hora
  - Taxa de sucesso/falha
  - Tempo médio de processamento

- [ ] **Auditoria Completa**: Saber exatamente o que aconteceu
  - Quem fez o quê, quando
  - Diff de mudanças (antes/depois)
  - Possibilidade de rollback

---

### 4. Inteligência Artificial

#### Chatbot Inteligente
- [ ] **GPT-4 para Atendimento**: Cliente conversa com IA
  - Responde perguntas sobre produtos
  - Rastreia pedidos automaticamente
  - Escalona para humano quando necessário

- [ ] **Classificação de Intenção**: Entender o que cliente quer
  - "Quero cancelar" → Trigger: processo de cancelamento
  - "Onde está meu pedido?" → Busca rastreamento
  - "Quero falar com gerente" → Transfere para humano

#### Análise Preditiva
- [ ] **Churn Prediction**: Prever clientes que vão abandonar
  - Cliente não compra há 60 dias → Risco de churn
  - Enviar mensagem personalizada com oferta

- [ ] **Lifetime Value**: Calcular valor de vida do cliente
  - Investir mais em clientes de alto LTV
  - Ofertas especiais para aumentar LTV

---

### 5. Otimizações de Performance

#### Caching
- [ ] **Cache de Produtos Complementares**: Não buscar sempre
  - Redis com TTL de 1 hora
  - Invalida quando produto é atualizado

- [ ] **Cache de Configurações**: Workspace settings
  - Não buscar credenciais em todo request
  - Atualiza apenas quando settings mudam

#### Processamento em Batch
- [ ] **Agrupar Atualizações de Estoque**:
  - Ao invés de 100 requests, fazer 1 com 100 produtos
  - Reduz latência e custo de API

- [ ] **Mensagens em Lote**:
  - Enviar múltiplas mensagens de uma vez
  - Rate limiting do WhatsApp

---

### 6. Monitoramento e Alertas

#### Observabilidade
- [ ] **Logs Centralizados**: Datadog, Sentry, ou similar
  - Todos os Edge Functions logam no mesmo lugar
  - Busca e filtros avançados

- [ ] **Métricas Customizadas**:
  - Quantidade de pedidos processados/hora
  - Taxa de erro por Edge Function
  - Tempo de resposta médio

#### Alertas
- [ ] **Slack/Discord/Email**: Quando algo dá errado
  - Edge Function falhou 5x seguidas
  - Fila de eventos com +100 pendentes
  - Instância WhatsApp desconectada

- [ ] **Health Checks**: Ping automático
  - A cada 5 minutos, verifica se tudo está OK
  - Dashboard de status público

---

## 📊 Resumo Técnico

### Edge Functions Ativas

| Função | Trigger | Frequência | Responsabilidade |
|--------|---------|------------|------------------|
| `process-order-created` | Event Queue | Real-time | Processar novo pedido + enviar mensagens |
| `send-scheduled-messages` | Cron | 1x/hora | Enviar mensagens agendadas (recompra) |
| `update-baselinker-stock` | HTTP Request | On-demand | Atualizar estoque Baselinker + log |
| `baselinker-sync` | HTTP Request | On-demand | Sincronizar orders/customers/inventory |
| `baselinker-event-poller` | Cron | 30s-1min | Buscar novos eventos do Baselinker |

### Tabelas Principais

| Tabela | Propósito | Campos Importantes |
|--------|-----------|-------------------|
| `orders` | Pedidos sincronizados | `order_id_base`, `mensagem_enviada`, `client_id` |
| `orders_products` | Produtos do pedido | `mensagem_recompra`, `sku`, `order_id` |
| `clients` | Clientes únicos | `cpf`, `phone`, `total_gasto`, `total_pedidos` |
| `scheduled_messages` | Mensagens agendadas | `scheduled_for`, `status`, `message_type` |
| `messages` | Histórico de mensagens | `send_type`, `status`, `content` |
| `products` | Catálogo de produtos | `sku`, `stock_es`, `stock_sp`, `duracao` |
| `stock_change_logs` | Log de estoque | `previous_quantity`, `new_quantity`, `action_type` |
| `event_queue` | Fila de eventos | `event_type`, `status`, `retry_count` |

### Fluxo Completo: Do Pedido à Mensagem

```
1. Cliente faz pedido no marketplace
2. Baselinker registra pedido
3. Edge Function "baselinker-event-poller" detecta novo pedido
4. Insere evento na "event_queue"
5. Database trigger chama "process-order-created"
6. Busca ou cria cliente
7. Cria pedido + produtos
8. Envia mensagem de venda casada (imediato)
9. Agenda mensagem de recompra (tabela scheduled_messages)
10. Atualiza estatísticas do cliente
11. Cron job diário envia mensagens agendadas
```

---

**Fim do Documento** 🎉

Para dúvidas ou sugestões de melhorias, consulte os arquivos:
- `supabase/functions/process-order-created/index.ts`
- `supabase/functions/send-scheduled-messages/index.ts`
- `supabase/functions/update-baselinker-stock/index.ts`
- `Briefing/EVENT_DRIVEN_ARCHITECTURE.md`
