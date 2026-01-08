# 📋 Plano de Implementação - FASE 1: Automações Essenciais

**Data**: 2026-01-08
**Objetivo**: Implementar as 3 Edge Functions mais críticas para automação completa do sistema

---

## 🎯 Visão Geral

### O que vamos construir:

1. **send-scheduled-messages** - Envia mensagens agendadas de recompra
2. **baselinker-event-polling** - Captura eventos do Baselinker automaticamente
3. **process-event-queue** - Processa fila de eventos de forma organizada

### Por que essa ordem:

- **Passo 1** é independente e resolve um problema imediato (mensagens agendadas paradas)
- **Passo 2** captura eventos e alimenta a fila
- **Passo 3** processa a fila criada pelo Passo 2

---

## 📦 FUNÇÃO 1: send-scheduled-messages

### Objetivo
Processar e enviar mensagens que foram agendadas pela função `process-order-created`.

### Tabela Necessária
Já existe (verificar): `scheduled_messages`

```sql
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  client_id UUID REFERENCES clients(id) NOT NULL,
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON scheduled_messages(scheduled_for)
  WHERE status = 'pending';
```

### Fluxo de Execução

```
1. Buscar mensagens pendentes onde scheduled_for <= NOW()
   ↓
2. Para cada mensagem:
   ↓
3. Buscar dados do cliente (phone, name)
   ↓
4. Enviar via WhatsApp (usando função sendWhatsAppMessage)
   ↓
5. Se sucesso:
   - Atualizar status = 'sent'
   - Registrar sent_at = NOW()
   - Inserir em messages (log)
   ↓
6. Se erro:
   - Incrementar retry_count
   - Salvar error_message
   - Se retry_count >= 3: status = 'failed'
```

### Agendamento
- **Método**: Supabase Cron (pg_cron)
- **Frequência**: A cada 5 minutos
- **Sintaxe**: `'*/5 * * * *'`

### Métricas a Rastrear
- Total de mensagens enviadas
- Taxa de sucesso/erro
- Tempo médio de processamento
- Mensagens que falharam após 3 tentativas

---

## 📦 FUNÇÃO 2: baselinker-event-polling

### Objetivo
Buscar eventos novos da API Baselinker usando `getJournalList` e inserir na fila de processamento.

### Tabelas Necessárias

**1. baselinker_sync_state** (rastrear último evento processado):
```sql
CREATE TABLE IF NOT EXISTS baselinker_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) UNIQUE NOT NULL,
  last_log_id BIGINT DEFAULT 0,
  last_sync_at TIMESTAMPTZ DEFAULT NOW(),
  is_syncing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. event_queue** (fila de eventos):
```sql
CREATE TABLE IF NOT EXISTS event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) NOT NULL,
  event_log_id BIGINT NOT NULL,
  event_type INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  order_id BIGINT,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(workspace_id, event_log_id)
);

CREATE INDEX IF NOT EXISTS idx_event_queue_pending
  ON event_queue(workspace_id, status, created_at)
  WHERE status = 'pending';
```

### Fluxo de Execução

```
1. Para cada workspace com Baselinker habilitado:
   ↓
2. Buscar last_log_id do baselinker_sync_state
   ↓
3. Chamar API getJournalList(last_log_id)
   ↓
4. Para cada evento retornado:
   ↓
5. Mapear event_type para event_name
   ↓
6. Inserir em event_queue (UNIQUE constraint previne duplicatas)
   ↓
7. Atualizar last_log_id com o maior log_id recebido
   ↓
8. Atualizar last_sync_at = NOW()
```

### Eventos do Baselinker (21 tipos)

| Tipo | Nome | Prioridade | Ação |
|------|------|------------|------|
| 1 | order_created | 🔴 Alta | Criar cliente + pedido |
| 3 | payment_received | 🔴 Alta | Notificar pagamento |
| 18 | status_changed | 🟡 Média | Notificar mudança |
| 11 | delivery_updated | 🟡 Média | Atualizar rastreio |
| 4 | order_removed | 🟡 Média | Cancelar pedido |
| 7 | invoice_created | 🟢 Baixa | Log apenas |
| 12 | product_added | 🟢 Baixa | Sync produto |
| 13 | product_edited | 🟢 Baixa | Sync produto |

### Agendamento
- **Método**: Supabase Cron
- **Frequência**: A cada 30 segundos
- **Sintaxe**: `'*/30 * * * * *'` (requer extensão pg_cron com segundos)
- **Alternativa**: A cada 1 minuto `'* * * * *'`

### Tratamento de Erros
- Lock otimista com `is_syncing` (previne execuções simultâneas)
- Se falhar, não atualiza `last_log_id` (tenta mesmos eventos na próxima)
- Rate limiting do Baselinker (100 req/min): throttle entre workspaces

---

## 📦 FUNÇÃO 3: process-event-queue

### Objetivo
Processar eventos da fila e chamar as Edge Functions apropriadas.

### Tabela Usada
`event_queue` (criada na Função 2)

### Fluxo de Execução

```
1. Buscar eventos pendentes (status = 'pending', retry_count < 3)
   ORDER BY created_at ASC LIMIT 10
   ↓
2. Para cada evento:
   ↓
3. Identificar event_type e rotear:
   - event_type 1  → process-order-created
   - event_type 3  → process-payment-received
   - event_type 18 → process-status-changed
   - event_type 11 → update-tracking-status
   - outros → log apenas
   ↓
4. Invocar Edge Function correspondente
   ↓
5. Se sucesso:
   - status = 'processed'
   - processed_at = NOW()
   ↓
6. Se erro:
   - retry_count++
   - error_message = detalhes do erro
   - Se retry_count >= 3: status = 'failed'
```

### Roteamento de Eventos

```typescript
const EVENT_HANDLERS = {
  1: 'process-order-created',        // ✅ JÁ EXISTE
  3: 'process-payment-received',     // TODO: Fase 2
  18: 'process-status-changed',      // TODO: Fase 2
  11: 'update-tracking-status',      // TODO: Fase 2
  4: 'process-order-removed',        // TODO: Fase 3
  // Outros eventos: apenas log
};
```

### Agendamento
- **Método**: Supabase Cron
- **Frequência**: A cada 10-15 segundos
- **Sintaxe**: `'*/15 * * * * *'` ou `'* * * * *'` (1 min)

### Idempotência
- `event_log_id` é UNIQUE por workspace
- Se evento já foi processado, skip silencioso
- Retry apenas eventos com status 'pending'

### Métricas a Rastrear
- Eventos processados por tipo
- Tempo médio de processamento
- Taxa de erro por tipo de evento
- Fila de backlog (eventos pendentes)

---

## 🗄️ Migrations Necessárias

### Migration 1: Tabela scheduled_messages
```sql
-- 20260108_create_scheduled_messages.sql
-- Verificar se já existe antes de criar
```

### Migration 2: Tabelas de Event Queue
```sql
-- 20260108_create_event_queue_tables.sql
-- Cria: baselinker_sync_state + event_queue
```

### Migration 3: Supabase Cron Jobs
```sql
-- 20260108_setup_cron_jobs.sql
-- Configura pg_cron para as 3 funções
```

---

## ⏱️ Configuração do Supabase Cron

### Habilitar pg_cron

1. Dashboard → Database → Extensions
2. Habilitar `pg_cron`

### Criar Cron Jobs

```sql
-- Job 1: Enviar mensagens agendadas (a cada 5 min)
SELECT cron.schedule(
  'send-scheduled-messages',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/send-scheduled-messages',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

-- Job 2: Buscar eventos Baselinker (a cada 1 min)
SELECT cron.schedule(
  'baselinker-event-polling',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-event-polling',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

-- Job 3: Processar fila de eventos (a cada 1 min)
SELECT cron.schedule(
  'process-event-queue',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/process-event-queue',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);
```

### Verificar Cron Jobs Ativos

```sql
SELECT * FROM cron.job;
```

### Remover Cron Job (se necessário)

```sql
SELECT cron.unschedule('nome-do-job');
```

---

## 🧪 Plano de Testes

### Função 1: send-scheduled-messages

**Teste Manual**:
```sql
-- Criar mensagem agendada para agora
INSERT INTO scheduled_messages (
  workspace_id,
  client_id,
  message_type,
  message_content,
  scheduled_for,
  status
) VALUES (
  'SEU_WORKSPACE_ID',
  'SEU_CLIENT_ID',
  'test',
  'Mensagem de teste do sistema automático',
  NOW(),
  'pending'
);

-- Invocar função manualmente
-- Dashboard → Edge Functions → send-scheduled-messages → Invoke

-- Verificar se foi enviada
SELECT * FROM scheduled_messages WHERE status = 'sent';
SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;
```

### Função 2: baselinker-event-polling

**Teste Manual**:
```sql
-- Verificar estado inicial
SELECT * FROM baselinker_sync_state;

-- Invocar função
-- Dashboard → Edge Functions → baselinker-event-polling → Invoke

-- Verificar eventos capturados
SELECT * FROM event_queue ORDER BY created_at DESC LIMIT 10;
```

### Função 3: process-event-queue

**Teste Manual**:
```sql
-- Inserir evento fake para teste
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
  999999,
  1,
  'order_created',
  12345,
  '{"order_id": 12345, "workspace_id": "SEU_WORKSPACE_ID"}'::jsonb,
  'pending'
);

-- Invocar função
-- Dashboard → Edge Functions → process-event-queue → Invoke

-- Verificar se foi processado
SELECT * FROM event_queue WHERE event_log_id = 999999;
```

---

## 📊 Monitoramento

### Queries Úteis

**1. Status das mensagens agendadas**:
```sql
SELECT
  status,
  COUNT(*) as total,
  MIN(scheduled_for) as proxima,
  MAX(scheduled_for) as ultima
FROM scheduled_messages
GROUP BY status;
```

**2. Fila de eventos pendentes**:
```sql
SELECT
  event_name,
  COUNT(*) as total,
  MIN(created_at) as mais_antigo
FROM event_queue
WHERE status = 'pending'
GROUP BY event_name;
```

**3. Taxa de erro por tipo de evento**:
```sql
SELECT
  event_name,
  status,
  COUNT(*) as total
FROM event_queue
GROUP BY event_name, status
ORDER BY event_name, status;
```

**4. Último sync do Baselinker**:
```sql
SELECT
  w.name as workspace,
  bs.last_log_id,
  bs.last_sync_at,
  NOW() - bs.last_sync_at as tempo_desde_ultimo
FROM baselinker_sync_state bs
JOIN workspaces w ON w.id = bs.workspace_id
ORDER BY bs.last_sync_at DESC;
```

---

## ✅ Checklist de Implementação

### Pré-requisitos
- [ ] Extensão pg_cron habilitada
- [ ] Extensão http habilitada (para cron fazer POST)
- [ ] Service role key configurada

### Função 1: send-scheduled-messages
- [ ] Criar Edge Function
- [ ] Verificar/criar tabela scheduled_messages
- [ ] Testar manualmente
- [ ] Configurar cron job
- [ ] Monitorar logs

### Função 2: baselinker-event-polling
- [ ] Criar Edge Function
- [ ] Criar migration (baselinker_sync_state + event_queue)
- [ ] Executar migration
- [ ] Testar manualmente
- [ ] Configurar cron job
- [ ] Monitorar logs

### Função 3: process-event-queue
- [ ] Criar Edge Function
- [ ] Testar manualmente (com evento fake)
- [ ] Configurar cron job
- [ ] Monitorar logs
- [ ] Verificar integração com process-order-created

### Pós-implementação
- [ ] Monitorar por 24h
- [ ] Verificar taxa de erro
- [ ] Ajustar frequência dos cron jobs se necessário
- [ ] Documentar métricas de performance

---

## 🎯 Resultado Esperado

Após implementação completa:

1. ✅ **Mensagens de recompra sendo enviadas automaticamente**
   - Sem intervenção manual
   - Com retry automático em caso de erro
   - Rastreável via logs

2. ✅ **Eventos do Baselinker capturados em tempo real**
   - Polling a cada 1 minuto
   - Sem perda de eventos
   - Fila organizada para processamento

3. ✅ **Processamento automático de eventos**
   - Novos pedidos processados automaticamente
   - Extensível para novos tipos de eventos
   - Resiliente a erros (retry automático)

---

## 🚀 Próximos Passos (Fase 2)

Após Fase 1 estável, implementar:
- `process-payment-received`
- `process-status-changed`
- `update-tracking-status`

---

**Criado**: 2026-01-08
**Versão**: 1.0
**Status**: Pronto para implementação
