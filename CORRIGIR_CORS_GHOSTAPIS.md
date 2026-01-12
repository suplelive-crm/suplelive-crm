# Correção do Erro CORS: GhostAPIs

## 🔴 Problema Identificado

O navegador está bloqueando requisições diretas para a API GhostAPIs devido à política CORS:

```
Access to fetch at 'https://ghostapis.com/api.php?token=...'
from origin 'http://localhost:5173' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### Por que acontece?

- **CORS (Cross-Origin Resource Sharing)** é uma proteção do navegador
- A API GhostAPIs não permite requisições diretas de aplicações web (apenas server-side)
- O frontend está tentando fazer `fetch()` direto para `ghostapis.com`

---

## ✅ Solução Implementada

Criamos uma **Edge Function no Supabase** que atua como proxy:
- Frontend chama a Edge Function (mesma origem, sem CORS)
- Edge Function faz a requisição para GhostAPIs (server-side, sem restrição)
- Edge Function retorna os dados para o frontend

```
Frontend → Supabase Edge Function → GhostAPIs
         (sem CORS)              (sem CORS)
```

---

## 📁 Arquivos Criados/Alterados

### 1. ✅ Edge Function: `ghostapis-proxy`

**Arquivo**: [supabase/functions/ghostapis-proxy/index.ts](supabase/functions/ghostapis-proxy/index.ts)

**O que faz**:
- Recebe requisição do frontend com parâmetros
- Busca token do GhostAPIs nas configurações do workspace
- Faz requisição para GhostAPIs
- Retorna resposta para o frontend

### 2. ✅ Cliente TypeScript: `ghostapis-api.ts`

**Arquivo**: [src/lib/ghostapis-api.ts](src/lib/ghostapis-api.ts)

**Funções disponíveis**:
- `fetchClientDataByCPF(cpf, workspaceId)` - Busca dados por CPF
- `fetchClientDataByPhone(telefone, workspaceId)` - Busca dados por telefone
- `checkGhostAPIsBalance(workspaceId)` - Verifica saldo (TODO)

### 3. ✅ baselinkerStore.ts atualizado

- Removida função antiga `fetchClientDataByCPF` (com fetch direto)
- Importada nova função do `ghostapis-api.ts`
- Mesma funcionalidade, mas sem CORS

---

## 🚀 Como Fazer o Deploy

### **Passo 1: Fazer Deploy da Edge Function**

No terminal, execute:

```bash
npx supabase functions deploy ghostapis-proxy
```

**Resultado esperado**:
```
Deploying function ghostapis-proxy...
✓ Deployed function ghostapis-proxy successfully
Function URL: https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/ghostapis-proxy
```

### **Passo 2: Configurar Token no Workspace**

O token do GhostAPIs precisa estar salvo nas configurações do workspace.

**Opção 1: Via Interface (Recomendado)**

1. Vá para **Integrações** no menu
2. Configure o GhostAPIs
3. Cole o token: `e83b734c357cfc9d5a2cae5eac2a6161`
4. Salve

**Opção 2: Via SQL (Direto no Supabase)**

```sql
-- Atualizar workspace com token do GhostAPIs
UPDATE workspaces
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{ghostapis}',
  '{"token": "e83b734c357cfc9d5a2cae5eac2a6161", "enabled": true}'::jsonb
)
WHERE id = 'seu-workspace-id-aqui';
```

### **Passo 3: Testar a Integração**

1. **Recarregue a aplicação** (Ctrl+R)
2. **Sincronize pedidos do Baselinker**
3. **Observe o console**:

```
[GHOST API] Buscando dados do CPF: 03280310709
[GHOSTAPIS PROXY] Endpoint: cpf, Params: { cpf2: '03280310709' }
[GHOSTAPIS PROXY] Request URL: https://ghostapis.com/api.php?token=e83b...&cpf2=03280310709
[GHOSTAPIS PROXY] Response: { 'response.NOME': 'João Silva', ... }
[GHOST API] ✅ Dados encontrados: { nome: 'João Silva', email: '...', telefone: '+5511999999999' }
```

---

## 🧪 Teste Manual da Edge Function

Você pode testar a Edge Function diretamente via `curl`:

```bash
curl -X POST \
  'https://oqwstanztqdiexgrpdta.supabase.co/functions/v1/ghostapis-proxy' \
  -H 'Authorization: Bearer SEU_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "endpoint": "cpf",
    "params": {
      "cpf2": "03280310709"
    },
    "workspaceId": "ec73946f-ec8f-41f0-92a6-b26a40c8262c"
  }'
```

**Resposta esperada**:
```json
{
  "response.NOME": "Nome do Cliente",
  "response.EMAIL": "email@exemplo.com",
  "response.TELEFONES": "11999999999, 11888888888",
  ...
}
```

---

## 📊 Informações do Seu Token

**API**: TELEFONE
**Token**: `e83b734c357cfc9d5a2cae5eac2a6161`
**Requisições/dia**: 4000
**Validade**: 31 dias (expira em 2026-02-12)
**URL de teste**: `https://ghostapis.com/api.php?token=e83b734c357cfc9d5a2cae5eac2a6161&telefone4=11999999999`
**URL de saldo**: `https://ghostapis.com/info.php?token=e83b734c357cfc9d5a2cae5eac2a6161`

---

## 🔐 Segurança

### ✅ Boas Práticas Implementadas:

1. **Token não exposto no frontend**
   - Token fica apenas no banco de dados (workspace.settings)
   - Edge Function busca token usando Service Role Key

2. **Requisições autenticadas**
   - Edge Function valida workspace antes de buscar token
   - Apenas usuários autenticados podem chamar a função

3. **CORS configurado**
   - Edge Function permite requisições do frontend
   - Headers CORS configurados corretamente

### ⚠️ Token Padrão Antigo Removido

O token antigo (`aa21949b4c1804624d6a3a36253eeaad`) que estava hardcoded no código foi removido. Agora o sistema **sempre** busca o token das configurações do workspace.

---

## 🆘 Troubleshooting

### Erro: "Token GhostAPIs não configurado no workspace"

**Causa**: O workspace não tem o token salvo.

**Solução**:
1. Vá em Integrações
2. Configure o GhostAPIs com o token `e83b734c357cfc9d5a2cae5eac2a6161`
3. Salve

### Erro: "Failed to invoke function"

**Causa**: Edge Function não foi deployada ou tem erro.

**Solução**:
1. Execute: `npx supabase functions deploy ghostapis-proxy`
2. Verifique logs: `npx supabase functions logs ghostapis-proxy`

### Erro: "CORS policy" ainda aparece

**Causa**: O código antigo ainda está sendo usado (cache do navegador).

**Solução**:
1. Limpe o cache do navegador (Ctrl+Shift+Delete)
2. Hard reload (Ctrl+Shift+R)
3. Verifique se o import está correto no `baselinkerStore.ts`

### Erro HTTP 401/403 da GhostAPIs

**Causa**: Token inválido ou expirado.

**Solução**:
1. Verifique a validade do token (expira em 2026-02-12)
2. Teste manualmente: `https://ghostapis.com/info.php?token=e83b734c357cfc9d5a2cae5eac2a6161`
3. Se expirou, renove na GhostAPIs e atualize no workspace

---

## 📈 Próximos Passos (Opcional)

### 1. Implementar verificação de saldo

Adicionar endpoint no proxy para chamar `info.php`:

```typescript
// No ghostapis-proxy/index.ts
if (endpoint === 'balance') {
  const url = `https://ghostapis.com/info.php?token=${token}`
  // ...
}
```

### 2. Cache de respostas

Implementar cache no Supabase para reduzir chamadas à API:

```sql
CREATE TABLE ghostapis_cache (
  cpf TEXT PRIMARY KEY,
  data JSONB,
  cached_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Rate limiting

Adicionar controle de requisições para não exceder limite diário:

```sql
CREATE TABLE ghostapis_usage (
  workspace_id UUID,
  date DATE,
  requests_count INTEGER DEFAULT 0,
  PRIMARY KEY (workspace_id, date)
);
```

---

## ✅ Checklist de Deploy

- [ ] Deploy da Edge Function realizado
- [ ] Token configurado no workspace
- [ ] Teste de sincronização executado
- [ ] Logs verificados (sem erro CORS)
- [ ] Cliente encontrado via CPF/telefone

---

## 🎯 Status

- ✅ Edge Function criada
- ✅ Cliente TypeScript criado
- ✅ baselinkerStore.ts atualizado
- ⏳ **Aguardando deploy da função**
- ⏳ Configuração do token no workspace

---

## 📝 Comandos Úteis

```bash
# Deploy da função
npx supabase functions deploy ghostapis-proxy

# Ver logs da função (em tempo real)
npx supabase functions logs ghostapis-proxy --tail

# Testar localmente
npx supabase functions serve ghostapis-proxy
```
