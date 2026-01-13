# Plano de Migração: Campo "Verified" de Orders para Clients

## Objetivo
Mover o campo de verificação de pedidos para clientes, pois **o "verificado" indica se o número do WhatsApp do cliente foi verificado**, não o pedido em si.

## Análise Atual

### Banco de Dados
- ✅ Tabela `orders` tem campo `is_verified` (boolean)
- ❌ Tabela `clients` NÃO tem campo de verificação ainda

### Frontend (5 arquivos afetados)
1. `src/pages/OrdersPage.tsx` - Usa `order.is_verified` para filtros e badges
2. `src/types/tracking.ts` - Define tipo Order com is_verified
3. `src/store/trackingStore.ts` - Busca pedidos com is_verified
4. `src/store/crmStore.ts` - Busca pedidos com is_verified  
5. `src/components/clients/EditClientDialog.tsx` - Pode ter verificação
6. `src/components/tracking/TrackingDetailsDialog.tsx` - Mostra status verificado

## Plano de Execução

### FASE 1: Preparação do Banco de Dados ✅
```sql
-- 1. Adicionar campo phone_verified na tabela clients
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- 2. Migrar dados: marcar cliente como verificado se tiver algum pedido verificado
UPDATE clients c
SET phone_verified = true
WHERE EXISTS (
  SELECT 1 FROM orders o
  WHERE o.client_id = c.id AND o.is_verified = true
);
```

### FASE 2: Atualizar Frontend

#### 2.1 Atualizar Types
```typescript
// src/types/index.ts
export interface Client {
  // ... existing fields
  phone_verified: boolean;  // NOVO CAMPO
}

export interface Order {
  // ... existing fields
  // is_verified: boolean;  // REMOVER ou deprecated
}
```

#### 2.2 Atualizar OrdersPage.tsx
**ANTES**: Mostrava verificação do pedido
**DEPOIS**: Mostrar verificação do cliente (telefone verificado)

```typescript
// Buscar orders com join de clients incluindo phone_verified
.select('*, client:clients(*, phone_verified)')

// Mudar exibição
{order.client.phone_verified && (
  <Badge className="bg-green-100 text-green-800">
    <CheckCircle className="h-3 w-3 mr-1" />
    Tel. Verificado
  </Badge>
)}

// Filtro "Apenas Não Verificados" agora filtra por cliente.phone_verified
const matchesVerification = !showOnlyUnverified || !order.client?.phone_verified;
```

#### 2.3 Atualizar Stores
- `crmStore.ts`: Incluir `phone_verified` no SELECT de clients
- `trackingStore.ts`: Ajustar queries se necessário

#### 2.4 Adicionar funcionalidade de verificação manual
Em `ClientsPage.tsx` ou `EditClientDialog.tsx`:
- Botão para marcar/desmarcar número como verificado
- Ícone visual indicando se número está verificado

### FASE 3: Limpeza (OPCIONAL - fazer depois de testar)
```sql
-- Remover campo is_verified da tabela orders
ALTER TABLE orders DROP COLUMN IF EXISTS is_verified;
```

## Ordem de Execução

1. ✅ **Executar SQL de migração** (FASE 1)
2. ⏳ **Atualizar types** (2.1)
3. ⏳ **Atualizar OrdersPage** (2.2)
4. ⏳ **Atualizar Stores** (2.3)
5. ⏳ **Adicionar verificação manual** (2.4)
6. ⏳ **Testar tudo**
7. ⏳ **Remover campo obsoleto** (FASE 3 - OPCIONAL)

## Benefícios

- ✅ Semântica correta: "verificado" agora está no cliente, não no pedido
- ✅ Evita redundância: não precisa marcar cada pedido como verificado
- ✅ Centralizado: uma vez verificado o número, todos os pedidos do cliente são confiáveis
- ✅ Melhor UX: pode ver quais clientes têm número verificado na lista de clientes
