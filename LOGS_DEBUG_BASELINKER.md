# Logs de Debug: Baselinker Sync "Configuração incompleta"

## 🔍 Melhorias Implementadas

Adicionei logs detalhados para identificar exatamente qual configuração está faltando quando o erro "Configuração incompleta" ocorre.

---

## 📝 Logs Adicionados

### 1. **BaselinkerAutoSync.tsx** - Status da Conexão

Agora, antes de cada tentativa de sincronização, o sistema mostra:

```typescript
[BASELINKER AUTO-SYNC] Status: {
  isConnected: '✅ Sim' | '❌ Não',
  hasConfig: '✅ Sim' | '❌ Não',
  configDetails: {
    apiKey: '***1234',
    syncOrders: true,
    syncCustomers: true,
    syncInventory: true
  } | 'Config is null'
}
```

**O que cada campo significa:**
- `isConnected`: Verifica se `workspace.settings.baselinker.enabled` e `token` existem
- `hasConfig`: Verifica se o Zustand store tem o objeto `config` (que é setado no `connect()`)
- `configDetails`: Mostra as configurações de sincronização

### 2. **baselinkerStore.ts** - Verificação Detalhada

Quando `syncAll()` é chamado, agora mostra:

```typescript
[BASELINKER SYNC] Verificando configuração: {
  hasConfig: true | false,
  hasWorkspace: true | false,
  config: {
    apiKey: '***1234',
    syncOrders: true,
    syncCustomers: true,
    syncInventory: true,
    inventoryId: '12345'
  } | null,
  workspaceId: 'uuid-do-workspace'
}
```

**Mensagens de erro específicas:**
- `"Configuração incompleta: config is null. O Baselinker pode não estar conectado ou a conexão ainda está inicializando."`
- `"Configuração incompleta: currentWorkspace is null. Nenhum workspace selecionado."`

---

## 🔎 Como Usar os Logs para Debug

### Cenário 1: Config é null, mas isConnected é true

```
[BASELINKER AUTO-SYNC] Status: {
  isConnected: '✅ Sim',
  hasConfig: '❌ Não',
  configDetails: 'Config is null'
}

[BASELINKER AUTO-SYNC] ⚠️ Config do Zustand store é null. A conexão pode estar inicializando...
```

**Diagnóstico**: O workspace tem as configurações salvas (`settings.baselinker`), mas o Zustand store ainda não foi inicializado.

**Causa Provável**:
- A função `connect()` ainda está executando
- A função `connect()` foi executada mas falhou antes de fazer `set({ config })`
- O componente montou antes do `connect()` terminar

**Solução**: O sistema agora pula a sincronização e tenta novamente no próximo intervalo.

---

### Cenário 2: Workspace é null

```
[BASELINKER SYNC] Verificando configuração: {
  hasConfig: true,
  hasWorkspace: false,
  workspaceId: undefined
}

Error: Configuração incompleta: currentWorkspace is null. Nenhum workspace selecionado.
```

**Diagnóstico**: O Baselinker está configurado, mas não há workspace selecionado.

**Causa Provável**:
- O usuário não selecionou um workspace
- O workspace foi desconectado
- Problema de sincronização do `workspaceStore`

**Solução**: Verificar se o usuário está logado e tem um workspace selecionado.

---

### Cenário 3: Ambos são null

```
[BASELINKER AUTO-SYNC] Status: {
  isConnected: '❌ Não',
  hasConfig: '❌ Não',
  configDetails: 'Config is null'
}

[BASELINKER AUTO-SYNC] ⚠️ Baselinker não está conectado (settings). Aguardando conexão...
```

**Diagnóstico**: Baselinker não está configurado.

**Causa Provável**:
- O usuário nunca conectou o Baselinker
- A configuração foi removida
- Problema ao salvar as configurações no workspace

**Solução**: Ir para página de Integrações e conectar o Baselinker novamente.

---

### Cenário 4: Tudo OK, mas ainda dá erro

```
[BASELINKER AUTO-SYNC] Status: {
  isConnected: '✅ Sim',
  hasConfig: '✅ Sim',
  configDetails: {
    apiKey: '***1234',
    syncOrders: true,
    syncCustomers: true,
    syncInventory: true
  }
}

[BASELINKER SYNC] Verificando configuração: {
  hasConfig: true,
  hasWorkspace: true,
  config: { ... },
  workspaceId: 'uuid-123'
}

Error: Configuração incompleta: ...
```

**Diagnóstico**: Bug no código - a lógica de verificação está errada.

**Causa Provável**:
- Alguma outra parte do código está verificando uma propriedade que não existe
- Race condition entre múltiplas chamadas de `syncAll()`

**Solução**: Investigar o stack trace completo do erro.

---

## 🧪 Como Testar os Novos Logs

1. **Recarregue a aplicação** (Ctrl+R)
2. **Abra o console do navegador** (F12)
3. **Aguarde 10 segundos** (tempo da primeira sincronização)
4. **Observe os logs**

### Logs Esperados (Cenário Normal):

```
[BASELINKER AUTO-SYNC] ✅ Baselinker configurado! Iniciando sincronização automática a cada 3 minutos
[BASELINKER AUTO-SYNC] Inicializando conexão com Baselinker...
[BASELINKER AUTO-SYNC] ✅ Conexão inicializada com sucesso!
[BASELINKER AUTO-SYNC] ⏰ Primeira sincronização em 10 segundos...
[BASELINKER AUTO-SYNC] ⏰ Sincronizações automáticas configuradas (intervalo: 3 min)

... (10 segundos depois) ...

[BASELINKER AUTO-SYNC] 🚀 Executando sincronização inicial...
[BASELINKER AUTO-SYNC] Status: {
  isConnected: '✅ Sim',
  hasConfig: '✅ Sim',
  configDetails: {
    apiKey: '***1234',
    syncOrders: true,
    syncCustomers: true,
    syncInventory: true
  }
}
[BASELINKER AUTO-SYNC] 🔄 Executando sincronização automática às 14:26:00
[BASELINKER SYNC] Verificando configuração: {
  hasConfig: true,
  hasWorkspace: true,
  config: { ... },
  workspaceId: 'uuid-123'
}
[BASELINKER AUTO-SYNC] ✅ Sincronização concluída com sucesso às 14:26:03
```

### Logs em Caso de Problema (Cenário de Debug):

```
[BASELINKER AUTO-SYNC] 🚀 Executando sincronização inicial...
[BASELINKER AUTO-SYNC] Status: {
  isConnected: '✅ Sim',
  hasConfig: '❌ Não',
  configDetails: 'Config is null'
}
[BASELINKER AUTO-SYNC] ⚠️ Config do Zustand store é null. A conexão pode estar inicializando...
```

Neste caso, o sistema **não tenta sincronizar** e espera o próximo intervalo.

---

## 🎯 Arquivos Alterados

- ✏️ [src/store/baselinkerStore.ts](src/store/baselinkerStore.ts) - Logs detalhados no `syncAll()`
- ✏️ [src/components/integrations/BaselinkerAutoSync.tsx](src/components/integrations/BaselinkerAutoSync.tsx) - Verificação e logs no `runSync()`

---

## 🔄 Próximos Passos

Agora, quando o erro ocorrer novamente, você poderá ver **exatamente** qual parte da configuração está faltando:

1. Se `isConnected = ❌`: O workspace não tem configuração do Baselinker salva
2. Se `hasConfig = ❌`: O Zustand store não foi inicializado (problema de timing)
3. Se `hasWorkspace = false`: Nenhum workspace selecionado

Com esses logs, conseguiremos identificar se o problema é:
- ⏱️ **Timing**: A sincronização está executando antes da inicialização terminar
- 💾 **Persistência**: As configurações não estão sendo salvas corretamente
- 🔄 **State**: O Zustand store não está sincronizado com o workspace

---

## 📊 Análise do Erro Anterior

Baseado no log que você mostrou:

```
Error: Configuração incompleta
    at baselinkerStore.ts:1114:17
    at runSync (BaselinkerAutoSync.tsx:76:15)
```

Agora os logs vão mostrar:
- Qual configuração está faltando (`config` ou `workspace`)
- Se `isConnected()` retorna true mas `config` é null
- O conteúdo real da config quando ela existe

Isso nos permitirá ver se é um problema de **timing** (connect ainda não terminou) ou um problema de **lógica** (isConnected retorna true incorretamente).

---

## ✅ Status

- ✅ Logs detalhados implementados
- ✅ Verificações duplas (settings + config)
- ✅ Mensagens de erro específicas
- ⏳ **Aguardando novo teste para ver os logs**
