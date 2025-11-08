# Migrations - Event-Driven Architecture

## ⚠️ Qual Migration Usar?

### Para Supabase Hospedado (Cloud) - RECOMENDADO

Use: **`20250107_event_driven_tables_fixed.sql`**

```sql
-- No SQL Editor do Supabase Dashboard
-- Copie e cole o conteúdo de 20250107_event_driven_tables_fixed.sql
```

**Por quê?**
- ✅ Não depende de tabelas que podem não existir
- ✅ Cria foreign keys condicionalmente
- ✅ Funciona em qualquer ordem de execução
- ✅ Sem erros de "relation does not exist"

---

### Para Desenvolvimento Local ou Self-Hosted

Use: **`20250107_event_driven_tables.sql`** (versão original)

```bash
# Via Supabase CLI
npx supabase db push
```

**Por quê?**
- Assume que todas as tabelas base já existem
- Mais simples, menos verificações
- Ideal quando tem controle total do schema

---

## Diferenças Entre as Versões

### `20250107_event_driven_tables.sql` (Original)

```sql
CREATE TABLE public.event_queue (
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  -- ...
);
```

❌ **Problema**: Se `workspaces` não existir, migration falha com erro:
```
ERROR: 42P01: relation "public.workspaces" does not exist
```

---

### `20250107_event_driven_tables_fixed.sql` (Recomendado)

```sql
CREATE TABLE public.event_queue (
  workspace_id UUID NOT NULL,
  -- ...
);

-- Add foreign key constraint only if workspaces table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
    ALTER TABLE public.event_queue
    ADD CONSTRAINT event_queue_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;
```

✅ **Solução**: Cria a tabela primeiro, adiciona FK depois (se tabela existir)

---

## Tabelas Criadas

Ambas as migrations criam as mesmas 4 tabelas:

1. **`event_queue`**
   - Fila de eventos do Baselinker
   - Campos: `id`, `workspace_id`, `event_log_id`, `event_type`, `order_id`, `payload`, `status`

2. **`baselinker_sync_state`**
   - Estado de sincronização por workspace
   - Campos: `id`, `workspace_id`, `last_log_id`, `is_syncing`, `sync_errors`

3. **`scheduled_messages`**
   - Mensagens agendadas (reorder, upsell, etc)
   - Campos: `id`, `workspace_id`, `client_id`, `message_type`, `scheduled_for`, `status`

4. **`notifications`**
   - Notificações do sistema
   - Campos: `id`, `workspace_id`, `user_id`, `type`, `title`, `message`, `read_at`

---

## Após Executar a Migration

### 1. Verificar Tabelas

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('event_queue', 'baselinker_sync_state', 'scheduled_messages', 'notifications')
ORDER BY table_name;
```

Deve retornar 4 linhas.

### 2. Verificar Configuração

```sql
SELECT * FROM check_event_system_config();
```

Deve retornar:
```
setting                 | value    | is_configured
------------------------|----------|---------------
app.supabase_url        | NOT SET  | false
app.service_role_key    | NOT SET  | false
```

### 3. Configurar Settings (Próximo Passo)

```sql
-- Configurar URL do projeto
ALTER DATABASE postgres SET app.supabase_url TO 'https://SEU_PROJECT.supabase.co';

-- Configurar Service Role Key (pegar em Project Settings → API)
ALTER DATABASE postgres SET app.service_role_key TO 'SUA_SERVICE_ROLE_KEY';
```

### 4. Verificar Novamente

```sql
SELECT * FROM check_event_system_config();
```

Agora deve mostrar:
```
setting                 | value       | is_configured
------------------------|-------------|---------------
app.supabase_url        | https://... | true
app.service_role_key    | ***SET***   | true
```

---

## Troubleshooting

### Erro: "relation does not exist"

**Sintoma**:
```
ERROR: 42P01: relation "public.workspaces" does not exist
```

**Solução**: Use `20250107_event_driven_tables_fixed.sql` em vez da versão original

---

### Erro: "function net.http_post does not exist"

**Sintoma**: Trigger falha ao inserir evento

**Causa**: Extensão `pg_net` não está instalada

**Solução**:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

### Tabelas criadas mas FKs não

**Sintoma**: Tabelas existem mas sem foreign keys

**Causa**: Tabelas referenciadas (`workspaces`, `clients`) não existiam no momento da migration

**Solução**: Execute manualmente os blocos `DO $$` para adicionar FKs:

```sql
-- Exemplo: Adicionar FK para event_queue
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') THEN
    ALTER TABLE public.event_queue
    DROP CONSTRAINT IF EXISTS event_queue_workspace_id_fkey;

    ALTER TABLE public.event_queue
    ADD CONSTRAINT event_queue_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
  END IF;
END $$;
```

---

### Trigger não dispara

**Sintoma**: Eventos inseridos mas `process-event` não é chamado

**Causa**: Settings `app.supabase_url` e `app.service_role_key` não configurados

**Solução**: Configure conforme passo 3 acima

---

## Ordem Recomendada de Execução

Para setup completo do zero:

1. ✅ **Esta migration** (`20250107_event_driven_tables_fixed.sql`)
2. ✅ Migration de stock logs (`20250107_stock_logs_enhancement.sql`)
3. ✅ Configurar database settings (`app.supabase_url`, etc)
4. ✅ Configurar credenciais do workspace (ver [QUICK_START_MULTI_TENANT.md](../../Briefing/QUICK_START_MULTI_TENANT.md))
5. ✅ Deploy das Edge Functions
6. ✅ Configurar cron jobs

---

## Arquivos Relacionados

- [QUICK_START_MULTI_TENANT.md](../../Briefing/QUICK_START_MULTI_TENANT.md) - Guia rápido completo
- [SUPABASE_DASHBOARD_SETUP.md](../../Briefing/SUPABASE_DASHBOARD_SETUP.md) - Setup detalhado
- [WORKSPACE_CREDENTIALS_CONFIG.md](../../Briefing/WORKSPACE_CREDENTIALS_CONFIG.md) - Configuração de credenciais

---

**Última atualização**: 2025-01-08
