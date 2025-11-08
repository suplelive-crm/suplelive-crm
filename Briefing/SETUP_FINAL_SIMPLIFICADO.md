# 🚀 Setup Final Simplificado

**Sistema Multi-Tenant Automático**

---

## ✅ O QUE O SISTEMA FAZ AUTOMATICAMENTE

O sistema está configurado para funcionar automaticamente para **TODOS os workspaces** que existem no banco.

**Você NÃO precisa**:
- ❌ Configurar credenciais no SQL manualmente
- ❌ Criar estados de sincronização por workspace
- ❌ Replicar configurações para cada workspace

**O sistema FAZ automaticamente**:
- ✅ Processa eventos de TODOS os workspaces
- ✅ Busca credenciais de cada workspace do banco
- ✅ Cria estados de sincronização para todos
- ✅ Roda para múltiplos workspaces simultaneamente

---

## 📋 SETUP EM 3 PASSOS (5 MINUTOS)

### PASSO 1: Configurar Banco (2 minutos)

1. **Acesse**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql

2. **Clique**: "New query"

3. **Copie e cole** o conteúdo de:
   ```
   supabase/migrations/00_SETUP_AUTOMATICO_DATABASE.sql
   ```

4. **Execute** (botão verde "Run")

5. **Leia o output** - ele mostra:
   - ✓ Quantos workspaces encontrou
   - ✓ Quantos estados de sincronização criou
   - ✓ O que foi configurado

**Pronto!** As tabelas e estruturas estão criadas para TODOS os workspaces.

---

### PASSO 2: Configurar Cron Jobs (2 minutos)

Execute estas queries no SQL Editor:

```sql
-- Event Poller (roda a cada 1 minuto para TODOS os workspaces)
SELECT cron.schedule(
  'baselinker-event-poller',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/baselinker-event-poller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Scheduled Messages (roda diariamente às 9h)
SELECT cron.schedule(
  'send-scheduled-messages',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/send-scheduled-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Verificar**:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job;
```

Deve retornar 2 jobs com `active = t`.

---

### PASSO 3: Usuários Configuram Credenciais no Painel (1 minuto)

**Cada usuário** faz isso no painel web:

1. Login no sistema
2. Menu → **Integrações**
3. Configurar **Baselinker**:
   - API Token
   - Warehouse ES
   - Warehouse SP
4. Configurar **Evolution API**:
   - URL da API
   - API Key
5. Salvar

**Pronto!** O sistema começa a funcionar automaticamente para aquele workspace.

---

## 🎯 Como Funciona o Sistema Multi-Tenant

```
Cron Job (1 min)
       ↓
baselinker-event-poller
       ↓
Busca TODOS os workspaces com Baselinker ativo
       ↓
Para cada workspace:
  ├─ Busca token do banco (workspaces.settings)
  ├─ Chama API do Baselinker
  ├─ Coleta eventos novos
  └─ Insere na event_queue
       ↓
Trigger dispara process-event
       ↓
process-order-created
  ├─ Busca credenciais do workspace
  ├─ Busca Evolution API config do workspace
  ├─ Processa pedido
  └─ Envia mensagens
```

**Cada workspace tem**:
- Suas próprias credenciais (isoladas)
- Seu próprio estado de sincronização
- Seus próprios eventos processados

---

## 📊 Estrutura de Credenciais no Banco

O painel web salva assim em `workspaces.settings`:

```json
{
  "baselinker": {
    "enabled": true,
    "token": "TOKEN_DO_CLIENTE",
    "warehouse_es": 1,
    "warehouse_sp": 2
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://evolution.cliente.com",
    "api_key": "KEY_DO_CLIENTE"
  }
}
```

**As Edge Functions buscam automaticamente** essas credenciais quando processam eventos.

---

## ✅ Verificar se Está Funcionando

### Ver workspaces e credenciais configuradas:

```sql
SELECT
  name,
  settings->'baselinker'->>'enabled' as baselinker_ativo,
  settings->'evolution'->>'enabled' as evolution_ativo,
  CASE
    WHEN settings->'baselinker'->>'token' IS NOT NULL AND settings->'baselinker'->>'token' != ''
    THEN 'Configurado'
    ELSE 'Pendente'
  END as status_baselinker
FROM workspaces;
```

### Ver estados de sincronização criados:

```sql
SELECT
  w.name as workspace,
  bss.last_log_id,
  bss.is_syncing,
  bss.last_sync_at
FROM baselinker_sync_state bss
JOIN workspaces w ON w.id = bss.workspace_id
ORDER BY w.name;
```

### Ver eventos coletados:

```sql
SELECT
  w.name as workspace,
  eq.event_name,
  eq.order_id,
  eq.status,
  eq.created_at
FROM event_queue eq
JOIN workspaces w ON w.id = eq.workspace_id
ORDER BY eq.created_at DESC
LIMIT 20;
```

### Ver últimas execuções do cron:

```sql
SELECT
  jobname,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

---

## 🎉 Fluxo Completo de Uso

1. **Você (Dev)**: Executa o script SQL uma vez
2. **Sistema**: Cria estruturas para todos os workspaces
3. **Cron Job**: Começa a rodar a cada 1 minuto
4. **Cliente/Usuário**: Entra no painel e configura suas credenciais
5. **Sistema**: Automaticamente começa a processar eventos daquele workspace
6. **Mais Clientes**: Cada um configura suas próprias credenciais
7. **Sistema**: Processa todos simultaneamente, cada um isolado

---

## 🔐 Segurança Multi-Tenant

- ✅ Cada workspace tem credenciais isoladas
- ✅ RLS garante que usuários só vejam seus dados
- ✅ Edge Functions buscam apenas credenciais do workspace correto
- ✅ Eventos são processados com as credenciais do workspace dono

---

## 🆘 Troubleshooting

### "Nenhum evento está sendo coletado"

**Possível causa**: Workspace não tem credenciais configuradas

**Verificar**:
```sql
SELECT
  name,
  settings->'baselinker'->>'enabled' as ativo,
  settings->'baselinker'->>'token' as token
FROM workspaces;
```

Se `token` estiver vazio, o usuário precisa configurar no painel.

### "Erro ao processar evento"

**Ver logs**:
1. Dashboard → Functions → baselinker-event-poller → Logs
2. Procurar por erros específicos

**Comum**: Token inválido ou expirado
**Solução**: Usuário atualiza token no painel

### "Cron job não está rodando"

**Verificar**:
```sql
SELECT jobid, jobname, active FROM cron.job;
```

Se `active = f`, execute:
```sql
SELECT cron.alter_job(JOBID, enabled := true);
```

---

## 📚 Documentação da Interface Web

**Próximo passo**: Atualizar o componente de Integrações no frontend para salvar em `workspaces.settings` via API.

**Localização**: `src/pages/IntegrationsPage.tsx`

**Método**:
```typescript
await supabase
  .from('workspaces')
  .update({
    settings: {
      ...currentSettings,
      baselinker: {
        enabled: true,
        token: formData.token,
        warehouse_es: formData.warehouse_es,
        warehouse_sp: formData.warehouse_sp
      }
    }
  })
  .eq('id', currentWorkspace.id);
```

---

**Tempo total**: 5 minutos
**Última atualização**: 2025-01-08
**Versão**: 2.0 (Multi-Tenant Automático)
