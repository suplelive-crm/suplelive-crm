# 🚀 Deploy - FASE 1: Automações Essenciais

**Data**: 2026-01-08
**Versão**: 1.0

---

## 📋 O que vamos implantar

3 Edge Functions + 3 Migrations + Configuração de Cron Jobs

### Edge Functions:
1. ✅ **send-scheduled-messages** - Envia mensagens agendadas
2. ✅ **baselinker-event-polling** - Captura eventos do Baselinker
3. ✅ **process-event-queue** - Processa fila de eventos

### Migrations:
1. ✅ **scheduled_messages** - Tabela de mensagens agendadas
2. ✅ **event_queue + baselinker_sync_state** - Tabelas de fila de eventos
3. ✅ **cron_jobs** - Configuração de agendamento automático

---

## 🎯 Ordem de Deployment

**IMPORTANTE**: Siga esta ordem exata:

```
1. Habilitar Extensões (pg_cron, http)
   ↓
2. Executar Migrations (criar tabelas)
   ↓
3. Deploy Edge Functions (via Dashboard)
   ↓
4. Configurar Cron Jobs (agendar execuções)
   ↓
5. Testar e Monitorar
```

---

## ETAPA 1: Habilitar Extensões

### 1.1 Habilitar pg_cron

1. Vá para: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/database/extensions
2. Procure por **pg_cron**
3. Clique em **Enable**
4. Aguarde confirmação

### 1.2 Habilitar http (se ainda não estiver)

1. Na mesma página de Extensions
2. Procure por **http**
3. Se não estiver habilitado, clique em **Enable**

### 1.3 Verificar Extensões

Execute no SQL Editor:

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('pg_cron', 'http');
```

Deve retornar ambas as extensões.

---

## ETAPA 2: Executar Migrations

### 2.1 Migration: scheduled_messages

1. Vá para: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql/new
2. Cole o conteúdo do arquivo:
   ```
   supabase/migrations/20260108_create_scheduled_messages.sql
   ```
3. Clique em **Run**
4. Aguarde mensagem de sucesso: ✅ TABELA scheduled_messages CRIADA COM SUCESSO!

### 2.2 Migration: event_queue_tables

1. No SQL Editor, **New Query**
2. Cole o conteúdo do arquivo:
   ```
   supabase/migrations/20260108_create_event_queue_tables.sql
   ```
3. Clique em **Run**
4. Aguarde mensagem de sucesso: ✅ TABELAS DE EVENT QUEUE CRIADAS COM SUCESSO!

### 2.3 Verificar Tabelas Criadas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('scheduled_messages', 'event_queue', 'baselinker_sync_state')
ORDER BY table_name;
```

Deve retornar as 3 tabelas.

---

## ETAPA 3: Deploy Edge Functions

### 3.1 Deploy: send-scheduled-messages

1. Vá para: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
2. Clique em **Create a new function**
3. Nome: `send-scheduled-messages`
4. Copie **TODO o conteúdo** do arquivo:
   ```
   supabase/functions/send-scheduled-messages/index-consolidated.ts
   ```
5. Cole no editor
6. Clique em **Deploy**
7. Aguarde: Function deployed successfully ✅

### 3.2 Deploy: baselinker-event-polling

1. Clique em **Create a new function**
2. Nome: `baselinker-event-polling`
3. Copie **TODO o conteúdo** do arquivo:
   ```
   supabase/functions/baselinker-event-polling/index-consolidated.ts
   ```
4. Cole no editor
5. Clique em **Deploy**
6. Aguarde: Function deployed successfully ✅

### 3.3 Deploy: process-event-queue

1. Clique em **Create a new function**
2. Nome: `process-event-queue`
3. Copie **TODO o conteúdo** do arquivo:
   ```
   supabase/functions/process-event-queue/index-consolidated.ts
   ```
4. Cole no editor
5. Clique em **Deploy**
6. Aguarde: Function deployed successfully ✅

### 3.4 Verificar Funções Deployadas

Vá para Edge Functions e confirme que as 3 funções aparecem como "Active":
- ✅ send-scheduled-messages
- ✅ baselinker-event-polling
- ✅ process-event-queue

---

## ETAPA 4: Configurar Cron Jobs

### 4.1 Executar Migration de Cron

1. Vá para SQL Editor: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql/new
2. Cole o conteúdo do arquivo:
   ```
   supabase/migrations/20260108_setup_cron_jobs.sql
   ```
3. Clique em **Run**
4. Aguarde mensagem de sucesso: ✅ CRON JOBS CONFIGURADOS COM SUCESSO!

### 4.2 Verificar Cron Jobs Criados

```sql
SELECT
  jobid,
  schedule,
  command,
  active
FROM cron.job
ORDER BY jobid DESC;
```

Deve mostrar os 3 jobs:
- send-scheduled-messages (*/5 * * * *)
- baselinker-event-polling (* * * * *)
- process-event-queue (* * * * *)

### 4.3 Verificar Execuções (após alguns minutos)

```sql
SELECT
  job_id,
  run_id,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

---

## ETAPA 5: Testes

### 5.1 Teste Manual: send-scheduled-messages

**Criar mensagem de teste**:

```sql
INSERT INTO scheduled_messages (
  workspace_id,
  client_id,
  message_type,
  message_content,
  scheduled_for,
  status
) VALUES (
  'SEU_WORKSPACE_ID',
  (SELECT id FROM clients WHERE phone IS NOT NULL LIMIT 1),
  'test',
  'Mensagem de teste do sistema automático',
  NOW(),
  'pending'
);
```

**Invocar manualmente** (ou esperar 5 min para cron executar):

1. Dashboard → Edge Functions → send-scheduled-messages
2. Click "Invoke"
3. Body: `{}`
4. Send Request

**Verificar resultado**:

```sql
SELECT * FROM scheduled_messages
WHERE message_type = 'test'
ORDER BY created_at DESC
LIMIT 1;
```

Status deve ser `sent` ✅

### 5.2 Teste Manual: baselinker-event-polling

**Invocar manualmente**:

1. Dashboard → Edge Functions → baselinker-event-polling
2. Click "Invoke"
3. Body: `{}`
4. Send Request

**Verificar eventos capturados**:

```sql
SELECT
  event_log_id,
  event_name,
  order_id,
  status,
  created_at
FROM event_queue
ORDER BY created_at DESC
LIMIT 10;
```

### 5.3 Teste Manual: process-event-queue

**Invocar manualmente**:

1. Dashboard → Edge Functions → process-event-queue
2. Click "Invoke"
3. Body: `{}`
4. Send Request

**Verificar eventos processados**:

```sql
SELECT
  event_name,
  status,
  processed_at,
  error_message
FROM event_queue
WHERE status IN ('processed', 'failed')
ORDER BY processed_at DESC
LIMIT 10;
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
GROUP BY event_name
ORDER BY total DESC;
```

**3. Taxa de sucesso de eventos**:
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
  NOW() - bs.last_sync_at as tempo_desde_ultimo,
  bs.is_syncing
FROM baselinker_sync_state bs
JOIN workspaces w ON w.id = bs.workspace_id
ORDER BY bs.last_sync_at DESC;
```

**5. Histórico de execuções do Cron**:
```sql
SELECT
  j.jobname,
  jrd.status,
  jrd.return_message,
  jrd.start_time,
  jrd.end_time,
  (jrd.end_time - jrd.start_time) as duracao
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.job_id
ORDER BY jrd.start_time DESC
LIMIT 20;
```

---

## 🔧 Troubleshooting

### Problema: Cron jobs não estão executando

**Verificar se pg_cron está ativo**:
```sql
SELECT * FROM cron.job WHERE active = true;
```

**Verificar erros nas execuções**:
```sql
SELECT *
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;
```

**Recriar job (se necessário)**:
```sql
-- Remover job
SELECT cron.unschedule('send-scheduled-messages');

-- Recriar
SELECT cron.schedule(
  'send-scheduled-messages',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/send-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Problema: Eventos não estão sendo processados

**Verificar se há eventos pendentes**:
```sql
SELECT COUNT(*) FROM event_queue WHERE status = 'pending';
```

**Verificar erros**:
```sql
SELECT
  event_name,
  error_message,
  retry_count
FROM event_queue
WHERE status = 'failed' OR retry_count > 0
ORDER BY created_at DESC
LIMIT 10;
```

**Reprocessar evento manualmente**:
```sql
-- Resetar status para reprocessar
UPDATE event_queue
SET status = 'pending', retry_count = 0, error_message = NULL
WHERE id = 'UUID_DO_EVENTO';
```

### Problema: Mensagens não estão sendo enviadas

**Verificar instância WhatsApp**:
```sql
SELECT
  w.name as workspace,
  wi.session_id,
  wi.status
FROM whatsapp_instances wi
JOIN workspaces w ON w.id = wi.workspace_id
WHERE wi.status = 'connected';
```

**Verificar mensagens falhadas**:
```sql
SELECT
  sm.id,
  c.name as client_name,
  c.phone,
  sm.error_message,
  sm.retry_count
FROM scheduled_messages sm
JOIN clients c ON c.id = sm.client_id
WHERE sm.status = 'failed'
ORDER BY sm.created_at DESC
LIMIT 10;
```

---

## ✅ Checklist Final

Após deployment completo, verificar:

- [ ] Extensões habilitadas (pg_cron, http)
- [ ] 3 tabelas criadas (scheduled_messages, event_queue, baselinker_sync_state)
- [ ] 3 Edge Functions deployadas e ativas
- [ ] 3 Cron jobs configurados e executando
- [ ] Teste manual de send-scheduled-messages OK
- [ ] Teste manual de baselinker-event-polling OK
- [ ] Teste manual de process-event-queue OK
- [ ] Monitoramento configurado
- [ ] Sem erros nos logs das últimas 10 execuções

---

## 🎉 Resultado Esperado

Após deployment completo:

1. ✅ **Mensagens de recompra sendo enviadas automaticamente**
   - A cada 5 minutos
   - Com retry automático
   - Logs rastreáveis

2. ✅ **Eventos do Baselinker capturados em tempo real**
   - A cada 1 minuto
   - Sem perda de eventos
   - Fila organizada

3. ✅ **Processamento automático de pedidos**
   - Novos pedidos processados automaticamente
   - Clientes criados
   - Mensagens enviadas
   - Recompras agendadas

---

## 📈 Próximos Passos (Fase 2)

Após Fase 1 estável (monitorar por 24-48h), implementar:

- `process-payment-received` - Notificar pagamento confirmado
- `process-status-changed` - Notificar mudanças de status
- `update-tracking-status` - Atualizar rastreio automaticamente

---

## 📞 Suporte

### Logs das Edge Functions

Dashboard → Edge Functions → [Nome da Função] → Logs

### Logs do Cron

```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 50;
```

### Estatísticas Gerais

```sql
-- Mensagens agendadas
SELECT status, COUNT(*) FROM scheduled_messages GROUP BY status;

-- Eventos na fila
SELECT status, COUNT(*) FROM event_queue GROUP BY status;

-- Jobs ativos
SELECT jobname, active FROM cron.job;
```

---

**Criado**: 2026-01-08
**Versão**: 1.0
**Status**: Pronto para deployment
**Tempo estimado**: 30-45 minutos
