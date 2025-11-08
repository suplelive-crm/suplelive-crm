# ✅ Verificação Completa do Sistema

Este guia vai te ajudar a verificar e configurar TUDO que é necessário para o sistema funcionar.

---

## 📋 Checklist Rápido

Siga na ordem:

- [ ] **Passo 1**: Executar script de verificação completa
- [ ] **Passo 2**: Analisar resultados
- [ ] **Passo 3**: Configurar credenciais do workspace
- [ ] **Passo 4**: Criar estado de sincronização
- [ ] **Passo 5**: Configurar cron jobs
- [ ] **Passo 6**: Testar sistema

---

## Passo 1: Executar Script de Verificação Completa

### 1.1 - Abrir SQL Editor

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
2. No menu lateral, clique em **"SQL Editor"**
3. Clique em **"New query"**

### 1.2 - Executar Script

1. Abra este arquivo: `supabase/migrations/00_SETUP_COMPLETO_DATABASE.sql`
2. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
3. **Cole no SQL Editor** (Ctrl+V)
4. Clique no botão **"Run"** (verde, canto inferior direito)
5. Aguarde a execução (pode demorar 10-30 segundos)

### 1.3 - Analisar Output

O script vai mostrar um relatório completo com:

- ✓ Tabelas que existem
- ✗ Tabelas que faltam
- ✓ Extensões habilitadas
- ✓ Tabelas event-driven criadas
- ✓ Triggers configurados
- ✓ RLS policies criadas
- ⚠️ Configurações pendentes

**Exemplo de output esperado**:

```
========================================
INICIANDO VERIFICAÇÃO DO BANCO DE DADOS
========================================

1. VERIFICANDO TABELAS PRINCIPAIS:
-----------------------------------
  ✓ workspaces existe
  ✓ workspace_users existe
  ✓ clients existe
  ✓ orders existe
  ...

2. VERIFICANDO TABELAS EVENT-DRIVEN:
------------------------------------
  ✓ event_queue existe
  ✓ baselinker_sync_state existe
  ✓ scheduled_messages existe
  ✓ notifications existe

3. HABILITANDO EXTENSÕES:
-------------------------
  ✓ pg_net habilitado
  ✓ pg_cron habilitado
  ✓ uuid-ossp habilitado

...

8. VERIFICANDO WORKSPACES:
--------------------------
  ✓ Tabela workspaces existe
  ✓ Total de workspaces: 1

  Workspaces encontrados:
    - Meu Workspace (ID: 550e8400-e29b-41d4-a716-446655440000)

9. VERIFICANDO CONFIGURAÇÕES:
------------------------------
  ⚠️  app.supabase_url: NOT SET (não configurado)
  ⚠️  app.service_role_key: NOT SET (não configurado)

========================================
VERIFICAÇÃO CONCLUÍDA!
========================================
```

---

## Passo 2: Interpretar Resultados

### ✅ Tudo OK se você ver:

- Todas as tabelas principais existem (✓)
- Todas as 4 tabelas event-driven criadas (✓)
- Pelo menos 1 workspace encontrado
- Extensões habilitadas (pg_net, pg_cron)

### ⚠️ Atenção se:

**"Nenhum workspace encontrado"**
→ Você precisa criar um workspace primeiro (veja Passo 2.1 abaixo)

**"Tabela workspaces NÃO EXISTE"**
→ Você precisa executar o `Schema.sql` primeiro (veja Passo 2.2 abaixo)

**"app.supabase_url: NOT SET"**
→ Não é problema no Supabase hospedado! As Edge Functions já têm acesso automaticamente.

---

## Passo 2.1: Criar Workspace (se não existir)

Se você não tem nenhum workspace, execute:

```sql
-- Inserir workspace padrão
INSERT INTO public.workspaces (name, slug, settings, created_at)
VALUES (
  'Meu Workspace',
  'meu-workspace',
  '{}'::jsonb,
  NOW()
)
RETURNING id, name;
```

**Anote o ID retornado** - você vai precisar dele!

---

## Passo 2.2: Executar Schema.sql (se tabelas não existirem)

Se a tabela `workspaces` não existe, você precisa executar o schema principal:

1. Abra o arquivo: `Schema.sql` (na raiz do projeto)
2. Copie TODO o conteúdo
3. Cole no SQL Editor
4. Execute
5. Depois, volte e execute novamente o `00_SETUP_COMPLETO_DATABASE.sql`

---

## Passo 3: Configurar Credenciais do Workspace

### 3.1 - Pegar ID do Workspace

Execute:

```sql
SELECT id, name FROM workspaces;
```

Copie o **ID** (UUID) do seu workspace.

### 3.2 - Configurar Credenciais

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

### 3.3 - Onde Pegar as Credenciais?

**BASELINKER TOKEN**:
1. Acesse: https://panel.baselinker.com/
2. Menu: **Settings** → **API**
3. Copie o token

**EVOLUTION API**:
- **URL**: Endereço da sua instância Evolution (ex: `https://evolution.seudominio.com`)
- **Key**: API Key configurada na sua Evolution API

### 3.4 - Verificar se Salvou

Execute:

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

✅ Se aparecer **"✓ Configurado"** nas duas colunas, está correto!

---

## Passo 4: Criar Estado de Sincronização Inicial

Execute **substituindo o workspace_id**:

```sql
-- Deletar estado anterior (se existir)
DELETE FROM baselinker_sync_state WHERE workspace_id = 'SEU_WORKSPACE_ID';

-- Criar novo estado
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('SEU_WORKSPACE_ID', 0, false);
```

**Verificar**:

```sql
SELECT
  workspace_id,
  last_log_id,
  is_syncing,
  last_sync_at
FROM baselinker_sync_state;
```

Deve retornar 1 linha com seu workspace.

---

## Passo 5: Configurar Cron Jobs

### 5.1 - Configurar Event Poller (a cada 1 minuto)

**IMPORTANTE**: Antes de criar o cron, você precisa configurar as variáveis:

```sql
-- Configurar URL do projeto
ALTER ROLE postgres
SET app.supabase_url TO 'https://oqwstanztqdiexgrpdta.supabase.co';

-- Configurar Service Role Key (pegar em Project Settings → API)
ALTER ROLE postgres
SET app.service_role_key TO 'eyJhbGci...SUA_SERVICE_ROLE_KEY';
```

**Para pegar a Service Role Key**:
1. Dashboard → **Project Settings** → **API**
2. Role para baixo até **"Project API keys"**
3. Copie a chave **service_role** (NÃO a anon key!)

**Agora criar o cron**:

```sql
-- Remover job anterior (se existir)
SELECT cron.unschedule('baselinker-event-poller');

-- Criar job (roda a cada 1 minuto)
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

### 5.2 - Configurar Send Scheduled Messages (diariamente às 9h)

```sql
-- Remover job anterior (se existir)
SELECT cron.unschedule('send-scheduled-messages');

-- Criar job (roda todo dia às 9h)
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

### 5.3 - Verificar Cron Jobs

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

✅ Ambos devem estar com `active = t` (true)

---

## Passo 6: Testar o Sistema

### 6.1 - Teste Manual do Event Poller

Execute:

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

Aguarde 5-10 segundos.

### 6.2 - Verificar se Eventos Foram Coletados

```sql
SELECT
  event_name,
  order_id,
  status,
  created_at
FROM event_queue
ORDER BY created_at DESC
LIMIT 10;
```

**Se retornar eventos**: 🎉 **FUNCIONOU!**

**Se retornar vazio**:
- Pode ser que não haja eventos novos no Baselinker ainda
- Ou as credenciais estão incorretas

### 6.3 - Ver Logs do Cron Job

```sql
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 5;
```

Isso mostra as últimas execuções do cron.

### 6.4 - Ver Logs das Edge Functions

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
2. Clique em **baselinker-event-poller**
3. Vá na aba **Logs**
4. Veja se há erros ou sucessos

---

## 🎉 Sistema Pronto!

Se você chegou até aqui e:

- ✅ Todas as tabelas existem
- ✅ Credenciais estão configuradas
- ✅ Estado de sincronização criado
- ✅ Cron jobs ativos
- ✅ Eventos sendo coletados

**Parabéns! O sistema está 100% funcional!** 🚀

---

## 📊 Queries Úteis para Monitoramento

### Ver estatísticas de eventos

```sql
SELECT
  status,
  COUNT(*) as total,
  MAX(created_at) as ultimo_evento
FROM event_queue
GROUP BY status
ORDER BY status;
```

### Ver eventos com erro

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

### Ver mensagens agendadas pendentes

```sql
SELECT
  message_type,
  scheduled_for,
  status,
  created_at
FROM scheduled_messages
WHERE status = 'pending'
ORDER BY scheduled_for ASC
LIMIT 10;
```

### Ver último sync do Baselinker

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

## 🆘 Troubleshooting

### Erro: "relation does not exist"

**Causa**: Tabela não foi criada

**Solução**: Execute novamente o `00_SETUP_COMPLETO_DATABASE.sql`

### Erro: "permission denied"

**Causa**: RLS está bloqueando

**Solução**: As policies de RLS permitem tudo para service_role. Verifique se você está usando a service_role_key correta.

### Erro: "function net.http_post does not exist"

**Causa**: Extensão pg_net não está habilitada

**Solução**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Eventos não aparecem

**Possíveis causas**:
1. Token do Baselinker inválido
2. Cron job não está rodando
3. Não há eventos novos no Baselinker

**Verificar**:
```sql
-- Ver logs do cron
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;

-- Ver se credenciais estão OK
SELECT settings->'baselinker'->>'token' as token FROM workspaces;
```

---

**Última atualização**: 2025-01-08
**Versão**: 2.0
