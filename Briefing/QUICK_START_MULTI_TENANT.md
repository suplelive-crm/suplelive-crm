# Quick Start - Atualização Multi-Tenant (Supabase Hospedado)

Este é um guia rápido para atualizar seu projeto Supabase hospedado (cloud) com o novo sistema multi-tenant de credenciais.

## ⚡ Passo a Passo Rápido

### 1️⃣ Atualizar Migration SQL

1. Abra o Supabase Dashboard: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. Clique em **New query**
5. Copie e cole o conteúdo do arquivo: [`supabase/migrations/20250107_event_driven_tables_fixed.sql`](../supabase/migrations/20250107_event_driven_tables_fixed.sql)
   - ⚠️ **IMPORTANTE**: Use a versão `_fixed.sql` que não tem dependências de tabelas externas
6. Clique em **Run** (botão verde)
7. Aguarde mensagem de sucesso (deve aparecer "✓ Event-driven tables created successfully!")

**✅ Verificar**: Execute esta query para confirmar

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'event_queue'
AND column_name = 'workspace_id';
```

Deve retornar:
```
column_name  | data_type
-------------|----------
workspace_id | uuid
```

---

### 2️⃣ Configurar Credenciais do Workspace

#### Pegar o ID do Workspace

```sql
SELECT id, name FROM workspaces;
```

Copie o `id` (UUID) que você quer configurar.

#### Inserir Credenciais

**Substitua os valores** e execute:

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
  }
}'::jsonb
WHERE id = 'COLE_SEU_WORKSPACE_ID_AQUI';
```

#### Onde pegar as credenciais?

**BASELINKER TOKEN**:
- Acesse: https://panel.baselinker.com/
- Menu: Settings → API
- Copie o token

**EVOLUTION API**:
- URL: Endereço da sua instância Evolution (ex: `https://evolution.seudominio.com`)
- Key: API Key configurada na sua Evolution

**✅ Verificar**: Execute para confirmar

```sql
SELECT
  name,
  settings->'baselinker'->>'enabled' as baselinker_ok,
  settings->'evolution'->>'enabled' as evolution_ok,
  CASE WHEN settings->'baselinker'->>'token' != '' THEN '✓' ELSE '✗' END as token_ok
FROM workspaces;
```

---

### 3️⃣ Deploy das Edge Functions

#### Opção A: Via Supabase CLI (Recomendado)

Se você tem Node.js instalado:

```bash
# Instalar CLI
npm install -g supabase

# Login
npx supabase login

# Link ao projeto (pegar project-ref no Dashboard → Project Settings → General)
npx supabase link --project-ref SEU_PROJECT_REF

# Deploy de todas as funções atualizadas
npx supabase functions deploy baselinker-event-poller
npx supabase functions deploy process-order-created
npx supabase functions deploy send-scheduled-messages
npx supabase functions deploy update-baselinker-stock
npx supabase functions deploy process-event
```

#### Opção B: Via GitHub Actions (Alternativa)

Se seu código está no GitHub:

1. No Supabase Dashboard, vá em **Edge Functions**
2. Clique em **Deploy from GitHub**
3. Conecte seu repositório
4. Configure o deploy automático

**✅ Verificar**: No Dashboard, vá em **Edge Functions** e confirme que as 5 funções estão deployadas

---

### 4️⃣ Inicializar Estado de Sincronização

Execute esta query (substitua o `workspace_id`):

```sql
-- Se já existe, delete primeiro
DELETE FROM baselinker_sync_state WHERE workspace_id = 'SEU_WORKSPACE_ID';

-- Criar novo registro
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('SEU_WORKSPACE_ID', 0, false);
```

**✅ Verificar**:

```sql
SELECT * FROM baselinker_sync_state;
```

---

### 5️⃣ Testar o Sistema

#### Teste 1: Event Poller Manual

No **SQL Editor**, execute:

```sql
-- Pegar URL do projeto
SELECT current_setting('app.supabase_url', true);

-- Se não retornar nada, configure:
ALTER DATABASE postgres SET app.supabase_url TO 'https://SEU_PROJECT.supabase.co';
ALTER DATABASE postgres SET app.service_role_key TO 'SUA_SERVICE_ROLE_KEY';
```

Depois teste o poller:

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

#### Teste 2: Verificar Eventos Coletados

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

Se retornar eventos, está funcionando! 🎉

---

### 6️⃣ Configurar Cron Jobs

#### Habilitar pg_cron

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### Agendar Event Poller (a cada 1 minuto)

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

#### Agendar Mensagens (diariamente às 9h)

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

**✅ Verificar**:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job;
```

Deve retornar 2 jobs ativos.

---

## 🎯 Checklist Completo

Use este checklist para garantir que tudo está configurado:

- [ ] Migration SQL executada (tabela `event_queue` tem campo `workspace_id`)
- [ ] Credenciais configuradas no banco (`workspaces.settings`)
- [ ] Edge Functions deployadas (5 funções visíveis no Dashboard)
- [ ] Estado de sincronização criado (`baselinker_sync_state`)
- [ ] Teste manual do event poller executado com sucesso
- [ ] Eventos aparecendo na tabela `event_queue`
- [ ] Cron jobs configurados e ativos
- [ ] Log do primeiro cron job verificado (`cron.job_run_details`)

---

## ❓ Troubleshooting Rápido

### Erro: "No workspace_id in event data"

**Causa**: Migration antiga sem campo `workspace_id`

**Solução**: Execute novamente a migration do Passo 1

### Erro: "Baselinker token not configured"

**Causa**: Credenciais não foram salvas no banco

**Solução**: Execute novamente o UPDATE do Passo 2 e verifique com a query de validação

### Erro: "Failed to fetch workspace config"

**Causa**: `workspace_id` inválido ou workspace não existe

**Solução**:
```sql
SELECT id, name FROM workspaces; -- Confirme o ID correto
```

### Eventos não aparecem na fila

**Causa 1**: Cron job não está rodando

**Solução**:
```sql
-- Ver últimas execuções
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 5;
```

**Causa 2**: Token do Baselinker inválido

**Solução**: Verifique no painel do Baselinker se o token está ativo

### Edge Function retorna 500

**Causa**: Erro de sintaxe ou credenciais incorretas

**Solução**:
1. Vá em **Edge Functions** → Clique na função
2. Veja os **Logs** para identificar o erro
3. Verifique se as credenciais estão corretas

---

## 📚 Documentação Completa

Para guias detalhados, consulte:

- [SUPABASE_DASHBOARD_SETUP.md](./SUPABASE_DASHBOARD_SETUP.md) - Setup completo passo a passo
- [WORKSPACE_CREDENTIALS_CONFIG.md](./WORKSPACE_CREDENTIALS_CONFIG.md) - Guia de credenciais
- [EVENT_DRIVEN_ARCHITECTURE.md](./EVENT_DRIVEN_ARCHITECTURE.md) - Arquitetura do sistema

---

## 🚀 Próximos Passos

Depois que tudo estiver funcionando:

1. **Monitore os logs** das Edge Functions por 24h
2. **Verifique a tabela** `event_queue` para ver eventos sendo processados
3. **Teste um pedido real** no Baselinker para ver o fluxo completo
4. **Configure alertas** para erros (via Supabase Dashboard)
5. **Adicione mais workspaces** se necessário (repita o Passo 2)

---

**Tempo estimado**: 15-30 minutos

**Dificuldade**: Intermediária (requer conhecimento básico de SQL)

**Suporte**: Se tiver dúvidas, verifique os logs das Edge Functions primeiro!
