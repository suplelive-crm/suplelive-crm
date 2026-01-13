# 🚀 Guia de Deploy - Baselinker Order Sync

Este guia orienta o deployment completo do sistema de sincronização de pedidos do Baselinker.

## 📋 Pré-requisitos

- Supabase CLI instalado (`npm install -g supabase`)
- Acesso ao projeto Supabase
- Chave de API do Baselinker configurada nos workspaces

## 📦 Arquivos Criados

### 1. Database Migration
- `supabase/migrations/create_baselinker_sync_tables.sql`
  - Cria tabelas `baselinker_sync_state` e `order_sync_queue`
  - Adiciona campos na tabela `orders`
  - Cria índices e políticas RLS
  - Cria funções auxiliares

### 2. Edge Functions
- `supabase/functions/baselinker-orders-poller/index.ts` - Polling de novos pedidos
- `supabase/functions/baselinker-events-poller/index.ts` - Polling de eventos
- `supabase/functions/process-order-event/index.ts` - Processamento da fila
- `supabase/functions/baselinker-full-sync/index.ts` - Sync completo diário

### 3. Cron Configuration
- `supabase/functions/_cron/baselinker-sync-jobs.yaml` - Agendamento dos jobs

## 🔧 Passo a Passo do Deploy

### Passo 1: Aplicar Migration no Banco de Dados

```bash
# Via Supabase CLI (recomendado)
cd supabase
supabase db push

# OU via Dashboard do Supabase
# 1. Acesse: https://supabase.com/dashboard
# 2. Vá em: SQL Editor
# 3. Cole o conteúdo de: supabase/migrations/create_baselinker_sync_tables.sql
# 4. Clique em "Run"
```

**Validação:**
```sql
-- Verificar se tabelas foram criadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('baselinker_sync_state', 'order_sync_queue');

-- Verificar se campos foram adicionados na tabela orders
SELECT column_name FROM information_schema.columns
WHERE table_name = 'orders'
AND column_name IN ('order_id_base', 'date_confirmed', 'order_status_id');
```

### Passo 2: Deploy das Edge Functions

```bash
# Login no Supabase (se necessário)
supabase login

# Link ao projeto
supabase link --project-ref SEU_PROJECT_REF

# Deploy de todas as funções
supabase functions deploy baselinker-orders-poller
supabase functions deploy baselinker-events-poller
supabase functions deploy process-order-event
supabase functions deploy baselinker-full-sync

# OU deploy de todas de uma vez
supabase functions deploy
```

**Validação:**
```bash
# Listar funções deployadas
supabase functions list

# Testar uma função manualmente
supabase functions invoke baselinker-orders-poller --no-verify-jwt
```

### Passo 3: Configurar Cron Jobs

#### Opção A: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/SEU_PROJECT/functions
2. Clique em "Cron Jobs" no menu lateral
3. Adicione cada job seguindo a configuração em `baselinker-sync-jobs.yaml`:

**Job 1: Orders Poller**
- Nome: `baselinker-orders-poller`
- Schedule: `*/1 * * * *` (a cada 1 minuto)
- Function: `baselinker-orders-poller`
- Enabled: ✅

**Job 2: Events Poller**
- Nome: `baselinker-events-poller`
- Schedule: `*/1 * * * *` (a cada 1 minuto)
- Function: `baselinker-events-poller`
- Enabled: ✅

**Job 3: Event Processor**
- Nome: `process-order-events`
- Schedule: `*/1 * * * *` (a cada 1 minuto)
- Function: `process-order-event`
- Enabled: ✅

**Job 4: Full Sync Daily**
- Nome: `baselinker-full-sync-daily`
- Schedule: `0 3 * * *` (às 3:00 AM)
- Function: `baselinker-full-sync`
- Enabled: ✅

#### Opção B: Via SQL (Alternativa)

```sql
-- Criar extensão pg_cron se não existir
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Orders Poller (a cada 1 minuto)
SELECT cron.schedule(
  'baselinker-orders-poller',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/baselinker-orders-poller',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Job 2: Events Poller (a cada 1 minuto)
SELECT cron.schedule(
  'baselinker-events-poller',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/baselinker-events-poller',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Job 3: Event Processor (a cada 1 minuto)
SELECT cron.schedule(
  'process-order-events',
  '*/1 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/process-order-event',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Job 4: Full Sync Daily (às 3:00 AM)
SELECT cron.schedule(
  'baselinker-full-sync-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJECT_REF.supabase.co/functions/v1/baselinker-full-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Validação:**
```sql
-- Ver jobs agendados
SELECT * FROM cron.job;

-- Ver histórico de execuções
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Passo 4: Configurar Variáveis de Ambiente

As Edge Functions já têm acesso automático a:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Se necessário adicionar outras variáveis:
```bash
supabase secrets set CUSTOM_VAR=valor
```

### Passo 5: Inicializar Sync State

Execute uma vez para criar entradas de sync state para workspaces existentes:

```sql
-- Já incluído na migration, mas pode executar novamente se necessário
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, last_order_confirmed_timestamp)
SELECT
  w.id,
  COALESCE((w.settings->>'baselinker_last_log_id')::BIGINT, 0),
  0 -- Começar do zero para order polling
FROM workspaces w
WHERE w.settings->>'baselinker_api_key' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM baselinker_sync_state bss
    WHERE bss.workspace_id = w.id
  )
ON CONFLICT (workspace_id) DO NOTHING;
```

## 🧪 Testes e Validação

### Teste 1: Verificar Execução dos Pollers

```bash
# Invocar manualmente para testar
supabase functions invoke baselinker-orders-poller --no-verify-jwt

# Verificar logs
supabase functions logs baselinker-orders-poller --tail
```

### Teste 2: Monitorar Fila

```sql
-- Ver estatísticas da fila por workspace
SELECT * FROM get_sync_queue_stats('SEU_WORKSPACE_ID');

-- Ver eventos pendentes
SELECT
  source,
  event_name,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM order_sync_queue
WHERE status = 'pending'
GROUP BY source, event_name;

-- Ver eventos com erro
SELECT * FROM order_sync_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

### Teste 3: Verificar Sincronização

```sql
-- Ver último sync por workspace
SELECT
  w.name,
  bss.last_log_id,
  bss.last_order_confirmed_timestamp,
  bss.last_sync_at,
  bss.total_events_processed,
  bss.total_orders_synced,
  bss.is_syncing
FROM baselinker_sync_state bss
JOIN workspaces w ON w.id = bss.workspace_id
ORDER BY bss.last_sync_at DESC;

-- Ver pedidos sincronizados recentemente
SELECT
  order_id_base,
  date_confirmed,
  status,
  total_amount,
  created_at,
  metadata->>'baselinker_data'->>'synced_at' as synced_at
FROM orders
WHERE order_id_base IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;
```

## 📊 Monitoramento Contínuo

### Queries Úteis

```sql
-- Dashboard de sincronização
SELECT
  w.name as workspace,
  bss.last_sync_at,
  bss.total_orders_synced,
  bss.total_events_processed,
  bss.is_syncing,
  (SELECT COUNT(*) FROM order_sync_queue WHERE workspace_id = w.id AND status = 'pending') as pending,
  (SELECT COUNT(*) FROM order_sync_queue WHERE workspace_id = w.id AND status = 'failed') as failed
FROM workspaces w
JOIN baselinker_sync_state bss ON bss.workspace_id = w.id;

-- Ver erros recentes
SELECT
  w.name,
  error->>'timestamp' as error_time,
  error->>'source' as source,
  error->>'message' as message
FROM workspaces w
JOIN baselinker_sync_state bss ON bss.workspace_id = w.id,
LATERAL jsonb_array_elements(bss.sync_errors) as error
ORDER BY error->>'timestamp' DESC
LIMIT 20;

-- Performance: tempo médio de processamento
SELECT
  event_name,
  source,
  COUNT(*) as total,
  AVG(EXTRACT(EPOCH FROM (processed_at - processing_started_at))) as avg_seconds,
  MAX(EXTRACT(EPOCH FROM (processed_at - processing_started_at))) as max_seconds
FROM order_sync_queue
WHERE status = 'completed'
  AND processed_at > NOW() - INTERVAL '24 hours'
GROUP BY event_name, source
ORDER BY total DESC;
```

### Alertas Recomendados

Configure alertas para:
1. **Fila crescendo**: `> 100 eventos pending por mais de 10 minutos`
2. **Taxa de erro alta**: `> 10% de eventos failed`
3. **Sync travado**: `is_syncing = true por mais de 30 minutos`
4. **Nenhuma atualização**: `last_sync_at mais antigo que 5 minutos`

## 🔧 Manutenção

### Limpar Fila Antiga (Manual)

```sql
-- Deletar eventos completados com mais de 30 dias
DELETE FROM order_sync_queue
WHERE status = 'completed'
  AND processed_at < NOW() - INTERVAL '30 days';

-- Resetar eventos travados
UPDATE order_sync_queue
SET status = 'retry',
    next_retry_at = NOW(),
    error_message = 'Reset: stuck in processing'
WHERE status = 'processing'
  AND processing_started_at < NOW() - INTERVAL '1 hour';
```

### Reprocessar Eventos Falhados

```sql
-- Reprocessar eventos com falha específica
UPDATE order_sync_queue
SET status = 'retry',
    retry_count = 0,
    next_retry_at = NOW(),
    error_message = NULL
WHERE status = 'failed'
  AND error_message LIKE '%specific error%';
```

### Forçar Full Sync Agora

```bash
# Invocar full sync manualmente
supabase functions invoke baselinker-full-sync --no-verify-jwt
```

## 🐛 Troubleshooting

### Problema: Nenhum evento sendo processado

**Diagnóstico:**
```sql
-- Ver se há eventos na fila
SELECT status, COUNT(*) FROM order_sync_queue GROUP BY status;

-- Ver se pollers estão rodando
SELECT * FROM cron.job WHERE jobname LIKE 'baselinker%';

-- Ver logs de execução
SELECT * FROM cron.job_run_details
WHERE jobname LIKE 'baselinker%'
ORDER BY start_time DESC LIMIT 10;
```

**Soluções:**
1. Verificar se cron jobs estão habilitados
2. Verificar logs das Edge Functions: `supabase functions logs`
3. Invocar manualmente para testar: `supabase functions invoke`

### Problema: Eventos ficam em "processing" indefinidamente

**Diagnóstico:**
```sql
SELECT * FROM order_sync_queue
WHERE status = 'processing'
  AND processing_started_at < NOW() - INTERVAL '10 minutes';
```

**Solução:**
```sql
-- Função de reset já incluída na migration
SELECT reset_stuck_sync_queue_entries();
```

### Problema: Taxa de erro alta

**Diagnóstico:**
```sql
SELECT
  error_message,
  COUNT(*) as count
FROM order_sync_queue
WHERE status IN ('failed', 'retry')
GROUP BY error_message
ORDER BY count DESC;
```

**Soluções:**
1. Verificar se API key do Baselinker está correta
2. Verificar rate limiting (>100 req/min)
3. Verificar estrutura de dados do pedido mudou

## 📝 Notas Importantes

1. **Rate Limiting**: Baselinker permite 100 req/min. Com 3 jobs rodando a cada minuto, base é ~3 req/min. Paginação pode aumentar isso.

2. **Travessia Temporal**: Usamos `date_confirmed_from` (não `date_from`) para evitar lacunas causadas por pedidos confirmados horas após criação.

3. **Deduplicação**: `event_log_id` UNIQUE garante que mesmo evento não seja processado múltiplas vezes.

4. **Source Tracking**: Campo `source` permite distinguir origem:
   - `order_poll`: Novos pedidos via getOrders
   - `event_poll`: Mudanças via getJournalList
   - `full_sync`: Backup diário

5. **Idempotência**: Todas as operações são idempotentes - reprocessar mesmo evento não causa duplicatas.

## ✅ Checklist Final

- [ ] Migration aplicada com sucesso
- [ ] 4 Edge Functions deployadas
- [ ] 4 Cron jobs configurados e habilitados
- [ ] Sync state inicializado para workspaces
- [ ] Teste manual executado com sucesso
- [ ] Monitoramento configurado
- [ ] Documentação revisada pela equipe

## 🎯 Próximos Passos

Após deploy bem-sucedido:
1. Monitorar primeiras 24 horas de perto
2. Ajustar rate limiting se necessário
3. Configurar alertas de monitoramento
4. Documentar casos especiais específicos do negócio
5. Treinar equipe nas queries de monitoramento

---

**Suporte**: Para questões ou problemas, verificar logs com `supabase functions logs <function-name>`
