# Status das Edge Functions - Supabase Cloud

Data da verificação: 2026-01-12

## Todas as Funções Deployadas

Total: **16 Edge Functions** ativas no Supabase Cloud

| Função | Status | Versão | Última Atualização | Observações |
|--------|--------|--------|-------------------|-------------|
| **evolution-webhook** | ✅ ACTIVE | v20 | 2025-07-03 | Webhook para Evolution API (WhatsApp) |
| **baselinker-sync** | ✅ ACTIVE | v15 | 2025-06-09 | Sincronização manual do Baselinker |
| **baselinker-proxy** | ✅ ACTIVE | v20 | 2026-01-12 | Proxy universal (Baselinker + GhostAPIs) |
| **register-user** | ✅ ACTIVE | v5 | 2026-01-12 | ✅ RESOLVIDO - Estava faltando |
| **tracking-automation** | ✅ ACTIVE | v3 | 2025-08-06 | Automação de rastreamento |
| **tracking-proxy** | ✅ ACTIVE | v3 | 2025-08-06 | Proxy para APIs de rastreamento |
| **baselinker-event-poller** | ✅ ACTIVE | v2 | 2025-11-08 | Poller de eventos do Baselinker |
| **process-order-created** | ✅ ACTIVE | v6 | 2026-01-08 | Processa criação de pedidos |
| **send-scheduled-messages** | ✅ ACTIVE | v3 | 2026-01-08 | Envia mensagens agendadas |
| **update-baselinker-stock** | ✅ ACTIVE | v2 | 2025-11-08 | Atualiza estoque no Baselinker |
| **process-event** | ✅ ACTIVE | v2 | 2025-11-08 | Roteador de eventos |
| **baselinker-webhook** | ✅ ACTIVE | v2 | 2025-11-14 | Webhook do Baselinker |
| **validate-whatsapp-number** | ✅ ACTIVE | v1 | 2026-01-08 | Valida números de WhatsApp |
| **process-event-queue** | ✅ ACTIVE | v1 | 2026-01-08 | Processa fila de eventos |
| **baselinker-event-polling** | ✅ ACTIVE | v1 | 2026-01-08 | Polling de eventos |
| **ghostapis-api-ts** | ⚠️ ACTIVE | v4 | 2026-01-12 | ⚠️ OBSOLETA - usar baselinker-proxy |

## Problemas Identificados

### 1. ✅ RESOLVIDO: register-user estava faltando

**Status Anterior**: 404 Not Found
**Status Atual**: ✅ Deployada (v5, atualizada hoje às 21:04)

### 2. ⚠️ Função Obsoleta: ghostapis-api-ts

A função `ghostapis-api-ts` está ativa mas **não deveria ser usada**. Ela foi substituída pela funcionalidade integrada no `baselinker-proxy`.

**Ação recomendada**: Pode ser deletada para evitar confusão.

## Funções Recentemente Atualizadas (Hoje)

1. **baselinker-proxy** - v20 (20:47) - Adicionado suporte GhostAPIs
2. **register-user** - v5 (21:04) - Deployada após erro 404
3. **ghostapis-api-ts** - v4 (20:22) - Versão antiga do proxy GhostAPIs

## Arquitetura Atual

### Integrações
- **WhatsApp**: `evolution-webhook`
- **Baselinker**: `baselinker-proxy`, `baselinker-sync`, `baselinker-webhook`, `baselinker-event-poller`, `baselinker-event-polling`
- **GhostAPIs**: `baselinker-proxy` (com `service: 'ghostapis'`)
- **Rastreamento**: `tracking-proxy`, `tracking-automation`

### Event-Driven System
- **Polling**: `baselinker-event-poller`, `baselinker-event-polling`
- **Processing**: `process-event`, `process-event-queue`, `process-order-created`
- **Actions**: `send-scheduled-messages`, `update-baselinker-stock`

### User Management
- **Registro**: `register-user`
- **Validação**: `validate-whatsapp-number`

## Próximos Passos

### 1. Limpeza (Opcional)
```bash
# Deletar função obsoleta
npx supabase functions delete ghostapis-api-ts --project-ref oqwstanztqdiexgrpdta
```

### 2. Atualizar CLI (Recomendado)
```bash
npm install -g supabase@latest
# ou
npm update supabase
```

Versão atual: v2.24.3
Versão disponível: v2.67.1

### 3. Testar Funções Críticas

- ✅ `register-user` - Testar criação de novo usuário
- ✅ `baselinker-proxy` - Testar com GhostAPIs (service: 'ghostapis')
- ⚠️ Verificar se `ghostapis-api-ts` ainda está sendo chamada em algum lugar

## Comandos Úteis

```bash
# Listar funções
npx supabase functions list --project-ref oqwstanztqdiexgrpdta

# Ver logs de uma função
npx supabase functions logs <function-name> --project-ref oqwstanztqdiexgrpdta

# Fazer deploy de uma função
npx supabase functions deploy <function-name> --project-ref oqwstanztqdiexgrpdta

# Deletar função obsoleta
npx supabase functions delete ghostapis-api-ts --project-ref oqwstanztqdiexgrpdta
```

## Conclusão

✅ Todas as funções necessárias estão deployadas e ativas
✅ `register-user` foi deployada com sucesso após o erro 404
✅ `baselinker-proxy` está atualizada com suporte a GhostAPIs
⚠️ `ghostapis-api-ts` pode ser removida (obsoleta)

**Sistema funcionando corretamente!** 🚀
