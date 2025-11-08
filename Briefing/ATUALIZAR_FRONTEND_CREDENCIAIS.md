# 🔧 Atualizar Frontend para Salvar Credenciais no Banco

**Status Atual**: Frontend salva credenciais no `localStorage`
**Status Desejado**: Frontend salva credenciais em `workspaces.settings` no banco de dados

---

## 🎯 **O Problema**

Atualmente, quando o usuário configura integrações (Baselinker, Evolution, OpenAI, n8n), as credenciais são salvas no `localStorage` do navegador. Isso tem problemas:

- ❌ Credenciais ficam apenas no navegador do usuário
- ❌ Se trocar de navegador, perde as credenciais
- ❌ Edge Functions não conseguem acessar (precisam buscar do banco)
- ❌ Não funciona para múltiplos usuários do mesmo workspace

**Solução**: Salvar em `workspaces.settings` (JSONB) no banco de dados.

---

## 📝 **Arquivos que Precisam ser Atualizados**

### 1. **`src/store/baselinkerStore.ts`**

**Localização**: Linhas 68-89 e 106-114

#### Mudança na função `isConnected`:

**ANTES**:
```typescript
isConnected: () => {
  const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
  if (!currentWorkspace) return false;
  const savedConfig = localStorage.getItem(`baselinker_config_${currentWorkspace.id}`);
  return !!savedConfig && !!JSON.parse(savedConfig).apiKey;
},
```

**DEPOIS**:
```typescript
isConnected: () => {
  const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
  if (!currentWorkspace) return false;

  // Buscar do workspaces.settings
  const baselinkerSettings = currentWorkspace.settings?.baselinker;
  return !!(baselinkerSettings?.enabled && baselinkerSettings?.token);
},
```

#### Mudança na função `connect`:

**ANTES** (linhas 76-103):
```typescript
connect: async (config: BaselinkerConfig) => {
  await ErrorHandler.handleAsync(async () => {
    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
    if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

    initializeBaselinker(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );

    // ❌ ESTÁ SALVANDO NO LOCALSTORAGE
    localStorage.setItem(`baselinker_config_${currentWorkspace.id}`, JSON.stringify(config));
    set({ config });

    await supabase
      .from('baselinker_sync')
      .upsert({
        workspace_id: currentWorkspace.id,
        sync_status: 'idle',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id'
      });

    get().startSyncInterval();
    await get().syncAll(true);
  });
},
```

**DEPOIS**:
```typescript
connect: async (config: BaselinkerConfig) => {
  await ErrorHandler.handleAsync(async () => {
    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
    if (!currentWorkspace) throw new Error('Nenhum workspace selecionado');

    initializeBaselinker(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );

    // ✅ SALVAR NO BANCO (workspaces.settings)
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', currentWorkspace.id)
      .single();

    if (error) throw error;

    const updatedSettings = {
      ...(workspace.settings || {}),
      baselinker: {
        enabled: true,
        token: config.apiKey,
        warehouse_es: config.warehouse_es || 1,
        warehouse_sp: config.warehouse_sp || 2,
        sync_interval: config.syncInterval || 5,
        sync_orders: config.syncOrders !== false,
        sync_customers: config.syncCustomers !== false,
        sync_inventory: config.syncInventory !== false
      }
    };

    await supabase
      .from('workspaces')
      .update({ settings: updatedSettings })
      .eq('id', currentWorkspace.id);

    // Atualizar workspace no store também
    useWorkspaceStore.getState().updateCurrentWorkspace({
      ...currentWorkspace,
      settings: updatedSettings
    });

    set({ config });

    await supabase
      .from('baselinker_sync')
      .upsert({
        workspace_id: currentWorkspace.id,
        sync_status: 'idle',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id'
      });

    get().startSyncInterval();
    await get().syncAll(true);
  });
},
```

#### Mudança na função `disconnect`:

**ANTES** (linhas 106-114):
```typescript
disconnect: async () => {
  await ErrorHandler.handleAsync(async () => {
    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
    if (!currentWorkspace) return;

    // ❌ REMOVENDO DO LOCALSTORAGE
    localStorage.removeItem(`baselinker_config_${currentWorkspace.id}`);
    get().stopSyncInterval();
    set({ config: null });
  });
},
```

**DEPOIS**:
```typescript
disconnect: async () => {
  await ErrorHandler.handleAsync(async () => {
    const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
    if (!currentWorkspace) return;

    // ✅ REMOVER DO BANCO
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', currentWorkspace.id)
      .single();

    const updatedSettings = {
      ...(workspace?.settings || {}),
      baselinker: {
        enabled: false,
        token: '',
        warehouse_es: 1,
        warehouse_sp: 2
      }
    };

    await supabase
      .from('workspaces')
      .update({ settings: updatedSettings })
      .eq('id', currentWorkspace.id);

    // Atualizar workspace no store
    useWorkspaceStore.getState().updateCurrentWorkspace({
      ...currentWorkspace,
      settings: updatedSettings
    });

    get().stopSyncInterval();
    set({ config: null });
  });
},
```

---

### 2. **`src/store/workspaceStore.ts`**

Adicionar função helper para atualizar workspace:

```typescript
// Adicionar na interface WorkspaceState
updateCurrentWorkspace: (workspace: Workspace) => void;

// Adicionar na implementação
updateCurrentWorkspace: (workspace: Workspace) => {
  set({ currentWorkspace: workspace });
  localStorage.setItem('currentWorkspace', JSON.stringify(workspace));
},
```

---

### 3. **`src/components/integrations/BaselinkerConfigDialog.tsx`**

**Mudança na função `loadSavedConfig` (linhas 132-144)**:

**ANTES**:
```typescript
const loadSavedConfig = async () => {
  if (!currentWorkspace) return;

  try {
    const savedConfig = localStorage.getItem(`baselinker_config_${currentWorkspace.id}`);
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      setConfig(parsed);
    }
  } catch (error) {
    console.error('Error loading Baselinker config:', error);
  }
};
```

**DEPOIS**:
```typescript
const loadSavedConfig = async () => {
  if (!currentWorkspace) return;

  try {
    // Buscar do banco
    const { data: workspace, error } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', currentWorkspace.id)
      .single();

    if (error) throw error;

    const baselinkerSettings = workspace.settings?.baselinker;

    if (baselinkerSettings && baselinkerSettings.token) {
      setConfig({
        apiKey: baselinkerSettings.token,
        syncInterval: baselinkerSettings.sync_interval || 5,
        syncOrders: baselinkerSettings.sync_orders !== false,
        syncCustomers: baselinkerSettings.sync_customers !== false,
        syncInventory: baselinkerSettings.sync_inventory !== false,
        orderStatuses: ['new', 'paid', 'processing', 'ready_for_shipping', 'shipped'],
        inventoryId: baselinkerSettings.inventory_id || '',
        warehouse_es: baselinkerSettings.warehouse_es || 1,
        warehouse_sp: baselinkerSettings.warehouse_sp || 2
      });
    }
  } catch (error) {
    console.error('Error loading Baselinker config:', error);
  }
};
```

---

### 4. **Fazer o mesmo para outros stores**

- `src/store/openaiStore.ts` (se existir)
- `src/store/n8nStore.ts` (se existir)
- `src/components/integrations/OpenAIConfigDialog.tsx`
- `src/components/integrations/N8NConfigDialog.tsx`

Seguir o mesmo padrão: buscar de `workspaces.settings` em vez de `localStorage`.

---

### 5. **`src/pages/IntegrationsPage.tsx`**

**Mudança nas linhas 49, 59, 185, 193**:

**ANTES**:
```typescript
status: localStorage.getItem(`openai_config_${useWorkspaceStore.getState().currentWorkspace?.id}`) ? 'connected' : 'disconnected',
```

**DEPOIS**:
```typescript
status: useWorkspaceStore.getState().currentWorkspace?.settings?.openai?.enabled ? 'connected' : 'disconnected',
```

---

## 🧪 **Como Testar**

1. **Configurar Baselinker no painel**
2. **Verificar no banco**:
   ```sql
   SELECT
     name,
     settings->'baselinker'->>'token' as token,
     settings->'baselinker'->>'enabled' as enabled
   FROM workspaces;
   ```
3. **Fechar navegador e abrir novamente** - credenciais devem continuar
4. **Abrir em outro navegador** - credenciais devem aparecer

---

## 📊 **Estrutura Esperada em `workspaces.settings`**

```json
{
  "baselinker": {
    "enabled": true,
    "token": "TOKEN_AQUI",
    "warehouse_es": 1,
    "warehouse_sp": 2,
    "sync_interval": 5,
    "sync_orders": true,
    "sync_customers": true,
    "sync_inventory": true
  },
  "evolution": {
    "enabled": true,
    "api_url": "https://evolution.example.com",
    "api_key": "KEY_AQUI"
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
}
```

---

## ✅ **Benefícios Após a Mudança**

- ✅ Credenciais persistem entre navegadores
- ✅ Edge Functions podem buscar do banco
- ✅ Funciona para múltiplos usuários do workspace
- ✅ Não perde credenciais ao limpar cache
- ✅ Sistema multi-tenant funcional
- ✅ Backend processa todos workspaces automaticamente

---

## 🔄 **Migração de Dados Existentes**

Se já existem usuários com credenciais no localStorage, criar uma migração:

```typescript
// src/migrations/migrateLocalStorageToDatabase.ts

import { supabase } from '@/lib/supabase';

export async function migrateCredentialsToDatabase(workspaceId: string) {
  try {
    // Buscar do localStorage
    const baselinkerConfig = localStorage.getItem(`baselinker_config_${workspaceId}`);
    const openaiConfig = localStorage.getItem(`openai_config_${workspaceId}`);
    const n8nConfig = localStorage.getItem(`n8n_config_${workspaceId}`);

    if (!baselinkerConfig && !openaiConfig && !n8nConfig) {
      return; // Nada para migrar
    }

    // Buscar settings atuais
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', workspaceId)
      .single();

    const updatedSettings = { ...(workspace?.settings || {}) };

    // Migrar Baselinker
    if (baselinkerConfig) {
      const parsed = JSON.parse(baselinkerConfig);
      updatedSettings.baselinker = {
        enabled: true,
        token: parsed.apiKey,
        warehouse_es: parsed.warehouse_es || 1,
        warehouse_sp: parsed.warehouse_sp || 2,
        sync_interval: parsed.syncInterval || 5
      };
      localStorage.removeItem(`baselinker_config_${workspaceId}`);
    }

    // Migrar OpenAI
    if (openaiConfig) {
      const parsed = JSON.parse(openaiConfig);
      updatedSettings.openai = {
        enabled: true,
        api_key: parsed.apiKey,
        model: parsed.model || 'gpt-4'
      };
      localStorage.removeItem(`openai_config_${workspaceId}`);
    }

    // Migrar n8n
    if (n8nConfig) {
      const parsed = JSON.parse(n8nConfig);
      updatedSettings.n8n = {
        enabled: true,
        webhook_url: parsed.webhookUrl
      };
      localStorage.removeItem(`n8n_config_${workspaceId}`);
    }

    // Salvar no banco
    await supabase
      .from('workspaces')
      .update({ settings: updatedSettings })
      .eq('id', workspaceId);

    console.log('Credenciais migradas com sucesso do localStorage para o banco');
  } catch (error) {
    console.error('Erro ao migrar credenciais:', error);
  }
}
```

Chamar no `App.tsx` quando carregar workspace:

```typescript
useEffect(() => {
  if (currentWorkspace) {
    migrateCredentialsToDatabase(currentWorkspace.id);
  }
}, [currentWorkspace]);
```

---

## ⚠️ **IMPORTANTE**

**NÃO FAÇA ESSAS MUDANÇAS AGORA** se o sistema já está em produção com usuários usando.

**Primeiro**:
1. Teste localmente
2. Crie a migração de dados
3. Faça backup do banco
4. Deploy em staging primeiro
5. Depois deploy em produção

**POR ENQUANTO**: O sistema funciona com backend buscando do banco e frontend salvando no localStorage. Não é ideal, mas funciona.

**QUANDO ATUALIZAR**: Siga este documento passo a passo.

---

**Última atualização**: 2025-01-08
**Prioridade**: Média (funciona sem, mas recomendado fazer)
**Tempo estimado**: 2-3 horas para implementar todas as mudanças
