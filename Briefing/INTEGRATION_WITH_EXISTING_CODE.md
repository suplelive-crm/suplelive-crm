# Integração com Código Existente

Este documento explica como integrar o sistema event-driven com o código existente da plataforma.

## 🔗 Código Existente que Vamos Usar

### 1. **baselinkerStore.ts**
Já tem toda a lógica de conexão e sincronização com Baselinker.

**O que vamos fazer**:
- ✅ Usar `getBaselinker()` para fazer chamadas API
- ✅ Usar configuração salva em `localStorage` (`baselinker_config_${workspace.id}`)
- ✅ Manter `baselinker_sync` table para estado de sincronização
- ❌ **NÃO vamos recriar** - apenas adaptar Edge Functions para usar isso

### 2. **workspaceStore.ts**
Já tem gerenciamento de WhatsApp instances e Evolution API.

**O que vamos fazer**:
- ✅ Usar `whatsappInstances` para enviar mensagens
- ✅ Usar `sendWhatsAppMessage()` existente
- ❌ **NÃO vamos criar nova função** de envio de WhatsApp

### 3. **Tabelas de Log Existentes**
- `log_lançamento_estoque` - Log de compras
- `log_lançamento_transferencia` - Log de transferências

**O que fizemos**:
- ✅ Adicionamos campos de auditoria (source, action_type, user_id, workspace_id, metadata)
- ✅ Criamos `stock_change_log` para consolidar TODOS os logs
- ✅ Função helper `log_stock_change()` para facilitar uso

---

## 📋 Nova Estrutura

### Tabelas Adicionadas

#### 1. `baselinker_warehouses`
Configuração de warehouses ativos por workspace.

```sql
CREATE TABLE baselinker_warehouses (
  workspace_id UUID,
  warehouse_id TEXT, -- 'bl_1', 'bl_2', etc
  warehouse_name TEXT,
  is_active BOOLEAN, -- Se plataforma pode alterar
  allow_stock_updates BOOLEAN,
  sync_direction TEXT -- 'read_only', 'write_only', 'bidirectional'
);
```

**Como usar no código**:
```typescript
// Verificar se warehouse está ativo antes de atualizar
const { data: warehouse } = await supabase
  .from('baselinker_warehouses')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('warehouse_id', 'bl_1')
  .eq('is_active', true)
  .single();

if (!warehouse || !warehouse.allow_stock_updates) {
  throw new Error('Warehouse não está ativo para alterações');
}
```

#### 2. `stock_change_log`
Log consolidado de TODAS as alterações de estoque.

```sql
CREATE TABLE stock_change_log (
  workspace_id UUID,
  sku TEXT,
  warehouse_id TEXT,
  action_type TEXT, -- 'add', 'remove', 'adjust', 'sync', etc
  source TEXT, -- 'manual', 'baselinker', 'system', 'purchase', etc
  previous_quantity NUMERIC,
  new_quantity NUMERIC,
  quantity_change NUMERIC, -- Calculado automaticamente
  change_reason TEXT,
  reference_id UUID, -- ID da compra, transfer, order, etc
  user_id UUID,
  metadata JSONB
);
```

**Como usar no código**:
```typescript
// Função helper para log
const logId = await supabase.rpc('log_stock_change', {
  p_workspace_id: workspaceId,
  p_sku: 'PROD123',
  p_warehouse_id: 'bl_1',
  p_previous_qty: 10,
  p_new_qty: 15,
  p_action_type: 'sync',
  p_source: 'baselinker',
  p_reason: 'Sincronização automática via event-driven',
  p_reference_id: purchaseId,
  p_reference_type: 'purchase',
  p_user_id: userId
});
```

---

## 🔄 Adaptando Edge Functions

### Antes (o que criamos)
```typescript
// supabase/functions/_shared/baselinker.ts
// Criamos nossa própria classe BaselinkerAPI
```

### Depois (o que vamos fazer)
```typescript
// Usar o baselinker-proxy existente
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/baselinker-proxy`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey: baselinkerToken,
      method: 'getJournalList',
      parameters: { last_log_id: lastLogId }
    })
  }
);
```

---

## 🎯 Fluxo Completo: Atualização de Estoque

### 1. **Plataforma recebe encomenda** (purchases)

```typescript
// src/components/tracking/CreatePurchaseDialog.tsx
// Quando produtos da compra chegam:

// 1. Verificar warehouse ativo
const { data: warehouse } = await supabase
  .from('baselinker_warehouses')
  .select('*')
  .eq('workspace_id', workspaceId)
  .eq('warehouse_id', 'bl_1')
  .eq('is_active', true)
  .single();

if (!warehouse || !warehouse.allow_stock_updates) {
  toast.error('Warehouse não configurado para atualizações');
  return;
}

// 2. Buscar produto e estoque atual
const { data: product } = await supabase
  .from('products')
  .select('*')
  .eq('sku', productSku)
  .single();

const currentStock = product.stock_es; // ou stock_sp

// 3. Atualizar estoque no banco local
const newStock = currentStock + quantityReceived;

await supabase
  .from('products')
  .update({ stock_es: newStock })
  .eq('id', product.id);

// 4. Atualizar estoque no Baselinker
await fetch(`${SUPABASE_URL}/functions/v1/update-baselinker-stock`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workspace_id: workspaceId,
    warehouse_id: 'bl_1',
    sku: productSku,
    new_quantity: newStock,
    reason: 'Recebimento de compra',
    reference_id: purchaseId,
    reference_type: 'purchase'
  })
});

// 5. Log automático será criado pela Edge Function
```

### 2. **Edge Function atualiza Baselinker**

```typescript
// supabase/functions/update-baselinker-stock/index.ts

serve(async (req) => {
  const { workspace_id, warehouse_id, sku, new_quantity, reason, reference_id } = await req.json();

  const supabase = createClient(...);

  // 1. Verificar warehouse ativo
  const isActive = await supabase.rpc('is_warehouse_active', {
    p_workspace_id: workspace_id,
    p_warehouse_id: warehouse_id
  });

  if (!isActive) {
    throw new Error('Warehouse not active for updates');
  }

  // 2. Buscar estoque atual no Baselinker (para ter previous_qty correto)
  const { data: product } = await supabase
    .from('products')
    .select('stock_es, stock_sp')
    .eq('workspace_id', workspace_id)
    .eq('sku', sku)
    .single();

  const previousQty = warehouse_id === 'bl_1' ? product.stock_es : product.stock_sp;

  // 3. Atualizar no Baselinker via proxy
  const response = await fetch(`${SUPABASE_URL}/functions/v1/baselinker-proxy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apiKey: BASELINKER_TOKEN,
      method: 'updateInventoryProductsQuantity',
      parameters: {
        inventory_id: warehouse_id,
        products: {
          [sku]: {
            stock: new_quantity
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error('Failed to update Baselinker stock');
  }

  // 4. Criar log automático
  const { data: user } = await supabase.auth.getUser();

  await supabase.rpc('log_stock_change', {
    p_workspace_id: workspace_id,
    p_sku: sku,
    p_warehouse_id: warehouse_id,
    p_previous_qty: previousQty,
    p_new_qty: new_quantity,
    p_action_type: 'adjust',
    p_source: 'system',
    p_reason: reason,
    p_reference_id: reference_id,
    p_reference_type: 'purchase',
    p_user_id: user?.id
  });

  return new Response(JSON.stringify({ success: true }));
});
```

---

## 🖥️ Frontend: Configuração de Warehouses

### Componente no IntegrationsPage

```typescript
// src/components/integrations/BaselinkerWarehouseConfig.tsx

export function BaselinkerWarehouseConfig() {
  const { currentWorkspace } = useWorkspaceStore();
  const [warehouses, setWarehouses] = useState([]);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);

  useEffect(() => {
    loadWarehouses();
  }, [currentWorkspace]);

  const loadWarehouses = async () => {
    // 1. Buscar warehouses do Baselinker
    const baselinker = getBaselinker();
    const inventories = await baselinker.getInventories(apiKey);

    setAvailableWarehouses(inventories.inventories);

    // 2. Buscar configuração salva
    const { data } = await supabase
      .from('baselinker_warehouses')
      .select('*')
      .eq('workspace_id', currentWorkspace.id);

    setWarehouses(data || []);
  };

  const toggleWarehouse = async (warehouseId: string, isActive: boolean) => {
    await supabase
      .from('baselinker_warehouses')
      .upsert({
        workspace_id: currentWorkspace.id,
        warehouse_id: warehouseId,
        is_active: isActive
      });

    loadWarehouses();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Warehouses Ativos</CardTitle>
        <CardDescription>
          Selecione quais warehouses a plataforma pode alterar
        </CardDescription>
      </CardHeader>
      <CardContent>
        {availableWarehouses.map((wh) => {
          const config = warehouses.find(w => w.warehouse_id === wh.warehouse_id);

          return (
            <div key={wh.warehouse_id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{wh.name}</p>
                <p className="text-sm text-gray-500">{wh.warehouse_id}</p>
              </div>
              <Switch
                checked={config?.is_active || false}
                onCheckedChange={(checked) => toggleWarehouse(wh.warehouse_id, checked)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

---

## 📊 Frontend: Página /jobs

### Visualizar Event Queue

```typescript
// src/pages/JobsPage.tsx

export function JobsPage() {
  const [events, setEvents] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);

  useEffect(() => {
    loadEventQueue();
    loadStockLogs();
  }, []);

  const loadEventQueue = async () => {
    const { data } = await supabase
      .from('event_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    setEvents(data);
  };

  const loadStockLogs = async () => {
    // Usar a view criada na migration
    const { data } = await supabase
      .from('v_recent_stock_changes')
      .select('*')
      .limit(50);

    setStockLogs(data);
  };

  const retryEvent = async (eventId: string) => {
    await supabase
      .from('event_queue')
      .update({ status: 'pending', retry_count: 0 })
      .eq('id', eventId);

    loadEventQueue();
  };

  return (
    <DashboardLayout>
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Fila de Eventos</TabsTrigger>
          <TabsTrigger value="stock-logs">Logs de Estoque</TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{event.event_name}</TableCell>
                  <TableCell>
                    <Badge variant={event.status === 'completed' ? 'success' : event.status === 'failed' ? 'destructive' : 'default'}>
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{event.order_id}</TableCell>
                  <TableCell>{format(new Date(event.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>
                    {event.status === 'failed' && (
                      <Button size="sm" onClick={() => retryEvent(event.id)}>
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="stock-logs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.sku}</TableCell>
                  <TableCell>{log.product_name}</TableCell>
                  <TableCell>{log.warehouse_name}</TableCell>
                  <TableCell>{log.action_type}</TableCell>
                  <TableCell>
                    <span className={log.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}>
                      {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">
                      ({log.previous_quantity} → {log.new_quantity})
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.source}</Badge>
                  </TableCell>
                  <TableCell>{format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
```

---

## ✅ Checklist de Integração

### Backend
- [ ] Executar migration `20250107_stock_logs_enhancement.sql`
- [ ] Criar Edge Function `update-baselinker-stock`
- [ ] Adaptar `process-order-created` para usar baselinker-proxy existente
- [ ] Adaptar `process-event` para usar workspaceStore para WhatsApp

### Frontend
- [ ] Criar `BaselinkerWarehouseConfig.tsx` componente
- [ ] Adicionar config de warehouses na página de Integrações
- [ ] Criar `JobsPage.tsx` com tabs (eventos + stock logs)
- [ ] Adicionar rota `/jobs` no App.tsx
- [ ] Adicionar link no Sidebar para `/jobs`

### Código Existente
- [ ] Atualizar `CreatePurchaseDialog.tsx` para chamar `update-baselinker-stock`
- [ ] Atualizar `CreateTransferDialog.tsx` para chamar `update-baselinker-stock`
- [ ] Atualizar `TrackingDetailsDialog.tsx` para logar alterações

---

## 🚀 Próximo Passo

Quer que eu crie:
1. A Edge Function `update-baselinker-stock` completa?
2. O componente `BaselinkerWarehouseConfig.tsx`?
3. A página `JobsPage.tsx` completa?

Qual prefere começar?
