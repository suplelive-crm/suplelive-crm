# Configuração de Credenciais por Workspace

Este documento explica como configurar as credenciais de integração (Baselinker, Evolution API, OpenAI, n8n) para cada workspace no banco de dados.

## Visão Geral

**IMPORTANTE**: As Edge Functions agora buscam automaticamente as credenciais da coluna `settings` (JSONB) na tabela `workspaces`. Você **NÃO precisa mais** configurar variáveis de ambiente individuais para cada integração.

### Benefícios da Abordagem Multi-Tenant

✅ **Múltiplos workspaces**: Cada workspace pode ter suas próprias credenciais
✅ **Segurança**: Credenciais ficam isoladas por workspace
✅ **Flexibilidade**: Ative/desative integrações por workspace
✅ **Escalabilidade**: Adicione novos workspaces sem reconfigurar servidor

---

## Estrutura da Coluna `settings`

A coluna `workspaces.settings` é do tipo JSONB e segue esta estrutura:

```json
{
  "baselinker": {
    "enabled": true,
    "token": "SEU_TOKEN_BASELINKER_AQUI",
    "warehouse_es": 1,
    "warehouse_sp": 2
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://api.evolution.com",
    "api_key": "SUA_CHAVE_EVOLUTION_AQUI"
  },
  "openai": {
    "enabled": true,
    "api_key": "sk-...",
    "model": "gpt-4"
  },
  "n8n": {
    "enabled": false,
    "webhook_url": "https://n8n.exemplo.com/webhook/..."
  }
}
```

---

## Como Configurar as Credenciais

### Opção 1: Via SQL (Supabase Dashboard)

Acesse o SQL Editor no Supabase Dashboard e execute:

```sql
-- Atualizar configurações do workspace
UPDATE workspaces
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{baselinker}',
  '{"enabled": true, "token": "SEU_TOKEN_AQUI", "warehouse_es": 1, "warehouse_sp": 2}'::jsonb
)
WHERE id = 'SEU_WORKSPACE_ID';

-- Configurar Evolution API
UPDATE workspaces
SET settings = jsonb_set(
  settings,
  '{evolution}',
  '{"enabled": true, "api_url": "https://api.evolution.com", "api_key": "SUA_CHAVE_AQUI"}'::jsonb
)
WHERE id = 'SEU_WORKSPACE_ID';

-- Configurar OpenAI
UPDATE workspaces
SET settings = jsonb_set(
  settings,
  '{openai}',
  '{"enabled": true, "api_key": "sk-...", "model": "gpt-4"}'::jsonb
)
WHERE id = 'SEU_WORKSPACE_ID';
```

### Opção 2: Via Interface (Página de Integrações)

A aplicação possui uma interface de configuração em `/integrations`:

1. Acesse a página de Integrações
2. Clique em "Configurar" na integração desejada
3. Preencha os campos:
   - **Baselinker**: Token, Warehouse ES, Warehouse SP
   - **Evolution API**: URL da API, API Key
   - **OpenAI**: API Key, Modelo
4. Marque "Ativar integração"
5. Clique em "Salvar"

As configurações são salvas automaticamente na coluna `settings` do workspace atual.

### Opção 3: Via API (Para scripts/automações)

```typescript
import { supabase } from '@/lib/supabase';

async function updateWorkspaceSettings(workspaceId: string) {
  const { error } = await supabase
    .from('workspaces')
    .update({
      settings: {
        baselinker: {
          enabled: true,
          token: 'SEU_TOKEN',
          warehouse_es: 1,
          warehouse_sp: 2,
        },
        evolution: {
          enabled: true,
          api_url: 'https://api.evolution.com',
          api_key: 'SUA_CHAVE',
        },
      },
    })
    .eq('id', workspaceId);

  if (error) {
    console.error('Erro ao atualizar:', error);
  }
}
```

---

## Configurações por Integração

### 1. Baselinker

```json
{
  "baselinker": {
    "enabled": true,
    "token": "SEU_TOKEN_BASELINKER",
    "warehouse_es": 1,
    "warehouse_sp": 2
  }
}
```

**Campos**:
- `enabled` (boolean): Ativa/desativa a integração
- `token` (string): Token de API do Baselinker
- `warehouse_es` (number, opcional): ID do armazém de Espírito Santo
- `warehouse_sp` (number, opcional): ID do armazém de São Paulo

**Como obter o token**:
1. Acesse o painel do Baselinker
2. Vá em Configurações → API
3. Gere um novo token
4. Copie e cole no campo `token`

**Funções que usam**:
- `baselinker-event-poller` - Busca eventos
- `process-order-created` - Processa pedidos
- `update-baselinker-stock` - Atualiza estoque

---

### 2. Evolution API (WhatsApp)

```json
{
  "evolution": {
    "enabled": true,
    "api_url": "https://api.evolution.com",
    "api_key": "SUA_CHAVE_API"
  }
}
```

**Campos**:
- `enabled` (boolean): Ativa/desativa a integração
- `api_url` (string): URL base da Evolution API
- `api_key` (string): Chave de autenticação

**Como obter as credenciais**:
1. Instale a Evolution API (self-hosted ou use serviço)
2. Configure uma instância do WhatsApp
3. Gere uma API Key nas configurações
4. Use a URL base da API (ex: `https://evolution.seuservidor.com`)

**Funções que usam**:
- `process-order-created` - Envia mensagens de boas-vindas/upsell
- `send-scheduled-messages` - Envia mensagens agendadas

---

### 3. OpenAI

```json
{
  "openai": {
    "enabled": true,
    "api_key": "sk-proj-...",
    "model": "gpt-4"
  }
}
```

**Campos**:
- `enabled` (boolean): Ativa/desativa a integração
- `api_key` (string): Chave de API da OpenAI
- `model` (string, opcional): Modelo a usar (padrão: `gpt-4`)

**Como obter a API Key**:
1. Acesse [platform.openai.com](https://platform.openai.com)
2. Vá em API Keys
3. Crie uma nova chave
4. Copie e cole no campo `api_key`

**Funções que usam**:
- Nós de chatbot nas automações
- Classificadores de intenção
- Agentes conversacionais

---

### 4. n8n (Opcional)

```json
{
  "n8n": {
    "enabled": false,
    "webhook_url": "https://n8n.exemplo.com/webhook/uuid"
  }
}
```

**Campos**:
- `enabled` (boolean): Ativa/desativa a integração
- `webhook_url` (string): URL do webhook do n8n

**Nota**: A migração para event-driven reduz a necessidade de n8n, mas você ainda pode usá-lo para workflows complexos.

---

## Verificar Configuração

### Via SQL

```sql
-- Ver configurações de todos os workspaces
SELECT
  id,
  name,
  settings->'baselinker'->>'enabled' as baselinker_enabled,
  settings->'evolution'->>'enabled' as evolution_enabled,
  settings->'openai'->>'enabled' as openai_enabled
FROM workspaces;

-- Ver configuração completa de um workspace específico
SELECT settings
FROM workspaces
WHERE id = 'SEU_WORKSPACE_ID';
```

### Via Frontend

1. Acesse `/integrations`
2. Veja o status de cada integração (ícone verde = ativo)
3. Clique em "Configurar" para ver os detalhes

---

## Segurança das Credenciais

### ✅ Boas Práticas

1. **Row Level Security (RLS)**: Garanta que as políticas RLS estejam ativas na tabela `workspaces`
2. **Acesso Limitado**: Apenas Service Role Key pode acessar credenciais nas Edge Functions
3. **Não expor no Frontend**: Nunca envie credenciais completas para o cliente
4. **Rotação de Chaves**: Atualize tokens periodicamente
5. **Backup Seguro**: Faça backup criptografado das configurações

### 🔒 Políticas RLS Recomendadas

```sql
-- Permitir que usuários vejam apenas workspaces aos quais pertencem
CREATE POLICY "Users can view their workspaces"
ON workspaces FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM workspace_users
    WHERE workspace_id = workspaces.id
  )
);

-- Apenas owners podem atualizar settings
CREATE POLICY "Only owners can update workspace settings"
ON workspaces FOR UPDATE
USING (owner_id = auth.uid());
```

---

## Troubleshooting

### Erro: "Baselinker token not configured"

**Causa**: O workspace não tem `baselinker.token` configurado ou `enabled: false`

**Solução**:
```sql
UPDATE workspaces
SET settings = jsonb_set(
  settings,
  '{baselinker,enabled}',
  'true'::jsonb
)
WHERE id = 'SEU_WORKSPACE_ID';
```

### Erro: "Evolution API not enabled"

**Causa**: A integração Evolution não está habilitada

**Solução**:
```sql
UPDATE workspaces
SET settings = jsonb_set(
  settings,
  '{evolution,enabled}',
  'true'::jsonb
)
WHERE id = 'SEU_WORKSPACE_ID';
```

### Erro: "No workspaces with Baselinker enabled"

**Causa**: Nenhum workspace tem a integração Baselinker ativa

**Solução**: Configure ao menos um workspace com Baselinker ativo (veja instruções acima)

---

## Migração de Variáveis de Ambiente

Se você estava usando variáveis de ambiente antes, siga este roteiro:

### Antes (variáveis de ambiente)
```bash
BASELINKER_TOKEN=seu_token
EVOLUTION_API_URL=https://api.evolution.com
EVOLUTION_API_KEY=sua_chave
```

### Depois (banco de dados)
```sql
UPDATE workspaces
SET settings = '{
  "baselinker": {
    "enabled": true,
    "token": "seu_token"
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://api.evolution.com",
    "api_key": "sua_chave"
  }
}'::jsonb
WHERE id = 'SEU_WORKSPACE_ID';
```

**Vantagem**: Agora você pode ter múltiplos workspaces com credenciais diferentes!

---

## Exemplos de Uso nas Edge Functions

As Edge Functions agora usam os helpers em `_shared/workspace-config.ts`:

```typescript
import { getBaselinkerToken, getEvolutionConfig } from '../_shared/workspace-config.ts';

// Buscar token do Baselinker
const token = await getBaselinkerToken(supabase, workspaceId);

// Buscar config completa da Evolution
const evolutionConfig = await getEvolutionConfig(supabase, workspaceId);
console.log(evolutionConfig.api_url); // https://api.evolution.com
console.log(evolutionConfig.api_key); // sua_chave
```

---

## Próximos Passos

1. Configure as credenciais do seu primeiro workspace
2. Teste as integrações na página `/integrations`
3. Monitore os logs nas Edge Functions para verificar se está funcionando
4. Adicione novos workspaces conforme necessário

**Dúvidas?** Consulte os logs das Edge Functions ou o código em `supabase/functions/_shared/workspace-config.ts`
