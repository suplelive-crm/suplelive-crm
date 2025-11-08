# 🗄️ Setup do Banco - Passo a Passo Visual

**Tempo estimado**: 10 minutos

---

## 🎯 Abrir o SQL Editor

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql
2. Clique em **"New query"**

---

## ✅ PASSO 1: Verificar Workspaces

**Cole e execute**:

```sql
SELECT
  id,
  name,
  slug,
  created_at,
  settings IS NOT NULL as tem_settings
FROM workspaces
ORDER BY created_at DESC;
```

### ✅ Se retornar workspaces:
Anote o **ID** do workspace que você quer usar.

### ⚠️ Se retornar vazio:
Execute esta query para criar um workspace:

```sql
INSERT INTO workspaces (name, slug, settings, created_at)
VALUES (
  'Meu Workspace',
  'meu-workspace',
  '{}'::jsonb,
  NOW()
)
RETURNING id, name;
```

**IMPORTANTE**: ✍️ **Anote o ID retornado!** Você vai precisar dele!

---

## ✅ PASSO 2: Verificar Tabelas Event-Driven

**Cole e execute**:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('event_queue', 'baselinker_sync_state', 'scheduled_messages', 'notifications')
ORDER BY table_name;
```

### ✅ Se retornar 4 linhas:
Perfeito! As tabelas já existem.

### ⚠️ Se retornar menos de 4:
Você precisa executar o **script de setup completo**:

1. Abra: `supabase\migrations\00_SETUP_COMPLETO_DATABASE.sql`
2. Copie TODO o conteúdo (Ctrl+A depois Ctrl+C)
3. Cole no SQL Editor
4. Execute (botão verde "Run")
5. Aguarde 10-30 segundos
6. **Leia o output** - ele mostra o que foi criado

---

## ✅ PASSO 3: Habilitar Extensões

**Cole e execute**:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Resultado esperado**: "Success. No rows returned"

---

## ✅ PASSO 4: Configurar Credenciais do Workspace

### 4.1 - Pegar as Credenciais

**BASELINKER TOKEN**:
1. Acesse: https://panel.baselinker.com/
2. Menu: **Settings** → **API**
3. Copie o token

**EVOLUTION API**:
- **URL**: `https://sua-evolution-api.com` (endereço da sua instância)
- **Key**: A API Key configurada na sua Evolution

### 4.2 - Atualizar no Banco

**SUBSTITUA os valores** e execute:

```sql
UPDATE workspaces
SET settings = '{
  "baselinker": {
    "enabled": true,
    "token": "COLE_SEU_TOKEN_BASELINKER_AQUI",
    "warehouse_es": 1,
    "warehouse_sp": 2
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://sua-evolution-api.com",
    "api_key": "COLE_SUA_KEY_EVOLUTION_AQUI"
  },
  "openai": {
    "enabled": false,
    "api_key": "",
    "model": "gpt-4"
  },
  "n8n": {
    "enabled": false,
    "webhook_url": ""
  }
}'::jsonb
WHERE id = 'COLE_O_ID_DO_WORKSPACE_AQUI';
```

### 4.3 - Verificar se Salvou

**Execute**:

```sql
SELECT
  name,
  settings->'baselinker'->>'enabled' as baselinker_ativo,
  CASE
    WHEN settings->'baselinker'->>'token' IS NOT NULL AND settings->'baselinker'->>'token' != ''
    THEN '✓ Configurado'
    ELSE '✗ Não configurado'
  END as baselinker_token,
  settings->'evolution'->>'enabled' as evolution_ativo,
  CASE
    WHEN settings->'evolution'->>'api_key' IS NOT NULL AND settings->'evolution'->>'api_key' != ''
    THEN '✓ Configurado'
    ELSE '✗ Não configurado'
  END as evolution_key
FROM workspaces;
```

**Resultado esperado**:
```
name          | baselinker_ativo | baselinker_token | evolution_ativo | evolution_key
--------------|------------------|------------------|-----------------|---------------
Meu Workspace | true             | ✓ Configurado    | true            | ✓ Configurado
```

✅ **Ambas devem mostrar "✓ Configurado"**

---

## ✅ PASSO 5: Criar Estado de Sincronização

**SUBSTITUA o workspace_id** e execute:

```sql
-- Deletar estado anterior (se existir)
DELETE FROM baselinker_sync_state WHERE workspace_id = 'SEU_WORKSPACE_ID';

-- Criar novo estado
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('SEU_WORKSPACE_ID', 0, false);
```

### Verificar:

```sql
SELECT
  workspace_id,
  last_log_id,
  is_syncing,
  last_sync_at
FROM baselinker_sync_state;
```

Deve retornar 1 linha.

---

## ✅ PASSO 6: Configurar Variáveis do Sistema

### 6.1 - Pegar a Service Role Key

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/settings/api
2. Role para baixo até **"Project API keys"**
3. Copie a chave **service_role** (NÃO a anon!)

### 6.2 - Configurar

**SUBSTITUA a service_role_key** e execute:

```sql
-- URL do projeto (já está correta)
ALTER ROLE postgres
SET app.supabase_url TO 'https://oqwstanztqdiexgrpdta.supabase.co';

-- Service Role Key (SUBSTITUA!)
ALTER ROLE postgres
SET app.service_role_key TO 'COLE_SUA_SERVICE_ROLE_KEY_AQUI';
```

### 6.3 - Verificar

```sql
SELECT * FROM check_event_system_config();
```

**Resultado esperado**:
```
setting                 | value                              | is_configured
------------------------|------------------------------------|--------------
app.supabase_url        | https://oqwstanztqdiexgrpdta...   | true
app.service_role_key    | ***SET***                          | true
```

✅ **Ambos devem mostrar `true`**

⚠️ **Se der erro "permission denied"**: Tudo bem! No Supabase hospedado as Edge Functions já têm acesso automaticamente. Pode pular este passo.

---

## ✅ PASSO 7: Configurar Cron Jobs

### 7.1 - Event Poller (a cada 1 minuto)

**Execute**:

```sql
-- Remover job anterior (se existir)
SELECT cron.unschedule('baselinker-event-poller');

-- Criar novo job
SELECT cron.schedule(
  'baselinker-event-poller',
  '* * * * *',
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

### 7.2 - Scheduled Messages (diariamente às 9h)

**Execute**:

```sql
-- Remover job anterior (se existir)
SELECT cron.unschedule('send-scheduled-messages');

-- Criar novo job
SELECT cron.schedule(
  'send-scheduled-messages',
  '0 9 * * *',
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

### 7.3 - Verificar Cron Jobs

**Execute**:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobname;
```

**Resultado esperado**:
```
jobid | jobname                    | schedule  | active
------|----------------------------|-----------|-------
1     | baselinker-event-poller    | * * * * * | t
2     | send-scheduled-messages    | 0 9 * * * | t
```

✅ **Ambos devem ter `active = t` (true)**

---

## ✅ PASSO 8: Testar o Sistema

### 8.1 - Chamar o Poller Manualmente

**Execute**:

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

**Aguarde 5-10 segundos**

### 8.2 - Verificar Eventos Coletados

**Execute**:

```sql
SELECT
  event_name,
  order_id,
  status,
  created_at,
  error_message
FROM event_queue
ORDER BY created_at DESC
LIMIT 10;
```

### ✅ Se retornar eventos:
🎉 **PARABÉNS! O SISTEMA ESTÁ FUNCIONANDO!**

### ⚠️ Se retornar vazio:
Pode ser que:
- Não haja eventos novos no Baselinker ainda
- As credenciais estão incorretas
- Há algum erro

**Ver logs**:
1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
2. Clique em **baselinker-event-poller**
3. Vá na aba **Logs**
4. Veja se há erros

---

## 📊 Queries de Monitoramento

### Ver Estatísticas de Eventos

```sql
SELECT
  status,
  COUNT(*) as total,
  MAX(created_at) as ultimo_evento
FROM event_queue
GROUP BY status
ORDER BY status;
```

### Ver Eventos com Erro

```sql
SELECT
  event_name,
  order_id,
  error_message,
  retry_count,
  created_at
FROM event_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

### Ver Logs do Cron Job

```sql
SELECT
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

### Ver Último Sync do Baselinker

```sql
SELECT
  w.name as workspace_name,
  bss.last_log_id,
  bss.last_sync_at,
  bss.is_syncing,
  bss.sync_errors
FROM baselinker_sync_state bss
JOIN workspaces w ON w.id = bss.workspace_id;
```

---

## ✅ Checklist Final

Marque conforme for completando:

- [ ] Passo 1: Workspace verificado/criado
- [ ] Passo 2: Tabelas event-driven criadas
- [ ] Passo 3: Extensões habilitadas
- [ ] Passo 4: Credenciais configuradas (✓ Configurado)
- [ ] Passo 5: Estado de sincronização criado
- [ ] Passo 6: Variáveis do sistema configuradas
- [ ] Passo 7: Cron jobs criados (2 jobs ativos)
- [ ] Passo 8: Sistema testado (eventos coletados)

---

## 🎉 Quando Tudo Estiver OK

Você terá:
- ✅ 4 tabelas event-driven criadas
- ✅ Credenciais configuradas no banco
- ✅ 2 cron jobs rodando
- ✅ Eventos sendo coletados do Baselinker
- ✅ Sistema processando pedidos em tempo real

---

## 🆘 Troubleshooting

### Erro: "relation does not exist"
**Solução**: Execute o `00_SETUP_COMPLETO_DATABASE.sql`

### Erro: "permission denied"
**Solução**: No Supabase hospedado, pode ignorar. As funções já têm acesso.

### Erro: "function net.http_post does not exist"
**Solução**: Execute `CREATE EXTENSION IF NOT EXISTS pg_net;`

### Eventos não aparecem
**Possíveis causas**:
1. Token do Baselinker inválido
2. Cron job não está rodando
3. Não há eventos novos no Baselinker

**Verificar logs**: Dashboard → Functions → baselinker-event-poller → Logs

---

**Tempo total**: 10 minutos
**Última atualização**: 2025-01-08
