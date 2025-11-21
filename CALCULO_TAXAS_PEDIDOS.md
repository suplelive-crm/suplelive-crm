# 📊 Cálculo Automático de Taxas e Faturamento Líquido

## ✅ Implementado com Sucesso!

O sistema agora calcula automaticamente as taxas de plataforma e o faturamento líquido para cada pedido sincronizado do Baselinker, replicando exatamente a lógica do n8n.

## 🎯 Como Funciona

### **Função**: `calculateOrderFinancials()`

Localização: [baselinkerStore.ts:58-138](src/store/baselinkerStore.ts#L58-L138)

Esta função analisa cada pedido e calcula:
- **`taxas`**: Taxa cobrada pela plataforma/marketplace
- **`faturamento_liquido`**: Valor que você realmente recebe (Valor pago - Taxas - Frete)
- **`canal_venda`**: Canal de origem do pedido

## 💰 Regras de Cálculo por Canal

### **1. Shopee**
- **Identificação**: `source` contém "shopee" OU `sourceId === ???` (ajustar ID correto)
- **Taxa**: 22% do valor total + R$4 por item
- **Fórmula**: `taxa = (valor_compra * 0.22) + (quantidade_produtos * 4)`

**Exemplo**:
```
Valor do pedido: R$100,00
Quantidade de produtos: 5
Taxa = (100 * 0.22) + (5 * 4) = 22 + 20 = R$42,00
Faturamento líquido = 100 - 42 - frete
```

### **2. Mercado Livre**
- **Identificação**: `source` contém "mercado", "meli" ou "mercadolivre"
- **Taxa**: 17% do valor total + R$19,50 por item
- **Fórmula**: `taxa = (valor_compra * 0.17) + (quantidade_produtos * 19.50)`

**Exemplo**:
```
Valor do pedido: R$100,00
Quantidade de produtos: 2
Taxa = (100 * 0.17) + (2 * 19.50) = 17 + 39 = R$56,00
Faturamento líquido = 100 - 56 - frete
```

### **3. Amazon / Magalu / Shoptime / Americanas**
- **Identificação**: `source` contém "amazon", "magalu", "shoptime" ou "americanas"
- **Taxa**: 24,5% do valor total
- **Fórmula**: `taxa = valor_compra * 0.245`

**Exemplo**:
```
Valor do pedido: R$100,00
Taxa = 100 * 0.245 = R$24,50
Faturamento líquido = 100 - 24.50 - frete
```

### **4. Site Próprio** (order_source_id = 8005077)
- **Identificação**: `sourceId === 8005077`
- **Taxa**: Varia por método de pagamento:
  - **Pix**: 1%
  - **Cartão**: 8,87%
  - **Boleto**: R$2,39 (fixo)

**Exemplos**:
```
Pedido via Pix: R$100,00
Taxa = 100 * 0.01 = R$1,00

Pedido via Cartão: R$100,00
Taxa = 100 * 0.0887 = R$8,87

Pedido via Boleto: R$100,00
Taxa = R$2,39 (fixo)
```

### **5. Atacado** (order_source_id = 8005285)
- **Identificação**: `sourceId === 8005285`
- **Taxa**: 0% (SEM TAXA)
- **Faturamento líquido**: Valor total - Frete

### **6. WhatsApp**
- **Identificação**: `source` contém "whatsapp" ou "wpp"
- **Taxa**: 0% (SEM TAXA)
- **Faturamento líquido**: Valor total - Frete

### **7. Padrão (Desconhecido)**
- **Quando**: Não corresponde a nenhuma das regras acima
- **Taxa**: Calcula por método de pagamento (igual ao Site Próprio)
- **Canal**: Nome da source original ou "desconhecido"

## 📁 Campos Salvos no Banco

Quando um pedido é sincronizado, os seguintes campos são preenchidos automaticamente:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `taxas` | real | Taxa calculada da plataforma (R$) |
| `faturamento_liquido` | real | Valor líquido recebido (R$) |
| `canal_venda` | text | Canal de origem (shopee, mercadolivre, site, etc) |
| `total_amount` | numeric | Valor total pago pelo cliente (incluindo frete) |
| `custo_frete(taxa)` | real | Custo do frete (extraído de `delivery_price`) |

## 🔍 Como Verificar

### **No Console do Navegador**

Quando um pedido é sincronizado, você verá logs como:

```
[PEDIDO 12345] Cálculo financeiro: {
  canal: 'mercadolivre',
  valorTotal: 150.00,
  taxas: 64.50,
  faturamentoLiquido: 75.50
}
```

### **No Banco de Dados**

```sql
SELECT
  order_id_base,
  canal_venda,
  total_amount as valor_total,
  taxas as taxa_plataforma,
  faturamento_liquido,
  "custo_frete(taxa)" as frete
FROM orders
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
ORDER BY order_date DESC
LIMIT 10;
```

## 🎓 Exemplos Práticos

### **Exemplo 1: Pedido Shopee**
```
Valor pago: R$200,00
Quantidade de produtos: 3
Frete: R$15,00

Taxa Shopee = (200 * 0.22) + (3 * 4) = 44 + 12 = R$56,00
Faturamento líquido = 200 - 56 - 15 = R$129,00
```

### **Exemplo 2: Pedido Site via Pix**
```
Valor pago: R$100,00
Frete: R$10,00
Método: Pix

Taxa Pix = 100 * 0.01 = R$1,00
Faturamento líquido = 100 - 1 - 10 = R$89,00
```

### **Exemplo 3: Pedido Atacado**
```
Valor pago: R$500,00
Frete: R$30,00

Taxa = R$0,00 (atacado não tem taxa)
Faturamento líquido = 500 - 0 - 30 = R$470,00
```

## ⚙️ Configuração de IDs de Source

**IMPORTANTE**: Ajuste os `sourceId` corretos no código!

Edite [baselinkerStore.ts:81](src/store/baselinkerStore.ts#L81):

```typescript
if (source.includes('shopee') || sourceId === 123456) { // ← AJUSTAR ID CORRETO
```

Para descobrir os IDs corretos:

1. Vá para Baselinker → Configurações → Fontes de Pedido
2. Anote o ID de cada marketplace
3. Atualize o código com os IDs reais

IDs conhecidos:
- **8005077** = Site Próprio
- **8005285** = Atacado
- **???** = Shopee (PRECISA AJUSTAR)
- **???** = Mercado Livre (PRECISA AJUSTAR)
- **???** = Amazon (PRECISA AJUSTAR)

## 🚀 Integração com n8n

Esta implementação **SUBSTITUI** a lógica do n8n para cálculo de taxas. Agora os cálculos são feitos automaticamente durante a sincronização do Baselinker, eliminando a necessidade de workflows adicionais para esse propósito.

### **Benefícios**:
- ✅ Cálculos em tempo real durante a sincronização
- ✅ Sem dependência de n8n para taxas
- ✅ Dados sempre consistentes
- ✅ Fácil manutenção (tudo em um só lugar)

## 📊 Logs e Monitoramento

Os cálculos são registrados no console durante cada sincronização:

```
[PEDIDO 12345] Cálculo financeiro: {
  canal: 'mercadolivre',
  valorTotal: 150.00,
  taxas: 64.50,
  faturamentoLiquido: 75.50
}
```

Isso permite:
- ✅ Verificar se os cálculos estão corretos
- ✅ Debugar problemas de taxas
- ✅ Auditar valores calculados

## 🔧 Manutenção

### **Alterar Taxa de uma Plataforma**

Edite a função `calculateOrderFinancials()` em [baselinkerStore.ts](src/store/baselinkerStore.ts):

```typescript
else if (source.includes('shopee') || sourceId === 123456) {
  // ANTES: taxaCalculada = (valorCompra * 0.22) + (quantidadeTotal * 4);
  // AGORA: Nova taxa de 20% + R$5 por item
  taxaCalculada = (valorCompra * 0.20) + (quantidadeTotal * 5);
  canalVenda = 'shopee';
}
```

### **Adicionar Nova Plataforma**

Adicione um novo `else if` na função:

```typescript
else if (source.includes('nova_plataforma')) {
  taxaCalculada = valorCompra * 0.15; // 15%
  canalVenda = 'nova_plataforma';
}
```

## ✅ Status da Implementação

- ✅ Função de cálculo criada
- ✅ Integração com sincronização de pedidos (INSERT)
- ✅ Integração com atualização de pedidos (UPDATE)
- ✅ Logs de debug implementados
- ✅ Documentação completa
- ⚠️ **PENDENTE**: Ajustar IDs de source corretos (Shopee, Mercado Livre, etc.)

## 🎯 Próximos Passos

1. **Descobrir IDs corretos** de cada marketplace no Baselinker
2. **Atualizar o código** com os IDs reais (linha 81 do baselinkerStore.ts)
3. **Testar** com pedidos reais de cada plataforma
4. **Validar** os cálculos comparando com o n8n

---

**Implementado em**: 14/11/2025
**Arquivo**: [baselinkerStore.ts](src/store/baselinkerStore.ts)
**Linhas**: 58-138 (função), 541-553 (UPDATE), 562-586 (INSERT)
