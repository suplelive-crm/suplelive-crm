# 📋 Plano de Implementação - FASE 2: Eventos Importantes

**Data**: 2026-01-08
**Objetivo**: Implementar processadores para eventos críticos do Baselinker

---

## 🎯 Visão Geral

### O que vamos construir:

1. **process-payment-received** - Notificar quando pagamento for confirmado
2. **process-status-changed** - Notificar mudanças de status do pedido
3. **update-tracking-status** - Atualizar rastreio de entregas

### Por que essa ordem:

- **Evento 3** (payment_received) é crítico - cliente quer saber que pagamento foi confirmado
- **Evento 18** (status_changed) mantém cliente informado sobre o pedido
- **Evento 11** (delivery_updated) automatiza rastreio de entregas

---

## 📦 FUNÇÃO 1: process-payment-received

### Objetivo
Processar evento de pagamento confirmado e notificar o cliente.

### Evento Baselinker
- **Tipo**: 3
- **Nome**: payment_received
- **Quando ocorre**: Pagamento é confirmado no Baselinker
- **Dados disponíveis**: order_id, payment_method, payment_amount

### Fluxo de Execução

```
1. Recebe evento payment_received (order_id)
   ↓
2. Buscar dados do pedido no banco
   ↓
3. Buscar dados do cliente
   ↓
4. Validar se cliente tem telefone
   ↓
5. Buscar template de mensagem (message_templates.payment_confirmed)
   ↓
6. Processar variáveis do template:
   - {{client_name}}
   - {{order_id}}
   - {{payment_method}}
   - {{amount}}
   ↓
7. Enviar mensagem via WhatsApp
   ↓
8. Atualizar pedido: payment_confirmed_at = NOW()
   ↓
9. Registrar em messages (log)
   ↓
10. Marcar evento como processado
```

### Campos Novos Necessários

```sql
-- Adicionar à tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_notified BOOLEAN DEFAULT false;
```

### Template de Mensagem Padrão

```
Oi {{client_name}}! 🎉

Pagamento confirmado! Seu pedido #{{order_id}} já está sendo preparado.

💳 Valor: R$ {{amount}}
📦 Em breve você receberá o código de rastreio.

Obrigado pela confiança! 💚
```

### Métricas a Rastrear
- Total de pagamentos confirmados
- Taxa de notificação (enviadas/total)
- Tempo médio entre pagamento e notificação

---

## 📦 FUNÇÃO 2: process-status-changed

### Objetivo
Processar mudanças de status do pedido e notificar o cliente conforme o novo status.

### Evento Baselinker
- **Tipo**: 18
- **Nome**: status_changed
- **Quando ocorre**: Status do pedido muda no Baselinker
- **Dados disponíveis**: order_id, old_status_id, new_status_id

### Status do Baselinker (Exemplo)

| ID | Nome | Ação |
|----|------|------|
| 1000 | Novo pedido | Não notificar (já notificado em order_created) |
| 1100 | Em preparação | ✅ Notificar: "Pedido em preparação" |
| 1200 | Enviado | ✅ Notificar: "Pedido enviado! Código: XYZ" |
| 1300 | Entregue | ✅ Notificar: "Pedido entregue! Como foi?" |
| 9999 | Cancelado | ✅ Notificar: "Pedido cancelado" |

### Fluxo de Execução

```
1. Recebe evento status_changed
   ↓
2. Buscar pedido + cliente
   ↓
3. Mapear new_status_id para nome legível
   ↓
4. Verificar se status requer notificação
   ↓
5. Buscar template específico do status
   ↓
6. Se status = "enviado":
   - Buscar código de rastreio no Baselinker
   - Incluir na mensagem
   ↓
7. Processar variáveis do template
   ↓
8. Enviar mensagem via WhatsApp
   ↓
9. Atualizar orders.last_status_notification
   ↓
10. Registrar em messages (log)
```

### Campos Novos Necessários

```sql
-- Adicionar à tabela orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_status_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_status_notification TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
```

### Templates por Status

```sql
-- Tabela para mapear status -> template
CREATE TABLE status_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  status_id INTEGER NOT NULL,
  status_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  should_notify BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, status_id)
);
```

### Templates Padrão

**Em preparação**:
```
Oi {{client_name}}!

Seu pedido #{{order_id}} está sendo preparado! 📦

Você receberá o código de rastreio em breve.

Acompanhe o status pelo nosso site! 🚀
```

**Enviado**:
```
Oi {{client_name}}!

Seu pedido #{{order_id}} foi enviado! 🎉

📦 Código de rastreio: {{tracking_code}}
🔗 Rastrear: {{tracking_url}}

Prazo de entrega: {{delivery_estimate}}

Qualquer dúvida, estou aqui! 😊
```

**Entregue**:
```
Oi {{client_name}}!

Seu pedido #{{order_id}} foi entregue! 🎉

Como foi sua experiência?
Sua opinião é muito importante! ⭐⭐⭐⭐⭐

Obrigado por comprar conosco! 💚
```

**Cancelado**:
```
Oi {{client_name}},

Seu pedido #{{order_id}} foi cancelado.

Se você não solicitou o cancelamento, entre em contato conosco.

Estamos à disposição! 📞
```

---

## 📦 FUNÇÃO 3: update-tracking-status

### Objetivo
Buscar atualizações de rastreio nas transportadoras e notificar o cliente.

### Evento Baselinker
- **Tipo**: 11
- **Nome**: delivery_updated
- **Quando ocorre**: Rastreio é atualizado no Baselinker
- **Dados disponíveis**: order_id, tracking_number, courier_code

### Fluxo de Execução

```
1. Recebe evento delivery_updated
   ↓
2. Buscar pedido + cliente
   ↓
3. Extrair tracking_number + courier_code
   ↓
4. Consultar API da transportadora
   (Correios, Melhor Envio, etc.)
   ↓
5. Buscar status atual da entrega:
   - Postado
   - Em trânsito
   - Saiu para entrega
   - Entregue
   - Tentativa de entrega
   ↓
6. Verificar se houve mudança de status
   ↓
7. Se mudou:
   - Notificar cliente com novo status
   - Atualizar tabela tracking_history
   ↓
8. Registrar em messages (log)
```

### Tabelas Necessárias

```sql
-- Histórico de rastreio
CREATE TABLE tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  tracking_code TEXT NOT NULL,
  courier_code TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_history_order
  ON tracking_history(order_id, created_at DESC);

CREATE INDEX idx_tracking_history_code
  ON tracking_history(tracking_code);
```

### APIs de Rastreio Suportadas

1. **Correios** (via Melhor Envio ou Correios API)
2. **Melhor Envio** (API própria)
3. **Total Express**
4. **Jadlog**
5. **Loggi**

### Template de Mensagem por Status

**Postado**:
```
Oi {{client_name}}!

Seu pedido #{{order_id}} foi postado! 📮

📦 Código de rastreio: {{tracking_code}}

Acompanhe a entrega pelo link:
{{tracking_url}}
```

**Em trânsito**:
```
Oi {{client_name}}!

Seu pedido #{{order_id}} está a caminho! 🚚

📍 Última localização: {{location}}
📅 Previsão de entrega: {{estimated_delivery}}

Rastrear: {{tracking_url}}
```

**Saiu para entrega**:
```
Oi {{client_name}}!

Seu pedido #{{order_id}} saiu para entrega! 🚚

O entregador está a caminho do seu endereço.

Previsão: Hoje até {{time}}

Prepare-se para receber! 🎉
```

**Entregue**:
```
Oi {{client_name}}!

Seu pedido #{{order_id}} foi entregue! 🎉

Esperamos que você goste! ❤️

Como foi sua experiência? Sua opinião é importante! ⭐
```

**Tentativa de entrega**:
```
Oi {{client_name}},

Houve uma tentativa de entrega do seu pedido #{{order_id}}.

📍 Motivo: {{reason}}

O entregador tentará novamente em breve.
Por favor, fique atento! 🔔
```

---

## 🗄️ Migrations Necessárias

### Migration 1: Campos de Pagamento

```sql
-- 20260109_add_payment_fields.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_notified BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2);
```

### Migration 2: Campos de Status

```sql
-- 20260109_add_status_fields.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_status_id INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_status_notification TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_code TEXT;

CREATE TABLE status_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  status_id INTEGER NOT NULL,
  status_name TEXT NOT NULL,
  template_content TEXT NOT NULL,
  should_notify BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, status_id)
);
```

### Migration 3: Rastreio

```sql
-- 20260109_create_tracking_history.sql
CREATE TABLE tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  tracking_code TEXT NOT NULL,
  courier_code TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_history_order
  ON tracking_history(order_id, created_at DESC);

CREATE INDEX idx_tracking_history_code
  ON tracking_history(tracking_code);
```

---

## 📊 Integração com process-event-queue

Atualizar o mapeamento de eventos:

```typescript
const EVENT_HANDLERS: Record<number, string> = {
  1: 'process-order-created',        // ✅ Fase 1
  3: 'process-payment-received',     // ✅ Fase 2
  18: 'process-status-changed',      // ✅ Fase 2
  11: 'update-tracking-status',      // ✅ Fase 2
  4: 'process-order-removed',        // TODO: Fase 3
};
```

Não é necessário alterar nada - o `process-event-queue` já está preparado para rotear esses eventos!

---

## 🧪 Plano de Testes

### Teste 1: Payment Received

```sql
-- Simular evento de pagamento
INSERT INTO event_queue (
  workspace_id,
  event_log_id,
  event_type,
  event_name,
  order_id,
  payload,
  status
) VALUES (
  'SEU_WORKSPACE_ID',
  999001,
  3,
  'payment_received',
  12345,
  '{"order_id": 12345, "payment_method": "pix", "amount": 150.00}'::jsonb,
  'pending'
);

-- Invocar process-event-queue
-- Verificar se mensagem foi enviada
SELECT * FROM messages WHERE metadata->>'event_type' = 'payment_received';
```

### Teste 2: Status Changed

```sql
-- Simular mudança de status
INSERT INTO event_queue (
  workspace_id,
  event_log_id,
  event_type,
  event_name,
  order_id,
  payload,
  status
) VALUES (
  'SEU_WORKSPACE_ID',
  999002,
  18,
  'status_changed',
  12345,
  '{"order_id": 12345, "old_status_id": 1000, "new_status_id": 1200}'::jsonb,
  'pending'
);
```

### Teste 3: Tracking Update

```sql
-- Simular atualização de rastreio
INSERT INTO event_queue (
  workspace_id,
  event_log_id,
  event_type,
  event_name,
  order_id,
  payload,
  status
) VALUES (
  'SEU_WORKSPACE_ID',
  999003,
  11,
  'delivery_updated',
  12345,
  '{"order_id": 12345, "tracking_number": "BR123456789", "courier_code": "correios"}'::jsonb,
  'pending'
);
```

---

## ✅ Checklist de Implementação

### Pré-requisitos
- [ ] Fase 1 deployada e funcionando
- [ ] Monitoramento da Fase 1 estável (24-48h)
- [ ] APIs de rastreio configuradas (se necessário)

### Função 1: process-payment-received
- [ ] Criar Edge Function
- [ ] Executar migration (payment fields)
- [ ] Adicionar templates padrão
- [ ] Testar manualmente
- [ ] Monitorar logs

### Função 2: process-status-changed
- [ ] Criar Edge Function
- [ ] Executar migration (status fields + templates table)
- [ ] Inserir templates padrão para status comuns
- [ ] Testar manualmente
- [ ] Monitorar logs

### Função 3: update-tracking-status
- [ ] Criar Edge Function
- [ ] Executar migration (tracking_history)
- [ ] Configurar APIs de rastreio
- [ ] Testar manualmente
- [ ] Monitorar logs

---

## 🎯 Resultado Esperado

Após Fase 2 completa:

1. ✅ **Pagamentos confirmados notificados automaticamente**
   - Cliente sabe imediatamente que pagamento foi aprovado
   - Reduz ansiedade e dúvidas

2. ✅ **Mudanças de status comunicadas**
   - Cliente sempre informado sobre o pedido
   - Transparência total no processo

3. ✅ **Rastreio automatizado**
   - Atualizações proativas de entrega
   - Cliente não precisa ficar consultando código

---

## 📈 Métricas de Sucesso

- Taxa de notificação de pagamento > 95%
- Tempo médio entre mudança de status e notificação < 2 minutos
- Atualizações de rastreio em tempo real
- Redução de mensagens de "onde está meu pedido?"

---

## 🚀 Próximos Passos (Fase 3)

Após Fase 2 estável:
- Reengajamento de clientes inativos
- Mensagens de aniversário
- Relatórios diários automáticos
- Análise de sentimento com IA

---

**Criado**: 2026-01-08
**Versão**: 1.0
**Status**: Aguardando Fase 1 estável
**Tempo estimado**: 2-3 horas de implementação
