# Plano de Migração dos Workflows n8n para a Plataforma

## Visão Geral

Este documento descreve o plano para migrar os 11 workflows do n8n que atualmente rodam em background para a plataforma SupleLive CRM, transformando-os em jobs nativos executados via Supabase Edge Functions e/ou cron jobs.

## Workflows Identificados

### 1. **Sincronização com Baselinker** (4 workflows)
- `Plataforma___Receber_pedidos__Sinc__.json` (2622 linhas)
- `Plataforma___Sincronizar_Estoque.json` (1024 linhas)
- `Plataforma___Sincroniza__o_clientes.json` (776 linhas)
- `Plataforma___Sincronizar_Devolu__es.json` (769 linhas)

**Função**: Sincronizar pedidos, estoque, clientes e devoluções do Baselinker para o banco de dados Supabase.

### 2. **Gestão de Estoque** (2 workflows)
- `Plataforma___Subir_estoque_produtos_novos.json` (1859 linhas)
- `Plataforma___Subir_estoque_transferencia.json` (1647 linhas)

**Função**: Atualizar estoque de produtos novos e transferências entre estoques (ES/SP).

### 3. **Automações de Tracking** (2 workflows)
- `Plataforma___Atualizar_Encomendas.json` (1582 linhas)
- `Plataforma___Mensagem_itens_chegou_atacado.json` (484 linhas)

**Função**: Atualizar status de encomendas através de API de rastreamento e enviar mensagens quando produtos chegarem.

### 4. **Agentes de Marketing** (2 workflows)
- `Agente___Mensagem_de_Recompra.json` (1002 linhas)
- `Agente___Venda_Casada.json` (615 linhas)

**Função**: Enviar mensagens automáticas de recompra e sugestões de venda casada baseadas em duração de produtos e histórico.

### 5. **Integração Chatwoot** (1 workflow)
- `Enviar_contato_para_chatwoot.json` (309 linhas)

**Função**: Sincronizar contatos do CRM para o Chatwoot.

---

## Arquitetura Proposta

### Opção 1: Supabase Edge Functions + pg_cron (Recomendado)

```
┌─────────────────────────────────────────────────────────┐
│                  Supabase Database                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │           pg_cron (PostgreSQL)                    │  │
│  │  - Agendamento de jobs periódicos                │  │
│  │  - Triggers baseados em tempo                    │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                                │
│                         ▼                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Supabase Edge Functions                   │  │
│  │                                                    │  │
│  │  ├─ sync-baselinker-orders                       │  │
│  │  ├─ sync-baselinker-products                     │  │
│  │  ├─ sync-baselinker-clients                      │  │
│  │  ├─ sync-baselinker-returns                      │  │
│  │  ├─ update-tracking-status                       │  │
│  │  ├─ send-reorder-messages                        │  │
│  │  ├─ send-upsell-messages                         │  │
│  │  ├─ update-stock-transfers                       │  │
│  │  ├─ sync-chatwoot-contacts                       │  │
│  │  └─ notify-stock-arrival                         │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                                │
└─────────────────────────│────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   External APIs       │
              │                       │
              │  - Baselinker API     │
              │  - Tracking API       │
              │  - Evolution API      │
              │  - Chatwoot API       │
              └───────────────────────┘
```

### Opção 2: Worker Service Separado (Escala maior)

Para cenários com maior volume, podemos criar um serviço worker Node.js separado:

```
┌─────────────────────────────────────────────────────────┐
│              Worker Service (Node.js)                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │           BullMQ / Agenda.js                      │  │
│  │           (Job Queue System)                      │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │              Job Processors                       │  │
│  │                                                    │  │
│  │  ├─ BaselinkerSyncProcessor                      │  │
│  │  ├─ TrackingUpdateProcessor                      │  │
│  │  ├─ MarketingAutomationProcessor                 │  │
│  │  └─ StockManagementProcessor                     │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Detalhamento por Workflow

### 1. Sincronização de Pedidos Baselinker

**Workflow Atual**: `Plataforma___Receber_pedidos__Sinc__.json`

**Frequência**: A cada 10 minutos (inferido pelo date_from - 10 horas)

**Lógica**:
1. Buscar pedidos do Baselinker dos últimos 10 minutos
2. Para cada pedido:
   - Verificar se cliente existe pelo CPF
   - Criar/atualizar cliente se necessário
   - Criar/atualizar pedido na tabela `orders`
   - Criar produtos do pedido em `orders_products`
   - Atualizar metadata (canal, taxas, faturamento)

**Migração Proposta**:
```typescript
// supabase/functions/sync-baselinker-orders/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

  // 1. Buscar pedidos das últimas 10h do Baselinker
  const tenHoursAgo = Math.floor(Date.now() / 1000) - (10 * 60 * 60)
  const orders = await fetchBaselinkerOrders(tenHoursAgo)

  // 2. Processar cada pedido
  for (const order of orders) {
    await processOrder(supabase, order)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

**Agendamento via pg_cron**:
```sql
SELECT cron.schedule(
  'sync-baselinker-orders',
  '*/10 * * * *', -- A cada 10 minutos
  $$
  SELECT net.http_post(
    url := 'https://[project-ref].supabase.co/functions/v1/sync-baselinker-orders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer [anon-key]"}'::jsonb
  );
  $$
);
```

---

### 2. Sincronização de Estoque Baselinker

**Workflow Atual**: `Plataforma___Sincronizar_Estoque.json`

**Frequência**: Diário ou sob demanda

**Lógica**:
1. Buscar todos os produtos do Baselinker (storage_id: bl_1)
2. Para cada produto:
   - Verificar se existe no banco pelo `external_id`
   - Atualizar estoque (stock_es, stock_sp)
   - Atualizar preço, EAN, SKU
   - Criar produto se não existir

**Migração Proposta**:
```typescript
// supabase/functions/sync-baselinker-products/index.ts

serve(async (req) => {
  const { workspace_id } = await req.json()

  // 1. Buscar produtos do Baselinker
  const products = await fetchBaselinkerProducts()

  // 2. Upsert no banco
  const { data, error } = await supabase
    .from('products')
    .upsert(
      products.map(p => ({
        workspace_id,
        external_id: p.id,
        sku: p.sku,
        name: p.name,
        price: p.price,
        stock_es: p.stock_es,
        stock_sp: p.stock_sp,
        // ... outros campos
      })),
      { onConflict: 'external_id,workspace_id' }
    )
})
```

**Agendamento**: Diário às 3h da manhã
```sql
SELECT cron.schedule(
  'sync-baselinker-products',
  '0 3 * * *', -- 3h da manhã todos os dias
  $$ ... $$
);
```

---

### 3. Atualização de Encomendas (Tracking)

**Workflow Atual**: `Plataforma___Atualizar_Encomendas.json`

**Frequência**: A cada hora

**Lógica**:
1. Buscar todas as compras não arquivadas com tracking code
2. Para cada tracking:
   - Consultar API de rastreamento (Correios/transportadora)
   - Atualizar status da compra
   - Se status = "Objeto entregue", marcar produtos como verificados
   - Registrar log de mudanças

**Migração Proposta**:
```typescript
// supabase/functions/update-tracking-status/index.ts

serve(async (req) => {
  const { data: purchases } = await supabase
    .from('purchases')
    .select('*')
    .eq('is_archived', false)
    .neq('trackingCode', null)

  for (const purchase of purchases) {
    const trackingInfo = await fetchTrackingInfo(
      purchase.trackingCode,
      purchase.carrier
    )

    // Atualizar status
    await supabase
      .from('purchases')
      .update({
        status: trackingInfo.status,
        atualizado: new Date().toISOString(),
        metadata: trackingInfo
      })
      .eq('id', purchase.id)

    // Se entregue, marcar produtos como verificados
    if (trackingInfo.status === 'Objeto entregue') {
      await markProductsAsDelivered(purchase.id)
    }
  }
})
```

**Nota**: Este workflow já existe parcialmente em `tracking-automation/index.ts`

---

### 4. Mensagens de Recompra (Marketing)

**Workflow Atual**: `Agente___Mensagem_de_Recompra.json`

**Frequência**: Diária

**Lógica**:
1. Buscar produtos de pedidos sem `envio_duracao` calculado
2. Para cada produto:
   - Pegar duração do produto da tabela `products`
   - Calcular data prevista de chegada: `data_compra + (duracao * quantidade)`
   - Calcular data de envio de recompra: `data_prevista - 15 dias`
   - Salvar em `orders_products.envio_duracao`
3. Buscar produtos com `envio_duracao = hoje`
4. Enviar mensagem de WhatsApp sugerindo recompra

**Migração Proposta**:
```typescript
// supabase/functions/send-reorder-messages/index.ts

serve(async (req) => {
  // 1. Calcular duração para produtos sem ela
  const { data: productsWithoutDuration } = await supabase
    .from('orders_products')
    .select('*, products(duracao)')
    .is('envio_duracao', null)

  for (const orderProduct of productsWithoutDuration) {
    const durationDays = orderProduct.products.duracao * orderProduct.quantidade_produtos
    const purchaseDate = new Date(orderProduct.created_at)
    const expectedArrival = addDays(purchaseDate, durationDays)
    const reorderDate = addDays(expectedArrival, -15)

    await supabase
      .from('orders_products')
      .update({ envio_duracao: reorderDate.toISOString().split('T')[0] })
      .eq('id', orderProduct.id)
  }

  // 2. Enviar mensagens para produtos com data = hoje
  const today = new Date().toISOString().split('T')[0]
  const { data: productsToReorder } = await supabase
    .from('orders_products')
    .select('*, orders(client_id), products(name)')
    .eq('envio_duracao', today)
    .eq('mensagem_recompra', false)

  for (const item of productsToReorder) {
    await sendReorderWhatsAppMessage(item)
    await supabase
      .from('orders_products')
      .update({ mensagem_recompra: true })
      .eq('id', item.id)
  }
})
```

---

### 5. Sincronização de Clientes

**Workflow Atual**: `Plataforma___Sincroniza__o_clientes.json`

**Frequência**: Sob demanda ou após sync de pedidos

**Lógica**:
1. Buscar pedidos sem `client_id` associado
2. Para cada pedido:
   - Buscar cliente pelo CPF
   - Se não existir, criar cliente
   - Associar cliente ao pedido
   - Atualizar totais do cliente (total_gasto, total_pedidos)

**Migração Proposta**:
- Integrar esta lógica dentro de `sync-baselinker-orders`
- Não precisa ser um job separado
- Executar como parte do processamento de cada pedido

---

### 6. Gestão de Transferências de Estoque

**Workflow Atual**: `Plataforma___Subir_estoque_transferencia.json`

**Frequência**: Quando transferência é entregue

**Lógica**:
1. Buscar transferências com status = "Objeto entregue"
2. Verificar produtos da transferência
3. Adicionar quantidade ao estoque de destino
4. Remover quantidade do estoque de origem
5. Registrar em `log_lançamento_transferencia`

**Migração Proposta**:
```typescript
// supabase/functions/process-stock-transfers/index.ts

serve(async (req) => {
  const { data: deliveredTransfers } = await supabase
    .from('transfers')
    .select('*, transfer_products(*)')
    .eq('status', 'Objeto entregue')
    .eq('in_stock', false)

  for (const transfer of deliveredTransfers) {
    for (const product of transfer.transfer_products) {
      // Atualizar estoque origem e destino
      await updateStockForTransfer(
        product.sku,
        product.quantity,
        transfer.source_stock,
        transfer.destination_stock
      )

      // Registrar log
      await supabase.from('log_lançamento_transferencia').insert({
        sku: product.sku,
        quantidade: product.quantity,
        tracking_code: transfer.trackingCode,
        tipo: 'entrada',
        estoque_origem: transfer.source_stock,
        estoque_destino: transfer.destination_stock
      })
    }

    await supabase
      .from('transfers')
      .update({ in_stock: true })
      .eq('id', transfer.id)
  }
})
```

**Trigger**: Pode ser chamado após `update-tracking-status` detectar entrega

---

## Cronograma de Implementação

### Fase 1: Fundação (Semana 1-2)
- [ ] Configurar pg_cron no Supabase
- [ ] Criar estrutura base para Edge Functions de jobs
- [ ] Implementar sistema de logs para jobs
- [ ] Criar tabela `background_jobs` para tracking de execuções

### Fase 2: Sincronização Baselinker (Semana 3-4)
- [ ] Migrar `sync-baselinker-orders`
- [ ] Migrar `sync-baselinker-products`
- [ ] Migrar `sync-baselinker-clients` (integrado em orders)
- [ ] Migrar `sync-baselinker-returns`
- [ ] Testes e validação

### Fase 3: Gestão de Estoque (Semana 5)
- [ ] Migrar `process-stock-transfers`
- [ ] Migrar `update-new-products-stock`
- [ ] Testes de integridade de estoque

### Fase 4: Tracking & Notificações (Semana 6)
- [ ] Melhorar `update-tracking-status` existente
- [ ] Implementar `notify-stock-arrival`
- [ ] Testes de notificações

### Fase 5: Automações de Marketing (Semana 7)
- [ ] Migrar `send-reorder-messages`
- [ ] Migrar `send-upsell-messages`
- [ ] Testes A/B de mensagens

### Fase 6: Integrações Finais (Semana 8)
- [ ] Migrar `sync-chatwoot-contacts`
- [ ] Dashboard de monitoramento de jobs
- [ ] Documentação final

### Fase 7: Transição (Semana 9)
- [ ] Executar jobs em paralelo (n8n + nativo) para validação
- [ ] Comparar resultados e performance
- [ ] Desativar workflows n8n gradualmente

---

## Estrutura de Tabelas de Suporte

### Tabela: `background_jobs`
```sql
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  job_name TEXT NOT NULL,
  status TEXT DEFAULT 'running', -- running, completed, failed
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  execution_time_ms INTEGER,
  records_processed INTEGER DEFAULT 0
);
```

### Tabela: `job_schedules`
```sql
CREATE TABLE job_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  job_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Monitoramento e Logs

### Dashboard de Jobs (Nova Página)
Criar página `/jobs` no CRM com:
- Lista de jobs agendados
- Status de última execução
- Tempo médio de execução
- Logs de erro
- Botão para executar manualmente
- Configuração de schedule por workspace

### Notificações de Falha
- Email para admin quando job falhar 3x consecutivas
- Webhook para Slack/Discord (opcional)
- Logs detalhados no Supabase

---

## Vantagens da Migração

1. **Custo**: Elimina necessidade de manter instância n8n
2. **Integração**: Tudo no mesmo ecossistema Supabase
3. **Manutenção**: Código TypeScript versionado no Git
4. **Escalabilidade**: Edge Functions escalam automaticamente
5. **Debugging**: Logs nativos do Supabase
6. **Segurança**: Sem expor credenciais em workflows externos

---

## Próximos Passos

1. **Revisar este plano** com a equipe
2. **Priorizar workflows** mais críticos primeiro
3. **Criar branch** `feature/background-jobs-migration`
4. **Implementar Fase 1** e validar a arquitetura
5. **Iterar** pelas fases seguintes

---

## Notas Importantes

- **Credenciais**: Todos os tokens/keys do n8n devem ser migrados para variáveis de ambiente do Supabase
- **Rate Limiting**: Implementar rate limiting para APIs externas (Baselinker, Tracking)
- **Retry Logic**: Adicionar retry automático para falhas temporárias
- **Idempotência**: Garantir que jobs podem ser re-executados sem duplicar dados
