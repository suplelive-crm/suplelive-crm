# 🚀 EXECUTE AGORA - Checklist Simplificado

**Status**: ✅ Edge Functions deployadas | ⚠️ Banco de dados precisa ser configurado

---

## 📝 O QUE FAZER AGORA (Ordem):

### ✅ 1. Edge Functions Deployadas

Já feito! As 5 funções estão no ar:
- ✅ baselinker-event-poller
- ✅ process-order-created
- ✅ send-scheduled-messages
- ✅ update-baselinker-stock
- ✅ process-event

Ver em: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions

---

### ⚠️ 2. Configurar Banco de Dados

**AÇÃO NECESSÁRIA**: Execute o script de setup completo

#### Como fazer:

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql

2. Clique em **"New query"**

3. Abra este arquivo no seu computador:
   ```
   supabase/migrations/00_SETUP_COMPLETO_DATABASE.sql
   ```

4. **Copie TODO o conteúdo** (Ctrl+A depois Ctrl+C)

5. **Cole no SQL Editor** (Ctrl+V)

6. Clique no botão verde **"Run"**

7. Aguarde terminar (10-30 segundos)

8. **Leia o output** - ele vai te mostrar:
   - ✓ O que já existe
   - ✗ O que foi criado
   - ⚠️ O que precisa ser configurado

---

### ⚠️ 3. Configurar Credenciais

**Depois de executar o script acima**, você precisa configurar as credenciais:

```sql
-- 1. Ver workspaces existentes
SELECT id, name FROM workspaces;

-- 2. Configurar credenciais (SUBSTITUA os valores!)
UPDATE workspaces
SET settings = '{
  "baselinker": {
    "enabled": true,
    "token": "SEU_TOKEN_BASELINKER_AQUI",
    "warehouse_es": 1,
    "warehouse_sp": 2
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://sua-evolution-api.com",
    "api_key": "SUA_KEY_EVOLUTION_AQUI"
  }
}'::jsonb
WHERE id = 'COLE_O_ID_DO_WORKSPACE_AQUI';
```

**Onde pegar credenciais:**
- **Baselinker**: https://panel.baselinker.com/ → Settings → API
- **Evolution API**: URL e Key da sua instância

---

### ⚠️ 4. Criar Estado de Sincronização

```sql
-- Substitua o workspace_id
INSERT INTO baselinker_sync_state (workspace_id, last_log_id, is_syncing)
VALUES ('SEU_WORKSPACE_ID', 0, false);
```

---

### ⚠️ 5. Configurar Cron Jobs

#### Passo 1: Configurar variáveis

```sql
-- URL do projeto
ALTER ROLE postgres
SET app.supabase_url TO 'https://oqwstanztqdiexgrpdta.supabase.co';

-- Service Role Key (pegar em Project Settings → API)
ALTER ROLE postgres
SET app.service_role_key TO 'SUA_SERVICE_ROLE_KEY_AQUI';
```

#### Passo 2: Criar cron do Event Poller (a cada 1 min)

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

#### Passo 3: Criar cron de Mensagens (diariamente às 9h)

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

#### Verificar crons criados:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job;
```

Deve retornar 2 jobs ativos.

---

### ✅ 6. Testar Sistema

#### Teste 1: Chamar o poller manualmente

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

#### Teste 2: Ver se eventos foram coletados

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

---

## 📊 Checklist Visual

```
┌─────────────────────────────────────────┬─────────┐
│ Item                                    │ Status  │
├─────────────────────────────────────────┼─────────┤
│ ✅ Edge Functions deployadas            │   OK    │
│ ⚠️  Script 00_SETUP_COMPLETO_DATABASE   │ PENDING │
│ ⚠️  Credenciais configuradas            │ PENDING │
│ ⚠️  Estado de sincronização criado      │ PENDING │
│ ⚠️  Cron jobs configurados              │ PENDING │
│ ⚠️  Sistema testado                     │ PENDING │
└─────────────────────────────────────────┴─────────┘
```

---

## 🎯 Próximo Passo Imediato

**➡️ EXECUTE O PASSO 2 AGORA** (Configurar Banco de Dados)

Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql

E siga as instruções acima.

---

## 📚 Documentação Completa

Para mais detalhes, consulte:

- **[VERIFICACAO_COMPLETA_SISTEMA.md](./VERIFICACAO_COMPLETA_SISTEMA.md)** - Guia completo com troubleshooting
- **[GUIA_COMPLETO_SUPABASE.md](./GUIA_COMPLETO_SUPABASE.md)** - Setup passo a passo
- **[QUICK_START_MULTI_TENANT.md](./QUICK_START_MULTI_TENANT.md)** - Guia rápido

---

## 🆘 Precisa de Ajuda?

Se algo der errado:

1. Leia o output do script - ele mostra o que está faltando
2. Consulte a seção de Troubleshooting em [VERIFICACAO_COMPLETA_SISTEMA.md](./VERIFICACAO_COMPLETA_SISTEMA.md)
3. Verifique os logs das Edge Functions no Dashboard

---

**Tempo estimado**: 10-15 minutos para completar tudo

**Última atualização**: 2025-01-08
