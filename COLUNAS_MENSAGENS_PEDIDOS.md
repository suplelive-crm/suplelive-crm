# ✅ Colunas de Rastreamento de Mensagens nos Pedidos

**Data**: 08/01/2026
**Status**: ✅ Pronto para Teste (Sem Migration Necessária!)

---

## 📋 Resumo

Adicionadas **duas colunas** na tabela de pedidos para rastrear mensagens automáticas:

1. **2ª Compra** ✅ - Mostra se mensagem de upsell foi enviada (usa `orders.mensagem_enviada`)
2. **Recompra** ⏳ - Mostra se mensagem de recompra foi enviada (em desenvolvimento)

### Visualização:
- ✅ Check verde = Mensagem enviada
- ❌ X vermelho = Mensagem NÃO enviada
- ⏳ Relógio = Em desenvolvimento

---

## 🎯 Campos Utilizados (JÁ EXISTEM no Banco!)

| Coluna UI | Campo Banco | Tabela | Status |
|-----------|-------------|--------|--------|
| **2ª Compra** | `mensagem_enviada` | `orders` | ✅ Funcionando |
| **Recompra** | `mensagem_recompra` | `orders_products` | ⏳ Precisa JOIN |

**IMPORTANTE**: Não precisa migration! Os campos já existem no schema atual.

---

## 🗂️ Arquivos Modificados

1. ✅ [src/types/index.ts:267](src/types/index.ts#L267) - Tipo Order
2. ✅ [src/pages/OrdersPage.tsx:253-304](src/pages/OrdersPage.tsx#L253) - Colunas + células

---

## 📊 Como Ficou:

```
| ID | Cliente | Valor | Status | Data | 2ª Compra | Recompra | Ações |
|----|---------|-------|--------|------|-----------|----------|-------|
| #1 | João    | R$150 | OK     | Hoje | ✅        | ⏳       | ...   |
| #2 | Maria   | R$200 | OK     | Hoje | ❌        | ⏳       | ...   |
```

---

## 🚀 Como Testar

**Não precisa migration!** Só rodar o projeto:

```bash
npm run dev
```

1. Login
2. Ir em "Pedidos"
3. Ver colunas "2ª Compra" e "Recompra"
4. Passar mouse nos emojis (tooltip)

---

## 🔧 Próximo Passo: Implementar Coluna "Recompra"

Para fazer a coluna "Recompra" funcionar de verdade, precisa buscar dados de `orders_products`:

```typescript
// No crmStore.ts - fetchOrders()
const { data } = await supabase
  .from('orders')
  .select(`
    *,
    client:clients(*),
    products:orders_products(mensagem_recompra)
  `);

// No OrdersPage.tsx
const hasReorder = order.products?.some(p => p.mensagem_recompra);

<TableCell>
  {hasReorder ? '✅' : '❌'}
</TableCell>
```

---

## 📝 Entendendo os Campos

### `orders.mensagem_enviada`
- **Era para**: Boas-vindas
- **Usado agora**: Mensagem de **2ª compra** (upsell)
- **Quando marca**: Cliente fez 2º pedido e recebeu mensagem

### `orders_products.mensagem_recompra`
- **Para**: Mensagem de **recompra** (após X dias)
- **Quando marca**: Workflow detectou que produto está acabando e enviou mensagem
- **Baseado em**: `envio_duracao` (ex: após 30 dias)

---

**Status**: ✅ Pronto! Só testar.
**Criado por**: Claude Code
