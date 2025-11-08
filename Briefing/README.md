# 📚 Documentação - SupleLive CRM (Event-Driven)

Índice completo da documentação do sistema de arquitetura orientada a eventos com suporte multi-tenant.

---

## 🚀 Quick Start

**Começando agora? Siga esta ordem:**

1. **[QUICK_START_MULTI_TENANT.md](./QUICK_START_MULTI_TENANT.md)** ⚡
   - Guia rápido (15-30 min)
   - Passo a passo objetivo
   - Para quem tem Supabase hospedado (cloud)
   - **Comece por aqui!**

2. **[SUPABASE_DASHBOARD_SETUP.md](./SUPABASE_DASHBOARD_SETUP.md)** 📋
   - Setup completo e detalhado
   - Instruções via interface web do Supabase
   - Não precisa de SSH ou CLI
   - Consulte quando tiver dúvidas

3. **[WORKSPACE_CREDENTIALS_CONFIG.md](./WORKSPACE_CREDENTIALS_CONFIG.md)** 🔐
   - Como configurar credenciais
   - Exemplos via SQL, Interface e API
   - Troubleshooting de credenciais
   - Leia depois de configurar

---

## 📖 Documentação Técnica

### Arquitetura

- **[EVENT_DRIVEN_ARCHITECTURE.md](./EVENT_DRIVEN_ARCHITECTURE.md)** 🏗️
  - Visão geral da arquitetura orientada a eventos
  - Como funciona o sistema de filas
  - Fluxo completo: Baselinker → Database → Edge Functions
  - Diagramas e exemplos
  - **Leia para entender o sistema**

- **[MIGRATION_PLAN.md](./MIGRATION_PLAN.md)** 📦
  - Plano de migração dos workflows n8n
  - Comparação: Antes (n8n) vs Depois (Event-Driven)
  - Cronograma de migração
  - Legado - referência histórica

### Setup e Configuração

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** ⚙️
  - Guia de setup via CLI (para quem prefere terminal)
  - Deploy local e produção
  - Alternativa ao Dashboard Setup

- **[INTEGRATION_WITH_EXISTING_CODE.md](./INTEGRATION_WITH_EXISTING_CODE.md)** 🔌
  - Como integrar com código existente
  - Adaptar Edge Functions atuais
  - Padrões de integração

### Changelog e Novidades

- **[CHANGELOG_MULTI_TENANT.md](./CHANGELOG_MULTI_TENANT.md)** 📝
  - Mudanças do sistema multi-tenant
  - Breaking changes
  - API changes detalhados
  - Migração obrigatória
  - **Leia antes de atualizar**

---

## 🗂️ Estrutura de Arquivos

```
Briefing/
├── README.md                              # Este arquivo (índice)
├── QUICK_START_MULTI_TENANT.md           # ⚡ Comece aqui!
├── SUPABASE_DASHBOARD_SETUP.md           # Setup completo via Dashboard
├── WORKSPACE_CREDENTIALS_CONFIG.md       # Configuração de credenciais
├── CHANGELOG_MULTI_TENANT.md             # Mudanças da versão 2.0
├── EVENT_DRIVEN_ARCHITECTURE.md          # Arquitetura do sistema
├── MIGRATION_PLAN.md                     # Plano de migração (legado)
├── SETUP_GUIDE.md                        # Setup via CLI (alternativo)
└── INTEGRATION_WITH_EXISTING_CODE.md     # Integração com código existente
```

---

## 🎯 Casos de Uso

### 1. "Quero instalar do zero"

➡️ Siga: [QUICK_START_MULTI_TENANT.md](./QUICK_START_MULTI_TENANT.md)

**Checklist**:
- [ ] Executar migrations SQL
- [ ] Configurar credenciais do workspace
- [ ] Deploy das Edge Functions
- [ ] Testar sistema
- [ ] Configurar cron jobs

---

### 2. "Já tenho o sistema rodando e quero atualizar"

➡️ Siga: [CHANGELOG_MULTI_TENANT.md](./CHANGELOG_MULTI_TENANT.md) + [QUICK_START_MULTI_TENANT.md](./QUICK_START_MULTI_TENANT.md)

**Checklist**:
- [ ] Ler changelog para entender mudanças
- [ ] Fazer backup do banco
- [ ] Executar migration atualizada
- [ ] Transferir credenciais para o banco
- [ ] Deploy das Edge Functions atualizadas
- [ ] Testar sistema
- [ ] Remover variáveis de ambiente antigas (opcional)

---

### 3. "Quero entender como funciona a arquitetura"

➡️ Leia: [EVENT_DRIVEN_ARCHITECTURE.md](./EVENT_DRIVEN_ARCHITECTURE.md)

**Tópicos**:
- Fluxo de eventos
- Triggers de banco
- Edge Functions
- Fila de processamento
- Mensagens agendadas

---

### 4. "Tenho erro com credenciais"

➡️ Consulte: [WORKSPACE_CREDENTIALS_CONFIG.md](./WORKSPACE_CREDENTIALS_CONFIG.md) → Seção Troubleshooting

**Erros comuns**:
- "Baselinker token not configured"
- "Evolution API not enabled"
- "No workspace_id in event data"

---

### 5. "Quero adicionar um novo workspace"

➡️ Siga: [WORKSPACE_CREDENTIALS_CONFIG.md](./WORKSPACE_CREDENTIALS_CONFIG.md) → Seção "Configurar Credenciais"

**Resumo**:
```sql
UPDATE workspaces
SET settings = '{"baselinker": {"enabled": true, "token": "..."}, ...}'::jsonb
WHERE id = 'NOVO_WORKSPACE_ID';
```

---

### 6. "Preciso configurar via interface web do Supabase"

➡️ Siga: [SUPABASE_DASHBOARD_SETUP.md](./SUPABASE_DASHBOARD_SETUP.md)

**Ideal para**:
- Quem usa Supabase hospedado
- Quem não tem acesso SSH
- Quem prefere interface gráfica

---

### 7. "Quero configurar via CLI/Terminal"

➡️ Siga: [SETUP_GUIDE.md](./SETUP_GUIDE.md)

**Ideal para**:
- Desenvolvedores com Node.js instalado
- Quem prefere linha de comando
- Deploy automatizado (CI/CD)

---

## 🔑 Conceitos-Chave

### Multi-Tenancy
Cada workspace tem suas próprias credenciais isoladas no banco de dados (`workspaces.settings`).

### Event-Driven
Eventos do Baselinker são coletados em tempo real, armazenados em fila (`event_queue`) e processados automaticamente.

### Edge Functions
Funções serverless no Supabase que processam eventos, enviam mensagens e atualizam estoque.

### Workspace Settings
Coluna JSONB na tabela `workspaces` que armazena credenciais de integrações (Baselinker, Evolution, OpenAI).

---

## 🛠️ Ferramentas e Integrações

### Baselinker
E-commerce platform integration. Token configurado em `workspaces.settings.baselinker.token`.

### Evolution API (WhatsApp)
WhatsApp integration. Credenciais em `workspaces.settings.evolution`.

### OpenAI (Opcional)
AI-powered features. Credenciais em `workspaces.settings.openai`.

### n8n (Opcional/Legado)
Workflow automation. Sendo migrado para event-driven.

---

## 📊 Fluxo de Dados

```
┌─────────────┐
│  Baselinker │ (Pedido criado)
└──────┬──────┘
       │
       ▼
┌──────────────────────┐
│ baselinker-event-    │ (Cron: a cada 1 min)
│ poller               │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ event_queue          │ (Status: pending)
│ (workspace_id)       │
└──────┬───────────────┘
       │
       ▼ (Database Trigger)
┌──────────────────────┐
│ process-event        │ (Roteador)
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ process-order-       │ (Processa pedido)
│ created              │
└──────┬───────────────┘
       │
       ├─► Cria cliente
       ├─► Cria pedido
       ├─► Envia mensagem de boas-vindas (Evolution API)
       ├─► Envia mensagem de upsell
       └─► Agenda mensagens de recompra (scheduled_messages)
```

---

## ⚙️ Edge Functions Disponíveis

| Função | Descrição | Trigger |
|--------|-----------|---------|
| `baselinker-event-poller` | Coleta eventos do Baselinker | Cron (1 min) |
| `process-event` | Roteador de eventos | Database Trigger |
| `process-order-created` | Processa pedidos novos | Via `process-event` |
| `send-scheduled-messages` | Envia mensagens agendadas | Cron (diário) |
| `update-baselinker-stock` | Atualiza estoque no Baselinker | API Call |

---

## 🧪 Testes e Validação

### Testar Event Poller

```sql
SELECT net.http_post(
  url := 'https://SEU_PROJECT.supabase.co/functions/v1/baselinker-event-poller',
  headers := '{"Authorization": "Bearer SUA_SERVICE_KEY"}'::jsonb,
  body := '{}'::jsonb
);
```

### Ver Eventos Coletados

```sql
SELECT event_name, order_id, status, created_at
FROM event_queue
ORDER BY created_at DESC
LIMIT 10;
```

### Ver Mensagens Agendadas

```sql
SELECT message_type, scheduled_for, status
FROM scheduled_messages
WHERE status = 'pending'
ORDER BY scheduled_for ASC;
```

---

## 🆘 Troubleshooting

### Passo 1: Verificar Logs das Edge Functions

1. Dashboard → **Edge Functions**
2. Clique na função
3. Veja os **Logs**

### Passo 2: Verificar Credenciais

```sql
SELECT
  name,
  settings->'baselinker'->>'token' as token_ok,
  settings->'evolution'->>'api_key' as evolution_ok
FROM workspaces;
```

### Passo 3: Verificar Cron Jobs

```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 5;
```

### Passo 4: Verificar Event Queue

```sql
SELECT status, COUNT(*)
FROM event_queue
GROUP BY status;
```

---

## 📞 Suporte e Contato

**Documentação Oficial**:
- Baselinker API: https://api.baselinker.com/
- Supabase Docs: https://supabase.com/docs
- Evolution API: https://doc.evolution-api.com/

**Issues e Bugs**:
- GitHub: [seu-repo/issues](https://github.com/seu-repo/issues)

**Dúvidas Frequentes**:
- Consulte a seção Troubleshooting em cada documento

---

## 🎓 Glossário

**Workspace**: Espaço isolado multi-tenant. Cada cliente/empresa tem um workspace.

**Event Queue**: Fila de eventos do Baselinker aguardando processamento.

**Edge Function**: Função serverless no Supabase (similar a AWS Lambda).

**RLS (Row Level Security)**: Política de segurança que restringe acesso a linhas do banco.

**Service Role Key**: Chave de administrador do Supabase (usado pelas Edge Functions).

**Cron Job**: Tarefa agendada que roda automaticamente (ex: a cada 1 minuto).

**pg_cron**: Extensão do PostgreSQL para agendar tarefas no banco.

---

## 📅 Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| **2.0.0** | 2025-01-08 | Sistema multi-tenant de credenciais |
| 1.0.0 | 2025-01-07 | Event-driven architecture inicial |

---

## 🎯 Roadmap Futuro

- [ ] Interface web para configuração de credenciais
- [ ] Dashboard de monitoramento de eventos
- [ ] Alertas automáticos via email/WhatsApp
- [ ] Suporte a mais integrações (Mercado Livre, etc)
- [ ] API REST para gerenciar workspaces
- [ ] Testes automatizados E2E

---

**Última atualização**: 2025-01-08
**Versão da documentação**: 2.0.0
**Autor**: Claude Code

**Pronto para começar?** 🚀 Vá para [QUICK_START_MULTI_TENANT.md](./QUICK_START_MULTI_TENANT.md)
