# Guia de Setup - Supabase Dashboard (Web UI)

Este guia mostra como configurar a arquitetura event-driven usando **apenas** a interface web do Supabase Dashboard. Não é necessário SSH ou linha de comando.

---

## 📋 Pré-requisitos

- [ ] Conta Supabase ativa (https://supabase.com)
- [ ] Projeto Supabase criado
- [ ] Baselinker API Token
- [ ] Evolution API configurada (URL + API Key)
- [ ] Acesso ao `getJournalList` habilitado no Baselinker (solicitar ao suporte se necessário)

---

## Passo 1: Executar Migrations do Banco de Dados

### 1.1 Acessar SQL Editor

1. Abra seu projeto no Supabase Dashboard
2. No menu lateral esquerdo, clique em **SQL Editor**
3. Clique no botão **New query**

### 1.2 Executar Migration: Tabelas de Eventos

1. Abra o arquivo [`supabase/migrations/20250107_event_driven_tables.sql`](../supabase/migrations/20250107_event_driven_tables.sql) do projeto
2. Copie **todo o conteúdo** do arquivo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** (botão verde no canto inferior direito)
5. Aguarde a mensagem de sucesso

**O que esta migration faz:**
- Cria tabela `event_queue` - fila de eventos do Baselinker
- Cria tabela `baselinker_sync_state` - estado de sincronização
- Cria tabela `scheduled_messages` - mensagens agendadas
- Cria tabela `notifications` - notificações internas
- Cria trigger PostgreSQL para processar eventos automaticamente
- Configura RLS policies

### 1.3 Executar Migration: Logs de Estoque

1. Abra o arquivo [`supabase/migrations/20250107_stock_logs_enhancement.sql`](../supabase/migrations/20250107_stock_logs_enhancement.sql)
2. Copie **todo o conteúdo** do arquivo
3. Cole no SQL Editor do Supabase (nova query)
4. Clique em **Run**
5. Aguarde a mensagem de sucesso

**O que esta migration faz:**
- Adiciona campos de auditoria nas tabelas de log existentes
- Cria tabela `baselinker_warehouses` - configuração de warehouses ativos
- Cria tabela `stock_change_log` - log consolidado de alterações de estoque
- Cria funções helper: `log_stock_change()`, `is_warehouse_active()`
- Cria views: `v_recent_stock_changes`, `v_stock_changes_by_warehouse`

### 1.4 Verificar Tabelas Criadas

Execute a seguinte query para verificar:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'event_queue',
  'baselinker_sync_state',
  'scheduled_messages',
  'notifications',
  'baselinker_warehouses',
  'stock_change_log'
)
ORDER BY table_name;
```

Deve retornar **6 tabelas**.

### 1.5 Inicializar Estado de Sincronização

Execute esta query substituindo `<seu-workspace-id>` pelo UUID do seu workspace:

```sql
-- Você pode pegar o workspace_id da tabela workspaces:
SELECT id, name FROM workspaces;

-- Depois insira o estado inicial:
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('<seu-workspace-id>', 0, false);
```

---

## Passo 2: Configurar Variáveis de Ambiente (Secrets)

### 2.1 Acessar Edge Functions Settings

1. No menu lateral, clique em **Project Settings** (ícone de engrenagem)
2. Clique em **Edge Functions**
3. Role até a seção **Environment variables**

### 2.2 Adicionar Secrets

Clique em **Add variable** para cada uma das seguintes:

| Name | Value | Descrição |
|------|-------|-----------|
| `BASELINKER_TOKEN` | `seu-token-aqui` | Token da API do Baselinker |
| `EVOLUTION_API_URL` | `https://sua-evolution-api.com` | URL da sua Evolution API |
| `EVOLUTION_API_KEY` | `sua-key-aqui` | API Key da Evolution API |

**Como pegar esses valores:**

- **BASELINKER_TOKEN**:
  1. Acesse https://panel.baselinker.com/
  2. Vá em Settings → API
  3. Copie o token

- **EVOLUTION_API_URL**: URL base da sua instância Evolution (ex: https://evolution.seudominio.com)

- **EVOLUTION_API_KEY**: API Key configurada na sua Evolution API

### 2.3 Salvar

Clique em **Save** após adicionar todas as variáveis.

---

## Passo 3: Deploy das Edge Functions

### 3.1 Método 1: Via Supabase CLI (Recomendado)

Se você tiver Node.js instalado:

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
npx supabase login

# Link ao projeto
npx supabase link --project-ref <seu-project-ref>

# Deploy das funções
npx supabase functions deploy update-baselinker-stock
npx supabase functions deploy baselinker-event-poller
npx supabase functions deploy process-event
npx supabase functions deploy process-order-created
npx supabase functions deploy send-scheduled-messages
```

**Pegar o `project-ref`:**
1. Vá em **Project Settings** → **General**
2. Copie o valor em **Reference ID**

### 3.2 Método 2: Via GitHub Integration (Alternativa)

1. No Supabase Dashboard, vá em **Edge Functions**
2. Clique em **Deploy from GitHub**
3. Conecte seu repositório GitHub
4. Configure o workflow para deploy automático

### 3.3 Verificar Deploy

1. No Supabase Dashboard, vá em **Edge Functions**
2. Deve aparecer as 5 funções:
   - `update-baselinker-stock`
   - `baselinker-event-poller`
   - `process-event`
   - `process-order-created`
   - `send-scheduled-messages`

---

## Passo 4: Configurar Database Settings

### 4.1 Configurar Custom Settings

No **SQL Editor**, execute:

```sql
-- Configurar URL do Supabase
ALTER DATABASE postgres
SET app.supabase_url TO 'https://seu-project.supabase.co';

-- Configurar Service Role Key
ALTER DATABASE postgres
SET app.service_role_key TO 'seu-service-role-key-aqui';
```

**Como pegar esses valores:**

1. Vá em **Project Settings** → **API**
2. **URL**: Copie o valor em **Project URL**
3. **Service Role Key**: Copie o valor em **service_role** (atenção: é a key **secret**, não a anon key!)

### 4.2 Verificar

Execute:

```sql
SELECT name, setting
FROM pg_settings
WHERE name LIKE 'app.%';
```

Deve retornar:
```
name                 | setting
---------------------|---------------------------
app.supabase_url     | https://seu-project...
app.service_role_key | eyJhbG...
```

---

## Passo 5: Configurar Cron Jobs

### 5.1 Habilitar Extensão pg_cron

No **SQL Editor**, execute:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 5.2 Agendar Event Poller (Roda a cada 1 minuto)

```sql
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

### 5.3 Agendar Send Scheduled Messages (Roda todo dia às 9h)

```sql
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

### 5.4 Verificar Cron Jobs

```sql
SELECT * FROM cron.job;
```

Deve aparecer 2 jobs:
- `baselinker-event-poller` - schedule: `* * * * *`
- `send-scheduled-messages` - schedule: `0 9 * * *`

---

## Passo 6: Testar o Sistema

### 6.1 Testar Event Poller Manualmente

No **SQL Editor**, execute:

```sql
SELECT net.http_post(
  url := current_setting('app.supabase_url') || '/functions/v1/baselinker-event-poller',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
  ),
  body := '{}'::jsonb
);
```

### 6.2 Verificar Eventos Criados

```sql
-- Ver últimos eventos
SELECT
  event_log_id,
  event_name,
  status,
  order_id,
  created_at
FROM event_queue
ORDER BY created_at DESC
LIMIT 10;
```

### 6.3 Ver Logs das Edge Functions

1. No Supabase Dashboard, vá em **Edge Functions**
2. Clique na função desejada (ex: `baselinker-event-poller`)
3. Clique na tab **Logs**
4. Veja os logs em tempo real

### 6.4 Ver Execuções dos Cron Jobs

```sql
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

---

## Passo 7: Configurar Warehouses Ativos

### 7.1 Listar Warehouses do Baselinker

Primeiro, vamos buscar os warehouses disponíveis:

```sql
-- Você vai precisar fazer isso manualmente via código ou criar uma Edge Function
-- Por enquanto, insira manualmente os warehouses que você conhece
```

### 7.2 Inserir Configuração de Warehouse

```sql
INSERT INTO baselinker_warehouses (
  workspace_id,
  warehouse_id,
  warehouse_name,
  is_active,
  allow_stock_updates,
  sync_direction
) VALUES (
  '<seu-workspace-id>',
  'bl_1', -- ID do warehouse no Baselinker
  'Warehouse São Paulo', -- Nome descritivo
  true, -- Ativo para alterações
  true, -- Permite atualizar estoque
  'bidirectional' -- 'read_only', 'write_only' ou 'bidirectional'
);
```

Repita para cada warehouse que você quer ativar (ex: `bl_2`, `bl_3`, etc).

### 7.3 Verificar Warehouses Configurados

```sql
SELECT
  warehouse_id,
  warehouse_name,
  is_active,
  allow_stock_updates,
  sync_direction
FROM baselinker_warehouses
WHERE workspace_id = '<seu-workspace-id>';
```

---

## Passo 8: Monitoramento

### 8.1 Dashboard de Eventos

Execute no SQL Editor:

```sql
-- Eventos processados hoje
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  event_name,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM event_queue
WHERE created_at > CURRENT_DATE
GROUP BY DATE_TRUNC('hour', created_at), event_name
ORDER BY hour DESC;
```

### 8.2 Logs de Estoque Recentes

```sql
-- Ver alterações de estoque dos últimos 7 dias
SELECT
  sku,
  product_name,
  warehouse_name,
  action_type,
  source,
  previous_quantity,
  new_quantity,
  quantity_change,
  change_reason,
  user_name,
  created_at
FROM v_recent_stock_changes
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;
```

### 8.3 Mensagens Agendadas Pendentes

```sql
-- Ver próximas mensagens a serem enviadas
SELECT
  sm.scheduled_for,
  sm.message_type,
  c.name as client_name,
  c.phone,
  sm.message_content
FROM scheduled_messages sm
JOIN clients c ON c.id = sm.client_id
WHERE sm.status = 'pending'
AND sm.scheduled_for > NOW()
ORDER BY sm.scheduled_for
LIMIT 20;
```

---

## Passo 9: Troubleshooting

### 9.1 Eventos não estão sendo processados

**Verificar trigger:**

```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'event_queue_trigger';
```

Se não retornar nada ou `tgenabled = false`, recriar o trigger:

```sql
CREATE TRIGGER event_queue_trigger
  AFTER INSERT ON public.event_queue
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.process_event_queue();
```

### 9.2 Cron Jobs não estão rodando

**Ver últimas execuções:**

```sql
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

Se `status = 'failed'`, veja o `return_message` para o erro.

**Verificar pg_net:**

```sql
-- Instalar extensão se necessário
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 9.3 Edge Functions retornam erro 401

- Verificar se as variáveis de ambiente foram salvas corretamente
- Ir em **Project Settings** → **Edge Functions** e confirmar que `BASELINKER_TOKEN`, `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` estão presentes

### 9.4 Event Poller não encontra eventos

**Resetar last_log_id para buscar eventos recentes:**

```sql
UPDATE baselinker_sync_state
SET last_log_id = 0
WHERE workspace_id = '<seu-workspace-id>';
```

Quando `last_log_id = 0`, o Baselinker retorna eventos dos últimos 3 dias.

### 9.5 Stock não está sendo atualizado

**Verificar se warehouse está ativo:**

```sql
SELECT is_warehouse_active('<workspace-id>', 'bl_1');
```

Se retornar `false`, ativar:

```sql
UPDATE baselinker_warehouses
SET is_active = true, allow_stock_updates = true
WHERE workspace_id = '<workspace-id>'
AND warehouse_id = 'bl_1';
```

---

## Passo 10: Acesso às Tabelas no Frontend

Para acessar essas tabelas no frontend React, você já tem tudo configurado via Supabase client:

```typescript
// Exemplo: Buscar eventos
const { data: events } = await supabase
  .from('event_queue')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);

// Exemplo: Buscar logs de estoque
const { data: stockLogs } = await supabase
  .from('v_recent_stock_changes')
  .select('*')
  .limit(50);

// Exemplo: Buscar warehouses configurados
const { data: warehouses } = await supabase
  .from('baselinker_warehouses')
  .select('*')
  .eq('workspace_id', currentWorkspace.id);
```

---

## Checklist Final

- [ ] Migrations executadas (event_driven_tables + stock_logs_enhancement)
- [ ] Variáveis de ambiente configuradas (BASELINKER_TOKEN, EVOLUTION_API_URL, EVOLUTION_API_KEY)
- [ ] Edge Functions deployadas (5 funções)
- [ ] Database settings configurados (app.supabase_url, app.service_role_key)
- [ ] Cron jobs agendados (event-poller + send-scheduled-messages)
- [ ] Estado de sincronização inicializado (baselinker_sync_state)
- [ ] Warehouses configurados (baselinker_warehouses)
- [ ] Testes manuais executados (event poller, visualizar eventos)
- [ ] Logs verificados (Edge Functions logs, cron.job_run_details)

---

## Próximos Passos

1. **Frontend**: Implementar componentes para:
   - Configuração de warehouses ativos
   - Visualização de event queue (/jobs)
   - Logs de alterações de estoque
   - Retry manual de eventos falhados

2. **Monitoramento**: Criar dashboard com métricas:
   - Eventos processados por hora
   - Taxa de sucesso/falha
   - Tempo médio de processamento
   - Alterações de estoque por warehouse

3. **Notificações**: Configurar alertas para:
   - Eventos falhados (>3 tentativas)
   - Cron jobs que falharam
   - Warehouses desconectados

---

## Suporte

**Documentação:**
- Baselinker API: https://api.baselinker.com/
- Supabase Docs: https://supabase.com/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- pg_cron: https://supabase.com/docs/guides/database/extensions/pg_cron

**Contatos:**
- Se encontrar problemas, consulte os logs das Edge Functions
- Verifique `event_queue` para eventos falhados
- Verifique `cron.job_run_details` para erros de cron

---

**Última atualização**: 2025-01-07
