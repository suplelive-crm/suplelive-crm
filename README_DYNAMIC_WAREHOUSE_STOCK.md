# Sistema de Estoque Dinâmico por Warehouse

## 📋 Visão Geral

O sistema foi migrado de um modelo fixo (ES/SP) para um **sistema dinâmico** que suporta múltiplos warehouses configurados no Baselinker. Agora o estoque não está mais limitado a duas localizações - você pode ter quantos warehouses precisar!

---

## ✅ O que foi Implementado

### 1. **Nova Tabela: `product_stock_by_warehouse`**

Tabela central para gerenciar estoque de forma dinâmica:

```sql
CREATE TABLE product_stock_by_warehouse (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  product_id UUID REFERENCES products(id),
  warehouse_id TEXT NOT NULL,           -- ID do warehouse do Baselinker
  sku TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(workspace_id, sku, warehouse_id)
);
```

**Características:**
- ✅ Suporta ilimitados warehouses
- ✅ Estoque específico por warehouse
- ✅ Constraint UNIQUE previne duplicatas
- ✅ RLS (Row Level Security) habilitado

### 2. **ProductAutocomplete - Estoque Dinâmico**

**Arquivo:** [`src/components/tracking/ProductAutocomplete.tsx`](src/components/tracking/ProductAutocomplete.tsx)

**O que faz:**
- Busca estoque em tempo real da tabela `product_stock_by_warehouse`
- Mostra estoque do warehouse selecionado (quando há seleção)
- Mostra estoque total de todos os warehouses (quando não há seleção)
- **Fallback automático** para `stock_es`/`stock_sp` durante migração

**Exemplo de exibição:**
- **Com warehouse selecionado:** `Estoque: 50`
- **Sem warehouse selecionado:** `Total: 150 (3 warehouses)`
- **Produto em único warehouse:** `Estoque: 50`

### 3. **BaselinkerStore - Sincronização Automática**

**Arquivo:** [`src/store/baselinkerStore.ts:676-690`](src/store/baselinkerStore.ts#L676-L690)

**O que faz:**
- Ao sincronizar inventário do Baselinker, salva o estoque na nova tabela
- Usa `upsert` para atualizar estoque existente ou inserir novo
- Mantém `stock_es` temporariamente para compatibilidade (será removido)

**Código:**
```typescript
await supabase
  .from('product_stock_by_warehouse')
  .upsert({
    workspace_id: currentWorkspace.id,
    product_id: productId,
    warehouse_id: warehouseId,        // Do Baselinker
    sku: product.sku,
    stock_quantity: parseInt(stockQuantity),
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'workspace_id,sku,warehouse_id'
  });
```

### 4. **InventoryStore - Listagem e Atualização**

**Arquivo:** [`src/store/inventoryStore.ts`](src/store/inventoryStore.ts)

**Mudanças:**

#### `loadProducts()` - Linhas 85-152
- Busca produtos da tabela `products`
- Busca estoques de `product_stock_by_warehouse`
- Cria Map com estoques: `Map<product_id, Map<warehouse_id, stock>>`
- Mapeia produtos com estoque correto por warehouse
- **Fallback** para `stock_es` se não houver estoque na nova tabela

#### `updateProductStock()` - Linhas 221-270
- Atualiza estoque em `product_stock_by_warehouse`
- Atualiza também `stock_es` (temporário)
- Usa `upsert` para criar ou atualizar registro

### 5. **Dialogs de Compra e Transferência**

**Arquivos:**
- [`CreatePurchaseDialog.tsx`](src/components/tracking/CreatePurchaseDialog.tsx)
- [`CreateTransferDialog.tsx`](src/components/tracking/CreateTransferDialog.tsx)

**Mudanças:**
- Seleção de warehouses dinâmicos do Baselinker
- Autocomplete mostra estoque do warehouse selecionado
- **Compra:** Warehouse de destino
- **Transferência:** Warehouse de origem e destino

---

## 🚀 Como Migrar

### **Passo 1: Executar SQL no Supabase**

1. Acesse o Supabase Dashboard: SQL Editor
2. Execute o arquivo: [`MIGRATION_DYNAMIC_WAREHOUSE_STOCK.sql`](MIGRATION_DYNAMIC_WAREHOUSE_STOCK.sql)
3. Confirme que a tabela foi criada:

```sql
SELECT * FROM pg_tables WHERE tablename = 'product_stock_by_warehouse';
```

### **Passo 2: Sincronizar Inventário do Baselinker**

1. Acesse a página de Integrações
2. Configure sua API Key do Baselinker
3. Clique em **"Sincronizar Inventário"**
4. O sistema vai popular automaticamente a tabela `product_stock_by_warehouse`

### **Passo 3: Verificar Dados**

```sql
-- Ver estoques por warehouse
SELECT
  p.name,
  p.sku,
  bw.warehouse_name,
  psw.stock_quantity
FROM product_stock_by_warehouse psw
LEFT JOIN products p ON psw.product_id = p.id
LEFT JOIN baselinker_warehouses bw ON psw.warehouse_id = bw.warehouse_id
WHERE psw.workspace_id = 'SEU_WORKSPACE_ID';
```

### **Passo 4: Testar no Frontend**

1. Abra o modal "Nova Compra" ou "Nova Transferência"
2. Selecione um warehouse
3. Busque um produto no autocomplete
4. Verifique se o estoque exibido está correto

---

## 📊 Estrutura de Dados

### **Antes (Sistema Fixo)**

```
products
├── id
├── sku
├── name
├── stock_es    ❌ Limitado a ES
├── stock_sp    ❌ Limitado a SP
└── warehouseID
```

### **Depois (Sistema Dinâmico)**

```
products                          product_stock_by_warehouse
├── id ─────────────────────────► ├── product_id
├── sku                           ├── sku
├── name                          ├── warehouse_id  ✅ Dinâmico
├── stock_es (DEPRECATED)         ├── stock_quantity
├── stock_sp (DEPRECATED)         └── workspace_id
└── warehouseID
```

---

## 🔄 Fluxo de Dados

### **Sincronização Baselinker → Sistema**

```
┌─────────────────┐
│ Baselinker API  │
│ getInventory... │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ baselinkerStore.syncInventory│
└────────┬────────────────────┘
         │
         ├──► Update products (name, price, cost, etc)
         │
         └──► Upsert product_stock_by_warehouse
              ├─ warehouse_id (do Baselinker)
              ├─ stock_quantity
              └─ sku
```

### **Exibição no Frontend**

```
┌──────────────────┐
│ ProductAutocomplete │
└────────┬───────────┘
         │
         ▼
┌─────────────────────────────┐
│ Fetch from:                 │
│ product_stock_by_warehouse  │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Map<SKU, Map<WH_ID, Stock>> │
└────────┬────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Display:                     │
│ - "Estoque: 50" (selecionado)│
│ - "Total: 150 (3 warehouses)"│
└──────────────────────────────┘
```

---

## 🧪 Testes Recomendados

### **1. Sincronização**
- [ ] Sincronizar inventário do Baselinker
- [ ] Verificar se todos os produtos estão na tabela `product_stock_by_warehouse`
- [ ] Confirmar que os `warehouse_id` estão corretos

### **2. Autocomplete**
- [ ] Abrir modal de compra/transferência
- [ ] Selecionar warehouse
- [ ] Buscar produto
- [ ] Confirmar que estoque exibido é do warehouse selecionado

### **3. Atualização de Estoque**
- [ ] Alterar estoque manualmente
- [ ] Verificar se salvou em `product_stock_by_warehouse`
- [ ] Confirmar que o autocomplete reflete a mudança

### **4. Múltiplos Warehouses**
- [ ] Produto com estoque em 3+ warehouses
- [ ] Verificar exibição "Total: X (Y warehouses)"

---

## 📝 Notas Importantes

### **Compatibilidade Durante Migração**

O sistema mantém **compatibilidade reversa**:
- Coluna `stock_es` ainda é atualizada (mas não mais usada)
- Autocomplete usa fallback para `stock_es`/`stock_sp` se não houver dados na nova tabela
- Você pode migrar gradualmente

### **Quando Remover Colunas Antigas**

Após confirmar que tudo funciona, você pode remover:

```sql
-- APENAS APÓS TESTAR TUDO!
ALTER TABLE products DROP COLUMN stock_es;
ALTER TABLE products DROP COLUMN stock_sp;
```

### **Funções SQL Disponíveis**

```sql
-- Obter estoque total de um produto (todas warehouses)
SELECT get_product_total_stock('SKU123', 'workspace_id');

-- Obter estoque de um produto em warehouse específico
SELECT get_product_warehouse_stock('SKU123', 'WH_ID', 'workspace_id');
```

### **View Pronta**

```sql
-- Ver resumo de estoque por produto
SELECT * FROM product_stock_summary
WHERE workspace_id = 'SEU_WORKSPACE_ID';
```

---

## 🎯 Benefícios

✅ **Escalabilidade**: Suporta quantos warehouses precisar
✅ **Precisão**: Estoque específico por localização
✅ **Flexibilidade**: Configuração dinâmica do Baselinker
✅ **Performance**: Queries otimizadas com índices
✅ **Auditoria**: Timestamp de criação e atualização

---

## 🐛 Troubleshooting

### **"Estoque não aparece no autocomplete"**

1. Verificar se a tabela foi criada:
```sql
SELECT * FROM product_stock_by_warehouse LIMIT 5;
```

2. Sincronizar inventário novamente
3. Verificar console do navegador para erros

### **"Estoque mostra valor errado"**

1. Verificar qual warehouse está selecionado
2. Confirmar estoque no banco:
```sql
SELECT * FROM product_stock_by_warehouse
WHERE sku = 'SEU_SKU';
```

### **"Erro ao salvar estoque"**

1. Verificar RLS policies:
```sql
SELECT * FROM pg_policies
WHERE tablename = 'product_stock_by_warehouse';
```

2. Confirmar que usuário está autenticado

---

**Última atualização:** 2025-11-13
**Autor:** Claude Code
**Versão:** 1.0.0
