# Fix: Paginação da API Baselinker - Sincronização de Pedidos

## 🐛 Problema Identificado

A API do Baselinker tem um **limite de 100 pedidos por requisição**. Quando você tem mais de 100 pedidos para sincronizar, a API retorna apenas os primeiros 100 e ignora o resto.

### Sintomas:
- ❌ Sincronização parando em 100 pedidos
- ❌ Pedidos mais antigos/recentes não aparecendo no sistema
- ❌ Contador mostrando sempre "100 pedidos sincronizados"

---

## ✅ Solução Implementada

Implementamos um **sistema de paginação automática** que busca todos os pedidos em lotes de 100 até não haver mais pedidos para buscar.

### Arquivo Modificado:
**[`src/store/baselinkerStore.ts`](src/store/baselinkerStore.ts)** - Função `syncOrders()` (linhas 300-339)

### Como Funciona:

```typescript
// Sistema de paginação: Baselinker retorna no máximo 100 pedidos por vez
let allOrders: any[] = [];
let page = 1;
let hasMoreOrders = true;

while (hasMoreOrders) {
  const parametersToSync = {
    date_from: lastSyncTimestamp,
    status_id: statusIdsToSync.join(','),
    page: page  // ⬅️ Parâmetro de paginação
  };

  const response = await baselinker.getOrders(config.apiKey, parametersToSync);
  const orders = response.orders || [];

  if (orders.length === 0) {
    // Não há mais pedidos
    hasMoreOrders = false;
  } else {
    allOrders.push(...orders);

    // Se retornou exatamente 100, provavelmente há mais pedidos
    if (orders.length === 100) {
      page++;  // ⬅️ Próxima página
    } else {
      // Menos de 100 pedidos = última página
      hasMoreOrders = false;
    }
  }
}

console.log(`✅ TOTAL: ${allOrders.length} pedidos encontrados em ${page} página(s)`);
```

---

## 🔍 Lógica de Paginação

### **Condição de Parada:**
1. **0 pedidos retornados** → Não há mais dados
2. **< 100 pedidos retornados** → Última página
3. **Exatamente 100 pedidos** → Provavelmente há mais páginas, continua buscando

### **Logs no Console:**
```
[PÁGINA 1] Buscando pedidos... { date_from: 1699564800, status_id: "123,456", page: 1 }
[PÁGINA 1] Encontrados 100 pedidos
[PÁGINA 2] Continuando para próxima página (100 pedidos encontrados)...
[PÁGINA 2] Buscando pedidos... { date_from: 1699564800, status_id: "123,456", page: 2 }
[PÁGINA 2] Encontrados 100 pedidos
[PÁGINA 3] Continuando para próxima página (100 pedidos encontrados)...
[PÁGINA 3] Buscando pedidos... { date_from: 1699564800, status_id: "123,456", page: 3 }
[PÁGINA 3] Encontrados 47 pedidos
[PÁGINA 3] Última página (47 pedidos)
✅ TOTAL: 247 pedidos encontrados em 3 página(s)
```

---

## 📊 Exemplos de Cenários

### **Cenário 1: Menos de 100 pedidos**
- Página 1: 73 pedidos → **Para** (última página)
- **Total: 73 pedidos**

### **Cenário 2: Exatamente 100 pedidos**
- Página 1: 100 pedidos → Continua
- Página 2: 0 pedidos → **Para** (sem mais dados)
- **Total: 100 pedidos**

### **Cenário 3: Mais de 100 pedidos**
- Página 1: 100 pedidos → Continua
- Página 2: 100 pedidos → Continua
- Página 3: 100 pedidos → Continua
- Página 4: 52 pedidos → **Para** (última página)
- **Total: 352 pedidos**

### **Cenário 4: Muitos pedidos (1000+)**
- Páginas 1-10: 100 pedidos cada → Continua
- Página 11: 42 pedidos → **Para** (última página)
- **Total: 1042 pedidos**

---

## ⚡ Performance e Rate Limiting

### **Rate Limiting Automático**
O sistema já tem **rate limiting de 1 segundo** entre requisições (implementado em `baselinker-api.ts`).

**Tempo estimado para sincronizar:**
- 100 pedidos: ~1 segundo
- 500 pedidos: ~5 segundos (5 páginas × 1 segundo)
- 1000 pedidos: ~10 segundos (10 páginas × 1 segundo)

### **Cache**
- Cada requisição é cacheada por **60 segundos**
- Se você sincronizar novamente em menos de 1 minuto, usa dados do cache (instantâneo)

---

## 🧪 Como Testar

### **1. Sincronização Normal**
1. Acesse Integrações → Baselinker
2. Clique em "Sincronizar Pedidos"
3. Observe o console do navegador (F12 → Console)
4. Veja os logs de paginação

### **2. Sincronização Completa (Force Full Sync)**
```typescript
// No console do navegador
const baselinkerStore = useBaselinkerStore.getState();
await baselinkerStore.syncOrders(true); // Force full sync
```

### **3. Verificar Total de Pedidos**
```sql
-- No Supabase SQL Editor
SELECT COUNT(*) as total_pedidos
FROM orders
WHERE workspace_id = 'SEU_WORKSPACE_ID';
```

---

## 📝 Documentação da API Baselinker

### **Método: `getOrders`**

**Parâmetros:**
- `date_from` (opcional): Timestamp UNIX - buscar pedidos desde esta data
- `date_to` (opcional): Timestamp UNIX - buscar pedidos até esta data
- `status_id` (opcional): IDs dos status separados por vírgula (ex: "123,456,789")
- `page` (opcional): Número da página (padrão: 1)
- `get_unconfirmed_orders` (opcional): Incluir pedidos não confirmados

**Retorno:**
```json
{
  "status": "SUCCESS",
  "orders": [
    { "order_id": "123", "price": "100.00", ... },
    { "order_id": "124", "price": "150.00", ... }
  ]
}
```

**Limite:** Máximo de **100 pedidos por página**

**Documentação oficial:** https://api.baselinker.com/index.php?method=getOrders

---

## 🎯 Benefícios da Implementação

✅ **Sincronização Completa**: Todos os pedidos são buscados, não apenas os primeiros 100
✅ **Automático**: Não precisa configurar nada, funciona automaticamente
✅ **Logs Detalhados**: Fácil de monitorar quantos pedidos foram sincronizados
✅ **Performance**: Rate limiting integrado previne bloqueio da API
✅ **Escalável**: Funciona com 10, 100, 1000+ pedidos

---

## 🔄 Sincronização Incremental vs Completa

### **Sincronização Incremental (Padrão)**
Busca apenas pedidos **desde a última sincronização**:
```typescript
await baselinkerStore.syncOrders(); // Usa date_from do último sync
```

### **Sincronização Completa**
Busca **todos os pedidos** desde o início:
```typescript
await baselinkerStore.syncOrders(true); // Force full sync
```

---

## 🐛 Troubleshooting

### **"Sincronização trava em 100 pedidos"**
✅ **RESOLVIDO** - Agora busca todas as páginas automaticamente

### **"Rate limit exceeded"**
- O sistema tem rate limiting de 1 segundo entre páginas
- Se bloquear, aguarde o tempo indicado no erro

### **"Pedidos duplicados"**
- O sistema verifica `external_id` antes de inserir
- Pedidos existentes são atualizados, não duplicados

### **"Sincronização muito lenta"**
- É normal: 1 segundo por página de 100 pedidos
- Para 1000 pedidos = ~10 segundos
- Você pode monitorar o progresso no console

---

## 📌 Notas Importantes

1. **Primeira Sincronização**: Pode demorar se você tiver muitos pedidos históricos
2. **Sincronizações Subsequentes**: Rápidas (busca apenas novos pedidos)
3. **Cache**: Sincronizar 2x em menos de 1 minuto usa cache (instantâneo)
4. **Workspace**: Cada workspace sincroniza independentemente

---

**Última atualização:** 2025-11-13
**Autor:** Claude Code
**Issue Resolvido:** Limite de 100 pedidos da API Baselinker
