# 🚀 COMECE AQUI - Setup Rápido do Sistema

**Status Atual**: ✅ Edge Functions deployadas | ⚠️ Banco precisa configuração

---

## 📍 Você Está em 3 Passos de Ter o Sistema Funcionando!

```
Passo 1: Configurar Banco (5 min) → Você está aqui
Passo 2: Configurar Credenciais (3 min)
Passo 3: Testar Sistema (2 min)
```

---

## 🎯 PASSO 1: Configurar Banco (5 minutos)

### Opção A: Guia Passo a Passo Detalhado (RECOMENDADO)

📖 **Abra**: [SETUP_BANCO_PASSO_A_PASSO.md](Briefing/SETUP_BANCO_PASSO_A_PASSO.md)

- ✅ Instruções visuais
- ✅ Cada query explicada
- ✅ Verificações após cada passo
- ✅ Troubleshooting incluído

### Opção B: Arquivo SQL Completo (Rápido)

1. **Acesse**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql
2. **Abra**: `supabase/migrations/00_SETUP_COMPLETO_DATABASE.sql`
3. **Copie tudo** e cole no SQL Editor
4. **Execute**
5. **Leia o output** - mostra o que foi criado

### Opção C: Queries Individuais

📄 **Abra**: [QUERIES_SETUP_RAPIDO.sql](Briefing/QUERIES_SETUP_RAPIDO.sql)

- 17 queries numeradas
- Execute uma por vez
- Com comentários explicativos

---

## 🎯 PASSO 2: Configurar Credenciais (3 minutos)

Você precisa de:

- **Token do Baselinker**: https://panel.baselinker.com/ → Settings → API
- **Evolution API URL e Key**: Da sua instância Evolution

Execute no SQL Editor:

```sql
-- 1. Pegar workspace ID
SELECT id, name FROM workspaces;

-- 2. Configurar credenciais (SUBSTITUA os valores!)
UPDATE workspaces
SET settings = '{
  "baselinker": {
    "enabled": true,
    "token": "SEU_TOKEN_BASELINKER",
    "warehouse_es": 1,
    "warehouse_sp": 2
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://sua-evolution-api.com",
    "api_key": "SUA_KEY_EVOLUTION"
  }
}'::jsonb
WHERE id = 'SEU_WORKSPACE_ID';

-- 3. Verificar
SELECT
  name,
  settings->'baselinker'->>'token' as baselinker,
  settings->'evolution'->>'api_key' as evolution
FROM workspaces;
```

---

## 🎯 PASSO 3: Testar Sistema (2 minutos)

Execute no SQL Editor:

```sql
-- Chamar o poller manualmente
SELECT net.http_post(
  url := current_setting('app.supabase_url') || '/functions/v1/baselinker-event-poller',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.service_role_key')
  ),
  body := '{}'::jsonb
);

-- Aguarde 5 segundos, depois:

-- Ver se coletou eventos
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

## 📚 Documentação Completa

| Arquivo | Quando Usar |
|---------|-------------|
| **[SETUP_BANCO_PASSO_A_PASSO.md](Briefing/SETUP_BANCO_PASSO_A_PASSO.md)** | ⭐ Configurar banco agora |
| [EXECUTE_AGORA.md](Briefing/EXECUTE_AGORA.md) | Checklist rápido |
| [STATUS_DO_PROJETO.md](STATUS_DO_PROJETO.md) | Ver o que falta fazer |
| [QUERIES_SETUP_RAPIDO.sql](Briefing/QUERIES_SETUP_RAPIDO.sql) | Queries individuais |
| [VERIFICACAO_COMPLETA_SISTEMA.md](Briefing/VERIFICACAO_COMPLETA_SISTEMA.md) | Guia completo |
| [GUIA_COMPLETO_SUPABASE.md](Briefing/GUIA_COMPLETO_SUPABASE.md) | Para iniciantes |

---

## 🔗 Links Diretos

- **SQL Editor**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql
- **Edge Functions**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
- **Project Settings**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/settings/api

---

## ⚡ Início Mais Rápido Possível

Se você quer começar AGORA mesmo:

1. **Abra**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/sql
2. **Clique**: "New query"
3. **Copie e cole** o conteúdo de: `supabase/migrations/00_SETUP_COMPLETO_DATABASE.sql`
4. **Execute** (botão verde)
5. **Depois siga**: [SETUP_BANCO_PASSO_A_PASSO.md](Briefing/SETUP_BANCO_PASSO_A_PASSO.md) - a partir do Passo 4

---

## 📊 Progresso

```
✅ Edge Functions deployadas (5/5)
⚠️ Banco configurado           (0/8 passos)
⚠️ Credenciais configuradas    (pendente)
⚠️ Sistema testado             (pendente)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 20% completo
```

---

## 🎯 Próxima Ação

**➡️ Abra AGORA**: [SETUP_BANCO_PASSO_A_PASSO.md](Briefing/SETUP_BANCO_PASSO_A_PASSO.md)

**Tempo estimado**: 10 minutos para concluir tudo

---

**Última atualização**: 2025-01-08
