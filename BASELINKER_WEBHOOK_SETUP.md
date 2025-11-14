# Configuração do Webhook Baselinker

## 📋 Visão Geral

O webhook do Baselinker permite receber atualizações em **tempo real** sobre pedidos, eliminando a necessidade de polling (sincronização periódica). Quando um evento ocorre no Baselinker (novo pedido, mudança de status, etc.), o Baselinker envia uma notificação HTTP para o nosso sistema.

---

## ✅ Benefícios do Webhook

- ⚡ **Tempo Real**: Atualizações instantâneas (segundos, não minutos)
- 💰 **Redução de Custos**: Menos requisições à API
- 🔄 **Mais Eficiente**: Processa apenas o que mudou
- 📊 **Rastreabilidade**: Cada evento é registrado

---

## 🚀 Implementação

### 1. Deploy da Função Supabase ✅ COMPLETO

O webhook já foi deployado com sucesso! 🎉

**URL do Webhook:**
```
https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-webhook
```

#### 1.1 Configurar Permissões no Supabase Dashboard

⚠️ **IMPORTANTE**: Você precisa configurar a função para aceitar requisições anônimas:

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions)
2. Clique na função **baselinker-webhook**
3. Vá na aba **Settings**
4. Em **"Verify JWT"**, **DESMARQUE** a opção (ou configure como `false`)
5. Clique em **Save**

Isso permite que o Baselinker envie webhooks sem autenticação JWT.

---

### 2. Configurar Webhook no Baselinker

#### Passo 1: Acessar Configurações do Baselinker

1. Acesse: https://panel.baselinker.com/
2. Vá em **Configurações** → **API** → **Webhooks**

#### Passo 2: Criar Novo Webhook

Clique em **"Adicionar webhook"** e configure:

**URL do Webhook:**
```
https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-webhook
```

**Método:** `POST`

**Headers Personalizados:**
```
x-workspace-id: SEU_WORKSPACE_ID
```
> ⚠️ **Importante**: Substitua `SEU_WORKSPACE_ID` pelo ID do workspace no Supabase

#### Passo 3: Selecionar Eventos

Marque os eventos que deseja receber:

- ✅ **order_status_changed** - Mudança de status do pedido
- ✅ **new_order** - Novo pedido criado
- ✅ **order_updated** - Pedido atualizado

#### Passo 4: Salvar Configuração

Clique em **"Salvar"** e teste o webhook usando o botão **"Testar webhook"** do Baselinker.

---

## 🔧 Como Funciona

### Fluxo de Eventos

```
┌─────────────────┐
│   Baselinker    │
│                 │
│ Evento ocorre:  │
│ - Novo pedido   │
│ - Status muda   │
│ - Pedido editado│
└────────┬────────┘
         │ HTTP POST
         ▼
┌─────────────────────────────┐
│  Supabase Edge Function     │
│  baselinker-webhook         │
│                             │
│  1. Valida payload          │
│  2. Identifica workspace    │
│  3. Processa evento         │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  Banco de Dados (Supabase)  │
│                             │
│  - Atualiza status          │
│  - Cria/atualiza pedido     │
│  - Registra timestamp       │
└─────────────────────────────┘
```

### Tipos de Eventos

#### 1. **order_status_changed**
Disparado quando o status de um pedido muda.

**Payload:**
```json
{
  "event": "order_status_changed",
  "order_id": "12345",
  "status_id": "123",
  "timestamp": 1699564800
}
```

**Ação:** Atualiza o campo `status` da tabela `orders`

#### 2. **new_order**
Disparado quando um novo pedido é criado.

**Payload:**
```json
{
  "event": "new_order",
  "order_id": "12346",
  "price": "150.00",
  "email": "cliente@example.com",
  ...
}
```

**Ação:** Loga o evento (pedido será sincronizado no próximo ciclo de sync)

#### 3. **order_updated**
Disparado quando dados do pedido são atualizados.

**Payload:**
```json
{
  "event": "order_updated",
  "order_id": "12345",
  "price": "180.00",
  ...
}
```

**Ação:** Atualiza `total_amount` e `metadata` do pedido

---

## 🔐 Segurança

### Headers Obrigatórios

O webhook exige o header `x-workspace-id` para identificar qual workspace processar:

```http
POST /functions/v1/baselinker-webhook
x-workspace-id: abc123-def456-ghi789
Content-Type: application/json

{ "event": "order_status_changed", ... }
```

### Validação de Payload

O webhook valida:
- ✅ Presença de `event` e `order_id`
- ✅ Existência do workspace
- ✅ Formato dos dados

### Logs

Todos os eventos são logados no console do Supabase:
```
[BASELINKER WEBHOOK] Received: { ... }
[WEBHOOK] Processing event: order_status_changed for order 12345
[WEBHOOK] Updated order 12345 status to processing
```

---

## 🧪 Testando o Webhook

### Teste Local (Supabase CLI)

```bash
# Iniciar função localmente
npx supabase functions serve baselinker-webhook

# Em outro terminal, enviar requisição de teste
curl -X POST http://localhost:54321/functions/v1/baselinker-webhook \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: SEU_WORKSPACE_ID" \
  -d '{
    "event": "order_status_changed",
    "order_id": "12345",
    "status_id": "paid"
  }'
```

### Teste via Baselinker

1. No painel do Baselinker, vá em **Webhooks**
2. Clique em **"Testar webhook"** no webhook criado
3. Verifique os logs no Supabase Dashboard

### Verificar Logs

```bash
# Ver logs em tempo real
npx supabase functions logs baselinker-webhook --tail
```

Ou no Supabase Dashboard:
1. Acesse **Functions** → **baselinker-webhook**
2. Clique na aba **Logs**

---

## 📊 Monitoramento

### Verificar se Webhook está Funcionando

```sql
-- Ver últimas atualizações de pedidos
SELECT
  order_id_base,
  status,
  updated_at,
  created_at
FROM orders
ORDER BY updated_at DESC
LIMIT 10;

-- Ver pedidos atualizados recentemente (webhook)
SELECT
  order_id_base,
  status,
  updated_at
FROM orders
WHERE updated_at > created_at + INTERVAL '5 minutes'
ORDER BY updated_at DESC;
```

---

## 🔄 Sincronização Híbrida

**Sistema Híbrido:** Webhook + Sincronização Periódica

### Webhook (Tempo Real)
- **Quando**: Evento ocorre no Baselinker
- **O que**: Atualiza status de pedidos existentes
- **Vantagem**: Instantâneo

### Sincronização Incremental (Backup)
- **Quando**: A cada X minutos ou sob demanda
- **O que**: Busca novos pedidos que o webhook pode ter perdido
- **Vantagem**: Garante que nada seja perdido

**Função de Sync:** [`baselinkerStore.syncOrders()`](src/store/baselinkerStore.ts#L300-L340)

Usa `order_date` do último pedido no banco para buscar apenas pedidos novos:

```typescript
const { data: lastOrder } = await supabase
  .from('orders')
  .select('order_date')
  .order('order_date', { ascending: false })
  .limit(1)
  .single()

const dateFrom = lastOrder
  ? Math.floor(new Date(lastOrder.order_date).getTime() / 1000) + 1
  : 0

// Buscar apenas pedidos desde dateFrom
```

---

## 🐛 Troubleshooting

### Webhook não está recebendo eventos

1. **Verificar URL**: Confirme que a URL está correta no Baselinker
2. **Verificar Header**: Confirme que `x-workspace-id` está configurado
3. **Ver Logs**: Check logs do Supabase para erros

```bash
npx supabase functions logs baselinker-webhook --tail
```

### Pedidos não estão atualizando

1. **Verificar se pedido existe**: O webhook só atualiza pedidos que já existem no banco
2. **Sincronizar manualmente**: Use "Sincronizar Pedidos" na interface
3. **Verificar workspace_id**: Confirme que o ID está correto

### Erro 400 - Missing workspace_id

Configure o header `x-workspace-id` no webhook do Baselinker:

```
x-workspace-id: abc123-def456-ghi789
```

Para obter o workspace_id:

```sql
SELECT id, name FROM workspaces;
```

---

## 📝 Notas Importantes

### Limitações do Webhook

- **Não cria novos pedidos**: Webhook apenas atualiza pedidos existentes
- **Não sincroniza produtos**: Apenas para pedidos
- **Depende de sync inicial**: Primeira sincronização deve ser manual

### Recomendações

1. **Primeira vez**: Execute sincronização manual completa
2. **Configurar webhook**: Para atualizações em tempo real
3. **Backup**: Manter sincronização periódica (1x/hora) como fallback

---

## 🔗 Links Úteis

- **Documentação Baselinker API**: https://api.baselinker.com
- **Documentação Webhooks Baselinker**: https://api.baselinker.com/index.php?method=webhooks
- **Supabase Edge Functions**: https://supabase.com/docs/guides/functions

---

**Última atualização:** 2025-11-13
**Autor:** Claude Code
**Versão:** 1.0.0
