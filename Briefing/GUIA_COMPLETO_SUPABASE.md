# 🚀 Guia Completo - Configurar Tudo no Supabase

**Para leigos** - Passo a passo simples para configurar o sistema multi-tenant no Supabase hospedado.

**Tempo estimado**: 20-30 minutos

---

## 📋 Antes de Começar

Você vai precisar de:
- [ ] Acesso ao Supabase Dashboard (https://supabase.com/dashboard)
- [ ] Token do Baselinker (pegar em https://panel.baselinker.com/ → Settings → API)
- [ ] URL e API Key da Evolution API (WhatsApp)

---

## Passo 1: Criar as Tabelas no Banco

### 1.1 - Abrir SQL Editor

1. Entre em https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral esquerdo, clique em **"SQL Editor"**
4. Clique no botão **"New query"**

### 1.2 - Copiar e Colar o SQL

1. Abra este arquivo no seu computador:
   ```
   supabase/migrations/20250107_event_driven_tables_fixed.sql
   ```

2. **Copie TODO o conteúdo** do arquivo (Ctrl+A, Ctrl+C)

3. **Cole no SQL Editor** do Supabase (Ctrl+V)

4. Clique no botão verde **"Run"** (canto inferior direito)

5. Aguarde alguns segundos

6. Deve aparecer a mensagem:
   ```
   ✓ Event-driven tables created successfully!
   ```

### 1.3 - Verificar se Funcionou

Cole esta query no SQL Editor e execute:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('event_queue', 'baselinker_sync_state', 'scheduled_messages', 'notifications')
ORDER BY table_name;
```

**Resultado esperado**: Deve mostrar 4 linhas com os nomes das tabelas.

✅ Se mostrou 4 tabelas, passe para o próximo passo!

---

## Passo 2: Configurar URL e Service Key

### 2.1 - Pegar a URL do Projeto

1. No Supabase Dashboard, clique em **"Project Settings"** (ícone de engrenagem no menu lateral)
2. Clique em **"API"**
3. Copie o valor de **"Project URL"** (algo como: `https://abc123.supabase.co`)

### 2.2 - Pegar a Service Role Key

1. Na mesma página (Project Settings → API)
2. Role para baixo até **"Project API keys"**
3. Copie o valor de **"service_role"** (começa com `eyJhbGc...`)
   - ⚠️ **ATENÇÃO**: É a chave **service_role**, NÃO a **anon** key!

### 2.3 - Configurar no Banco

1. Volte para o **SQL Editor**
2. Cole e execute estas queries **substituindo os valores**:

```sql
-- Configurar URL (SUBSTITUA pelo seu Project URL)
ALTER ROLE postgres
SET app.supabase_url TO 'https://abc123.supabase.co';

-- Configurar Service Key (SUBSTITUA pela sua service_role key)
ALTER ROLE postgres
SET app.service_role_key TO 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

⚠️ **Se der erro "permission denied"**: Não se preocupe! As Edge Functions já têm acesso a essas variáveis automaticamente no Supabase hospedado. Você pode pular para o **Passo 3**.

### 2.4 - Verificar

Execute esta query:

```sql
SELECT * FROM check_event_system_config();
```

**Resultado esperado**:
```
setting                 | value       | is_configured
------------------------|-------------|---------------
app.supabase_url        | https://... | true
app.service_role_key    | ***SET***   | true
```

✅ Se os dois mostrarem `true`, está correto!

---

## Passo 3: Configurar Credenciais do Workspace

**IMPORTANTE**: Este passo será feito pelo **usuário final** na interface web do sistema, não por você!

### 3.1 - Acessar a Aplicação

1. Abra seu aplicativo SupleLive CRM no navegador
2. Faça login com sua conta
3. Vá no menu lateral e clique em **"Integrações"** (ou **"Integrations"**)

### 3.2 - Configurar Baselinker

1. Na página de Integrações, encontre o card **"Baselinker"**
2. Clique no botão **"Configurar Baselinker"**
3. Um modal vai abrir
4. Preencha os campos:
   - **API Key**: Cole seu token do Baselinker
     - Para pegar: Acesse https://panel.baselinker.com/ → Settings → API → Copie o token
   - **Warehouse ES**: ID do armazém de ES (geralmente `1` ou `bl_1`)
   - **Warehouse SP**: ID do armazém de SP (geralmente `2` ou `bl_2`)
   - Marque **"Ativar integração"**
5. Clique em **"Salvar"** ou **"Conectar"**
6. Aguarde a mensagem de sucesso

### 3.3 - Configurar Evolution API (WhatsApp)

1. Na mesma página de Integrações, encontre **"WhatsApp Business"** ou **"Evolution API"**
2. Clique em **"Configurar WhatsApp"**
3. Preencha os campos:
   - **URL da API**: Endereço da sua Evolution API (ex: `https://evolution.seudominio.com`)
   - **API Key**: A chave configurada na sua Evolution API
   - **Nome da Instância**: Nome para identificar (ex: `suplecrm-whatsapp`)
   - Marque **"Ativar integração"**
4. Clique em **"Salvar"** ou **"Conectar"**
5. Aguarde a mensagem de sucesso

### 3.4 - Verificar se Salvou (Opcional - via SQL)

Se quiser confirmar que foi salvo no banco, execute no SQL Editor:

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

### ⚠️ Se a Interface Não Salvar no Banco Ainda

Atualmente a interface pode estar salvando no `localStorage` (temporário). Se for o caso, você precisará configurar manualmente via SQL **APENAS UMA VEZ**:

<details>
<summary>📝 Click aqui para ver instruções de configuração manual via SQL</summary>

```sql
-- 1. Pegar o ID do workspace
SELECT id, name FROM workspaces;

-- 2. Configurar credenciais (SUBSTITUA os valores!)
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
  }
}'::jsonb
WHERE id = 'COLE_O_ID_DO_WORKSPACE_AQUI';
```

Depois de configurar via SQL uma vez, as Edge Functions vão começar a funcionar!

</details>

✅ Credenciais configuradas! Passe para o próximo passo.

---

## Passo 4: Criar o Estado de Sincronização

Execute esta query **substituindo o workspace_id**:

```sql
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('COLE_O_ID_DO_WORKSPACE_AQUI', 0, false);
```

**Exemplo**:
```sql
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 0, false);
```

Verificar:

```sql
SELECT * FROM baselinker_sync_state;
```

Deve mostrar 1 linha com seu workspace.

---

## Passo 5: Fazer Deploy das Edge Functions

### Opção A: Via Supabase CLI (Recomendado)

Se você tem Node.js instalado:

```bash
# Abrir terminal/cmd na pasta do projeto
cd c:\Users\paull\Documents\GitHub\suplelive-crm

# Instalar Supabase CLI
npm install -g supabase

# Login
npx supabase login

# Link ao projeto (pegar project-ref em Project Settings → General → Reference ID)
npx supabase link --project-ref SEU_PROJECT_REF

# Deploy das funções
npx supabase functions deploy baselinker-event-poller
npx supabase functions deploy process-order-created
npx supabase functions deploy send-scheduled-messages
npx supabase functions deploy update-baselinker-stock
npx supabase functions deploy process-event
```

### Opção B: Não tenho Node.js / Não sei usar terminal

1. No Supabase Dashboard, vá em **"Edge Functions"**
2. Clique em **"Deploy from GitHub"**
3. Conecte seu repositório GitHub
4. Configure o deploy automático
5. Aguarde o deploy completar

### Verificar Deploy

1. Vá em **Edge Functions** no Dashboard
2. Deve aparecer 5 funções:
   - `baselinker-event-poller`
   - `process-event`
   - `process-order-created`
   - `send-scheduled-messages`
   - `update-baselinker-stock`

---

## Passo 6: Configurar Cron Jobs

### 6.1 - Habilitar pg_cron

No SQL Editor, execute:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 6.2 - Habilitar pg_net (para fazer HTTP requests)

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 6.3 - Criar Cron Job: Event Poller (A cada 1 minuto)

Cole e execute:

```sql
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

### 6.4 - Criar Cron Job: Mensagens Agendadas (Diariamente às 9h)

Cole e execute:

```sql
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

### 6.5 - Verificar Cron Jobs

Execute:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobid;
```

**Resultado esperado**: 2 jobs ativos:
```
jobid | jobname                      | schedule    | active
------|------------------------------|-------------|--------
1     | baselinker-event-poller      | * * * * *   | true
2     | send-scheduled-messages      | 0 9 * * *   | true
```

✅ Se mostrou os 2 jobs, está tudo certo!

---

## Passo 7: Testar o Sistema

### 7.1 - Testar Event Poller Manualmente

Execute no SQL Editor:

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

**Resultado esperado**: Deve retornar algo como:
```json
{"success": true, "results": [...]}
```

### 7.2 - Ver Eventos Coletados

Execute:

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

**Resultado esperado**:
- Se houver pedidos novos no Baselinker, vão aparecer aqui
- Se não aparecer nada, é porque não há pedidos novos (normal)

### 7.3 - Ver Logs dos Cron Jobs

Execute:

```sql
SELECT
  jobid,
  runid,
  status,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 5;
```

**Resultado esperado**: Deve mostrar execuções do cron job.

---

## 🎉 Pronto! Sistema Configurado

### Checklist Final

Use este checklist para confirmar que tudo está funcionando:

- [ ] **Passo 1**: 4 tabelas criadas (event_queue, baselinker_sync_state, scheduled_messages, notifications)
- [ ] **Passo 2**: Configurações do Supabase definidas (URL e Service Key)
- [ ] **Passo 3**: Credenciais do workspace configuradas (Baselinker e Evolution)
- [ ] **Passo 4**: Estado de sincronização criado
- [ ] **Passo 5**: 5 Edge Functions deployadas
- [ ] **Passo 6**: 2 Cron jobs ativos
- [ ] **Passo 7**: Teste manual funcionou

---

## 🔍 Como Saber se Está Funcionando?

### Monitorar Eventos

Execute periodicamente:

```sql
SELECT
  status,
  COUNT(*) as total
FROM event_queue
GROUP BY status
ORDER BY status;
```

**Resultado saudável**:
```
status     | total
-----------|-------
completed  | 150   ← Eventos processados com sucesso
pending    | 2     ← Aguardando processamento (normal ter alguns)
failed     | 0     ← Idealmente zero (se tiver, há problemas)
```

### Ver Mensagens Agendadas

```sql
SELECT
  message_type,
  scheduled_for,
  status,
  client_id
FROM scheduled_messages
WHERE status = 'pending'
ORDER BY scheduled_for ASC
LIMIT 10;
```

### Ver Logs das Edge Functions

1. No Supabase Dashboard, vá em **Edge Functions**
2. Clique em **baselinker-event-poller**
3. Veja a aba **Logs**
4. Deve mostrar execuções recentes

---

## ❌ Problemas Comuns

### Erro: "Baselinker token not configured"

**Causa**: Token não foi salvo corretamente no Passo 3

**Solução**: Refaça o Passo 3.3, verificando se o token está entre aspas

---

### Erro: "No workspaces with Baselinker enabled"

**Causa**: Campo `enabled` está como `false`

**Solução**:
```sql
UPDATE workspaces
SET settings = jsonb_set(settings, '{baselinker,enabled}', 'true'::jsonb)
WHERE id = 'SEU_WORKSPACE_ID';
```

---

### Cron job não está rodando

**Causa**: Extensão pg_cron não habilitada

**Solução**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

### Eventos não são processados

**Causa**: Configurações do Passo 2 não foram aplicadas

**Solução**: Refaça o Passo 2 (URL e Service Key)

---

### Edge Functions retornam erro 500

**Causa**: Credenciais inválidas ou Edge Functions não foram deployadas

**Solução**:
1. Verifique as credenciais no Passo 3.4
2. Verifique se as Edge Functions estão deployadas no Dashboard

---

## 📞 Precisa de Ajuda?

### Ver Logs de Erro

```sql
-- Eventos que falharam
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

### Ver Erros de Sincronização

```sql
SELECT
  workspace_id,
  last_sync_at,
  sync_errors
FROM baselinker_sync_state;
```

---

## 🎯 Próximos Passos

Depois que tudo estiver funcionando:

1. **Monitorar por 24 horas** para garantir estabilidade
2. **Fazer um pedido teste** no Baselinker para ver o fluxo completo
3. **Configurar alertas** no Supabase para erros
4. **Adicionar mais workspaces** se necessário (repetir Passo 3)

---

**Última atualização**: 2025-01-08
**Versão**: 2.0.0 (Multi-tenant)
**Nível**: Iniciante/Intermediário

**Dúvidas?** Releia a seção "Problemas Comuns" ou verifique os logs das Edge Functions no Dashboard.
