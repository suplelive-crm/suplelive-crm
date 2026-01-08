# 🚀 Deploy das Edge Functions (Manual)

**Data**: 08/01/2026
**Status**: ⚠️ Executar Manualmente no Dashboard

---

## ⚠️ Problema

O deploy via CLI requer Docker Desktop rodando. Como alternativa, vamos fazer deploy manual pelo Dashboard do Supabase.

---

## 📋 Edge Functions para Deploy

### 1. **validate-whatsapp-number**
### 2. **process-order-created** (atualizada)

---

## 🎯 Como Fazer Deploy Manual

### **Opção A: Via Dashboard do Supabase** (RECOMENDADO)

#### **Passo 1: Acessar Edge Functions**

1. Acesse: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta
2. No menu lateral, clique em **"Edge Functions"**
3. Clique em **"Create a new function"** (ou editar se já existir)

#### **Passo 2: Deploy `validate-whatsapp-number`**

1. Nome da função: `validate-whatsapp-number`
2. Cole o código de:
   ```
   supabase/functions/validate-whatsapp-number/index.ts
   ```
3. Clique em **"Deploy function"**
4. Aguarde confirmação de sucesso

#### **Passo 3: Deploy `process-order-created`**

1. Se já existir, clique em **"Edit"**
2. Se não existir, crie nova função: `process-order-created`
3. Cole o código de:
   ```
   supabase/functions/process-order-created/index.ts
   ```
4. **IMPORTANTE**: Também precisa dos arquivos auxiliares:
   - `validate-client-data.ts` (mesmo diretório)
   - `../shared/baselinker.ts`
   - `../shared/workspace-config.ts`
   - `../shared/message-templates.ts`

5. Clique em **"Deploy function"**

---

### **Opção B: Via Supabase CLI** (Requer Docker)

Se você tiver Docker Desktop instalado e rodando:

```bash
# 1. Login no Supabase (uma vez)
npx supabase login

# 2. Link ao projeto
npx supabase link --project-ref oqwstanztqdiexgrpdta

# 3. Deploy validate-whatsapp-number
npx supabase functions deploy validate-whatsapp-number

# 4. Deploy process-order-created
npx supabase functions deploy process-order-created
```

---

## 📂 Estrutura de Arquivos para Deploy

### **validate-whatsapp-number/**
```
supabase/functions/validate-whatsapp-number/
└── index.ts (arquivo principal)
```

**Conteúdo**: [supabase/functions/validate-whatsapp-number/index.ts](supabase/functions/validate-whatsapp-number/index.ts)

---

### **process-order-created/**
```
supabase/functions/process-order-created/
├── index.ts (arquivo principal)
└── validate-client-data.ts (módulo de validação)
```

**Arquivos necessários**:
1. [supabase/functions/process-order-created/index.ts](supabase/functions/process-order-created/index.ts)
2. [supabase/functions/process-order-created/validate-client-data.ts](supabase/functions/process-order-created/validate-client-data.ts)

**Dependências compartilhadas** (devem existir):
- `supabase/functions/_shared/baselinker.ts`
- `supabase/functions/_shared/workspace-config.ts`
- `supabase/functions/_shared/message-templates.ts`

---

## ✅ Verificar se Deploy Funcionou

### **Teste validate-whatsapp-number:**

```bash
curl -X POST \
  'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/validate-whatsapp-number' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "5527999999999",
    "instanceId": "uuid-da-instancia"
  }'
```

**Resposta esperada**:
```json
{
  "exists": true,
  "name": "Nome do WhatsApp",
  "phone": "5527999999999",
  "verified": true
}
```

---

### **Teste process-order-created:**

**Forma 1: Simular evento do Baselinker**
```bash
curl -X POST \
  'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/process-order-created' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "event": {
      "order_id": "123456",
      "workspace_id": "uuid-do-workspace"
    }
  }'
```

**Forma 2: Verificar logs no Dashboard**
1. Edge Functions → process-order-created → Logs
2. Verificar se não há erros de import/syntax

---

## 🔧 Troubleshooting

### **Erro: "Cannot find module"**

**Causa**: Faltam arquivos auxiliares (validate-client-data.ts, shared/*.ts)

**Solução**:
1. Verificar se todos os arquivos estão no diretório correto
2. Se usar Dashboard, pode precisar copiar todo o código em um único arquivo
3. Ou usar CLI com Docker

---

### **Erro: "Function not found"**

**Causa**: Deploy não foi feito corretamente

**Solução**:
1. Verificar em Edge Functions do Dashboard se a função aparece
2. Verificar se status está "Active"
3. Tentar redeployar

---

### **Erro ao executar: "Invalid instanceId"**

**Causa**: Instância WhatsApp não encontrada ou inativa

**Solução**:
1. Verificar se há instância WhatsApp conectada
2. Verificar se `whatsapp_instances.id` é válido
3. Verificar se `status = 'connected'`

---

## 📝 Notas Importantes

### **Variáveis de Ambiente**

As Edge Functions têm acesso automático a:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

Não precisa configurar nada extra!

### **Permissões**

As funções já estão configuradas para:
- ✅ Acessar `auth.users` (via SECURITY DEFINER)
- ✅ Acessar tabelas `public.*`
- ✅ Fazer chamadas HTTP externas (GhostAPI, Evolution API)

---

## 🎯 Ordem de Deploy

**IMPORTANTE**: Deploy na ordem correta!

1. ✅ **Primeiro**: `validate-whatsapp-number`
   - Não tem dependências

2. ✅ **Segundo**: `process-order-created`
   - Depende de `validate-whatsapp-number`
   - Depende de arquivos `_shared`

---

## 📊 Status Atual

- [ ] `validate-whatsapp-number` deployada
- [ ] `process-order-created` deployada e atualizada
- [ ] Testes executados com sucesso
- [ ] Logs verificados sem erros

---

## 🔗 Links Úteis

- **Dashboard Edge Functions**: https://supabase.com/dashboard/project/oqwstanztqdiexgrpdta/functions
- **Documentação Supabase Edge Functions**: https://supabase.com/docs/guides/functions
- **Logs em Tempo Real**: Dashboard → Edge Functions → [Nome da função] → Logs

---

**Criado por**: Claude Code
**Data**: 08/01/2026
**Status**: ⚠️ Aguardando deploy manual
