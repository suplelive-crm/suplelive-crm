Human: # Guia de Setup - Event-Driven Architecture

Este guia explica como configurar e implantar a arquitetura orientada a eventos para processar pedidos do Baselinker automaticamente.

## Pré-requisitos

- [ ] Conta Supabase configurada
- [ ] Baselinker API Token
- [ ] Evolution API (WhatsApp) configurada
- [ ] Supabase CLI instalado (`npm install -g supabase`)
- [ ] Acesso ao `getJournalList` habilitado no Baselinker (contatar suporte)

---

## Passo 1: Configurar Banco de Dados

### 1.1 Executar Migration

```bash
# No diretório do projeto
cd supabase

# Login no Supabase (primeira vez)
npx supabase login

# Link ao projeto
npx supabase link --project-ref <seu-project-ref>

# Executar migration
npx supabase db push
```

Ou execute manualmente no SQL Editor do Supabase:
- Abra o arquivo `supabase/migrations/20250107_event_driven_tables.sql`
- Copie e cole no SQL Editor do Supabase
- Execute

### 1.2 Verificar Tabelas Criadas

```sql
-- Deve retornar as 4 novas tabelas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('event_queue', 'baselinker_sync_state', 'scheduled_messages', 'notifications');
```

### 1.3 Inicializar Sync State

```sql
-- Inserir estado inicial para seu workspace
INSERT INTO baselinker_sync_state (workspace_id, last_log_id)
VALUES ('<seu-workspace-id>', 0);
```

---

## Passo 2: Configurar Variáveis de Ambiente

### 2.1 No Supabase Dashboard

Vá em: **Project Settings** → **Edge Functions** → **Secrets**

Adicione as seguintes variáveis:

```bash
BASELINKER_TOKEN=seu-token-aqui
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-api-key-aqui
```

### 2.2 Para Development Local

Crie arquivo `.env` em `supabase/functions/.env`:

```env
SUPABASE_URL=https://seu-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key
BASELINKER_TOKEN=seu-token-baselinker
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-evolution-key
```

---

## Passo 3: Deploy das Edge Functions

### 3.1 Deploy Todas as Funções

```bash
# Deploy all functions
npx supabase functions deploy baselinker-event-poller
npx supabase functions deploy process-event
npx supabase functions deploy process-order-created
npx supabase functions deploy send-scheduled-messages
```

### 3.2 Verificar Deploy

```bash
# Listar funções deployadas
npx supabase functions list
```

Deve aparecer:
- baselinker-event-poller
- process-event
- process-order-created
- send-scheduled-messages

---

## Passo 4: Configurar Cron Jobs

### 4.1 Event Poller (A cada 1 minuto)

No SQL Editor do Supabase:

```sql
-- Instalar extensão pg_cron se não estiver instalada
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar event poller para rodar a cada 1 minuto
SELECT cron.schedule(
  'baselinker-event-poller',
  '* * * * *', -- A cada 1 minuto
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/baselinker-event-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 4.2 Send Scheduled Messages (Diário às 9h)

```sql
-- Rodar todo dia às 9h da manhã
SELECT cron.schedule(
  'send-scheduled-messages',
  '0 9 * * *', -- 9h todos os dias
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 4.3 Verificar Cron Jobs

```sql
-- Listar cron jobs ativos
SELECT * FROM cron.job;

-- Ver execuções recentes
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

---

## Passo 5: Configurar Settings do Supabase

### 5.1 Configurar custom.supabase_url e custom.service_role_key

No SQL Editor:

```sql
-- Configurar URL do Supabase
ALTER DATABASE postgres SET app.supabase_url TO 'https://seu-project.supabase.co';

-- Configurar Service Role Key
ALTER DATABASE postgres SET app.service_role_key TO 'seu-service-role-key-aqui';
```

**Importante**: Substitua pelos valores reais do seu projeto!

---

## Passo 6: Testar o Sistema

### 6.1 Testar Event Poller Manualmente

```bash
curl -X POST https://seu-project.supabase.co/functions/v1/baselinker-event-poller \
  -H "Authorization: Bearer seu-anon-key" \
  -H "Content-Type: application/json"
```

Deve retornar algo como:
```json
{
  "success": true,
  "results": [
    {
      "workspace_id": "...",
      "events_processed": 5,
      "last_log_id": 12345
    }
  ]
}
```

### 6.2 Verificar Eventos na Fila

```sql
-- Ver eventos recentes
SELECT event_log_id, event_name, status, created_at
FROM event_queue
ORDER BY created_at DESC
LIMIT 10;

-- Ver eventos pendentes
SELECT * FROM event_queue WHERE status = 'pending';

-- Ver eventos falhados
SELECT * FROM event_queue WHERE status = 'failed';
```

### 6.3 Testar Processamento de Evento

```sql
-- Inserir evento de teste manualmente
INSERT INTO event_queue (event_log_id, event_type, event_name, order_id, payload, status)
VALUES (999999, 1, 'order_created', 123456, '{"order_id": 123456}'::jsonb, 'pending');

-- O trigger deve processar automaticamente em ~10 segundos
-- Verificar se mudou para 'completed'
SELECT * FROM event_queue WHERE event_log_id = 999999;
```

### 6.4 Ver Mensagens Agendadas

```sql
-- Ver mensagens futuras
SELECT
  sm.scheduled_for,
  sm.message_type,
  c.name as client_name,
  sm.status
FROM scheduled_messages sm
JOIN clients c ON c.id = sm.client_id
WHERE sm.status = 'pending'
ORDER BY sm.scheduled_for;
```

---

## Passo 7: Monitoramento

### 7.1 Criar View para Dashboard

```sql
-- View para métricas de eventos
CREATE OR REPLACE VIEW event_metrics AS
SELECT
  event_name,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds
FROM event_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_name, status;

-- Ver métricas
SELECT * FROM event_metrics ORDER BY count DESC;
```

### 7.2 Query para Ver Atividade Recente

```sql
-- Eventos processados hoje
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  event_name,
  COUNT(*) as events_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM event_queue
WHERE created_at > CURRENT_DATE
GROUP BY DATE_TRUNC('hour', created_at), event_name
ORDER BY hour DESC;
```

### 7.3 Alertas de Falha

```sql
-- Ver eventos que falharam 3 vezes
SELECT *
FROM event_queue
WHERE status = 'failed'
AND retry_count >= 3
ORDER BY created_at DESC;
```

---

## Passo 8: Troubleshooting

### 8.1 Eventos não estão sendo processados

**Verificar trigger:**
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'event_queue_trigger';
```

Se não existir, executar novamente:
```sql
CREATE TRIGGER event_queue_trigger
  AFTER INSERT ON public.event_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.process_event_queue();
```

### 8.2 Cron jobs não estão rodando

```sql
-- Ver últimas execuções
SELECT
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

Se status = 'failed', ver o `return_message` para o erro.

### 8.3 Event Poller retorna lista vazia

- Verificar se `BASELINKER_TOKEN` está configurado
- Confirmar que `getJournalList` está habilitado no Baselinker (contatar suporte)
- Verificar `last_log_id` em `baselinker_sync_state` não está muito alto

```sql
-- Resetar last_log_id para 0 (busca últimos 3 dias)
UPDATE baselinker_sync_state SET last_log_id = 0;
```

### 8.4 Mensagens não estão sendo enviadas

**Verificar WhatsApp instance:**
```sql
SELECT * FROM whatsapp_instances WHERE status = 'connected';
```

Se não houver instância conectada, conectar via interface da plataforma.

**Verificar Evolution API:**
```bash
curl https://sua-evolution-api.com/instance/fetchInstances \
  -H "apikey: sua-api-key"
```

---

## Passo 9: Configuração de Produção

### 9.1 Rate Limiting

O código já implementa rate limiting para Baselinker (95 requests/min).

Para Evolution API, adicionar delay entre mensagens (já implementado: 1s).

### 9.2 Logs

Ver logs das Edge Functions:

```bash
npx supabase functions logs baselinker-event-poller
npx supabase functions logs process-event
```

### 9.3 Backup

```bash
# Backup do banco (incluindo event_queue)
pg_dump -h db.seu-project.supabase.co \
  -U postgres \
  -d postgres \
  -t event_queue \
  -t baselinker_sync_state \
  -t scheduled_messages \
  > backup_events.sql
```

---

## Passo 10: Desligar n8n (Quando Pronto)

1. **Rodar em paralelo por 1 semana** para validar
2. **Comparar dados**: pedidos criados no n8n vs event-driven
3. **Pausar workflows n8n** um por um
4. **Monitorar por mais 3 dias**
5. **Desligar n8n completamente**

---

## Variáveis de Ambiente - Resumo

| Variável | Descrição | Onde Configurar |
|----------|-----------|-----------------|
| `BASELINKER_TOKEN` | Token API Baselinker | Supabase Secrets |
| `EVOLUTION_API_URL` | URL da Evolution API | Supabase Secrets |
| `EVOLUTION_API_KEY` | API Key Evolution | Supabase Secrets |
| `app.supabase_url` | URL do projeto Supabase | Postgres Config |
| `app.service_role_key` | Service Role Key | Postgres Config |

---

## Próximos Passos

- [ ] Criar interface de monitoramento no frontend
- [ ] Adicionar página `/jobs` para ver fila de eventos
- [ ] Implementar retry manual para eventos falhados
- [ ] Criar dashboard de métricas (eventos/dia, tempo médio, etc)
- [ ] Adicionar notificações Slack/Discord para falhas críticas

---

## Suporte

Se encontrar problemas:

1. Verificar logs das Edge Functions
2. Verificar tabela `event_queue` para eventos falhados
3. Verificar `cron.job_run_details` para erros de cron
4. Consultar este guia na seção **Troubleshooting**

## Contatos

- Documentação Baselinker: https://api.baselinker.com/
- Documentação Supabase: https://supabase.com/docs
- Evolution API: (documentação da sua instância)
